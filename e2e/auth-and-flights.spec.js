const { test, expect } = require('playwright/test');

test('register, login, and manage a group', async ({ page }) => {
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

    await page.waitForURL('**/groups');

    await page.fill('#groupName', 'E2E Trip Group');
    await page.selectOption('#groupCurrency', 'USD');
    await page.click('#createGroupForm button[type="submit"]');

    const groupRow = page.locator('#groupRows tr', { hasText: 'E2E Trip Group' });
    await expect(groupRow).toBeVisible();
    await groupRow.locator('a.btn').click();

    await page.waitForURL('**/dashboard?groupId=*');
    await expect(page.locator('#groupName')).toContainText('E2E Trip Group');

    await page.fill('#familyName', 'Silva');
    await page.click('#familyForm button[type="submit"]');
    await expect(page.locator('#familyList')).toContainText('Silva');

    await page.fill('#participantName', 'Bruno');
    await page.selectOption('#participantType', 'adult');
    await page.selectOption('#participantFamily', { label: 'Silva' });
    await page.click('#participantForm button[type="submit"]');
    await expect(page.locator('#participantList')).toContainText('Bruno');

    await page.fill('#expenseDescription', 'Airbnb');
    await page.fill('#expenseAmount', '120');
    await page.fill('#expenseDate', '2026-02-22');
    await page.fill('#expenseCategory', 'Lodging');
    await page.selectOption('#expensePayer', { label: 'Bruno' });

    await page.locator('#splitTargets label', { hasText: 'Bruno' }).locator('input').check();
    await page.click('#expenseForm button[type="submit"]');

    await expect(page.locator('#expenseList')).toContainText('Airbnb');
    await expect(page.locator('#summaryTotal')).toContainText('$120.00');
});
