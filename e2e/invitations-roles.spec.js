const { test, expect } = require('playwright/test');

async function registerAndLogin(page, email, password = 'Test123!a') {
    await page.goto('/register');
    await page.fill('#useremail', email);
    await page.fill('#firstname', 'E2E');
    await page.fill('#lastname', 'User');
    await page.fill('#userpassword', password);
    await page.fill('#userpasswordconfirm', password);
    await page.click('form.needs-validation button[type="submit"]');
    await page.waitForURL('**/login', { timeout: 15000 });
    await page.fill('#email', email);
    await page.fill('form.form-horizontal input[type="password"]', password);
    await page.click('form.form-horizontal button[type="submit"]');
    await page.waitForURL('**/groups', { timeout: 15000 });
}

async function createGroup(page, name) {
    await page.fill('#groupName', name);
    await page.selectOption('#groupCurrency', 'USD');
    await page.click('#createGroupForm button[type="submit"]');
    await page.waitForURL('**/dashboard?groupId=*', { timeout: 15000 });
    return new URL(page.url()).searchParams.get('groupId');
}

async function navigateToMembers(page, groupId) {
    await page.goto(`/group-details?groupId=${groupId}#members`);
    await page.waitForSelector('#members:not(.d-none)', { timeout: 10000 });
    // O form de convite fica dentro de um Bootstrap collapse — precisa abrir
    await page.click('#inviteMemberBtn');
    await page.waitForSelector('#inviteEmail', { state: 'visible', timeout: 10000 });
}

// ─── Convites ────────────────────────────────────────────────────────────────

test('convites: owner cria convite e membro aceita', async ({ browser }) => {
    test.setTimeout(120000);
    const ts = Date.now();
    const ownerEmail = `e2e.owner.${ts}@example.com`;
    const memberEmail = `e2e.member.${ts}@example.com`;

    const ownerCtx = await browser.newContext();
    const memberCtx = await browser.newContext();
    const ownerPage = await ownerCtx.newPage();
    const memberPage = await memberCtx.newPage();

    await registerAndLogin(ownerPage, ownerEmail);
    const groupId = await createGroup(ownerPage, `Invite Trip ${ts}`);

    await navigateToMembers(ownerPage, groupId);
    await ownerPage.fill('#inviteEmail', memberEmail);
    await ownerPage.selectOption('#inviteRole', 'member');
    await ownerPage.click('#inviteForm button[type="submit"]');
    await ownerPage.waitForTimeout(1000);

    // Busca token via fetch no contexto autenticado do browser
    // Lê o link gerado exibido na UI após envio
    await ownerPage.waitForSelector('#inviteLinkInput', { state: 'visible', timeout: 10000 });
    const inviteUrl = await ownerPage.inputValue('#inviteLinkInput');
    expect(inviteUrl).toBeTruthy();
    const token = new URL(inviteUrl).searchParams.get('token');
    expect(token).toBeTruthy();

    // Membro registra e aceita
    await registerAndLogin(memberPage, memberEmail);
    await memberPage.goto(`/invite?token=${token}`);
    await memberPage.waitForSelector('#acceptBtn', { state: 'visible', timeout: 15000 });
    await memberPage.click('#acceptBtn');
    await memberPage.waitForSelector('#successState:not(.d-none)', { timeout: 15000 });

    await memberPage.goto('/groups');
    await expect(memberPage.locator('#groupList')).toContainText(`Invite Trip ${ts}`, { timeout: 10000 });

    await ownerCtx.close();
    await memberCtx.close();
});

// ─── Roles ────────────────────────────────────────────────────────────────────

