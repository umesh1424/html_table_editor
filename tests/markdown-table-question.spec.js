const { test, expect } = require('@playwright/test');

test.describe('Quiz Markdown Table Formatting & Table Editor Auto-Population', () => {
  test('Markdown table in question text renders as styled HTML table and auto-loads into Table Editor', async ({ page }) => {
    // Navigate to local demo quiz
    await page.goto('http://localhost:3000/quiz?code=DEMO&name=StudentVerification', { waitUntil: 'domcontentloaded' });

    // Navigate to Question 5 (Excel practical question with the markdown table)
    for (let i = 1; i <= 4; i++) {
      await expect(page.locator('#question-badge')).toHaveText(`Question ${i} of 5`, { timeout: 10000 });
      await page.locator('#next-btn').click();
    }

    // Now on Question 5
    await expect(page.locator('#question-badge')).toHaveText('Question 5 of 5');

    // 1. Verify question text container does NOT show raw pipes or dashes
    const questionTextEl = page.locator('#question-text-display');
    await expect(questionTextEl).toBeVisible();
    await expect(questionTextEl).toContainText('Create an Excel worksheet');

    // 2. Verify the rendered HTML table wrapper exists
    const tableWrap = page.locator('.question-markdown-table-wrap');
    await expect(tableWrap).toBeVisible();

    // Verify table headers
    await expect(tableWrap.locator('th').nth(0)).toHaveText('Student');
    await expect(tableWrap.locator('th').nth(1)).toHaveText('Activity');
    await expect(tableWrap.locator('th').nth(2)).toHaveText('Marks');

    // Verify table rows
    await expect(tableWrap.locator('tbody tr')).toHaveCount(5);
    await expect(tableWrap.locator('tbody tr').nth(0)).toContainText('Reema');
    await expect(tableWrap.locator('tbody tr').nth(0)).toContainText('Drawing');
    await expect(tableWrap.locator('tbody tr').nth(0)).toContainText('93');

    await expect(tableWrap.locator('tbody tr').nth(4)).toContainText('Naina');
    await expect(tableWrap.locator('tbody tr').nth(4)).toContainText('Drawing');
    await expect(tableWrap.locator('tbody tr').nth(4)).toContainText('88');

    // 3. Verify Table Action Toolbar
    const copyBtn = tableWrap.locator('button:has-text("Copy Data")');
    const loadBtn = tableWrap.locator('button:has-text("Load into Table Editor")');
    await expect(copyBtn).toBeVisible();
    await expect(loadBtn).toBeVisible();

    // 4. Test "Load into Table Editor" button
    await loadBtn.click();
    await expect(page.locator('#toast-container')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#toast-container')).toContainText('Table data loaded into Table Editor');

    // 5. Verify the Table Editor fallback textarea has the CSV
    const fallbackTextarea = page.locator('#editor-fallback-textarea-q-demo-excel');
    await expect(fallbackTextarea).toHaveValue(/Reema.*Drawing.*93/);

    // 6. Verify Table Editor iframe is rendered
    const iframe = page.locator('#table-editor-iframe-q-demo-excel');
    await expect(iframe).toBeVisible();

    // Take screenshot of the rendered table and options
    await page.screenshot({ path: 'tests/markdown_table_rendered.png', fullPage: false });
    console.log('>>> Markdown table rendered and verified successfully! <<<');
  });
});
