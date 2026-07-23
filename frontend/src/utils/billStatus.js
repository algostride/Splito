/**
 * What a bill means for the signed-in user.
 *
 * Derived entirely from the bill payload. `items[].assignments[]` already
 * carries `user_id` and `share_amount`, and `paid_by` says who fronted the
 * money, so the three states the Bills tab shows need no new endpoint and no
 * second request.
 *
 * The subtlety is that a bill's status is not the same as its payer's
 * identity, and a bill is not always "not involved" just because the user is
 * not the payer. A compound bill can include the user in one item and not
 * another, and a bill can include the user in no item at all. Summing shares
 * across items first, then comparing against the payer, gets all of these
 * right without special cases.
 */

import { asNumber } from './money';

/**
 * The signed-in user's share and everyone else's, in rupees.
 *
 * Sums in paise and rounds once at the end. Summing per-item `share_amount`
 * values as floats drifts on real inputs: 0.29 + 0.29 + 0.29 + 0.13, a four-way
 * split of a rupee, comes to 0.9999999999999999, which would report a fully
 * paid share as short and quietly disagree with the backend's own total.
 *
 * Both totals come from one pass, so they cannot disagree with each other.
 */
const splitTotals = (bill, userId) => {
  let mine = 0;
  let others = 0;
  for (const item of bill?.items ?? []) {
    for (const assignment of item?.assignments ?? []) {
      const paise = asNumber(assignment?.share_amount) * 100;
      if (assignment?.user_id === userId) mine += paise;
      else others += paise;
    }
  }
  return { share: Math.round(mine) / 100, others: Math.round(others) / 100 };
};

/**
 * @returns {{kind: 'owe'|'owed'|'none', amount: number, share: number}}
 *   `owe`  the user is not the payer and has a share to pay
 *   `owed` the user paid and others owe them the remainder
 *   `none` the user has no share and did not pay
 *
 * `share` is the user's own portion either way, which the row shows as context.
 *
 * A paid bill where nobody else has a share is reported as `none` rather than
 * `owed` with an amount of zero: a user who fronted a bill entirely for
 * themselves is not owed anything, and "you are owed ₹0.00" is noise.
 */
export const deriveBillStatus = (bill, userId) => {
  if (!userId) return { kind: 'none', amount: 0, share: 0 };

  const { share, others } = splitTotals(bill, userId);

  if (bill?.paid_by === userId) {
    if (others > 0) return { kind: 'owed', amount: others, share };
    return { kind: 'none', amount: 0, share };
  }
  if (share > 0) return { kind: 'owe', amount: share, share };
  return { kind: 'none', amount: 0, share };
};

/** Sentence form of a status, for the row and for accessible names. */
export const billStatusLabel = (status) => {
  if (status?.kind === 'owe') return 'you owe';
  if (status?.kind === 'owed') return 'you are owed';
  return 'not involved';
};
