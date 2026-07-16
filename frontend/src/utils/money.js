/**
 * Money formatting.
 *
 * Amounts come off the API as strings and every sum needs a number, so both
 * conversions live here. Shared rather than duplicated into each page: the
 * dashboard, the group header and the balance rows all had their own idea of
 * how a rupee amount should read.
 */

/**
 * Every amount in the app is rupees, formatted to two places.
 *
 * Grouped, because an unseparated four-figure amount is genuinely hard to read
 * at a glance: "₹1240.00" against "₹240.00" differ by a factor of five and look
 * like they differ by a digit. `en-IN` puts the separator where an Indian reader
 * expects it (₹12,480.00, ₹1,24,800.00) rather than the western 3-digit form.
 *
 * The two decimal places are pinned rather than left to the locale default,
 * which would drop them for a whole number. A minus goes *before* the symbol:
 * the default would give "₹-180.00", which reads as a positive rupee sign
 * followed by a negative number.
 */
export const rupees = (value) => {
  const n = asNumber(value);
  const grouped = Math.abs(n).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${n < 0 ? '−' : ''}₹${grouped}`;
};

/** Balances arrive as strings, so anything that sums them needs a number. */
export const asNumber = (value) => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/**
 * A balance with an explicit sign.
 *
 * Positive and negative balances are distinguished by colour, and colour alone
 * is not an accessible signal. The sign carries the same information in text.
 */
export const signedRupees = (value) => {
  const n = asNumber(value);
  if (n > 0) return `+${rupees(n)}`;
  if (n < 0) return `−${rupees(Math.abs(n))}`;
  return rupees(0);
};

/**
 * Text alternative for a balance, for titles and screen readers.
 *
 * A bare phrase, no amount, so it can be used as a `title` attribute or a
 * label beside a figure that is already on screen.
 */
export const balanceMeaning = (value) => {
  const n = asNumber(value);
  if (n > 0) return 'you are owed';
  if (n < 0) return 'you owe';
  return 'settled up';
};

/**
 * A full sentence for a balance, amount included.
 *
 * This wording was duplicated four times with three different sets of words:
 * "you are owed" / "you are down" / "you are settled up" on the group header,
 * "gets back" / "owes" / "settled up" on the balances tab, and the two above in
 * money.js and billStatus.js. Same fact, four phrasings, so a screen reader
 * user switching tabs hears the same balance described differently each time.
 * The group header and the balances tab now both call this.
 */
export const balanceSentence = (value) => {
  const n = asNumber(value);
  if (n > 0) return `you are owed ${rupees(n)}`;
  if (n < 0) return `you owe ${rupees(Math.abs(n))}`;
  return 'you are settled up';
};

/**
 * Tone class for a signed balance.
 *
 * Was byte-identical in Dashboard.jsx and Friends.jsx. Both now import it, so
 * "a positive balance is green" is stated once.
 */
export const netTone = (value) => {
  const n = asNumber(value);
  if (n > 0) return 'text-pos';
  if (n < 0) return 'text-neg';
  return 'text-muted';
};
