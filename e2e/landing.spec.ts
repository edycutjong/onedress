import { test, expect } from '@playwright/test';

/**
 * Core-surface test for the current build. The full 7-step flow (Create · Measure ·
 * Score · Compare · Render · Finish · Verdict) lands in a later phase; this asserts
 * the shipped landing surface communicates the product thesis. Extend per screen as
 * the flow is built.
 */
test.describe('landing surface', () => {
  test('states the group-color thesis', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/six skin tones/i)).toBeVisible();
    await expect(page.getByText(/no one is anyone.s worst option/i)).toBeVisible();
  });

  test('the page has a single H1', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toHaveCount(1);
  });
});
