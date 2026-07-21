import { Layers, Receipt } from 'lucide-react';

/**
 * The simple/compound choice, in two shapes.
 *
 * It lives here rather than inline in both callers because the header popup and
 * the add-bill page fallback are the same decision, and the wording drifting
 * between them would be a small, very annoying bug.
 *
 * `compact` is the narrow stacked list for a ~288px popover; the default is the
 * two-up card grid for a full page. The option itself is one component with the
 * row laid out as `compact ? row : column`, rather than two copies of the
 * markup.
 *
 * Deliberately not built on `PopoverItem`: that component hardcodes
 * `items-center`, and a two-line row wants `items-start`. Two `align-items`
 * rules in one class attribute resolve in stylesheet order, not
 * class-attribute order, so passing it through className would be a coin flip.
 * These are plain `role="menuitem"` buttons inside the Popover container.
 */

const OPTIONS = [
  {
    key: 'simple',
    title: 'Simple bill',
    description: 'Split a single amount among members',
    Icon: Receipt,
  },
  {
    key: 'compound',
    title: 'Compound bill',
    description: 'Add multiple items with individual splits',
    Icon: Layers,
  },
];

const Option = ({ option, compact, onSelect }) => {
  const { Icon, title, description } = option;

  if (compact) {
    return (
        <button
            type="button"
            role="menuitem"
            onClick={() => onSelect(option.key)}
            className="w-full flex items-center gap-3 rounded-control px-3 py-2.5 text-left press hover:bg-accent-soft"
        >
            <span className="w-9 h-9 rounded-control bg-accent-soft text-accent flex items-center justify-center shrink-0">
                <Icon size={17} strokeWidth={1.75} aria-hidden="true" />
            </span>
            <span className="min-w-0">
                <span className="block text-body font-semibold text-text">{title}</span>
                <span className="block text-meta text-faint">{description}</span>
            </span>
        </button>
    );
  }

  return (
    <button
        type="button"
        onClick={() => onSelect(option.key)}
        className="p-card rounded-card border-2 border-border hover:border-accent bg-canvas hover:bg-accent-soft transition-colors text-left space-y-3"
    >
        <span className="w-12 h-12 bg-surface text-accent rounded-control flex items-center justify-center">
            <Icon size={22} strokeWidth={1.75} aria-hidden="true" />
        </span>
        <span className="block text-title font-semibold text-text">{title}</span>
        <span className="block text-meta text-faint">{description}</span>
    </button>
  );
};

const BillTypeOptions = ({ onSelect, compact = false }) => (
    <div className={compact ? 'flex flex-col gap-1' : 'grid grid-cols-1 sm:grid-cols-2 gap-gap'}>
        {OPTIONS.map((option) => (
            <Option key={option.key} option={option} compact={compact} onSelect={onSelect} />
        ))}
    </div>
);

export default BillTypeOptions;
