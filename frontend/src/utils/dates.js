/**
 * Date formatting and grouping for bill history.
 *
 * Calendar months rather than relative buckets ("Today", "Yesterday"). Relative
 * labels read better for a feed, but they are relative to the clock, so the
 * same fixture data would land in a different bucket every day and any test
 * asserting on them would rot. Month headings are stable: the same data always
 * produces the same headers, and a bill from last year is still findable.
 *
 * `new Date(...).toLocaleDateString()` was being called inline on the bills tab,
 * which meant the format was whatever the visitor's locale happened to be and
 * the string could not be reasoned about. These are explicit and shared.
 */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Parsed once, and guarded: an unparseable date must not become `NaN`. */
const parse = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * A sortable key for the month a date falls in, e.g. `2026-09`.
 *
 * Zero-padded so a plain string sort is also a chronological sort.
 */
export const monthKey = (value) => {
  const d = parse(value);
  if (!d) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/** Heading text for a month key, e.g. `2026-09` becomes `September 2026`. */
export const monthLabel = (key) => {
  const [year, month] = String(key).split('-');
  const index = Number(month) - 1;
  if (!MONTHS[index]) return String(key);
  return `${MONTHS[index]} ${year}`;
};

/**
 * A full readable date, e.g. `5 March 2026`.
 *
 * For assistive tech. The compact stamp beside a bill renders as a day over an
 * abbreviated month and is hidden from screen readers, so without this the date
 * would exist only visually. Abbreviating for a screen reader would be worse:
 * "5 Mar" gives no year, and a bill list spans years.
 */
export const longDate = (value) => {
  const d = parse(value);
  if (!d) return '';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

/**
 * Group bills into calendar months, newest month first.
 *
 * Preserves the order it is given inside each month rather than re-sorting, so
 * this composes with whatever ordering the list already applies instead of
 * quietly replacing it. The API returns bills newest-first, so each month
 * comes out newest-first too.
 */
export const groupByMonth = (bills) => {
  const groups = new Map();
  for (const bill of bills ?? []) {
    const key = monthKey(bill?.created_at);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(bill);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([key, items]) => ({ key, label: monthLabel(key), bills: items }));
};

/**
 * A two-line date stamp for a bill row: the day over the month.
 *
 * The year is only added when the bill is not from the current one. Inside a
 * month heading the month is already implied, but the day still has to be
 * legible per row, and a year on every row is noise for the 99% of bills that
 * are from this year.
 *
 * @returns {{day: string, month: string, year: string|null, iso: string}}
 *   `iso` is the machine-readable value, for a `<time datetime>` attribute.
 */
export const dateStamp = (value, { now = new Date() } = {}) => {
  const d = parse(value);
  if (!d) return { day: '', month: '', year: null, iso: '' };
  const sameYear = d.getFullYear() === now.getFullYear();
  return {
    day: String(d.getDate()),
    month: MONTHS[d.getMonth()].slice(0, 3),
    year: sameYear ? null : String(d.getFullYear()),
    iso: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
  };
};
