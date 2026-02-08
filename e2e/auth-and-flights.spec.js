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

    // Aguarda redirecionamento após registro
    await page.waitForURL('**/login', { timeout: 15000 });
    await page.fill('#email', email);
    await page.fill('form.form-horizontal input[type="password"]', password);
    await page.click('form.form-horizontal button[type="submit"]');

    // Aguarda login e redirecionamento
    await page.waitForURL('**/groups', { timeout: 15000 });

    await page.fill('#groupName', 'E2E Trip Group');
    await page.selectOption('#groupCurrency', 'USD');
    await page.click('#createGroupForm button[type="submit"]');

    // Aguarda criação do grupo e redirecionamento
    await page.waitForURL('**/dashboard?groupId=*', { timeout: 15000 });
    await expect(page.locator('#groupName')).toContainText('E2E Trip Group');

    const dashboardUrl = new URL(page.url());
    const groupId = dashboardUrl.searchParams.get('groupId');
    await page.goto(`/group-details?groupId=${groupId}#participants`);

    await page.fill('#familyName', 'Silva');
    await page.click('#familyForm button[type="submit"]');
    // Aguarda família ser criada e aparecer na lista
    await page.waitForTimeout(1000);
    await expect(page.locator('#familyList')).toContainText('Silva');

    await page.fill('#participantName', 'Bruno');
    await page.selectOption('#participantType', 'adult');
    await page.selectOption('#participantFamily', { label: 'Silva' });
    await page.click('#participantForm button[type="submit"]');
    // Aguarda participante ser criado e aparecer na lista
    await page.waitForTimeout(1000);
    await expect(page.locator('#participantList')).toContainText('Bruno');

    await page.goto(`/group-details?groupId=${groupId}#expenses`);

    // Abre o modal de adicionar despesa
    await page.click('#openExpenseModal');
    // Aguarda modal abrir e campo estar visível
    await page.waitForSelector('#expenseDescription', { state: 'visible', timeout: 10000 });
    await page.fill('#expenseDescription', 'Airbnb');
    await page.fill('#expenseAmount', '120');
    await page.fill('#expenseDate', '2026-02-22');
    await page.selectOption('#expenseCurrency', 'USD'); // Campo que estava faltando!
    await page.fill('#expenseCategory', 'Lodging');
    await page.selectOption('#expensePayer', { label: 'Bruno' });

    // Garante que split mode é "equal" (dividir igualmente)
    await page.check('#splitModeEqual');
    // Pequeno delay para garantir que UI atualizou
    await page.waitForTimeout(500);

    // Marca Bruno para receber o split
    await page.locator('#splitTargets label', { hasText: 'Bruno' }).locator('input').check();
    // Aguarda checkbox estar marcado
    await page.waitForTimeout(500);

    // Captura screenshot antes do submit
    await page.screenshot({ path: 'test-results/before-submit.png' });

    // Usa o botão do footer do modal (mais confiável)
    await page.click('#expenseSubmit');

    // Aguarda despesa ser processada (modal pode demorar a fechar)
    await page.waitForTimeout(3000);

    // Captura screenshot após submit
    await page.screenshot({ path: 'test-results/after-submit.png' });

    // Verifica se há mensagens de erro visíveis
    const errorMsg = await page.locator('.invalid-feedback:visible, .alert-danger:visible, #splitTargetsError:visible').textContent().catch(() => 'No error visible');
    console.log('Error messages:', errorMsg);

    await expect(page.locator('#expenseList')).toContainText('Airbnb');
    await expect(page.locator('#summaryTotal')).toContainText('$120.00');
});
