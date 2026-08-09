import { test, expect } from '@playwright/test';

/**
 * The product thesis, asserted where a judge actually meets it. These numbers come
 * from the real engine running on the demo party at module load — if the engine or
 * the fixture drifts, these fail, which is exactly what they are for.
 */

const spine = (page: import('@playwright/test').Page) =>
  page.getByRole('navigation', { name: 'Progress' });

test.describe('verdict — the landing screen', () => {
  test('states the group-color thesis with the group floor, not the mean', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/six skin tones/i)).toBeVisible();
    await expect(page.getByText(/no one is anyone.s worst option/i)).toBeVisible();
    await expect(page.getByText(/Nobody below 57\.8/)).toBeVisible();
  });

  test('the page has a single H1', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toHaveCount(1);
  });

  test('shows all six bridesmaids with Fitzpatrick I–VI', async ({ page }) => {
    await page.goto('/');
    const lineup = page.getByRole('region', { name: 'The lineup' });
    for (const numeral of ['I', 'II', 'III', 'IV', 'V', 'VI']) {
      await expect(lineup.getByText(`Fitzpatrick type ${numeral}`, { exact: true })).toHaveCount(1);
    }
  });

  test('recaps the counterfactual lift', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('+26.5').first()).toBeVisible();
  });
});

test.describe('compare — the counterfactual', () => {
  test('shows both scores for the most-hurt bridesmaid', async ({ page }) => {
    await page.goto('/');
    await spine(page)
      .getByRole('button', { name: /^Compare/ })
      .click();

    await expect(page.getByRole('heading', { level: 1 })).toContainText(/pays for the average/i);
    // Rust 38.8 → Marigold 65.3 on the Fitzpatrick V bridesmaid.
    await expect(page.getByText('Rust').first()).toBeVisible();
    await expect(page.getByText('38.8').first()).toBeVisible();
    await expect(page.getByText('65.3').first()).toBeVisible();
  });
});

test.describe('score — the objective toggle', () => {
  test('switching the objective changes the winning colorway', async ({ page }) => {
    await page.goto('/');
    await spine(page)
      .getByRole('button', { name: /^Score/ })
      .click();

    const pick = page.getByText('This objective picks').locator('..');
    await expect(pick).toContainText('Marigold');

    await page.getByRole('button', { name: 'Best on average' }).click();
    await expect(pick).toContainText('Rust');

    await page.getByRole('button', { name: 'Max-of-minimum' }).click();
    await expect(pick).toContainText('Marigold');
  });

  test('the scoring formula is on screen, not hidden behind a link', async ({ page }) => {
    await page.goto('/');
    await spine(page)
      .getByRole('button', { name: /^Score/ })
      .click();
    await expect(page.getByText(/0\.50·U \+ 0\.30·C \+ 0\.20·S/)).toBeVisible();
  });

  test('all 24 colorways are ranked', async ({ page }) => {
    await page.goto('/');
    await spine(page)
      .getByRole('button', { name: /^Score/ })
      .click();
    await expect(page.getByRole('listitem').filter({ hasText: 'worst:' })).toHaveCount(24);
  });
});

test.describe('render — honesty about what has not happened', () => {
  test('render cards are skeletons that do not claim a render', async ({ page }) => {
    await page.goto('/');
    await spine(page)
      .getByRole('button', { name: /^Render/ })
      .click();
    await expect(
      page.getByText('No render in the cached party — a live run fills this frame.'),
    ).toHaveCount(6);
    await expect(page.getByText('awaiting render')).toHaveCount(6);
  });
});

test.describe('create — real upload states', () => {
  test('six empty slots, start disabled until a bridesmaid is complete', async ({ page }) => {
    await page.goto('/');
    await spine(page)
      .getByRole('button', { name: /^Create/ })
      .click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Start a party');
    await expect(page.getByLabel(/^Name for bridesmaid/)).toHaveCount(6);
    await expect(page.getByRole('button', { name: /^Start the run/ })).toBeDisabled();
  });

  test('an unusable file surfaces the API’s own guidance', async ({ page }) => {
    await page.goto('/');
    await spine(page)
      .getByRole('button', { name: /^Create/ })
      .click();
    await page.locator('#b1-face').setInputFiles({
      name: 'not-a-photo.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not a photo'),
    });
    // Either the format is rejected up front, or the deployment has no key — both
    // are real, mapped errors, and both must render as an alert with guidance.
    const alert = page.locator('main [role="alert"]');
    await expect(alert).toBeVisible({ timeout: 15_000 });
    // Whatever the code, the card must offer the visitor a next action, never a raw code.
    await expect(alert).toContainText(/photo|key|connection/i);
  });
});
