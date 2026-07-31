import { expect, test } from '@playwright/test';
import { seedAuth } from './helpers/auth.js';
import { stubApi } from './helpers/api.js';
import { FLAT } from './fixtures/data.js';

test.beforeEach(async ({ page }) => {
  await seedAuth(page);
  await stubApi(page);
});

const addBillButton = (page) => page.getByRole('button', { name: 'Add bill' });
const option = (page, name) => page.getByRole('menuitem', { name: new RegExp(name, 'i') });

test.describe('add bill entry', () => {
  test('the header button opens a picker instead of navigating', async ({ page }) => {
    await page.goto(`/groups/${FLAT}`);
    await expect(page).toHaveURL(new RegExp(`/groups/${FLAT}$`));

    await addBillButton(page).click();
    // Both options are offered without having left the group page.
    await expect(option(page, 'Simple bill')).toBeVisible();
    await expect(option(page, 'Compound bill')).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/groups/${FLAT}$`));
  });

  test('choosing simple opens the simple form', async ({ page }) => {
    await page.goto(`/groups/${FLAT}`);
    await addBillButton(page).click();
    await option(page, 'Simple bill').click();

    await expect(page).toHaveURL(new RegExp(`/groups/${FLAT}/add-bill\\?type=simple$`));
    // The simple form's own field, not the chooser.
    await expect(page.getByRole('textbox', { name: /title/i })).toBeVisible();
    await expect(option(page, 'Simple bill')).toHaveCount(0);
  });

  test('choosing compound opens the compound form', async ({ page }) => {
    await page.goto(`/groups/${FLAT}`);
    await addBillButton(page).click();
    await option(page, 'Compound bill').click();

    await expect(page).toHaveURL(new RegExp(`/groups/${FLAT}/add-bill\\?type=compound$`));
    // The compound form has its own tab list, which the simple one does not.
    await expect(page.getByRole('tablist')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Items' })).toBeVisible();
  });

  test('Escape closes the picker without navigating', async ({ page }) => {
    await page.goto(`/groups/${FLAT}`);
    await addBillButton(page).click();
    await expect(option(page, 'Simple bill')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(option(page, 'Simple bill')).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`/groups/${FLAT}$`));
  });

  test('clicking away closes the picker', async ({ page }) => {
    await page.goto(`/groups/${FLAT}`);
    await addBillButton(page).click();
    await expect(option(page, 'Simple bill')).toBeVisible();

    await page.locator('h1').first().click();
    await expect(option(page, 'Simple bill')).toHaveCount(0);
  });

  test('the picker is reachable at every width', async ({ page }) => {
    // Below sm the button's label is hidden, so without an aria-label this
    // button is a bare + icon that announces as nothing and cannot be addressed.
    await page.goto(`/groups/${FLAT}`);
    await expect(addBillButton(page)).toBeVisible();
    await addBillButton(page).click();
    await expect(option(page, 'Simple bill')).toBeInViewport();
  });
});

test.describe('add bill without a type', () => {
  test('the on-page chooser is still the fallback for a direct visit', async ({ page }) => {
    await page.goto(`/groups/${FLAT}/add-bill`);
    // Reached by typing the URL or following an old bookmark, so it has to
    // still work even though the popup is the normal way in.
    await expect(page.getByRole('button', { name: 'Simple bill' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Compound bill' })).toBeVisible();
  });

  test('the fallback chooser leads to the form too', async ({ page }) => {
    await page.goto(`/groups/${FLAT}/add-bill`);
    await page.getByRole('button', { name: 'Simple bill' }).click();
    await expect(page.getByRole('textbox', { name: /title/i })).toBeVisible();
  });

  test('editing a bill never offers the chooser', async ({ page }) => {
    await page.goto(`/groups/${FLAT}/bills/b1/edit`);
    await expect(page.getByRole('textbox', { name: /title/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Simple bill' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Compound bill' })).toHaveCount(0);
  });
});
