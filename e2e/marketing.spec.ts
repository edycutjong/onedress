import { test, expect } from '@playwright/test';

/**
 * One deploy, three surfaces. `/` is the brochure, `/pitch` is the deck, `/party`
 * is the product — and the only reason the first two exist on this domain is to
 * hand a judge to the third. So the assertions that matter here are the *routes*
 * and the *round trip*, not the copy.
 *
 * Reduced motion is forced so the scroll-reveal transitions settle instantly and
 * the CTA is clickable the moment the document is parsed.
 */

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test.describe('/ — the landing page', () => {
  test('serves the brochure, not the app', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/OneDress/i);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Six bridesmaids/i);
    // The product chrome must NOT be here — that is what /party is for.
    await expect(page.getByRole('navigation', { name: 'Progress' })).toHaveCount(0);
  });

  test('the primary CTA goes into the product and the product loads', async ({ page }) => {
    await page.goto('/');
    await page
      .getByRole('link', { name: /Open the live app/i })
      .first()
      .click();

    await expect(page).toHaveURL(/\/party$/);
    // Arriving means the real app, on the cached party, with its spine.
    await expect(page.getByRole('navigation', { name: 'Progress' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Marigold');
  });

  test('every route out of the landing page is one of the three surfaces', async ({ page }) => {
    await page.goto('/');
    // At least one link into the app and one into the deck, on the page a judge
    // lands on. If either disappears, the consolidation has silently regressed.
    // `:visible` because the nav copies of these links collapse on small screens —
    // what must hold at every width is that at least one of each is on screen.
    await expect(page.locator('a[href="/party"]:visible').first()).toBeVisible();
    await expect(page.locator('a[href="/pitch"]:visible').first()).toBeVisible();
  });

  test('its images are real files in this deploy, not 404s', async ({ page }) => {
    await page.goto('/');
    const hero = page.locator('img[src="/readme-hero.png"]');
    await expect(hero).toHaveCount(1);
    // naturalWidth is 0 for an image the server never delivered.
    await expect
      .poll(() => hero.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);
  });

  test('no horizontal overflow at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientW = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollW).toBeLessThanOrEqual(clientW + 1);
  });
});

test.describe('/pitch — the deck', () => {
  test('serves the ten-slide deck at a clean URL', async ({ page }) => {
    const response = await page.goto('/pitch');
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/pitch deck/i);
    await expect(page.locator('#counter')).toContainText('10');
  });

  test('leads back to the product', async ({ page }) => {
    await page.goto('/pitch');
    await expect(page.locator('a[href="/party"]').first()).toHaveCount(1);
    await expect(page.locator('a[href="/"]').first()).toHaveCount(1);
  });
});

test.describe('/party — the product links home', () => {
  test('the wordmark and footer complete the round trip', async ({ page }) => {
    await page.goto('/party');
    await expect(page.getByRole('navigation', { name: 'Site' }).getByRole('link')).toHaveCount(3);

    await page.getByRole('link', { name: /back to the landing page/i }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Six bridesmaids/i);
  });
});
