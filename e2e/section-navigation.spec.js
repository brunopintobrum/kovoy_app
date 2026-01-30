const { test, expect } = require('playwright/test');

test('management sections keep title visible', async ({ page }) => {
    const timestamp = Date.now();
    const email = `e2e.nav.${timestamp}@example.com`;
    const password = 'Test123!a';

    await page.goto('/register');
    await page.fill('#useremail', email);
    await page.fill('#firstname', 'E2E');
    await page.fill('#lastname', 'Nav');
    await page.fill('#userpassword', password);
    await page.fill('#userpasswordconfirm', password);
    await page.click('form.needs-validation button[type="submit"]');

    await page.waitForURL('**/login');
    await page.fill('#email', email);
    await page.fill('form.form-horizontal input[type="password"]', password);
    await page.click('form.form-horizontal button[type="submit"]');

    await page.waitForURL('**/groups');
    await page.fill('#groupName', 'E2E Nav Group');
    await page.selectOption('#groupCurrency', 'USD');
    await page.click('#createGroupForm button[type="submit"]');

    await page.waitForURL('**/dashboard?groupId=*');
    const url = new URL(page.url());
    const groupId = url.searchParams.get('groupId');
    expect(groupId).toBeTruthy();

    await page.goto(`/group-details?groupId=${groupId}#expenses`);
    await expect(page.locator('#pageTitle')).toHaveText('Expenses');
    await page.waitForFunction(() => window.scrollY <= 5);
    await expect(page.locator('#pageTitle')).toBeVisible();

    await page.click('#side-menu a[href="#flights"]');
    await expect(page.locator('#pageTitle')).toHaveText('Flights');
    await page.waitForFunction(() => window.scrollY <= 5);
    await expect(page.locator('#pageTitle')).toBeVisible();

    await page.click('#side-menu a[href="#lodgings"]');
    await expect(page.locator('#pageTitle')).toHaveText('Lodgings');
    await page.waitForFunction(() => window.scrollY <= 5);
    await expect(page.locator('#pageTitle')).toBeVisible();
});
