const { test, expect } = require('@playwright/test');

test.describe('End-to-End Quiz Platform: HTML (CodeStudio) & Excel (Table Editor) Practical Suite', () => {
  test('Complete Quiz Workflow: MCQ, FIB, Short Answer, HTML CodeStudio, Excel Editor, Autosave, Submit and Results', async ({ page }) => {
    // 1. Navigate to the full 5-question practical quiz on local dev server
    await page.goto('http://localhost:3000/quiz?code=DEMO&name=UmeshStudent', { waitUntil: 'domcontentloaded' });

    // Verify Quiz title and Candidate label
    await expect(page.locator('#quiz-header-title')).toHaveText('LevelUp Full-Stack Practical Quiz', { timeout: 10000 });
    await expect(page.locator('#student-name-label')).toHaveText('Candidate: UmeshStudent');
    await expect(page.locator('#question-badge')).toHaveText('Question 1 of 5');

    // --- QUESTION 1: MCQ ---
    // Select Option B (<footer>)
    const optB = page.locator('button:has-text("<footer>")').first();
    await expect(optB).toBeVisible();
    await optB.click();

    // Save screenshot of Question 1
    await page.screenshot({ path: 'tests/e2e_q1_mcq.png' });

    // Navigate to Question 2
    await page.locator('#next-btn').click();
    await expect(page.locator('#question-badge')).toHaveText('Question 2 of 5');

    // --- QUESTION 2: FIB (Fill In Blank) ---
    const fibInput = page.locator('.inline-fib-input, #student-text-answer').first();
    await expect(fibInput).toBeVisible();
    await fibInput.fill('<ul>');

    // Save screenshot of Question 2
    await page.screenshot({ path: 'tests/e2e_q2_fib.png' });

    // Navigate to Question 3
    await page.locator('#next-btn').click();
    await expect(page.locator('#question-badge')).toHaveText('Question 3 of 5');

    // --- QUESTION 3: SHORT ANSWER with Excel Launcher Button ---
    const shortInput = page.locator('#student-text-answer');
    await expect(shortInput).toBeVisible();
    await shortInput.fill('The box model consists of content, padding, border, and margin.');

    // Verify the Excel button exists beside the short answer input
    const shortExcelBtn = page.locator('#student-open-excel-btn-q-demo-short');
    await expect(shortExcelBtn).toBeVisible();

    // Save screenshot of Question 3
    await page.screenshot({ path: 'tests/e2e_q3_short_answer.png' });

    // Navigate to Question 4
    await page.locator('#next-btn').click();
    await expect(page.locator('#question-badge')).toHaveText('Question 4 of 5');

    // --- QUESTION 4: HTML PRACTICAL (CodeStudio) ---
    await expect(page.locator('#question-text-display')).toContainText('Profile Card');

    // Verify CodeStudio launch button and Code Type bar
    const codeStudioBtn = page.locator('#open-codestudio-btn-q-demo-html');
    await expect(codeStudioBtn).toBeVisible();
    const codeBar = page.locator('#student-code-bar-q-demo-html');
    await expect(codeBar).toBeVisible();

    // Simulate CodeStudio transferring code via postMessage and localStorage
    const sampleHtmlCode = '<div class="profile-card"><h3>Jane Doe</h3><p>Full-Stack Engineer</p><button>Connect</button></div>';

    await page.evaluate(({ qId, code }) => {
      // Dispatch postMessage as CodeStudio does
      window.postMessage({
        protocol: 'LEVELUP_EDITOR_v1',
        type: 'CODESTUDIO_TRANSFER_CODE',
        questionId: qId,
        payload: { code: code },
        timestamp: Date.now()
      }, '*');

      // Also trigger cross-tab storage event
      localStorage.setItem('levelup_codestudio_submission', JSON.stringify({
        questionId: qId,
        code: code,
        timestamp: Date.now()
      }));
    }, { qId: 'q-demo-html', code: sampleHtmlCode });

    // Verify code was received into the quiz code bar
    await expect(codeBar).toHaveValue(sampleHtmlCode, { timeout: 5000 });

    // Verify sync status badge updated
    const codeSyncBadge = page.locator('#codestudio-sync-status-q-demo-html');
    await expect(codeSyncBadge).toContainText('Code received from CodeStudio');

    // Save screenshot of Question 4
    await page.screenshot({ path: 'tests/e2e_q4_codestudio_received.png' });

    // Navigate to Question 5
    await page.locator('#next-btn').click();
    await expect(page.locator('#question-badge')).toHaveText('Question 5 of 5');

    // --- QUESTION 5: EXCEL PRACTICAL (Table Editor Dual-Mode) ---
    await expect(page.locator('#question-text-display')).toContainText('Quarterly Sales');

    const optUploadBtn = page.locator('#excel-opt-upload-btn-q-demo-excel');
    const optEditorBtn = page.locator('#excel-opt-editor-btn-q-demo-excel');
    const uploadPanel = page.locator('#excel-upload-panel-q-demo-excel');
    const editorPanel = page.locator('#excel-editor-panel-q-demo-excel');

    // Default mode is Table Editor
    await expect(editorPanel).toBeVisible();
    await expect(uploadPanel).toBeHidden();

    // Toggle to Upload mode
    await optUploadBtn.click();
    await expect(uploadPanel).toBeVisible();
    await expect(editorPanel).toBeHidden();

    // Toggle back to Table Editor mode
    await optEditorBtn.click();
    await expect(editorPanel).toBeVisible();
    await expect(uploadPanel).toBeHidden();

    // Test Table Editor submission to quiz
    const sampleCsvData = 'Region,Q1,Q2,Total\nNorth,120,180,300\nSouth,150,210,360';

    await page.evaluate(({ qId, csv }) => {
      // Simulate Table Editor submitting code to quiz
      window.postMessage({
        protocol: 'LEVELUP_EDITOR_v1',
        type: 'CODESTUDIO_TRANSFER_CODE',
        questionId: qId,
        payload: {
          data: csv,
          code: csv,
          csv: csv,
          json: JSON.stringify({ sheets: { Sheet1: { data: csv } } })
        },
        timestamp: Date.now()
      }, '*');

      // Cross-tab storage broadcast
      localStorage.setItem('levelup_excel_submission', JSON.stringify({
        questionId: qId,
        data: csv,
        csv: csv,
        timestamp: Date.now()
      }));
    }, { qId: 'q-demo-excel', csv: sampleCsvData });

    // Verify autosave indicator on the Excel question
    const excelSaveStatus = page.locator('#editor-save-status-q-demo-excel');
    await expect(excelSaveStatus).toContainText('Autosaved', { timeout: 5000 });

    // Save screenshot of Question 5
    await page.screenshot({ path: 'tests/e2e_q5_excel_autosaved.png' });

    // --- SUBMIT QUIZ ---
    const submitBtn = page.locator('#next-btn');
    await expect(submitBtn).toContainText('Submit Quiz');
    await submitBtn.click();

    // Wait for redirection to result page
    await page.waitForURL(/result/, { timeout: 10000 });

    // Verify Result page elements
    await expect(page.locator('body')).toContainText('UmeshStudent');

    // Save screenshot of Results page
    await page.screenshot({ path: 'tests/e2e_result_page.png' });

    console.log('>>> ALL 5 PRACTICAL QUIZ SECTIONS PASSED E2E! <<<');
  });
});
