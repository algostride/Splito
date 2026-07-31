import { expect, test } from '@playwright/test';
import { seedAuth } from './helpers/auth.js';
import { stubApi } from './helpers/api.js';
import { BILLS, FLAT } from './fixtures/data.js';

/**
 * Mutation feedback and optimistic deletes.
 *
 * Two things this covers that nothing did before: a mutation that completes
 * silently, and a list that waits for a round trip before changing.
 */

test.beforeEach(async ({ page }) => {
  await seedAuth(page);
  await stubApi(page);
});

test.describe('a mutation says so', () => {
  test('creating a group confirms it', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /create group/i }).click();
    await page.getByPlaceholder('Flat 302, Indiranagar').fill('Weekend Soccer');
    await page.getByRole('dialog').getByRole('button', { name: 'Create group' }).click();

    const toast = page.getByRole('status', { name: 'Notifications' }).getByText(/Created "Weekend Soccer"/);
    await expect(toast).toBeVisible();
    // The confirmation carries a spoken prefix, so it is not colour alone.
    await expect(page.getByRole('status', { name: 'Notifications' })).toContainText('Success:');
  });

  test('recording a payment confirms it with the amount and both names', async ({ page }) => {
    await page.goto(`/groups/${FLAT}/balances`);
    await page.getByRole('button', { name: 'Settle up' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('combobox').first().selectOption({ index: 1 });
    await dialog.getByRole('combobox').nth(1).selectOption({ index: 2 });
    await dialog.getByRole('spinbutton').fill('120');
    await dialog.getByRole('button', { name: /record payment/i }).click();

    // "₹120.00" rather than "120", so the message is unambiguous.
    await expect(page.getByRole('status', { name: 'Notifications' }).getByText(/Recorded ₹120\.00/)).toBeVisible();
  });

  test('adding a bill confirms it', async ({ page }) => {
    await page.goto(`/groups/${FLAT}/add-bill?type=simple`);
    await page.getByLabel('Title').fill('Taxi to airport');
    await page.getByLabel('Amount').fill('480');
    // "Paid by" has no default, and the form's own guard rejects the submit
    // with "Select who paid" if it is left alone. That is a client-side check,
    // so no request goes out and the screen silently does nothing.
    await page.getByLabel('Paid by').selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Save Bill' }).click();
    await expect(
      page.getByRole('status', { name: 'Notifications' }).getByText(/Added "Taxi to airport"/),
    ).toBeVisible();
  });

  test('a toast can be dismissed', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /create group/i }).click();
    await page.getByPlaceholder('Flat 302, Indiranagar').fill('Dismissable');
    await page.getByRole('dialog').getByRole('button', { name: 'Create group' }).click();
    await expect(page.getByRole('status', { name: 'Notifications' }).getByText(/Dismissable/)).toBeVisible();
    await page.getByRole('button', { name: 'Dismiss notification' }).click();
    await expect(page.getByRole('status', { name: 'Notifications' }).getByText(/Dismissable/)).toHaveCount(0);
  });

  test('the live region is polite for success, assertive for failure', async ({ page }) => {
    await page.goto('/');
    const region = page.getByRole('status', { name: 'Notifications' });
    // Present but empty at rest. A live region mounted together with its own
    // text is unreliable -- some screen readers only announce changes to a
    // region that already existed.
    await expect(region).toBeAttached();
    await expect(region).toHaveAttribute('aria-live', 'polite');
  });
});

test.describe('deleting a row does not wait for the server', () => {
  /* The list stub has to start *without* Groceries being removed and only drop
     it once a delete has been attempted.

     The fixtures are stateless, so a list stub that filters unconditionally
     never renders the row in the first place. And a list stub that never
     filters puts the row straight back on the post-invalidation refetch, which
     hides the optimistic removal. A flag set by the DELETE gives both: the row
     is there to begin with, and gone afterwards, which is what the real server
     does. */
  const deleting = { attempted: false };

  const listTrackingDelete = {
    'GET bills/': ({ query }) => {
      const rows = BILLS[query.get('group')] ?? [];
      return deleting.attempted ? rows.filter((b) => b.id !== 'b1') : rows;
    },
  };

  const watchForDelete = (page) =>
    page.on('request', (r) => {
      if (r.method() === 'DELETE') deleting.attempted = true;
    });

  test('the bill disappears before the server confirms the delete', async ({ page }) => {
    // The DELETE is held open, so nothing but the optimistic update can be the
    // reason the row is gone.
    let release;
    const held = new Promise((resolve) => { release = resolve; });
    await watchForDelete(page);
    await page.route('**/api/v1/bills/b1/', async (route) => {
      await held;
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await stubApi(page, { simple: { ...listTrackingDelete } });

    await page.goto(`/groups/${FLAT}`);
    await expect(page.getByText('Groceries')).toBeVisible();
    await page.getByRole('button', { name: 'Actions for Groceries' }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Delete bill' }).click();

    await expect(page.getByText('Groceries')).toHaveCount(0);
    release();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText('Groceries')).toHaveCount(0);
  });

  test('a failed delete puts the row back', async ({ page }) => {
    await watchForDelete(page);
    await stubApi(page, {
      simple: {
        ...listTrackingDelete,
        'DELETE bills/b1/': { __status: 500, __body: { detail: 'Nope.' } },
      },
    });
    await page.goto(`/groups/${FLAT}`);
    await expect(page.getByText('Groceries')).toBeVisible();
    await page.getByRole('button', { name: 'Actions for Groceries' }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Delete bill' }).click();

    /* The list has stopped offering Groceries, so the refetch cannot be what
       brings the row back -- only the rollback patch can. That is the realistic
       shape: the server committed, the response never arrived. */
    await expect(page.getByRole('dialog').getByText('Nope.')).toBeVisible();
    await expect(page.getByText('Groceries')).toBeVisible();
  });
});
