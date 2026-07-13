/**
 * The surface every panel in the app is built from.
 *
 * Padding is opt-in rather than baked in. The mock's tables need the wrapper to
 * own the outer inset while the outermost cells drop their own padding, and
 * that only lines up if the wrapper is padding-free, so `pad` defaults to none
 * and callers say `pad="card"` when they want it.
 */

const PAD = {
  none: '',
  card: 'p-card',
  gutter: 'p-gutter',
};

const Card = ({ pad = 'none', lift = false, className = '', children, ...rest }) => (
  <div
    className={[
      lift ? 'hover-lift' : '',
      'rounded-card border border-border bg-surface shadow-card',
      PAD[pad] ?? PAD.none,
      className,
    ]
      .filter(Boolean)
      .join(' ')}
    {...rest}
  >
    {children}
  </div>
);

export default Card;
