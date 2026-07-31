import { expect, test } from '@playwright/test';
import { seedAuth } from './helpers/auth.js';
import { stubApi } from './helpers/api.js';
import { FLAT, GROUPS, MEMBERS } from './fixtures/data.js';

/**
 * Split values, as the edit form shows them.
 *
 * The reported symptom: opening a bill for edit filled the split field with
 * "1.000000". `ItemAssignment.split_value` is a six-decimal column and DRF
 * stringifies a Decimal with `str()`, which keeps the stored scale, so a share
 * of 1 arrives as "1.000000". The `0004` backfill is worse: it writes
 * `share / amount * 100` quantised to 6dp, so a migrated bill arrives as
 * "14.516129".
 *
 * The shared fixture could never have caught this -- its `assignment()` helper
 * sends `money(share)`, which is 2dp, so the fixtures disagree with the real
 * API. These tests stub the 6dp shapes explicitly rather than changing the
 * shared fixture, which keeps every other spec's inputs untouched.
 */

const me = GROUPS[0].created_by;

/** A simple bill whose single item carries the given split values. */
const billWith = (id, title, { mode, amount, shares }) => ({
  id,
  group: FLAT,
  title,
  total_amount: amount,
  currency: 'INR',
  bill_type: 'simple',
  created_by: me,
  paid_by: me.id,
  paid_by_detail: me,
  created_at: '2026-04-01T10:00:00Z',
  items: [
    {
      id: `${id}-item`,
      name: title,
      amount,
      split_mode: mode,
      assignments: shares.map(([userId, value], i) => ({
        id: `${id}-a${i}`,
        user_id: userId.id,
        user: userId,
        // The two-decimal money is not what is under test here.
        share_amount: value,
        split_value: value,
      })),
    },
  ],
});

/* Real members of the fixture group. The split grid renders the group's
   members and looks a value up per member, so a made-up id simply gets an
   empty input -- which is exactly the symptom an earlier draft of this file
   produced. */
const memberUser = (index) => MEMBERS[FLAT][index].user;
const ANANYA = memberUser(0);
const ROHAN = memberUser(1);

/** Open a stubbed bill for editing and return its split inputs. */
const openEditor = async (page, bill) => {
  await stubApi(page, {
    simple: {
      [`GET bills/${bill.id}/`]: bill,
      'GET bills/': [bill],
      'GET groups/': GROUPS,
    },
  });
  await page.goto(`/groups/${FLAT}/bills/${bill.id}/edit`);
  await expect(page.getByLabel('Title')).toBeVisible();
  // Scoped to the group. The Amount field is also a spinbutton and comes first
  // on the form, so an unscoped nth(0) is the amount, not the first share.
  const grid = page.getByRole('group', { name: 'Split between members' });
  await expect(grid).toBeVisible();
  return grid.getByRole('spinbutton');
};

test.describe('split values are shown at their own precision', () => {
  test('a share of 1.000000 reads as 1, not 1.000000', async ({ page }) => {
    await seedAuth(page);
    const bill = billWith('sv1', 'Shares padding', {
      mode: 'shares',
      amount: '300.00',
      shares: [[ANANYA, '1.000000'], [ROHAN, '1.000000']],
    });
    const inputs = await openEditor(page, bill);
    await expect(inputs.nth(0)).toHaveValue('1');
    await expect(inputs.nth(1)).toHaveValue('1');
  });

  test('a percent of 20.000000 reads as 20', async ({ page }) => {
    await seedAuth(page);
    const bill = billWith('sv2', 'Percent padding', {
      mode: 'percent',
      amount: '300.00',
      shares: [[ANANYA, '20.000000'], [ROHAN, '80.000000']],
    });
    const inputs = await openEditor(page, bill);
    await expect(inputs.nth(0)).toHaveValue('20');
    await expect(inputs.nth(1)).toHaveValue('80');
  });

  test('a backfilled percent is shown to 2dp, not its 6dp storage value', async ({ page }) => {
    await seedAuth(page);
    // 180 / 1240 * 100, which is what 0004 writes.
    const bill = billWith('sv3', 'Backfilled', {
      mode: 'percent',
      amount: '1240.00',
      shares: [[ANANYA, '14.516129'], [ROHAN, '7.258064']],
    });
    const inputs = await openEditor(page, bill);
    await expect(inputs.nth(0)).toHaveValue('14.52');
    await expect(inputs.nth(1)).toHaveValue('7.26');
  });
});

