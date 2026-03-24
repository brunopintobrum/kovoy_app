const { test, expect } = require('playwright/test');
const fs = require('fs');
const path = require('path');

test('export and import CSV expenses', async ({ page }) => {
    test.setTimeout(120000); // 2-minute timeout for complex test
    const timestamp = Date.now();
    const email = `e2e.csv.${timestamp}@example.com`;
    const password = 'Test123!a';

    // Register and login
    await page.goto('/register');
    console.log('Filled email field with:', email);
    await page.fill('#useremail', email);
    await page.fill('#firstname', 'CSV');
    await page.fill('#lastname', 'Tester');
    await page.fill('#userpassword', password);
    await page.fill('#userpasswordconfirm', password);

    // Check if form has validation errors
    const errors = await page.locator('.invalid-feedback').allTextContents();
    console.log('Form validation errors:', errors);

    console.log('Clicking registration submit button...');
    await page.click('form.needs-validation button[type="submit"]');
    // Wait for navigation to complete - will redirect to /login or /email-verification
    console.log('Waiting for page to load...');
    // Handle both possible redirect paths
    try {
        await page.waitForURL('**/email-verification*', { timeout: 3000 });
    } catch {
        // If not email-verification, expect login
        await page.waitForURL('**/login*', { timeout: 3000 });
    }
    console.log('Current URL after registration:', page.url());

    // If on email-verification page, navigate to login instead
    if (page.url().includes('email-verification')) {
        console.log('On email-verification page, navigating to login...');
        await page.goto('/login', { waitUntil: 'networkidle' });
    }
    console.log('On login page');

    // Fill login form
    console.log('Filling credentials...');
    await page.fill('#email', email);
    await page.fill('form.form-horizontal input[type="password"]', password);
    console.log('Submitting login form...');
    await page.click('form.form-horizontal button[type="submit"]');
    await page.waitForURL('**/groups', { timeout: 15000 });
    console.log('✓ Logged in successfully');

    // Create group
    await page.fill('#groupName', 'CSV Test Group');
    await page.selectOption('#groupCurrency', 'USD');
    await page.click('#createGroupForm button[type="submit"]');
    await page.waitForURL('**/dashboard?groupId=*', { timeout: 15000 });

    const dashboardUrl = new URL(page.url());
    const groupId = dashboardUrl.searchParams.get('groupId');

    // Create family and participants
    await page.goto(`/group-details?groupId=${groupId}#participants`);
    await page.fill('#familyName', 'TestFamily');
    await page.click('#familyForm button[type="submit"]');
    await page.waitForTimeout(1000);

    await page.fill('#participantName', 'Alice');
    await page.selectOption('#participantType', 'adult');
    await page.selectOption('#participantFamily', { label: 'TestFamily' });
    await page.click('#participantForm button[type="submit"]');
    await page.waitForTimeout(1000);

    await page.fill('#participantName', 'Bob');
    await page.selectOption('#participantType', 'adult');
    await page.selectOption('#participantFamily', { label: 'TestFamily' });
    await page.click('#participantForm button[type="submit"]');
    await page.waitForTimeout(1000);

    // Add expenses
    await page.goto(`/group-details?groupId=${groupId}#expenses`);
    await page.click('#openExpenseModal');
    await page.waitForSelector('#expenseDescription', { state: 'visible', timeout: 10000 });

    await page.fill('#expenseDescription', 'Hotel');
    await page.fill('#expenseAmount', '200');
    await page.fill('#expenseDate', '2026-04-23');
    await page.selectOption('#expenseCurrency', 'USD');
    await page.fill('#expenseCategory', 'Accommodation');
    await page.selectOption('#expensePayer', { label: 'Alice' });
    await page.check('#splitModeEqual');
    await page.waitForTimeout(500);
    await page.locator('#splitTargets label', { hasText: 'Alice' }).locator('input').check();
    await page.locator('#splitTargets label', { hasText: 'Bob' }).locator('input').check();
    await page.click('#expenseSubmit');
    await page.waitForTimeout(2000);

    // Test CSV Export
    console.log('Testing CSV export...');
    await page.goto(`/dashboard?groupId=${groupId}`);

    // Wait for export button and trigger download
    const downloadPromise = page.waitForEvent('download');
    await page.click('#megaExportCsvBtn');
    const download = await downloadPromise;

    const csvPath = path.join('/tmp', `group-${groupId}.csv`);
    await download.saveAs(csvPath);

    // Verify CSV content
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    expect(csvContent).toContain('Hotel');
    expect(csvContent).toContain('200');
    expect(csvContent).toContain('Alice');
    expect(csvContent).toContain('Accommodation');
    console.log('✓ CSV export successful');

    // Test JSON Export
    console.log('Testing JSON export...');
    const jsonDownloadPromise = page.waitForEvent('download');
    await page.click('#megaExportJsonBtn');
    const jsonDownload = await jsonDownloadPromise;

    const jsonPath = path.join('/tmp', `group-backup-${groupId}.json`);
    await jsonDownload.saveAs(jsonPath);

    // Verify JSON content
    const jsonContent = fs.readFileSync(jsonPath, 'utf-8');
    const jsonData = JSON.parse(jsonContent);
    expect(jsonData.group).toBeDefined();
    expect(jsonData.participants).toBeDefined();
    expect(jsonData.expenses).toBeDefined();
    expect(jsonData.expenses.length).toBeGreaterThan(0);
    console.log('✓ JSON export successful');

    // Test CSV Import
    console.log('Testing CSV import...');

    // Create a test CSV file to import
    const importCsvPath = path.join(process.env.TMP || require('os').tmpdir(), 'test-import.csv');
    const importCsvContent = `date,description,amount,currency,payer,category,participant,split_amount,notes
2026-04-24,Dinner,60.00,USD,Alice,Dining,Alice,30.00,Restaurant
2026-04-24,Dinner,60.00,USD,Alice,Dining,Bob,30.00,Restaurant`;

    fs.writeFileSync(importCsvPath, importCsvContent);
    console.log(`Created CSV file at: ${importCsvPath}`);

    // Use file input to upload CSV
    const fileInput = await page.$('#csvFileInput');
    if (!fileInput) {
        console.log('Error: #csvFileInput not found');
    }
    await fileInput.setInputFiles(importCsvPath);

    // Wait for import to complete and modal to appear
    await page.waitForSelector('#importResultModal', { state: 'visible', timeout: 15000 });

    // Check import result
    const resultText = await page.locator('#importResultText').textContent();
    expect(resultText).toContain('imported');
    console.log(`✓ CSV import successful: ${resultText}`);

    // Verify expenses were imported
    // Try to close the modal if it's still visible
    const closeBtn = await page.$('[data-bs-dismiss="modal"]');
    if (closeBtn) {
        try {
            await page.click('[data-bs-dismiss="modal"]', { timeout: 5000 });
        } catch (e) {
            console.log('Modal close button not visible, continuing...');
        }
    }

    // Wait for modal to close or navigate directly
    await page.waitForTimeout(1000);
    await page.goto(`/group-details?groupId=${groupId}#expenses`);

    // Check that the Dinner expense is now visible
    await expect(page.locator('#expenseList')).toContainText('Dinner', { timeout: 10000 });
    console.log('✓ Imported expenses are visible in the list');
});
