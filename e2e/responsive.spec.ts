import { test, expect } from '@playwright/test';

/** Layout must hold at mobile / tablet / desktop with no horizontal overflow. */
const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
];

test.describe('responsive layout', () => {
  for (const vp of VIEWPORTS) {
    test(`no horizontal overflow at ${vp.name} (${vp.width}px)`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');
      const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientW = await page.evaluate(() => document.documentElement.clientWidth);
      // Allow a 1px rounding tolerance.
      expect(scrollW).toBeLessThanOrEqual(clientW + 1);
    });
  }

  test('hero heading is visible on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});
