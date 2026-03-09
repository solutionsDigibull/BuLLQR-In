import { test, expect } from '@playwright/test';

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('shows login form with username and password fields', async ({ page }) => {
    await expect(page.getByLabel(/username/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('shows validation errors for short inputs', async ({ page }) => {
    const usernameInput = page.getByLabel(/username/i);
    const passwordInput = page.getByLabel(/password/i);

    await usernameInput.fill('ab');
    await usernameInput.blur();
    await expect(page.getByText(/at least 3 characters/i)).toBeVisible();

    await passwordInput.fill('12');
    await passwordInput.blur();
    await expect(page.getByText(/at least 4 characters/i)).toBeVisible();
  });

  test('disables submit button while loading', async ({ page }) => {
    // Intercept the login API to slow it down
    await page.route('**/api/v1/auth/login', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'test-token',
          token_type: 'bearer',
          expires_in: 28800,
          user: {
            id: '123',
            username: 'operator1',
            full_name: 'Test Operator',
            role: 'operator',
            station_id: 'WS-01',
            is_active: true,
          },
        }),
      });
    });

    await page.getByLabel(/username/i).fill('operator1');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Button should be disabled during loading
    await expect(page.getByRole('button', { name: /signing in/i })).toBeDisabled();
  });

  test('shows error on invalid credentials', async ({ page }) => {
    await page.route('**/api/v1/auth/login', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Invalid credentials' }),
      });
    });

    await page.getByLabel(/username/i).fill('wrong');
    await page.getByLabel(/password/i).fill('wrong');
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page.getByText(/invalid|failed/i)).toBeVisible();
  });

  test('redirects to /scan on successful login', async ({ page }) => {
    await page.route('**/api/v1/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'test-jwt-token',
          token_type: 'bearer',
          expires_in: 28800,
          user: {
            id: '123',
            username: 'operator1',
            full_name: 'Test Operator',
            role: 'operator',
            station_id: 'WS-01',
            is_active: true,
          },
        }),
      });
    });

    await page.getByLabel(/username/i).fill('operator1');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/scan/);
  });
});