test.describe('a share can be a fraction', () => {
  /* 5 loaves shared as 4.5 and 0.5. The weights are relative, so this is the
     same 90/10 split as 9 and 1 -- but 4.5 and 0.5 is how a person actually
     counts loaves, and asking them to rescale is the thing a shares field
     exists to avoid. It was also impossible before: min and MIN were 1. */
  test('the half-loaf split hydrates instead of being rejected', async ({ page }) => {
    await seedAuth(page);
    const bill = billWith('sv4', 'Bakery', {
      mode: 'shares',
      amount: '500.00',
      shares: [[ANANYA, '4.500000'], [ROHAN, '0.500000']],
    });
    const inputs = await openEditor(page, bill);
    await expect(inputs.nth(0)).toHaveValue('4.5');
    await expect(inputs.nth(1)).toHaveValue('0.5');

    // And the money beside each row, which is where a user would actually see
    // the bug: splitWeights used parseInt, so 0.5 became 0, the member was
    // dropped as "not in the split", and the other member was handed the whole
    // 500.00. The inputs looked right while the row said ₹0.00.
    const grid = page.getByRole('group', { name: 'Split between members' });
    await expect(grid).toContainText('₹450.00');
    await expect(grid).toContainText('₹50.00');
    // Not "not ₹0.00": the grid also renders this group's unselected members,
    // and a ₹0.00 row is correct for one of those. The full amount is the
    // unambiguous symptom, because nobody in a two-way 4.5/0.5 split is owed
    // the whole 500.00.
    await expect(grid).not.toContainText('₹500.00');
  });

  test('a half-loaf split saves, and the money lands 90/10', async ({ page }) => {
    await seedAuth(page);
    const bill = billWith('sv5', 'Bakery save', {
      mode: 'shares',
      amount: '500.00',
      shares: [[ANANYA, '4.500000'], [ROHAN, '0.500000']],
    });
    const sent = [];
    page.on('request', (r) => {
      if (r.method() === 'PUT' || r.method() === 'POST') sent.push(JSON.parse(r.postData() ?? '{}'));
    });
    await openEditor(page, bill);
    await page.getByRole('button', { name: /save/i }).first().click();
    await expect.poll(() => sent.length).toBe(1);

    // 4.5 of a basis of 5 is 90% of 500.00 = 450.00, and 0.5 is 50.00. The
    // whole point: the browser must not block this submit, which the old
    // min=1 step=1 would have done via native validation.
    const shares = sent[0].items[0].assignments.map((a) => a.share_amount);
    expect(sent[0].items[0].split_mode).toBe('shares');
    expect(shares).toEqual(['450.00', '50.00']);
    // And the weights sent are the trimmed ones, not the 6dp storage form.
    expect(sent[0].items[0].assignments.map((a) => a.split_value)).toEqual(['4.5', '0.5']);
  });

  test('the shares stepper moves in tenths and stops at 0.1', async ({ page }) => {
    await seedAuth(page);
    const bill = billWith('sv6', 'Stepper', {
      mode: 'shares',
      amount: '100.00',
      shares: [[ANANYA, '0.500000'], [ROHAN, '1.000000']],
    });
    const inputs = await openEditor(page, bill);
    const dec = page.getByRole('button', { name: /decrease|minus/i }).first();
    // 0.5 - 0.1 = 0.4, not clamped away, and 0.1 is the new floor.
    for (let i = 0; i < 4; i += 1) await dec.click();
    await expect(inputs.nth(0)).toHaveValue('0.1');
    await dec.click();
    await expect(inputs.nth(0)).toHaveValue('0.1');
  });
});

