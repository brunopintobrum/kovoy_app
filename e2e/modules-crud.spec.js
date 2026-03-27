const { test, expect } = require('playwright/test');

// ─── Helpers ────────────────────────────────────────────────────────────────

async function registerAndLogin(page, email, password = 'Test123!a') {
    await page.goto('/register');
    await page.fill('#useremail', email);
    await page.fill('#firstname', 'E2E');
    await page.fill('#lastname', 'Modules');
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

async function createParticipant(page, groupId, name) {
    await page.goto(`/group-details?groupId=${groupId}#participants`);
    await page.waitForSelector('#participantName', { state: 'visible', timeout: 10000 });
    await page.fill('#participantName', name);
    await page.selectOption('#participantType', 'adult');
    await page.click('#participantForm button[type="submit"]');
    await page.waitForTimeout(800);
    await expect(page.locator('#participantList')).toContainText(name, { timeout: 5000 });
}

// ─── Hospedagens CRUD ────────────────────────────────────────────────────────

test('hospedagens: criar e deletar', async ({ page }) => {
    test.setTimeout(90000);
    const ts = Date.now();
    await registerAndLogin(page, `e2e.lodging.${ts}@example.com`);
    const groupId = await createGroup(page, `Lodging Trip ${ts}`);

    await page.goto(`/group-details?groupId=${groupId}#lodgings`);
    await page.waitForSelector('#openLodgingModal', { state: 'visible', timeout: 10000 });
    await page.click('#openLodgingModal');
    await page.waitForSelector('#lodgingName', { state: 'visible', timeout: 10000 });
    await page.waitForTimeout(500);

    await page.fill('#lodgingName', 'Disney Resort');
    await page.fill('#lodgingAddress', '1 Disney Way');
    await page.selectOption('#lodgingCountry', { index: 1 });
    await page.fill('#lodgingCity', 'Orlando');
    await page.fill('#lodgingCheckIn', '2026-07-01');
    await page.fill('#lodgingCheckInTime', '15:00');
    await page.fill('#lodgingCheckOut', '2026-07-08');
    await page.fill('#lodgingCheckOutTime', '11:00');
    await page.selectOption('#lodgingStatus', 'planned');
    await page.fill('#lodgingCost', '700');
    await page.selectOption('#lodgingCurrency', 'USD');
    await page.fill('#lodgingRoomType', 'Double');
    await page.fill('#lodgingRoomQuantity', '1');
    await page.fill('#lodgingRoomOccupancy', '2');
    await page.fill('#lodgingContact', 'reception@disney.com');

    await page.click('#lodgingSubmit');
    await page.waitForTimeout(2000);
    await expect(page.locator('#lodgingList')).toContainText('Disney Resort', { timeout: 15000 });

    await page.locator('[data-action="delete-lodging"]').first().click();
    await page.waitForSelector('#confirmDeleteBtn', { state: 'visible', timeout: 5000 });
    await page.click('#confirmDeleteBtn');
    await page.waitForTimeout(1000);
    await expect(page.locator('#lodgingList')).not.toContainText('Disney Resort', { timeout: 10000 });
});

// ─── Transportes CRUD ────────────────────────────────────────────────────────

test('transportes: criar e deletar', async ({ page }) => {
    test.setTimeout(90000);
    const ts = Date.now();
    await registerAndLogin(page, `e2e.transport.${ts}@example.com`);
    const groupId = await createGroup(page, `Transport Trip ${ts}`);

    await page.goto(`/group-details?groupId=${groupId}#transports`);
    await page.waitForSelector('#openTransportModal', { state: 'visible', timeout: 10000 });
    await page.click('#openTransportModal');
    await page.waitForSelector('#transportType', { state: 'visible', timeout: 10000 });
    await page.waitForTimeout(500);

    await page.fill('#transportType', 'Bus');
    await page.selectOption('#transportStatus', 'planned');
    await page.fill('#transportOrigin', 'GRU Airport');
    await page.fill('#transportDestination', 'MCO Airport');
    await page.fill('#transportDepart', '2026-07-01T10:00');
    await page.fill('#transportArrive', '2026-07-01T14:00');
    await page.fill('#transportAmount', '50');
    await page.selectOption('#transportCurrency', 'USD');

    await page.click('#transportSubmit');
    await page.waitForTimeout(2000);
    await expect(page.locator('#transportList')).toContainText('GRU Airport', { timeout: 15000 });

    await page.locator('[data-action="delete-transport"]').first().click();
    await page.waitForSelector('#confirmDeleteBtn', { state: 'visible', timeout: 5000 });
    await page.click('#confirmDeleteBtn');
    await page.waitForTimeout(1000);
    await expect(page.locator('#transportList')).not.toContainText('GRU Airport', { timeout: 10000 });
});

// ─── Tickets CRUD ────────────────────────────────────────────────────────────

test('tickets: criar e deletar', async ({ page }) => {
    test.setTimeout(90000);
    const ts = Date.now();
    await registerAndLogin(page, `e2e.ticket.${ts}@example.com`);
    const groupId = await createGroup(page, `Ticket Trip ${ts}`);
    await createParticipant(page, groupId, 'Ana');

    await page.goto(`/group-details?groupId=${groupId}#tickets`);
    await page.waitForSelector('#openTicketModal', { state: 'visible', timeout: 10000 });
    await page.click('#openTicketModal');
    await page.waitForSelector('#ticketType', { state: 'visible', timeout: 10000 });
    await page.waitForTimeout(500);

    await page.fill('#ticketType', 'Park');
    await page.fill('#ticketEventAt', '2026-07-03T09:00');
    await page.fill('#ticketLocation', 'Magic Kingdom');
    await page.selectOption('#ticketStatus', 'planned');
    await page.fill('#ticketAmount', '120');
    await page.selectOption('#ticketCurrency', 'USD');
    await page.selectOption('#ticketParticipants', { index: 0 });

    await page.click('#ticketSubmit');
    await page.waitForTimeout(2000);
    await expect(page.locator('#ticketList')).toContainText('Magic Kingdom', { timeout: 15000 });

    await page.locator('[data-action="delete-ticket"]').first().click();
    await page.waitForSelector('#confirmDeleteBtn', { state: 'visible', timeout: 5000 });
    await page.click('#confirmDeleteBtn');
    await page.waitForTimeout(1000);
    await expect(page.locator('#ticketList')).not.toContainText('Magic Kingdom', { timeout: 10000 });
});
