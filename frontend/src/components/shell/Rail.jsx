import { NavLink } from 'react-router-dom';
import { Heart, LayoutDashboard, LogOut, Sun, Moon, Users } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { logoutAndReset } from '../../store';
import { useGetGroupsQuery } from '../../store/groupsApi';
import Avatar from '../ui/Avatar';
import { useTheme } from '../../hooks/useTheme';

/**
 * Desktop navigation: icon-only from `md`, labelled from `lg`.
 *
 * The group list is real data from `GET groups/`, not a mock. Labels are
 * `hidden lg:inline` rather than the rail simply narrowing, so the icon column
 * keeps its width and the items do not reflow when the breakpoint is crossed.
 */

const NavItem = (props) => {
  const { to, icon: Icon, label, end } = props;
  return (
  <NavLink
    to={to}
    end={end}
    title={label}
    className={({ isActive }) =>
      [
        'nav-item w-full flex items-center gap-3 px-3 h-control rounded-control',
        'text-body font-medium text-left',
        isActive
          ? 'bg-accent text-on-accent'
          : 'text-muted hover:text-text hover:bg-surface-2',
      ].join(' ')
    }
  >
    <span className="shrink-0">
      <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
    </span>
    {/* Two spans on purpose, and the split matters.

        The outer one carries the sr-only / not-sr-only pair, which exists so
        the name stays in the accessibility tree between md and lg where the
        rail is icon-only. `not-sr-only` is a full reset: it sets
        `white-space: normal` and `overflow: visible`. On one element alongside
        `truncate` it silently won -- both selectors are a single class, so
        source order decided, and the responsive one is emitted later. A long
        group name then wrapped inside a fixed 40px row and spilled into its
        neighbours.

        So the reset and the truncation live on different elements. `truncate`
        goes on an inner `block`, which is not a flex item, so no rule from
        either utility can reach it.

        `min-w-0` on the outer is not optional. It is a flex item, and flex items
        default to `min-width: auto`, which refuses to shrink below the
        min-content width -- and with `white-space: nowrap` that is the whole
        string. Without it, truncate would never engage and the text would
        overflow horizontally instead. */}
    <span className="sr-only lg:not-sr-only min-w-0">
      <span className="block truncate">{label}</span>
    </span>
  </NavLink>
  );
};

const Brand = ({ subtitle }) => (
  <div className="flex items-center gap-3 h-20">
    <div className="w-brand h-brand rounded-control bg-accent text-on-accent flex items-center justify-center font-display font-bold text-[15px] shrink-0">
      S
    </div>
    <div className="min-w-0 hidden lg:block">
      <div className="text-body font-semibold leading-tight text-text">Splito</div>
      {subtitle ? (
        <div className="text-meta text-faint leading-tight truncate">{subtitle}</div>
      ) : null}
    </div>
  </div>
);

const ThemeToggle = ({ className = '' }) => {
  const { mode, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className={[
        'press inline-flex items-center justify-center w-control-sm h-control-sm',
        'rounded-control text-muted hover:bg-surface-2 hover:text-text',
        className,
      ].join(' ')}
    >
      {mode === 'dark' ? (
        <Sun size={17} strokeWidth={1.75} aria-hidden="true" />
      ) : (
        <Moon size={17} strokeWidth={1.75} aria-hidden="true" />
      )}
    </button>
  );
};

const Rail = () => {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const { data: groups } = useGetGroupsQuery();
  const name = user?.name || '';
  const list = groups ?? [];

  return (
    <aside className="hidden md:flex md:w-[68px] lg:w-rail shrink-0 flex-col border-r border-border bg-surface sticky top-0 h-dvh">
      <div className="border-b border-border flex md:justify-center lg:justify-start px-3">
        <Brand />
      </div>

      <nav className="p-3 space-y-1">
        <NavItem to="/" end icon={LayoutDashboard} label="Dashboard" />
        <NavItem to="/friends" icon={Heart} label="Friends" />
      </nav>

      <div className="p-3 space-y-1 border-t border-border overflow-y-auto">
        <div className="px-3 pb-1.5 flex items-center gap-2 hidden lg:flex">
          <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
          {/* min-w-0 for the same flex-item reason as the nav labels. This one
              is 11 characters so it cannot break today, but it sits beside a
              shrink-0 dot and the pattern is worth being consistent about. */}
          <span className="text-meta text-faint font-semibold uppercase truncate min-w-0">
            Your groups
          </span>
        </div>
        {list.length === 0 ? (
          <p className="hidden lg:block px-3 text-meta text-faint leading-snug">
            No groups yet.
          </p>
        ) : (
          list.map((group) => (
            <NavItem
              key={group.id}
              to={`/groups/${group.id}`}
              icon={Users}
              label={group.name}
            />
          ))
        )}
      </div>

      <div className="flex-1" />

      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-2 px-1.5">
          <Avatar name={name} size="sm" />
          <div className="min-w-0 flex-1 hidden lg:block">
            <div className="text-body font-semibold leading-tight text-text truncate">
              {name || 'Signed in'}
            </div>
            <div className="text-meta text-faint leading-tight truncate">{user?.email}</div>
          </div>
          <ThemeToggle />
          <button
            type="button"
            onClick={() => dispatch(logoutAndReset())}
            aria-label="Sign out"
            title="Sign out"
            className="press inline-flex items-center justify-center w-control-sm h-control-sm rounded-control text-muted hover:bg-surface-2 hover:text-text"
          >
            <LogOut size={17} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Rail;
export { NavItem, Brand, ThemeToggle };
