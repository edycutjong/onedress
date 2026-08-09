import { test, expect } from '@playwright/test';

/**
 * The second cached dataset: seven real people, measured live through the YouCam API
 * and rendered by cloth-v3. Two things are asserted here and neither is cosmetic.
 *
 *  1. The images are REAL and they load. The whole point of this dataset is that the
 *     app stops being illustrations, so a 404 on a render is a failed test, not a
 *     missing decoration.
 *  2. The engine finds NO divergence on this party, and the app reports that as a
 *     finding rather than an empty screen. If a future change starts manufacturing a
 *     counterfactual here, these fail — which is exactly what they are for.
 */

const spine = (page: import('@playwright/test').Page) =>
  page.getByRole('navigation', { name: 'Progress' });

const selectMeasured = async (page: import('@playwright/test').Page) => {
  await page.goto('/party');
  await page.getByRole('button', { name: 'Measured party (real photos)' }).click();
};

test.describe('measured party — real photographs', () => {
  test('switching datasets swaps the verdict to the measured party’s winner', async ({ page }) => {
    await page.goto('/party');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Marigold');

    await page.getByRole('button', { name: 'Measured party (real photos)' }).click();

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Wine');
    await expect(page.getByText(/Nobody below 56\.9/)).toBeVisible();
    // Real units, really spent — this party was not free.
    await expect(page.getByText(/222\/224 units spent/).first()).toBeVisible();
  });

  test('says what the imagery is: licensed stock, measured live', async ({ page }) => {
    await selectMeasured(page);
    await expect(page.getByText(/licensed stock photographs/i)).toBeVisible();
    await expect(page.getByText(/not bridesmaids, clients or customers/i)).toBeVisible();
  });

  test('the lineup shows real renders, each labelled as a render', async ({ page }) => {
    await selectMeasured(page);
    const lineup = page.getByRole('region', { name: 'The lineup' });

    // Six of the seven rendered; every one of them is a real file that must load.
    const images = lineup.locator('img');
    await expect(images).toHaveCount(6);
    for (let i = 0; i < 6; i += 1) {
      const img = images.nth(i);
      await expect(img).toHaveAttribute('src', /^\/party\/wine\/p\d\.jpg$/);
      const ok = await img.evaluate(
        (el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0,
      );
      expect(ok, 'a lineup render failed to load').toBe(true);
    }
    await expect(lineup.getByText('cloth-v3 render')).toHaveCount(6);
  });

  test('the measure screen shows the source frames the analyzers actually ran on', async ({
    page,
  }) => {
    await selectMeasured(page);
    await spine(page)
      .getByRole('button', { name: /^Measure/ })
      .click();

    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Seven measurements, not seven opinions',
    );
    // Six source frames; Person 5's was never committed, so her card stays an
    // illustration. Scoped to main — the shell banner also uses the phrase.
    await expect(page.locator('main').getByText('source frame')).toHaveCount(6);
    await expect(page.locator('img[src^="/party/faces/"]')).toHaveCount(6);
    await expect(page.locator('main').getByText('illustration')).toHaveCount(1);
  });

  test('the failed render is shown as failed, with the API’s own reason', async ({ page }) => {
    await selectMeasured(page);
    await spine(page)
      .getByRole('button', { name: /^Render/ })
      .click();

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Seven try-ons in Wine');
    // Six done, one failed — stated in the header counts rather than quietly dropped.
    await expect(page.getByText(/6\s*rendered/)).toBeVisible();
    await expect(page.getByText(/1\s*needs a re-shoot/)).toBeVisible();
    // error_pose, mapped through the shipped taxonomy — not hidden, not softened.
    const alert = page.locator('main [role="alert"]');
    await expect(alert).toHaveCount(1);
    await expect(alert).toContainText('Stand up straight');
  });
});

test.describe('measured party — compare reports the agreement', () => {
  test('states plainly that both objectives chose the same colorway', async ({ page }) => {
    await selectMeasured(page);
    await spine(page)
      .getByRole('button', { name: /^Compare/ })
      .click();

    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Both objectives picked the same colour',
    );
    // The spread that causes it, measured — not asserted.
    await expect(page.getByText(/span ITA/)).toBeVisible();
    await expect(page.getByText('59.9°')).toBeVisible();
    // And where the divergence does show up.
    await expect(page.getByText(/Demo party \(synthetic I–VI\)/).first()).toBeVisible();
    await expect(page.getByText(/135\.7°/)).toBeVisible();
  });

  test('shows one column, not an empty two-column split', async ({ page }) => {
    await selectMeasured(page);
    await spine(page)
      .getByRole('button', { name: /^Compare/ })
      .click();

    const table = page.getByRole('table');
    await expect(table.getByRole('columnheader')).toHaveCount(2); // person + the single pick
    await expect(table.getByRole('columnheader').nth(1)).toContainText(
      'Picked by OneDress · and by eye',
    );
  });

  test('the verdict claims no lift when there is none', async ({ page }) => {
    await selectMeasured(page);
    await expect(page.getByText('+0.0')).toBeVisible();
    await expect(page.getByText(/no lift to claim/i)).toBeVisible();
  });
});
