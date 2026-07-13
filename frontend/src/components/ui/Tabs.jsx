/**
 * The distributed underline tab bar.
 *
 * "Distributed" means each tab takes an equal share of the bar's width rather
 * than hugging its label, so the underline marks a position on a scale instead
 * of sitting under a word. The bar is a grid of equal columns, which is also
 * why it does not need the `overflow-x-auto` the old version had: with a fixed
 * column count the strip can never become a wheel-scrolling region.
 *
 * Two layers, because there are two kinds of tab here:
 *
 *   UnderlineTabs  presentational, takes `active`, renders buttons. Used where
 *                  the tab is component state, as in the compound bill form's
 *                  Overview / Items / Splits.
 *   Tabs           the same bar driven by the URL, so a tab can be shared,
 *                  bookmarked and survived by a reload. Used by the group page.
 *
 * They were one component before, and the bill form grew its own copy of the
 * underline markup instead.
 */

import { NavLink } from 'react-router-dom';

const itemClass = (isActive, height) =>
  [
    `relative flex items-center justify-center ${height} text-body font-semibold transition-colors`,
    isActive ? 'text-text' : 'text-muted hover:text-text',
  ].join(' ');

const Underline = () => (
  <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-accent" />
);

/** Controlled: `active` is the caller's own state. */
export const UnderlineTabs = ({ tabs, active, onChange, height = 'h-14', className = '' }) => (
  <div
    role="tablist"
    className={['grid', className].filter(Boolean).join(' ')}
    style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
  >
    {tabs.map((tab) => {
      const isActive = tab.key === active;
      return (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={isActive}
          onClick={() => onChange(tab.key)}
          className={itemClass(isActive, height)}
        >
          {tab.label}
          {isActive ? <Underline /> : null}
        </button>
      );
    })}
  </div>
);

/** URL-driven. `end` marks a tab that must match its path exactly. */
const Tabs = ({ tabs, height = 'h-14', className = '' }) => (
  <nav
    aria-label="Section"
    className={['border-b border-border bg-surface grid', className].filter(Boolean).join(' ')}
    style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
  >
    {tabs.map((tab) => (
      <NavLink
        key={tab.to}
        to={tab.to}
        end={tab.end}
        className={({ isActive }) => itemClass(isActive, height)}
      >
        {({ isActive }) => (
          <>
            {tab.label}
            {isActive ? <Underline /> : null}
          </>
        )}
      </NavLink>
    ))}
  </nav>
);

export default Tabs;
