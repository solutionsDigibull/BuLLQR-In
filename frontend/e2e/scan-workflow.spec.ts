import { test, expect } from '@playwright/test';

/**
 * E2E tests for the scan workflow (T091).
 *
 * Tests cover:
 * - Barcode entry and validation
 * - Stage selection
 * - Quality status submission (OK / NOT OK)
 * - Session display updates
 * - Duplicate scan handling
 */

// Mock authenticated state with API interception
test.beforeEach(async ({ page }) => {
  // Mock auth - set token in localStorage before navigating
  await page.addInitScript(() => {
    localStorage.setItem('cats_token', 'test-jwt-token');
    localStorage.setItem(
      'cats_user',
      JSON.stringify({
        id: '550e8400-e29b-41d4-a716-446655440000',
        username: 'operator1',
        full_name: 'Test Operator',
        role: 'operator',
        station_id: 'WS-01',
        is_active: true,
      }),
    );
  });

  // Mock /auth/me
  await page.route('**/api/v1/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: '550e8400-e29b-41d4-a716-446655440000',
        username: 'operator1',
        full_name: 'Test Operator',
        role: 'operator',
        station_id: 'WS-01',
        is_active: true,
      }),
    });
  });

  // Mock stages
  await page.route('**/api/v1/scan/stages', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 'stage-1', stage_name: 'Cutting', stage_sequence: 1, description: null },
        { id: 'stage-2', stage_name: 'Stripping', stage_sequence: 2, description: null },
        { id: 'stage-3', stage_name: 'Crimping', stage_sequence: 3, description: null },
        { id: 'stage-4', stage_name: 'Testing', stage_sequence: 4, description: null },
        { id: 'stage-5', stage_name: 'Final Inspection', stage_sequence: 5, description: null },
      ]),
    });
  });

  // Mock latest scans
  await page.route('**/api/v1/scan/latest*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  // Mock analytics progress
  await page.route('**/api/v1/analytics/progress', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        stages: [],
        target_status: 'not_set',
        target_completion_percentage: 0,
      }),
    });
  });

  // Mock today count
  await page.route('**/api/v1/scan/today-count', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ count: 42 }),
    });
  });
});

test.describe('Scan Workflow', () => {
  test('displays scan page with barcode input and stage selector', async ({ page }) => {
    await page.goto('/scan');

    await expect(page.getByPlaceholder(/barcode/i)).toBeVisible();
    await expect(page.getByRole('combobox')).toBeVisible();
  });

  test('validates barcode length (20-50 chars)', async ({ page }) => {
    await page.goto('/scan');

    const barcodeInput = page.getByPlaceholder(/barcode/i);

    // Too short — type a short barcode and press Enter
    await barcodeInput.fill('SHORT123');
    await barcodeInput.press('Enter');

    // Should show validation error or stay in idle state (no submission)
    await expect(page.getByText(/20.*50|invalid|too short/i)).toBeVisible();
  });

  test('submits scan with OK quality status', async ({ page }) => {
    // Mock scan processing
    await page.route('**/api/v1/scan/process', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'scan-001',
          work_order_id: 'wo-001',
          serial_number: 1,
          work_order_code: 'WO-20260206-CABLE001-00001',
          stage_name: 'Cutting',
          operator_name: 'Test Operator',
          quality_status: 'ok',
          is_first_article: false,
          quality_inspector_name: null,
          scan_timestamp: new Date().toISOString(),
          message: 'Scan recorded successfully',
        }),
      });
    });

    await page.goto('/scan');

    // Enter valid barcode
    const barcodeInput = page.getByPlaceholder(/barcode/i);
    await barcodeInput.fill('WO-20260206-CABLE001-00001');
    await barcodeInput.press('Enter');

    // Select stage
    await page.getByRole('combobox').selectOption('stage-1');

    // Click OK button
    await page.getByRole('button', { name: /^OK$/i }).click();

    // Should show success feedback
    await expect(page.getByText(/success|recorded/i)).toBeVisible();
  });

  test('submits scan with NOT OK quality status', async ({ page }) => {
    await page.route('**/api/v1/scan/process', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'scan-002',
          work_order_id: 'wo-001',
          serial_number: 1,
          work_order_code: 'WO-20260206-CABLE001-00002',
          stage_name: 'Crimping',
          operator_name: 'Test Operator',
          quality_status: 'not_ok',
          is_first_article: false,
          quality_inspector_name: null,
          scan_timestamp: new Date().toISOString(),
          message: 'Scan recorded',
        }),
      });
    });

    await page.goto('/scan');

    const barcodeInput = page.getByPlaceholder(/barcode/i);
    await barcodeInput.fill('WO-20260206-CABLE001-00002');
    await barcodeInput.press('Enter');

    await page.getByRole('combobox').selectOption('stage-3');
    await page.getByRole('button', { name: /not ok/i }).click();

    await expect(page.getByText(/success|recorded/i)).toBeVisible();
  });

  test('handles duplicate scan error', async ({ page }) => {
    await page.route('**/api/v1/scan/process', async (route) => {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'DUPLICATE_SCAN',
          detail: 'This work order has already been scanned at this stage.',
          code: 'DUPLICATE_SCAN',
          timestamp: new Date().toISOString(),
        }),
      });
    });

    await page.goto('/scan');

    const barcodeInput = page.getByPlaceholder(/barcode/i);
    await barcodeInput.fill('WO-20260206-CABLE001-00003');
    await barcodeInput.press('Enter');

    await page.getByRole('combobox').selectOption('stage-1');
    await page.getByRole('button', { name: /^OK$/i }).click();

    // Should show duplicate/update options
    await expect(page.getByText(/duplicate|already.*scanned|update/i)).toBeVisible();
  });

  test('handles server error gracefully', async ({ page }) => {
    await page.route('**/api/v1/scan/process', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Internal server error' }),
      });
    });

    await page.goto('/scan');

    const barcodeInput = page.getByPlaceholder(/barcode/i);
    await barcodeInput.fill('WO-20260206-CABLE001-00004');
    await barcodeInput.press('Enter');

    await page.getByRole('combobox').selectOption('stage-2');
    await page.getByRole('button', { name: /^OK$/i }).click();

    // Should show error message
    await expect(page.getByText(/error|failed/i)).toBeVisible();
  });
});
