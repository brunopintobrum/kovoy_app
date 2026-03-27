const { test, expect } = require('playwright/test');

async function registerAndLogin(page, email, password = 'Test123!a') {
    await page.goto('/register');
    await page.fill('#useremail', email);
    await page.fill('#firstname', 'E2E');
    await page.fill('#lastname', 'Sum');
    await page.fill('#userpassword', password);
    await page.fill('#userpasswordconfirm', password);
    await page.click('form.needs-validation button[type="submit"]');
    await page.waitForURL('**/login', { timeout: 15000 });
    await page.fill('#email', email);
    await page.fill('form.form-horizontal input[type="password"]', password);
    await page.click('form.form-horizontal button[type="submit"]');
    await page.waitForURL('**/groups', { timeout: 15000 });
}

test.describe('saldo', () => {
    test('saldo individual exibe totais por participante', async ({ page }) => {
        test.setTimeout(90000);
        const ts = Date.now();
        const email = `e2e.summary.${ts}@example.com`;

        await registerAndLogin(page, email);
        await page.fill('#groupName', `Summary Trip ${ts}`);
        await page.selectOption('#groupCurrency', 'USD');
        await page.click('#createGroupForm button[type="submit"]');
        await page.waitForURL('**/dashboard?groupId=*', { timeout: 15000 });
        const groupId = new URL(page.url()).searchParams.get('groupId');

        // Cria família e dois participantes
        await page.goto(`/group-details?groupId=${groupId}#participants`);
        await page.waitForSelector('#familyName', { state: 'visible', timeout: 10000 });
        await page.fill('#familyName', 'Silva');
        await page.click('#familyForm button[type="submit"]');
        await page.waitForTimeout(800);

        await page.fill('#participantName', 'Ana');
        await page.selectOption('#participantType', 'adult');
        await page.selectOption('#participantFamily', { label: 'Silva' });
        await page.click('#participantForm button[type="submit"]');
        await page.waitForTimeout(800);
        await expect(page.locator('#participantList')).toContainText('Ana', { timeout: 5000 });

        await page.fill('#participantName', 'Bob');
        await page.selectOption('#participantType', 'adult');
        await page.selectOption('#participantFamily', { label: 'Silva' });
        await page.click('#participantForm button[type="submit"]');
        await page.waitForTimeout(800);
        await expect(page.locator('#participantList')).toContainText('Bob', { timeout: 5000 });

        // Cria despesa com split igual entre Ana e Bob
        await page.goto(`/group-details?groupId=${groupId}#expenses`);
        await page.click('#openExpenseModal');
        await page.waitForSelector('#expenseDescription', { state: 'visible', timeout: 10000 });
        await page.fill('#expenseDescription', 'Hotel');
        await page.fill('#expenseAmount', '200');
        await page.fill('#expenseDate', '2026-07-01');
        await page.selectOption('#expenseCurrency', 'USD');
        await page.fill('#expenseCategory', 'Lodging');
        await page.selectOption('#expensePayer', { label: 'Ana' });
        await page.check('#splitModeEqual');
        await page.waitForTimeout(500);
        await page.locator('#splitTargets label', { hasText: 'Ana' }).locator('input').check();
        await page.locator('#splitTargets label', { hasText: 'Bob' }).locator('input').check();
        await page.waitForTimeout(500);
        await page.click('#expenseSubmit');
        await page.waitForTimeout(2000);
        await expect(page.locator('#expenseList')).toContainText('Hotel', { timeout: 10000 });

        // Verifica dashboard mostra total
        await page.goto(`/dashboard?groupId=${groupId}`);
        await page.waitForTimeout(2000);
        await expect(page.locator('#summaryTotal')).toContainText('200', { timeout: 10000 });
    });

    test('modo saldo familiar vs individual no dashboard', async ({ page }) => {
        test.setTimeout(90000);
        const ts = Date.now();
        const email = `e2e.family.${ts}@example.com`;

        await registerAndLogin(page, email);
        await page.fill('#groupName', `Family Mode Trip ${ts}`);
        await page.selectOption('#groupCurrency', 'USD');
        await page.click('#createGroupForm button[type="submit"]');
        await page.waitForURL('**/dashboard?groupId=*', { timeout: 15000 });
        const groupId = new URL(page.url()).searchParams.get('groupId');

        // Cria participante simples
        await page.goto(`/group-details?groupId=${groupId}#participants`);
        await page.waitForSelector('#participantName', { state: 'visible', timeout: 10000 });
        await page.fill('#participantName', 'Carlos');
        await page.selectOption('#participantType', 'adult');
        await page.click('#participantForm button[type="submit"]');
        await page.waitForTimeout(800);

        // Muda modo de saldo familiar via select no dashboard
        await page.goto(`/dashboard?groupId=${groupId}`);
        await page.waitForSelector('#familyBalanceMode', { state: 'visible', timeout: 10000 });

        // Seleciona modo "families"
        await page.selectOption('#familyBalanceMode', 'families');
        await page.waitForTimeout(1000);

        // Seleciona modo "participants"
        await page.selectOption('#familyBalanceMode', 'participants');
        await page.waitForTimeout(1000);

        // Dashboard ainda deve estar visível e funcional
        await expect(page.locator('#summaryTotal')).toBeVisible({ timeout: 5000 });
    });
});
