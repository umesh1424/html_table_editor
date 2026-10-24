const { test, expect } = require('@playwright/test');

test.describe('HTML Table Editor: Submit to Quiz Button Tests', () => {
  test('Submit to Quiz buttons are visible in header and ribbon, and broadcast submission data on click', async ({ page }) => {
    // 1. Load table editor directly from the local server
    await page.goto('http://localhost:3000/html_table_editor/?qid=quiz-q-101');

    // 2. Verify Header Submit to Quiz button
    const headerBtn = page.locator('#btnSubmitToQuiz');
    await expect(headerBtn).toBeVisible();
    await expect(headerBtn).toContainText('Submit to Quiz');

    // 3. Verify Ribbon Submit to Quiz button
    const ribbonBtn = page.locator('#btnSubmitToQuizRibbon');
    await expect(ribbonBtn).toBeVisible();
    await expect(ribbonBtn).toContainText('Submit to Quiz');

    // 4. Fill in cell A1 with 'Notebook'
    const cellA1 = page.getByTestId('cell-0-0');
    await cellA1.click();
    await page.locator('#formulaInput').fill('Notebook');
    await page.locator('#formulaInput').press('Enter');
    await expect(cellA1.locator('.cell-content')).toHaveText('Notebook');

    // 5. Click the Submit to Quiz button
    await headerBtn.click();

    // 6. Verify UI feedback on the button
    await expect(headerBtn).toContainText('Submitted to Quiz!');
    await expect(headerBtn).toHaveClass(/submitted/);

    // 7. Verify Toast notification appears
    const toast = page.locator('#quizSubmitToast');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('Spreadsheet Submitted to Quiz!');

    // 8. Verify localStorage submission payload
    const submissionRaw = await page.evaluate(() => {
      return localStorage.getItem('levelup_excel_submission');
    });
    expect(submissionRaw).not.toBeNull();
    const submission = JSON.parse(submissionRaw);
    expect(submission.questionId).toBe('quiz-q-101');
    expect(submission.data).toContain('Notebook');
  });
});
