import { useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Heart, LayoutDashboard, LogOut, Users, X } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { logoutAndReset } from '../../store';
import { useGetGroupsQuery } from '../../store/groupsApi';
import Avatar from '../ui/Avatar';

/**
 * Off-canvas navigation below `md`.
 *
 * The wrapper stays mounted and only toggles pointer-events, so the panel can
 * animate in and out instead of appearing and vanishing. The scrim and the
 * panel are independently transitioned; `drawer-open` on the wrapper is what
 * both read, which keeps one source of truth for "is it open".
 */

// Destructure in the body, not the parameter list: no-unused-vars'
// varsIgnorePattern covers variable declarations only, so `icon: Icon` as a
// parameter is reported unused even though JSX renders it. See the note in
// eslint.config.js about the capitalised-identifier exemption.
const Item = (props) => {
  const { to, icon: Icon, label, end, onNavigate } = props;
  return (
  <NavLink
    to={to}
    end={end}
    onClick={onNavigate}
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
    <span className="truncate">{label}</span>
  </NavLink>
  );
};

const Drawer = ({ open, onClose }) => {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const { data: groups } = useGetGroupsQuery();
  const { pathname } = useLocation();
  const list = groups ?? [];

  // Any navigation closes the drawer, including a browser back that changes
  // the route without going through the links below.
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      // Only the topmost overlay reacts, so an open Modal is not also closed by
      // the same Escape. See Modal.jsx.
      if (event.key === 'Escape') {
        event.stopImmediatePropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  return (
    <div
      // pointer-events-none on the wrapper is not optional. A fixed inset-0
      // box at z-40 sits above the top bar (z-30) even when the drawer is
      // closed, so without this the whole page is untappable on a phone: the
      // transparent overlay intercepts every click. The scrim and the panel
      // opt back in only while open. The mockup had this; the React port lost
      // it, and the E2E suite caught it.
        className="md:hidden fixed inset-0 z-40 pointer-events-none group"
        data-drawer-open={open ? 'true' : 'false'}
        // `inert`, not `aria-hidden`. The comment here used to claim
        // aria-hidden "keeps the off-canvas links out of the tab order", which
        // is not what aria-hidden does: it hides content from assistive tech
        // but leaves every link focusable, so a keyboard user on a phone could
        // Tab into a panel that is translated off-screen and invisible. `inert`
        // takes the subtree out of the tab order *and* the a11y tree together,
        // which is what was wanted. aria-hidden is kept as well for browsers
        // without inert support.
        // React 19 takes `inert` as a boolean prop, not an empty-string
        // attribute. Passing `''` is coerced away and the attribute never lands.
        inert={!open}
        aria-hidden={!open}
    >
      <div
        onClick={onClose}
        // `group-data-[...]` rather than `data-[...]`: the arbitrary data
        // variant matches only the element that itself carries the attribute,
        // which is the wrapper here. The children need the group variant to
        // read it off the parent. With `data-[...]` on the children the drawer
        // set its state but never visually opened.
        className="drawer-scrim absolute inset-0 bg-scrim/60 opacity-0 pointer-events-none group-data-[drawer-open=true]:opacity-100 group-data-[drawer-open=true]:pointer-events-auto"
      />
      <div className="drawer-panel pointer-events-none absolute inset-y-0 left-0 w-rail max-w-[82vw] bg-surface shadow-pop -translate-x-full flex flex-col group-data-[drawer-open=true]:translate-x-0 group-data-[drawer-open=true]:pointer-events-auto">
        <div className="h-14 shrink-0 border-b border-border flex items-center justify-between px-card">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-control bg-accent text-on-accent flex items-center justify-center font-display font-bold text-[13px] shrink-0">
              S
            </div>
            <span className="text-body font-semibold text-text">Splito</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="press inline-flex items-center justify-center w-control-sm h-control-sm rounded-control text-muted hover:bg-surface-2 hover:text-text"
          >
            <X size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          <Item to="/" end icon={LayoutDashboard} label="Dashboard" onNavigate={onClose} />
          <Item to="/friends" icon={Heart} label="Friends" onNavigate={onClose} />
          {list.length > 0 ? (
            <p className="px-3 pt-4 pb-1.5 text-meta text-faint uppercase">Your groups</p>
          ) : null}
          {list.map((group) => (
            <Item
              key={group.id}
              to={`/groups/${group.id}`}
              icon={Users}
              label={group.name}
              onNavigate={onClose}
            />
          ))}
        </nav>

        <div className="shrink-0 p-3 border-t border-border flex items-center gap-2 px-1.5">
          <Avatar name={user?.name || ''} size="sm" />
          <div className="flex-1">
            <div className="text-body font-semibold leading-tight text-text truncate">
              {user?.name || 'Signed in'}
            </div>
            <div className="text-meta text-faint leading-tight truncate">{user?.email}</div>
          </div>
          <button
            type="button"
            onClick={() => dispatch(logoutAndReset())}
            aria-label="Sign out"
            className="press inline-flex items-center justify-center w-control-sm h-control-sm rounded-control text-muted hover:bg-surface-2 hover:text-text"
          >
            <LogOut size={17} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Drawer;