test('roles: viewer não pode criar despesa nem família', async ({ browser }) => {
    test.setTimeout(120000);
    const ts = Date.now();
    const ownerEmail = `e2e.owner2.${ts}@example.com`;
    const viewerEmail = `e2e.viewer.${ts}@example.com`;

    const ownerCtx = await browser.newContext();
    const viewerCtx = await browser.newContext();
    const ownerPage = await ownerCtx.newPage();
    const viewerPage = await viewerCtx.newPage();

    await registerAndLogin(ownerPage, ownerEmail);
    const groupId = await createGroup(ownerPage, `Roles Trip ${ts}`);

    await navigateToMembers(ownerPage, groupId);
    await ownerPage.fill('#inviteEmail', viewerEmail);
    await ownerPage.selectOption('#inviteRole', 'viewer');
    await ownerPage.click('#inviteForm button[type="submit"]');
    await ownerPage.waitForTimeout(1000);

    // Lê o link gerado exibido na UI após envio
    await ownerPage.waitForSelector('#inviteLinkInput', { state: 'visible', timeout: 10000 });
    const inviteUrl = await ownerPage.inputValue('#inviteLinkInput');
    expect(inviteUrl).toBeTruthy();
    const token = new URL(inviteUrl).searchParams.get('token');
    expect(token).toBeTruthy();

    await registerAndLogin(viewerPage, viewerEmail);
    await viewerPage.goto(`/invite?token=${token}`);
    await viewerPage.waitForSelector('#acceptBtn', { state: 'visible', timeout: 15000 });
    await viewerPage.click('#acceptBtn');
    await viewerPage.waitForSelector('#successState:not(.d-none)', { timeout: 15000 });

    // Viewer acessa participants — botões devem estar desabilitados
    await viewerPage.goto(`/group-details?groupId=${groupId}#participants`);
    await viewerPage.waitForSelector('#participants:not(.d-none)', { timeout: 10000 });
    await expect(viewerPage.locator('#familyForm button[type="submit"]')).toBeDisabled({ timeout: 5000 });
    await expect(viewerPage.locator('#participantForm button[type="submit"]')).toBeDisabled({ timeout: 5000 });

    // Viewer acessa expenses — botão de abrir modal deve estar desabilitado
    await viewerPage.goto(`/group-details?groupId=${groupId}#expenses`);
    await viewerPage.waitForSelector('#expenses:not(.d-none)', { timeout: 10000 });
    await expect(viewerPage.locator('#openExpenseModal')).toBeDisabled({ timeout: 5000 });

    await ownerCtx.close();
    await viewerCtx.close();
});

test('roles: member pode criar despesa', async ({ browser }) => {
    test.setTimeout(120000);
    const ts = Date.now();
    const ownerEmail = `e2e.owner3.${ts}@example.com`;
    const memberEmail = `e2e.member2.${ts}@example.com`;

    const ownerCtx = await browser.newContext();
    const memberCtx = await browser.newContext();
    const ownerPage = await ownerCtx.newPage();
    const memberPage = await memberCtx.newPage();

    await registerAndLogin(ownerPage, ownerEmail);
    const groupId = await createGroup(ownerPage, `Member Trip ${ts}`);

    // Cria participante para o split
    await ownerPage.goto(`/group-details?groupId=${groupId}#participants`);
    await ownerPage.waitForSelector('#participantName', { state: 'visible', timeout: 10000 });
    await ownerPage.fill('#participantName', 'Alice');
    await ownerPage.selectOption('#participantType', 'adult');
    await ownerPage.click('#participantForm button[type="submit"]');
    await ownerPage.waitForTimeout(800);

    await navigateToMembers(ownerPage, groupId);
    await ownerPage.fill('#inviteEmail', memberEmail);
    await ownerPage.selectOption('#inviteRole', 'member');
    await ownerPage.click('#inviteForm button[type="submit"]');
    await ownerPage.waitForTimeout(1000);

    // Lê o link gerado exibido na UI após envio
    await ownerPage.waitForSelector('#inviteLinkInput', { state: 'visible', timeout: 10000 });
    const inviteUrl = await ownerPage.inputValue('#inviteLinkInput');
    expect(inviteUrl).toBeTruthy();
    const token = new URL(inviteUrl).searchParams.get('token');
    expect(token).toBeTruthy();

    await registerAndLogin(memberPage, memberEmail);
    await memberPage.goto(`/invite?token=${token}`);
    await memberPage.waitForSelector('#acceptBtn', { state: 'visible', timeout: 15000 });
    await memberPage.click('#acceptBtn');
    await memberPage.waitForSelector('#successState:not(.d-none)', { timeout: 15000 });

    // Member acessa expenses — botão deve estar habilitado
    await memberPage.goto(`/group-details?groupId=${groupId}#expenses`);
    await memberPage.waitForSelector('#expenses:not(.d-none)', { timeout: 10000 });
    await expect(memberPage.locator('#openExpenseModal')).toBeEnabled({ timeout: 5000 });

    await ownerCtx.close();
    await memberCtx.close();
});
