/**
 * Button with no visible label.
 *
 * Only for controls whose meaning is the icon, and `label` is required rather
 * than optional: the compound bill form's rename/remove controls were four
 * bare `<button>` elements wrapping an SVG with nothing else in them, which
 * announced as "button" and nothing more.
 */

const TONES = {
  faint: 'text-faint hover:text-text hover:bg-surface-2',
  danger: 'text-faint hover:text-neg hover:bg-neg-soft',
  settle: 'text-pos hover:bg-pos-soft',
  neutral: 'text-faint hover:text-text',
};

const SIZES = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
};

const IconButton = ({
  tone = 'faint',
  size = 'sm',
  label,
  className = '',
  type = 'button',
  children,
  ...rest
}) => (
  <button
    type={type}
    aria-label={label}
    title={label}
    className={[
      'press inline-flex items-center justify-center rounded-control transition-colors',
      'disabled:opacity-50 disabled:pointer-events-none',
      TONES[tone] ?? TONES.faint,
      SIZES[size] ?? SIZES.sm,
      className,
    ]
      .filter(Boolean)
      .join(' ')}
    {...rest}
  >
    {children}
  </button>
);

export default IconButton;
