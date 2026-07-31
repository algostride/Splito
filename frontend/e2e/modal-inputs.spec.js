import { expect, test } from '@playwright/test';
import { seedAuth } from './helpers/auth.js';
import { stubApi } from './helpers/api.js';
import { FLAT } from './fixtures/data.js';

/**
 * Typing into a modal, and the number affordances.
 *
 * The focus tests use `pressSequentially` rather than `fill`, and that is the
 * whole point. `fill` writes a value in one shot with no intermediate render, so
 * it can never have caught the bug this file exists for: the Modal's focus effect
 * depended on `onClose`, every call site passes an inline arrow, so every
 * keystroke produced a new function identity, the effect re-fired, and its
 * cleanup restored focus to the opener before the body moved focus to the panel.
 * The caret was thrown out of the input after every single character, so typing
 * 400 needed a click before each digit.
 */

test.beforeEach(async ({ page }) => {
  await seedAuth(page);
  await stubApi(page);
});

const openSettle = async (page) => {
  await page.goto(`/groups/${FLAT}/balances`);
  await page.getByRole('button', { name: 'Settle up' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  return dialog;
};

test.describe('typing in a modal keeps the caret', () => {
  test('a multi-digit amount can be typed without clicking again', async ({ page }) => {
    const dialog = await openSettle(page);
    const amount = dialog.getByLabel('How much?');

    await amount.click();
    await amount.pressSequentially('4');
    // The regression. Without the fix this fails here: focus has already been
    // thrown back to the panel.
    await expect(amount).toBeFocused();

    await amount.pressSequentially('00');
    await expect(amount).toBeFocused();
    await expect(amount).toHaveValue('400');
  });

  test('a decimal amount keeps the caret through the point', async ({ page }) => {
    const dialog = await openSettle(page);
    const amount = dialog.getByLabel('How much?');
    await amount.click();
    await amount.pressSequentially('47.50');
    await expect(amount).toBeFocused();
    await expect(amount).toHaveValue('47.50');
  });

  test('the member selects keep focus after being chosen', async ({ page }) => {
    const dialog = await openSettle(page);
    const payer = dialog.getByLabel('Who paid?');
    // Focused first on purpose: Playwright's selectOption sets the value without
    // necessarily moving focus, so the earlier draft of this test failed for a
    // reason that had nothing to do with the app. Clicking a select then choosing
    // an option is also what a person actually does.
    await payer.focus();
    await payer.selectOption({ index: 1 });
    // A select is not typed into, so losing focus here reads as the effect
    // re-firing on the state change -- the same bug as the text fields, just
    // less noticeable because there is no caret to watch.
    await expect(payer).toBeFocused();
  });

  test('a group name can be typed without clicking again', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /create group/i }).click();
    const dialog = page.getByRole('dialog');
    const name = dialog.getByLabel('Group name');
    await name.click();
    await name.pressSequentially('Flat');
    await expect(name).toBeFocused();
    await name.pressSequentially(' 12');
    await expect(name).toHaveValue('Flat 12');
  });

  test('focus still returns to the opener when the dialog closes', async ({ page }) => {
    const opener = page.getByRole('button', { name: 'Settle up' });
    await page.goto(`/groups/${FLAT}/balances`);
    await opener.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    // The behaviour the ref change had to preserve: keyed on [open] alone, the
    // effect still runs its cleanup on close and gives focus back.
    await expect(opener).toBeFocused();
  });
});

test.describe('number inputs have no native arrows', () => {
  test('the settle amount offers no browser spinner', async ({ page }) => {
    const dialog = await openSettle(page);
    const amount = dialog.getByLabel('How much?');
    // The class is what suppresses the arrows; the computed appearance is the
    // check that it actually took effect.
    await expect(amount).toHaveClass(/no-number-spinner/);
    const appearance = await amount.evaluate(
      (el) => getComputedStyle(el).appearance,
    );
    expect(['none', 'textfield']).toContain(appearance);
  });

  test('no number input anywhere is left with native arrows', async ({ page }) => {
    await page.goto(`/groups/${FLAT}/add-bill?type=simple`);
    const amount = page.getByLabel('Amount');
    await expect(amount).toHaveClass(/no-number-spinner/);
  });
});

test.describe('the amount is capped at 2dp by a message, not a keystroke', () => {
  test('a third decimal is accepted into the field', async ({ page }) => {
    const dialog = await openSettle(page);
    const amount = dialog.getByLabel('How much?');
    await amount.click();
    // Not blocked, not silently dropped. The digit lands, and the app objects on
    // submit. Swallowing it would break someone typing 4.5 then 6 for 4.56.
    await amount.pressSequentially('4.567');
    await expect(amount).toHaveValue('4.567');
  });

  test('and rejected on submit, in the app\'s words, with no request', async ({ page }) => {
    const posts = [];
    page.on('request', (r) => {
      if (r.method() === 'POST') posts.push(new URL(r.url()).pathname);
    });
    const dialog = await openSettle(page);
    await dialog.getByLabel('Who paid?').selectOption({ index: 1 });
    await dialog.getByLabel('Who was paid?').selectOption({ index: 2 });
    const amount = dialog.getByLabel('How much?');
    await amount.click();
    await amount.pressSequentially('4.567');
    await dialog.getByRole('button', { name: /record payment/i }).click();

    await expect(dialog.getByText('Use at most 2 decimal places.')).toBeVisible();
    // No doomed request. The server would reject it with the same rule, but
    // making the user wait for that is pointless.
    expect(posts).toEqual([]);
  });

  test('zero and an empty amount are both refused, with distinct messages', async ({ page }) => {
    const dialog = await openSettle(page);
    await dialog.getByLabel('Who paid?').selectOption({ index: 1 });
    await dialog.getByLabel('Who was paid?').selectOption({ index: 2 });

    await dialog.getByRole('button', { name: /record payment/i }).click();
    await expect(dialog.getByText('Enter an amount.')).toBeVisible();

    await dialog.getByLabel('How much?').fill('0');
    await dialog.getByRole('button', { name: /record payment/i }).click();
    await expect(dialog.getByText('Amount must be more than 0.')).toBeVisible();
  });

  test('two decimal places are accepted and do submit', async ({ page }) => {
    const posts = [];
    page.on('request', (r) => {
      if (r.method() === 'POST') posts.push(JSON.parse(r.postData() ?? '{}'));
    });
    const dialog = await openSettle(page);
    await dialog.getByLabel('Who paid?').selectOption({ index: 1 });
    await dialog.getByLabel('Who was paid?').selectOption({ index: 2 });
    const amount = dialog.getByLabel('How much?');
    await amount.click();
    await amount.pressSequentially('47.50');
    await dialog.getByRole('button', { name: /record payment/i }).click();

    await expect.poll(() => posts.length).toBe(1);
    expect(posts[0].amount).toBe('47.50');
  });
});
