const path = require('path');
const { test, expect } = require('@playwright/test');

test.describe('LevelUp Table Editor Integration', () => {
  test('full message protocol lifecycle: handshake, init, editing, autosave, and restore', async ({ page }) => {
    const harnessPath = `file://${path.resolve(__dirname, 'harness.html')}`;

    await page.goto(harnessPath);

    // 1. Verify EDITOR_READY handshake
    await expect(page.locator('#status')).toHaveText('READY_RECEIVED', { timeout: 10000 });

    const readyMsg = await page.evaluate(() => {
      return window.receivedMessages.find(m => m && m.type === 'EDITOR_READY');
    });
    expect(readyMsg).toBeDefined();
    expect(readyMsg.protocol).toBe('LEVELUP_EDITOR_v1');
    expect(readyMsg.payload.ready).toBe(true);

    const frame = page.frameLocator('#editorFrame');

    // 2. Send LEVELUP_INIT with custom data and formula
    const sampleWorkbook = {
      sheets: {
        Sheet1: {
          cells: [
            [
              { value: 50, raw: '50', style: { bold: true }, format: 'general' },
              { value: 100, raw: '100', style: {}, format: 'general' }
            ],
            [
              { value: 150, raw: '=A1+B1', style: {}, format: 'general' }
            ]
          ],
          colWidths: [100, 100],
          rowHeights: [30, 30]
        }
      },
      activeSheet: 'Sheet1'
    };

    await page.evaluate((data) => {
      const frameEl = document.getElementById('editorFrame');
      frameEl.contentWindow.postMessage({
        protocol: 'LEVELUP_EDITOR_v1',
        type: 'LEVELUP_INIT',
        questionId: 'q-math-101',
        payload: {
          data: JSON.stringify(data),
          questionId: 'q-math-101'
        },
        timestamp: Date.now()
      }, '*');
    }, sampleWorkbook);

    // Verify restored data and formula evaluation in the grid
    const cellA1 = frame.getByTestId('cell-0-0');
    const cellB1 = frame.getByTestId('cell-0-1');
    const cellA2 = frame.getByTestId('cell-1-0');

    await expect(cellA1.locator('.cell-content')).toHaveText('50');
    await expect(cellB1.locator('.cell-content')).toHaveText('100');
    await expect(cellA2.locator('.cell-content')).toHaveText('150'); // evaluated =A1+B1

    // 3. Edit cell in table -> verify AUTOSAVE_NOTIFY is sent
    await cellA1.click();
    await frame.locator('#formulaInput').fill('80');
    await frame.locator('#formulaInput').press('Enter');

    // Formula =A1+B1 should now recalculate to 180!
    await expect(cellA2.locator('.cell-content')).toHaveText('180');

    // Wait for AUTOSAVE_NOTIFY to be received by parent
    await expect.poll(async () => {
      return await page.evaluate(() => {
        return window.receivedMessages.some(m => m && m.type === 'AUTOSAVE_NOTIFY');
      });
    }, { timeout: 5000 }).toBe(true);

    const autosaveMsg = await page.evaluate(() => {
      return window.receivedMessages.filter(m => m && m.type === 'AUTOSAVE_NOTIFY').pop();
    });
    expect(autosaveMsg).toBeDefined();
    expect(autosaveMsg.protocol).toBe('LEVELUP_EDITOR_v1');
    expect(autosaveMsg.questionId).toBe('q-math-101');
    expect(typeof autosaveMsg.payload.data).toBe('string');

    // 4. Test REQUEST_GET_CONTENT -> RESPONSE_GET_CONTENT
    await page.evaluate(() => {
      const frameEl = document.getElementById('editorFrame');
      frameEl.contentWindow.postMessage({
        protocol: 'LEVELUP_EDITOR_v1',
        type: 'REQUEST_GET_CONTENT',
        questionId: 'q-math-101',
        payload: {},
        timestamp: Date.now()
      }, '*');
    });

    await expect.poll(async () => {
      return await page.evaluate(() => {
        return window.receivedMessages.some(m => m && m.type === 'RESPONSE_GET_CONTENT');
      });
    }, { timeout: 5000 }).toBe(true);

    const responseMsg = await page.evaluate(() => {
      return window.receivedMessages.filter(m => m && m.type === 'RESPONSE_GET_CONTENT').pop();
    });
    expect(responseMsg).toBeDefined();
    expect(responseMsg.questionId).toBe('q-math-101');
    const exportedData = JSON.parse(responseMsg.payload.data);
    expect(exportedData.sheets.Sheet1.cells[0][0].value).toBe(80);
    expect(exportedData.sheets.Sheet1.cells[1][0].raw).toBe('=A1+B1');

    // 5. Test restoration without loss on another fresh question load
    await page.evaluate((savedPayload) => {
      const frameEl = document.getElementById('editorFrame');
      frameEl.contentWindow.postMessage({
        protocol: 'LEVELUP_EDITOR_v1',
        type: 'LEVELUP_INIT',
        questionId: 'q-math-102',
        payload: {
          data: savedPayload,
          questionId: 'q-math-102'
        },
        timestamp: Date.now()
      }, '*');
    }, responseMsg.payload.data);

    // Verify cell values and formula are completely intact
    await expect(cellA1.locator('.cell-content')).toHaveText('80');
    await expect(cellA2.locator('.cell-content')).toHaveText('180');
  });

  test('validates protocol correctly', async ({ page }) => {
    const harnessPath = `file://${path.resolve(__dirname, 'harness.html')}`;
    await page.goto(harnessPath);

    const frame = page.frameLocator('#editorFrame');
    await expect(frame.getByTestId('cell-0-0')).toBeVisible();

    // Verify invalid protocol messages are ignored
    await page.evaluate(() => {
      const frameEl = document.getElementById('editorFrame');
      frameEl.contentWindow.postMessage({
        protocol: 'INVALID_PROTOCOL',
        type: 'LEVELUP_INIT',
        payload: { data: 'invalid' }
      }, '*');
    });

    // Cell 0-0 remains default empty
    await expect(frame.getByTestId('cell-0-0').locator('.cell-content')).toHaveText('');
  });

  test('student edits table, autosaves, navigates away, and reopens question with full restoration', async ({ page }) => {
    const harnessPath = `file://${path.resolve(__dirname, 'harness.html')}`;
    await page.goto(harnessPath);

    await expect(page.locator('#status')).toHaveText('READY_RECEIVED', { timeout: 10000 });
    const frame = page.frameLocator('#editorFrame');

    // 1. Student works on Question 1
    const q1Initial = {
      sheets: {
        'Expenses': {
          cells: [
            [
              { value: 'Item', raw: 'Item', style: { bold: true }, format: 'general' },
              { value: 'Cost', raw: 'Cost', style: { bold: true }, format: 'general' }
            ],
            [
              { value: 'Books', raw: 'Books', style: {}, format: 'general' },
              { value: 120, raw: '120', style: {}, format: 'number' }
            ],
            [
              { value: 'Supplies', raw: 'Supplies', style: {}, format: 'general' },
              { value: 45, raw: '45', style: {}, format: 'number' }
            ],
            [
              { value: 'Total', raw: 'Total', style: { bold: true }, format: 'general' },
              { value: 165, raw: '=SUM(B2:B3)', style: { bold: true }, format: 'number' }
            ]
          ],
          colWidths: [120, 100],
          rowHeights: [28, 28, 28, 28]
        }
      },
      activeSheet: 'Expenses'
    };

    // Load Q1
    await page.evaluate((data) => {
      const frameEl = document.getElementById('editorFrame');
      frameEl.contentWindow.postMessage({
        protocol: 'LEVELUP_EDITOR_v1',
        type: 'LEVELUP_INIT',
        questionId: 'q-expense-1',
        payload: {
          data: JSON.stringify(data),
          questionId: 'q-expense-1'
        },
        timestamp: Date.now()
      }, '*');
    }, q1Initial);

    // Verify Q1 loaded
    const cellTotal = frame.getByTestId('cell-3-1');
    await expect(cellTotal.locator('.cell-content')).toHaveText('165');

    // Student modifies Supplies cost from 45 to 80
    const cellCost2 = frame.getByTestId('cell-2-1');
    await cellCost2.click();
    await frame.locator('#formulaInput').fill('80');
    await frame.locator('#formulaInput').press('Enter');

    // Total formula =SUM(B2:B3) automatically updates to 200
    await expect(cellTotal.locator('.cell-content')).toHaveText('200');

    // Wait for autosave to capture the modified table
    let q1SavedData = null;
    await expect.poll(async () => {
      const msgs = await page.evaluate(() => window.receivedMessages);
      const autosave = msgs.filter(m => m && m.type === 'AUTOSAVE_NOTIFY' && m.questionId === 'q-expense-1').pop();
      if (autosave && autosave.payload && autosave.payload.data) {
        q1SavedData = autosave.payload.data;
        return true;
      }
      return false;
    }, { timeout: 5000 }).toBe(true);

    expect(q1SavedData).not.toBeNull();

    // 2. Student navigates to Question 2 (Blank or different data)
    await page.evaluate(() => {
      const frameEl = document.getElementById('editorFrame');
      frameEl.contentWindow.postMessage({
        protocol: 'LEVELUP_EDITOR_v1',
        type: 'LEVELUP_INIT',
        questionId: 'q-diff-2',
        payload: {
          data: '',
          questionId: 'q-diff-2'
        },
        timestamp: Date.now()
      }, '*');
    });

    // 3. Student navigates back to Question 1: parent sends LEVELUP_INIT with q1SavedData
    await page.evaluate((saved) => {
      const frameEl = document.getElementById('editorFrame');
      frameEl.contentWindow.postMessage({
        protocol: 'LEVELUP_EDITOR_v1',
        type: 'LEVELUP_INIT',
        questionId: 'q-expense-1',
        payload: {
          data: saved,
          questionId: 'q-expense-1'
        },
        timestamp: Date.now()
      }, '*');
    }, q1SavedData);

    // Verify Question 1 is completely restored:
    // Cell B3 cost is 80, formula in B4 =SUM(B2:B3) evaluated to 200, sheet name is Expenses
    await expect(frame.getByTestId('cell-2-1').locator('.cell-content')).toHaveText('80');
    await expect(frame.getByTestId('cell-3-1').locator('.cell-content')).toHaveText('200');

    // Click formula cell and verify formula raw expression in formula bar
    await frame.getByTestId('cell-3-1').click();
    await expect(frame.locator('#formulaInput')).toHaveValue('=SUM(B2:B3)');
  });

  test('imports raw markdown tables and CSV into grid cells seamlessly', async ({ page }) => {
    const harnessPath = `file://${path.resolve(__dirname, 'harness.html')}`;
    await page.goto(harnessPath);

    await expect(page.locator('#status')).toHaveText('READY_RECEIVED', { timeout: 10000 });
    const frame = page.frameLocator('#editorFrame');

    const sampleMarkdownTable = `
| Student | Activity | Marks |
| ------- | -------- | ----: |
| Reema | Drawing | 93 |
| Om | Quiz | 68 |
| Sara | Drawing | 79 |
`;

    await page.evaluate((md) => {
      const frameEl = document.getElementById('editorFrame');
      frameEl.contentWindow.postMessage({
        protocol: 'LEVELUP_EDITOR_v1',
        type: 'LEVELUP_INIT',
        questionId: 'q-excel-md',
        payload: {
          data: md,
          questionId: 'q-excel-md'
        },
        timestamp: Date.now()
      }, '*');
    }, sampleMarkdownTable);

    // Verify markdown table was parsed and rendered into grid cells
    await expect(frame.getByTestId('cell-0-0').locator('.cell-content')).toHaveText('Student');
    await expect(frame.getByTestId('cell-0-1').locator('.cell-content')).toHaveText('Activity');
    await expect(frame.getByTestId('cell-0-2').locator('.cell-content')).toHaveText('Marks');

    await expect(frame.getByTestId('cell-1-0').locator('.cell-content')).toHaveText('Reema');
    await expect(frame.getByTestId('cell-1-1').locator('.cell-content')).toHaveText('Drawing');
    await expect(frame.getByTestId('cell-1-2').locator('.cell-content')).toHaveText('93');

    await expect(frame.getByTestId('cell-2-0').locator('.cell-content')).toHaveText('Om');
    await expect(frame.getByTestId('cell-2-1').locator('.cell-content')).toHaveText('Quiz');
    await expect(frame.getByTestId('cell-2-2').locator('.cell-content')).toHaveText('68');
  });
});

