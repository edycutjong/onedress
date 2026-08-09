import { test, expect } from '@playwright/test';

/** Layout must hold at mobile / tablet / desktop with no horizontal overflow. */
const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
];

const STEPS = ['Create', 'Measure', 'Score', 'Compare', 'Render', 'Verdict'];

test.describe('responsive layout', () => {
  for (const vp of VIEWPORTS) {
    test(`no horizontal overflow on any screen at ${vp.name} (${vp.width}px)`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/party');
      const spine = page.getByRole('navigation', { name: 'Progress' });

      for (const label of STEPS) {
        await spine.getByRole('button', { name: new RegExp(`^${label}`) }).click();
        const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
        const clientW = await page.evaluate(() => document.documentElement.clientWidth);
        // Allow a 1px rounding tolerance.
        expect(scrollW, `${label} overflows at ${vp.width}px`).toBeLessThanOrEqual(clientW + 1);
      }
    });
  }

  test('hero heading is visible on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/party');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('the progress spine stays reachable on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/party');
    const spine = page.getByRole('navigation', { name: 'Progress' });
    await expect(spine).toBeVisible();
    // The spine scrolls horizontally inside its own container rather than pushing
    // the page wide; the last step must still be clickable.
    await spine.getByRole('button', { name: /^Verdict/ }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Marigold');
  });
});
