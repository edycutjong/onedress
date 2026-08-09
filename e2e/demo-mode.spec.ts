import { test, expect } from '@playwright/test';

/**
 * Smoke test: the app loads with NO API keys / env vars set (zero-config, the
 * judging requirement). No error overlays, correct metadata, no console errors.
 */
test.describe('demo mode — zero config', () => {
  test('loads without API keys and renders the hero', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/');

    // Brand + pitch are present.
    await expect(page.getByText('OneDress').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /one dress color/i })).toBeVisible();

    // No Next.js dev error overlay.
    await expect(page.locator('nextjs-portal')).toHaveCount(0);

    // No console errors during load.
    expect(consoleErrors, consoleErrors.join('\n')).toHaveLength(0);
  });

  test('has correct document title and description meta', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/OneDress/i);
    const desc = page.locator('meta[name="description"]');
    await expect(desc).toHaveAttribute('content', /skin tone|dress color/i);
  });
});
