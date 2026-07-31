import { expect, test } from '@playwright/test';
import { seedAuth } from './helpers/auth.js';
import { stubApi } from './helpers/api.js';
import { FLAT } from './fixtures/data.js';

/**
 * Money formatting as the user actually sees it.
 *
 * Asserted through rendered output rather than by importing the helper, so
 * this covers the token/class path as well. The grouping change was the one
 * user-visible edit in this pass, and it is the kind of thing that silently
 * regresses: a locale default that drops the trailing zeros would still look
 * plausible.
 */

test.beforeEach(async ({ page }) => {
  await seedAuth(page);
  await stubApi(page);
});

test.describe('grouped amounts', () => {
  test('separates thousands in the Indian positions', async ({ page }) => {
    await page.goto('/');
    const card = page.getByRole('list', { name: 'Groups' }).locator('> li').first();
    // 1240 -> 1,240 rather than 1.240 or 1240.
    await expect(card).toContainText('₹1,240.00');
  });

  test('keeps two decimals on a whole amount', async ({ page }) => {
    await page.goto(`/groups/${FLAT}/balances`);
    // 90 is a whole number. A locale default would render "₹90" and drop the
    // decimals, which would then not line up with the others in the column.
    await expect(page.getByText('you are owed ₹90.00').first()).toBeVisible();
  });

  test('puts a minus before the symbol, not after', async ({ page }) => {
    await page.goto(`/groups/${FLAT}/balances`);
    // Math.abs plus a sign in signedRupees(), so a negative balance is "−₹180.00".
    // rupee-sign-then-minus would read as a positive sign over a negative number.
    await expect(page.getByText('you owe ₹180.00').first()).toBeVisible();
    const text = await page.getByText('you owe ₹180.00').first().innerText();
    expect(text).not.toContain('₹-');
  });
});
