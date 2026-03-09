import { test as setup, expect } from '@playwright/test';

/**
 * Authentication setup — logs in and saves auth state for reuse across tests.
 */
setup('authenticate as operator', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel(/username/i).fill('operator1');
  await page.getByLabel(/password/i).fill('password123');
  await page.getByRole('button', { name: /sign in/i }).click();

  // Wait for redirect to scan page
  await expect(page).toHaveURL(/\/scan/);

  // Save auth state
  await page.context().storageState({ path: 'e2e/.auth/operator.json' });
});

setup('authenticate as admin', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel(/username/i).fill('admin1');
  await page.getByLabel(/password/i).fill('adminpass123');
  await page.getByRole('button', { name: /sign in/i }).click();

  await expect(page).toHaveURL(/\/scan/);

  await page.context().storageState({ path: 'e2e/.auth/admin.json' });
});
