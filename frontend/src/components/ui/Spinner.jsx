/**
 * The one loading indicator.
 *
 * This was copy-pasted at four sizes across the app (Dashboard, GroupDetail,
 * AddBill, BillDetail, AcceptInvite, and twice inside the bill forms).
 *
 * `tone` exists because the two bill forms put their spinner on top of a filled
 * submit button, where the ring has to read against the button's own
 * foreground. Overriding the border colour through `className` instead would
 * put `border-accent` and `border-on-accent` in one class attribute, and those
 * resolve in stylesheet order, not class-attribute order.
 */

const SIZES = {
  xs: 'w-4 h-4 border-2',
  sm: 'w-6 h-6 border-2',
  md: 'w-10 h-10 border-4',
  lg: 'w-16 h-16 border-4',
};

const TONES = {
  accent: 'border-accent border-t-transparent',
  onAccent: 'border-on-accent border-t-transparent',
};

const Spinner = ({ size = 'md', tone = 'accent', className = '', label = 'Loading' }) => (
  <div
    role="status"
    aria-label={label}
    className={[
      SIZES[size] ?? SIZES.md,
      TONES[tone] ?? TONES.accent,
      'rounded-full animate-spin',
      className,
    ]
      .filter(Boolean)
      .join(' ')}
  />
);

/** Spinner plus a line of text, which is what every loading state wants. */
export const LoadingBlock = ({ text, size = 'md' }) => (
  <div className="flex flex-col items-center justify-center gap-4 py-20 text-muted">
    <Spinner size={size} />
    {text ? <p className="text-meta">{text}</p> : null}
  </div>
);

export default Spinner;
