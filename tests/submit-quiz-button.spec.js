const { test, expect } = require('@playwright/test');

test.describe('HTML Table Editor: Single Submit to Quiz Button & Auto-Close Tests', () => {
  test('Exactly ONE Submit to Quiz button exists in header and triggers auto-close on submit', async ({ page }) => {
    // Spy on window.close()
    await page.addInitScript(() => {
      window.closedCalled = false;
      const originalClose = window.close;
      window.close = function() {
        window.closedCalled = true;
        try { originalClose.call(window); } catch (e) {}
      };
    });

    // 1. Load table editor directly from the local server
    await page.goto('http://localhost:3000/html_table_editor/?qid=quiz-q-101');

    // 2. Verify there is strictly ONLY ONE Submit to Quiz button on the entire page
    const allSubmitButtons = page.locator('.btn-submit-quiz');
    await expect(allSubmitButtons).toHaveCount(1);

    // 3. Verify Header Submit to Quiz button exists
    const headerBtn = page.locator('#btnSubmitToQuiz');
    await expect(headerBtn).toBeVisible();
    await expect(headerBtn).toContainText('Submit to Quiz');

    // 4. Verify Ribbon Submit to Quiz button has been removed
    const ribbonBtn = page.locator('#btnSubmitToQuizRibbon');
    await expect(ribbonBtn).toHaveCount(0);

    // Take screenshot showing exactly one button
    await page.screenshot({ path: 'tests/single_submit_btn.png' });

    // 5. Fill in cell A1 with 'Notebook'
    const cellA1 = page.getByTestId('cell-0-0');
    await cellA1.click();
    await page.locator('#formulaInput').fill('Notebook');
    await page.locator('#formulaInput').press('Enter');
    await expect(cellA1.locator('.cell-content')).toHaveText('Notebook');

    // 6. Click the Submit to Quiz button
    await headerBtn.click();

    // 7. Verify UI feedback on the button indicates submission and closing
    await expect(headerBtn).toContainText('Submitted!');
    await expect(headerBtn).toHaveClass(/submitted/);

    // 8. Verify Toast notification appears
    const toast = page.locator('#quizSubmitToast');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('Spreadsheet Submitted to Quiz!');

    // 9. Verify localStorage submission payload
    const submissionRaw = await page.evaluate(() => {
      return localStorage.getItem('levelup_excel_submission');
    });
    expect(submissionRaw).not.toBeNull();
    const submission = JSON.parse(submissionRaw);
    expect(submission.questionId).toBe('quiz-q-101');
    expect(submission.data).toContain('Notebook');

    // 10. Verify window.close() was called automatically
    await page.waitForTimeout(600);
    const wasCloseCalled = await page.evaluate(() => window.closedCalled);
    expect(wasCloseCalled).toBe(true);
  });
});
