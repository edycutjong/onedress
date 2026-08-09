import { test, expect } from '@playwright/test';

/**
 * The app must open on the cached demo party with NO API key and NO units spent —
 * that is the judged path, so it is the one asserted hardest. Everything here has to
 * hold on a deployment where `getClient()` returns null.
 */
test.describe('demo mode — zero config', () => {
  test('opens on the verdict with no API key and no errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/party');

    // Brand, the persistent spine, and the honesty banner.
    await expect(page.getByText('OneDress').first()).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Progress' })).toBeVisible();
    await expect(page.getByText('cached demo party')).toBeVisible();

    // The verdict is the landing screen, and it leads with the winning colorway.
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Marigold');

    // Zero units spent is the whole point of the cached party.
    await expect(page.getByText(/0\/260 units spent/).first()).toBeVisible();

    await expect(page.locator('nextjs-portal')).toHaveCount(0);
    expect(consoleErrors, consoleErrors.join('\n')).toHaveLength(0);
  });

  test('the seven-step spine is present and every step is reachable', async ({ page }) => {
    await page.goto('/party');
    const spine = page.getByRole('navigation', { name: 'Progress' });
    const steps = ['Create', 'Measure', 'Score', 'Compare', 'Render', 'Finish', 'Verdict'];

    for (const label of steps) {
      await expect(spine.getByRole('button', { name: new RegExp(`^${label}`) })).toBeVisible();
    }

    // Walking the spine must never leave the page without exactly one h1.
    for (const label of steps) {
      await spine.getByRole('button', { name: new RegExp(`^${label}`) }).click();
      await expect(page.locator('h1')).toHaveCount(1);
    }
  });

  test('has correct document title and description meta', async ({ page }) => {
    await page.goto('/party');
    await expect(page).toHaveTitle(/OneDress/i);
    const desc = page.locator('meta[name="description"]');
    await expect(desc).toHaveAttribute('content', /skin tone|dress color/i);
  });
});
