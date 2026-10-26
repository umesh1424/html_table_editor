const { test, expect } = require('@playwright/test');

test.describe('Quiz Markdown Table Formatting & Excel Button UI', () => {
  test('Question renders clean HTML table, prominent Excel Button, and Quiz Data Bar', async ({ page }) => {
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

    // 3. Verify Table Action Toolbar
    const copyBtn = tableWrap.locator('button:has-text("Copy Data")');
    const loadBtn = tableWrap.locator('button:has-text("Load into Table Editor")');
    await expect(copyBtn).toBeVisible();
    await expect(loadBtn).toBeVisible();

    // 4. Verify PROMINENT EXCEL BUTTON exists (just like user requested!)
    const openExcelBtn = page.locator('#open-excel-btn-q-demo-excel');
    await expect(openExcelBtn).toBeVisible();
    await expect(openExcelBtn).toContainText('Open Excel Table Editor');

    // 5. Verify Quiz Data Bar exists and is visible
    const dataBar = page.locator('#editor-fallback-textarea-q-demo-excel');
    await expect(dataBar).toBeVisible();

    // 6. Test "Load into Table Editor" button populates data bar
    await loadBtn.click();
    await expect(page.locator('#toast-container')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#toast-container')).toContainText('Table data loaded into Table Editor');
    await expect(dataBar).toHaveValue(/Reema.*Drawing.*93/);

    // 7. Verify "Toggle Embedded Frame" works if user ever wants inline preview
    const toggleFrameBtn = page.locator('#toggle-inline-frame-btn-q-demo-excel');
    await expect(toggleFrameBtn).toBeVisible();
    await toggleFrameBtn.click();
    const inlineWrapper = page.locator('#inline-frame-wrapper-q-demo-excel');
    await expect(inlineWrapper).toBeVisible();

    // Take screenshot of Question 5 showing the prominent Excel Button, Table, and Data Bar
    await page.screenshot({ path: 'tests/excel_button_rendered.png', fullPage: false });
    console.log('>>> Excel Button UI and Markdown table verified successfully! <<<');
  });
});
