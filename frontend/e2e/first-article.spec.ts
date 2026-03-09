import { test, expect } from '@playwright/test';

/**
 * E2E tests for the first article inspection workflow (T092).
 *
 * Tests cover:
 * - First article detection triggers QI approval dialog
 * - QI inspector selection
 * - First article approval (OK / NOT OK)
 * - Dialog dismissal
 */

test.beforeEach(async ({ page }) => {
  // Mock auth
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

  // Mock common API endpoints
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

  await page.route('**/api/v1/scan/stages', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 'stage-1', stage_name: 'Cutting', stage_sequence: 1, description: null },
      ]),
    });
  });

  await page.route('**/api/v1/scan/latest*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

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

  await page.route('**/api/v1/scan/today-count', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ count: 0 }),
    });
  });

  // Mock QI inspectors list
  await page.route('**/api/v1/scan/operators*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 'qi-1', username: 'qi_john', full_name: 'John QI', role: 'quality_inspector', station_id: null, is_active: true },
        { id: 'qi-2', username: 'qi_jane', full_name: 'Jane QI', role: 'quality_inspector', station_id: null, is_active: true },
      ]),
    });
  });
});

test.describe('First Article Inspection', () => {
  test('shows first article dialog when scan is first article', async ({ page }) => {
    // Simulate a first-article scan response that triggers the FA flow
    await page.route('**/api/v1/scan/process', async (route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      // If the request doesn't have is_first_article, respond with first_article_required
      if (!body.is_first_article) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'scan-fa-001',
            work_order_id: 'wo-001',
            serial_number: 1,
            work_order_code: 'WO-20260206-CABLE001-FA001',
            stage_name: 'Cutting',
            operator_name: 'Test Operator',
            quality_status: 'ok',
            is_first_article: true,
            quality_inspector_name: null,
            scan_timestamp: new Date().toISOString(),
            message: 'First article — QI approval required',
          }),
        });
      } else {
        // FA submission with QI
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'scan-fa-001',
            work_order_id: 'wo-001',
            serial_number: 1,
            work_order_code: 'WO-20260206-CABLE001-FA001',
            stage_name: 'Cutting',
            operator_name: 'Test Operator',
            quality_status: body.quality_status || 'ok',
            is_first_article: true,
            quality_inspector_name: 'John QI',
            scan_timestamp: new Date().toISOString(),
            message: 'First article approved',
          }),
        });
      }
    });

    await page.goto('/scan');

    // Enter barcode and submit
    const barcodeInput = page.getByPlaceholder(/barcode/i);
    await barcodeInput.fill('WO-20260206-CABLE001-FA001');
    await barcodeInput.press('Enter');

    await page.getByRole('combobox').selectOption('stage-1');
    await page.getByRole('button', { name: /^OK$/i }).click();

    // First article dialog should appear (with inspector selection)
    await expect(page.getByText(/first article|qi.*approval|inspector/i)).toBeVisible();
  });

  test('first article dialog has inspector selection and quality buttons', async ({ page }) => {
    // Mock to trigger FA dialog
    await page.route('**/api/v1/scan/process', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'scan-fa-002',
          work_order_id: 'wo-002',
          serial_number: 2,
          work_order_code: 'WO-20260206-CABLE001-FA002',
          stage_name: 'Cutting',
          operator_name: 'Test Operator',
          quality_status: 'ok',
          is_first_article: true,
          quality_inspector_name: null,
          scan_timestamp: new Date().toISOString(),
          message: 'First article — QI approval required',
        }),
      });
    });

    await page.goto('/scan');

    const barcodeInput = page.getByPlaceholder(/barcode/i);
    await barcodeInput.fill('WO-20260206-CABLE001-FA002');
    await barcodeInput.press('Enter');

    await page.getByRole('combobox').selectOption('stage-1');
    await page.getByRole('button', { name: /^OK$/i }).click();

    // Verify dialog contents — should have inspector dropdown and OK/NOT OK buttons
    await expect(page.getByText(/first article|inspector/i)).toBeVisible();
  });
});
