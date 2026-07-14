import { Menu } from 'lucide-react';
import { ThemeToggle } from './Rail';

/**
 * Mobile top bar.
 *
 * Below `md` the rail is a drawer, so navigation needs a bar of its own. It is
 * `h-14` and sticky, which is why every sticky screen header in the app
 * offsets by `top-14` and drops the offset at `md` where this bar disappears.
 */
const TopBar = ({ onOpenMenu }) => (
  <div className="md:hidden sticky top-0 z-30 h-14 border-b border-border bg-surface flex items-center justify-between px-4 gap-3">
    <div className="flex items-center gap-3">
      <div className="w-brand h-brand rounded-control bg-accent text-on-accent flex items-center justify-center font-display font-bold text-[15px] shrink-0">
        S
      </div>
      <span className="text-body font-semibold text-text">Splito</span>
    </div>
    <div className="flex items-center gap-1">
      <ThemeToggle />
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Open menu"
        className="press inline-flex items-center justify-center w-control-sm h-control-sm rounded-control text-muted hover:bg-surface-2 hover:text-text"
      >
        <Menu size={18} strokeWidth={1.75} aria-hidden="true" />
      </button>
    </div>
  </div>
);

export default TopBar;
