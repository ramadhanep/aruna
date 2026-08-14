import { test, expect } from '@playwright/test';

test.describe('app shell smoke tests', () => {
  test('renders the app shell without an error boundary', async ({ page }) => {
    await page.goto('/explore');
    await expect(page.locator('main').first()).toBeVisible();
    await expect(page.locator('main').first()).not.toContainText('Something went wrong');
  });

  test('mobile bottom nav navigates between core pages', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile bottom nav is mobile-only');
    await page.goto('/explore');
    const nav = page.getByRole('navigation').last();
    await expect(nav).toBeVisible();

    await nav.getByText('Watchlist').click();
    await expect(page).toHaveURL(/\/watchlist/);
    await expect(page.locator('main').first()).toBeVisible();

    await nav.getByText('Portfolio').click();
    await expect(page).toHaveURL(/\/portfolio-tracker/);
    await expect(page.locator('main').first()).toBeVisible();
  });
});

test.describe('homepage redirect', () => {
  test('redirects unauthenticated visitors to /explore', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/explore/);
  });
});
