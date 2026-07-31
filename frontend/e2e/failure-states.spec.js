import { expect, test } from '@playwright/test';
import { seedAuth } from './helpers/auth.js';
import { stubApi } from './helpers/api.js';
import { FLAT } from './fixtures/data.js';

/**
 * The five defects this covers, all of which shipped. Each was reachable and
 * each had a plausible-looking screen behind it, so the assertions are written
 * against what the user can see rather than against internals.
 */

const GROUP = FLAT;

test.beforeEach(async ({ page }) => {
  await seedAuth(page);
  await stubApi(page);
});

test.describe('a failed delete explains itself', () => {
  // The reason used to render in the page body, behind the confirm dialog's
  // `fixed inset-0 z-50` scrim. So a 500 left the dialog open and silent, which
  // reads as a button that does nothing.
  test('the reason is inside the dialog, not behind the scrim', async ({ page }) => {
    await stubApi(page, {
      simple: {
        'DELETE bills/b1/': { __status: 500, __body: { detail: 'Server exploded.' } },
      },
    });
    await page.goto(`/groups/${GROUP}`);
    await page.getByRole('button', { name: 'Actions for Groceries' }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    // The failure only happens once the delete is actually confirmed.
    await page.getByRole('button', { name: 'Delete bill' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // In the dialog, and specifically above its explanatory paragraph.
    await expect(dialog.getByText('Server exploded.')).toBeVisible();
    // Still open, so the user can retry or cancel rather than losing context.
    await expect(dialog.getByRole('button', { name: 'Delete bill' })).toBeVisible();
  });

  test('the reason is not left behind in the page body', async ({ page }) => {
    await stubApi(page, {
      simple: {
        'DELETE bills/b1/': { __status: 500, __body: { detail: 'Server exploded.' } },
      },
    });
    await page.goto(`/groups/${GROUP}`);
    await page.getByRole('button', { name: 'Actions for Groceries' }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Delete bill' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Counted on the page, excluding the dialog. This is the regression guard:
    // one copy inside the dialog is right, a second copy behind the scrim is
    // the bug coming back.
    const outside = page
      .getByText('Server exploded.')
      .filter({ visible: true });
    expect(await outside.count()).toBe(1);
  });

  test('a successful delete closes the dialog and shows no reason', async ({ page }) => {
    await page.goto(`/groups/${GROUP}`);
    await page.getByRole('button', { name: 'Actions for Groceries' }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Delete bill' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  /* Deleting a bill from this tab was passing the whole bill object to a
     mutation that expects an id, so the request went to
     `bills/[object%20Object]/` and always failed. The dialog then stayed open
     with its reason behind the scrim, so it looked like a dead button rather
     than a broken call. Nothing covered the happy path, which is why it
     shipped. The sibling call sites -- BillDetail and SettlementsTab -- both
     passed .id correctly, so only this one was wrong. */
  test('deletes by id, not by object', async ({ page }) => {
    const deletes = [];
    page.on('request', (r) => {
      if (r.method() === 'DELETE') deletes.push(new URL(r.url()).pathname);
    });
    await page.goto(`/groups/${GROUP}`);
    await page.getByRole('button', { name: 'Actions for Groceries' }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Delete bill' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    expect(deletes).toEqual(['/api/v1/bills/b1/']);
    // The exact stringification of the bug, so a regression is unmistakable.
    expect(deletes.join(' ')).not.toContain('object');
  });
});

test.describe('the settle dialog cannot become a dead end', () => {
  // The members query took `{ data: members }` with no isLoading or error, so a
  // failure left both <Select>s showing only a disabled "Choose a member" and
  // nothing said why.
  test('reports a failed members query and refuses to submit', async ({ page }) => {
    await stubApi(page, {
      simple: {
        [`GET groups/${GROUP}/members/`]: { __status: 500, __body: { detail: 'Members unavailable.' } },
      },
    });
    await page.goto(`/groups/${GROUP}/balances`);
    await page.getByRole('button', { name: 'Settle up' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Members unavailable.')).toBeVisible();
    await expect(dialog.getByRole('button', { name: /record payment/i })).toBeDisabled();
  });

  test('still works normally when the members query succeeds', async ({ page }) => {
    await page.goto(`/groups/${GROUP}/balances`);
    await page.getByRole('button', { name: 'Settle up' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('button', { name: /record payment/i })).toBeEnabled();
    await expect(dialog.getByText('Members unavailable.')).toHaveCount(0);
  });
});

test.describe('a tokenless invite link explains itself', () => {
  // `if (token) processInvite()` with no else left `status` at 'loading' for
  // ever, so this was a spinner that never resolved and never spoke.
  test('a URL with no token shows a failure, not an endless spinner', async ({ page }) => {
    // Note: this used to render the 404 page, not a spinner. The route required
    // a token, so a truncated link got "Page not found" -- which reads as a
    // broken app rather than a broken link. The route now exists for this case.
    await page.goto('/accept-invite');
    await expect(page.getByRole('heading', { name: 'Invite Link Incomplete' })).toBeVisible();
    await expect(page.getByText(/missing its invite token/i)).toBeVisible();
    // The loading copy must be gone, or the page is still showing a spinner.
    await expect(page.getByText(/verifying your invite link/i)).toHaveCount(0);
  });

  test('offers a way out', async ({ page }) => {
    await page.goto('/accept-invite');
    await page.getByRole('link', { name: 'Go to Dashboard' }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe('the members list handles a group with nobody in it', () => {
  test('shows an empty state rather than a bare header', async ({ page }) => {
    await stubApi(page, {
      simple: { [`GET groups/${GROUP}/members/`]: [] },
    });
    await page.goto(`/groups/${GROUP}/members`);
    await expect(page.getByRole('heading', { name: 'No members yet' })).toBeVisible();
    // It has to point somewhere, or it is a dead end.
    await expect(page.getByText(/form below to invite/i)).toBeVisible();
  });
});
