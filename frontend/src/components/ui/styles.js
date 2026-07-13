/**
 * Shared class strings and name derivations.
 *
 * These live apart from the components on purpose. `react-refresh` (see
 * eslint.config.js) rejects a module that exports both a component and a
 * plain function, because HMR cannot then swap the component in isolation. So
 * each primitive keeps its component in its own file, and the vocabulary they
 * share is collected here.
 */

/* ------------------------------------------------------------------ button */

const BUTTON_BASE =
  'press inline-flex items-center justify-center gap-2 rounded-control font-semibold ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ' +
  'whitespace-nowrap select-none disabled:opacity-50 disabled:pointer-events-none';

const BUTTON_VARIANTS = {
  primary: 'bg-accent text-on-accent hover:bg-accent-2',
  secondary: 'bg-surface text-text border border-border hover:bg-surface-2',
  ghost: 'text-muted hover:bg-surface-2 hover:text-text',
  danger: 'bg-neg text-on-accent hover:opacity-90',
  settle: 'bg-pos text-on-accent hover:opacity-90',
};

const BUTTON_SIZES = {
  sm: 'h-control-sm px-3 text-meta',
  md: 'h-control px-4 text-body',
};

/**
 * Exported separately from the Button component because a lot of "buttons"
 * here are really links. A polymorphic `as={Link}` wrapper would have to
 * forward refs and merge event handlers to do the same job; a class helper does
 * not, and `<Link className={buttonClass(...)}>` reads the same as `<Button>`.
 */
export const buttonClass = ({ variant = 'primary', size = 'md', className = '' } = {}) =>
  [
    BUTTON_BASE,
    BUTTON_VARIANTS[variant] ?? BUTTON_VARIANTS.primary,
    BUTTON_SIZES[size] ?? BUTTON_SIZES.md,
    className,
  ]
    .filter(Boolean)
    .join(' ');

/* ------------------------------------------------------------------- input */

const INPUT_BASE =
  'w-full h-control rounded-control border border-border-2 bg-surface text-body ' +
  'text-text placeholder:text-faint ' +
  'transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

// Horizontal padding is chosen as one variant rather than layered, because
// `px-4` in the base plus a `pl-9` passed in through className would be two
// rules for padding-left, and those resolve in stylesheet order rather than
// class-attribute order. `icon` and `money` leave room for a leading glyph.
const INPUT_PAD = {
  none: 'px-4',
  icon: 'pl-9 pr-4',
  money: 'pl-8 pr-4',
};

// `sm` is for controls that sit inline in a row, such as the compound bill
// form's rename fields. `none` keeps the full-height control.
const INPUT_HEIGHT = {
  sm: 'h-control-sm',
  md: 'h-control',
};

export const inputClass = ({ className = '', invalid = false, inset = 'none', size = 'md' } = {}) =>
  [
    INPUT_BASE,
    INPUT_HEIGHT[size] ?? INPUT_HEIGHT.md,
    INPUT_PAD[inset] ?? INPUT_PAD.none,
    invalid
      ? 'border-neg focus:border-neg focus:outline-neg'
      : 'focus:border-accent focus:outline-accent',
    className,
  ]
    .filter(Boolean)
    .join(' ');

/* ------------------------------------------------------------------ avatar */

export const initials = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('') || '?';

const AVATAR_TONES = [
  'bg-accent-soft text-accent',
  'bg-surface-2 text-accent-ink',
  'bg-surface-3 text-muted',
  'bg-accent-soft text-accent-2',
];

/**
 * Stable per-name tone, so a given person looks the same everywhere. Summed
 * character codes rather than a hash of the string, so "Ananya Rao" and "Rao
 * Ananya" land on the same value.
 */
export const avatarTone = (name = '') => {
  let sum = 0;
  for (let i = 0; i < name.length; i += 1) sum += name.charCodeAt(i);
  return AVATAR_TONES[sum % AVATAR_TONES.length];
};

export const avatarSize = (size = 'md') =>
  ({
    xs: 'w-6 h-6 text-[9px]',
    sm: 'w-avatar-sm h-avatar-sm text-[9px]',
    md: 'w-avatar h-avatar text-[10px]',
    lg: 'w-avatar-lg h-avatar-lg text-xs',
  })[size] ?? 'w-avatar h-avatar text-[10px]';