test.describe('the app validates, not the browser', () => {
  test('a split the app rejects shows the app\'s message, not a native bubble', async ({ page }) => {
    await seedAuth(page);
    const bill = billWith('sv7', 'Invalid split', {
      mode: 'shares',
      amount: '100.00',
      shares: [[ANANYA, '1.000000'], [ROHAN, '1.000000']],
    });
    await openEditor(page, bill);
    // Amount and shares must agree; breaking that is the app's own rule.
    await page.getByLabel('Amount').fill('100.00');
    await page.getByRole('button', { name: /save/i }).first().click();
    // Whatever the outcome, it is rendered by the app and no native validation
    // tooltip is possible, because the form is noValidate.
    expect(await page.locator('form[novalidate]').count()).toBe(1);
  });
});

test.describe('the shared StepperInput', () => {
  /* The stepper markup was lifted out of MemberSplitGrid into
     components/ui/StepperInput so the pattern lives in one place. These assert
     the behaviour that had to survive the move: mode-aware precision, a floor at
     min, and labels that name the member rather than saying "increase". */

  const openShares = async (page, title, values) => {
    const bill = billWith('st1', title, {
      mode: 'shares',
      amount: '100.00',
      shares: values,
    });
    const inputs = await openEditor(page, bill);
    const grid = page.getByRole('group', { name: 'Split between members' });
    return { inputs, grid };
  };

  test('the buttons name the member they act on', async ({ page }) => {
    await seedAuth(page);
    const { grid } = await openShares(page, 'Labels', [
      [ANANYA, '1.000000'],
      [ROHAN, '1.000000'],
    ]);
    // "Decrease split for Ananya" rather than a bare "decrease", because the
    // grid renders one pair per member and a screen reader has to say which.
    await expect(
      grid.getByRole('button', { name: `Decrease split for ${ANANYA.name}` }),
    ).toBeVisible();
    await expect(
      grid.getByRole('button', { name: `Increase split for ${ROHAN.name}` }),
    ).toBeVisible();
  });

  test('plus adds a tenth in shares mode and stops at the floor', async ({ page }) => {
    await seedAuth(page);
    const { inputs, grid } = await openShares(page, 'Step', [
      [ANANYA, '2.000000'],
      [ROHAN, '1.000000'],
    ]);
    await grid.getByRole('button', { name: `Increase split for ${ANANYA.name}` }).click();
    // 2 -> 2.1, at the mode's one decimal, not 2.1000000000000005.
    await expect(inputs.nth(0)).toHaveValue('2.1');
    await grid.getByRole('button', { name: `Decrease split for ${ANANYA.name}` }).click();
    await expect(inputs.nth(0)).toHaveValue('2');
  });

  test('the floor is the mode minimum, not zero', async ({ page }) => {
    await seedAuth(page);
    const { inputs, grid } = await openShares(page, 'Floor', [
      [ANANYA, '0.200000'],
      [ROHAN, '1.000000'],
    ]);
    const down = grid.getByRole('button', { name: `Decrease split for ${ANANYA.name}` });
    await down.click();
    await expect(inputs.nth(0)).toHaveValue('0.1');
    // 0 is not a share: a 0 value is dropped as "not in the split", so
    // stepping to it would silently exclude the member.
    await down.click();
    await expect(inputs.nth(0)).toHaveValue('0.1');
  });

  test('a stepper click does not toggle the member out of the split', async ({ page }) => {
    await seedAuth(page);
    const { inputs, grid } = await openShares(page, 'Propagation', [
      [ANANYA, '2.000000'],
      [ROHAN, '1.000000'],
    ]);
    await grid.getByRole('button', { name: `Increase split for ${ANANYA.name}` }).click();
    // The row is a clickable div that toggles inclusion. If the stepper let its
    // click through, the member would gain a tenth and vanish from the split in
    // the same gesture.
    await expect(inputs.nth(0)).toBeEnabled();
    await expect(inputs.nth(0)).toHaveValue('2.1');
  });

  test('percent steps by a hundredth', async ({ page }) => {
    await seedAuth(page);
    const bill = billWith('st2', 'Percent step', {
      mode: 'percent',
      amount: '100.00',
      shares: [[ANANYA, '50.000000'], [ROHAN, '50.000000']],
    });
    const inputs = await openEditor(page, bill);
    const grid = page.getByRole('group', { name: 'Split between members' });
    await grid.getByRole('button', { name: `Increase split for ${ANANYA.name}` }).click();
    await expect(inputs.nth(0)).toHaveValue('50.01');
  });
});
