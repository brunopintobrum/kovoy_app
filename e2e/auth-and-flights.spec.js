const { test, expect } = require('playwright/test');

test('register, login, and add a flight', async ({ page }) => {
    const timestamp = Date.now();
    const email = `e2e.user.${timestamp}@example.com`;
    const password = 'Test123!a';

    await page.goto('/register');
    await page.fill('#useremail', email);
    await page.fill('#firstname', 'E2E');
    await page.fill('#lastname', 'User');
    await page.fill('#userpassword', password);
    await page.fill('#userpasswordconfirm', password);
    await page.click('form.needs-validation button[type="submit"]');

    await page.waitForURL('**/login');
    await page.fill('#email', email);
    await page.fill('form.form-horizontal input[type="password"]', password);
    await page.click('form.form-horizontal button[type="submit"]');

    await page.waitForURL('**/dashboard**');
    await page.goto('/dashboard#voos');
    await page.waitForSelector('#flightForm');

    await page.fill('#flightAirline', 'Air Canada');
    await page.fill('#flightPnr', 'AC1234');
    await page.fill('#flightGroup', 'Family 1');
    await page.fill('#flightCost', '1200');
    await page.selectOption('#flightCurrency', 'CAD');
    await page.fill('#flightFrom', 'YUL');
    await page.fill('#flightTo', 'MCO');
    await page.fill('#flightDepart', '2026-02-22T10:00');
    await page.fill('#flightArrive', '2026-02-22T14:30');
    await page.fill('#flightNotes', 'E2E test flight');
    await page.click('#flightForm button[type="submit"]');

    await expect(page.locator('#flightsList')).toContainText('Air Canada');
});
