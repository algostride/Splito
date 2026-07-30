/**
 * Anchored popover, for menus that are not modals.
 *
 * This is the "Add bill" type picker on GroupDetail, which previously kept its
 * own outside-mousedown and Escape handling inline. Keeping the dismissal
 * logic here is the point: three call sites had each grown their own version
 * and only one of them handled the keyboard.
 *
 * Keyboard behaviour, added after an audit found only Escape and an outside
 * click: focus moves into the menu on open and back to the trigger on close, and
 * Arrow keys move between items. Without the first two, opening a menu with the
 * keyboard left focus on the trigger, so Tab walked the rest of the page and the
 * menu items were effectively unreachable.
 *
 * The document listeners are registered only while open. They used to be
 * registered unconditionally, so the Bills tab -- which renders a Popover per
 * row -- added two document listeners per bill, and every Escape anywhere on the
 * page fired all of them.
 */

import { useEffect, useRef } from 'react';

const FOCUSABLE = 'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

const Popover = ({ open, onClose, trigger, children, align = 'right', className = '' }) => {
  const wrapRef = useRef(null);
  const menuRef = useRef(null);

  /* Latest-onClose ref, for the reason given in Modal.jsx. Depending on
     `onClose` directly meant this effect tore down and re-registered both
     document listeners on every render, because every call site passes an inline
     arrow. The focus effect below was already keyed on `open` alone, which is
     why only the Modal stole the caret from a typing user. */
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      if (!wrapRef.current?.contains(event.target)) onCloseRef.current();
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        // stopImmediatePropagation, not stopPropagation: the Drawer and Modal
        // also listen for Escape on `document`, and stopPropagation does not
        // stop a listener on the *same* node, so one Escape used to close the
        // popover, the drawer behind it and any open modal all at once.
        event.stopImmediatePropagation();
        onCloseRef.current();
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // Move focus in on open, and hand it back to the trigger on close, so a
  // keyboard user is not left tabbing through the page behind the menu.
  useEffect(() => {
    if (!open) return undefined;

    // Captured now, not read from the ref in the cleanup: closing sets `open`
    // false, which unmounts the menu, so by the time the cleanup runs
    // menuRef.current is already null.
    const menu = menuRef.current;
    const triggerEl = wrapRef.current?.querySelector(FOCUSABLE);
    menu?.querySelector(FOCUSABLE)?.focus();

    return () => {
      /* Return focus to the trigger unconditionally, which is the standard
         menu-button behaviour. The obvious guard -- "only if focus is still in
         the menu" -- can never pass: closing unmounts the menu, so focus has
         already fallen back to <body> by the time this runs.

         The one case worth skipping is a close that navigates away, where the
         trigger is no longer in the document. Focusing a detached node is a
         no-op that silently drops focus to the body, so it is checked for. */
      if (!triggerEl?.isConnected) return;
      triggerEl.focus();
    };
  }, [open]);

  // Arrow keys and Home/End, the standard menu affordance.
  const onMenuKeyDown = (event) => {
    const items = [...(menuRef.current?.querySelectorAll(FOCUSABLE) ?? [])];
    if (items.length === 0) return;
    const at = items.indexOf(document.activeElement);

    const focusAt = (index) => {
      event.preventDefault();
      items[(index + items.length) % items.length]?.focus();
    };

    if (event.key === 'ArrowDown') focusAt(at + 1);
    else if (event.key === 'ArrowUp') focusAt(at - 1);
    else if (event.key === 'Home') focusAt(0);
    else if (event.key === 'End') focusAt(items.length - 1);
  };

  return (
    <div ref={wrapRef} className="relative">
      {trigger}
      {open ? (
        <div
          ref={menuRef}
          role="menu"
          // aria-expanded belongs on the trigger, which is the element that
          // owns the expanded state. Here it documents the menu's own
          // visibility for anything reading the panel.
          aria-expanded="true"
          onKeyDown={onMenuKeyDown}
          className={[
            'absolute top-[calc(100%+8px)] z-40 min-w-56 rounded-card border border-border',
            'bg-surface shadow-pop p-2',
            align === 'right' ? 'right-0' : 'left-0',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
};

/** A single selectable row inside a Popover. */
export const PopoverItem = ({ onSelect, children, className = '' }) => (
  <button
    type="button"
    role="menuitem"
    onClick={onSelect}
    className={[
      'w-full flex items-center gap-3 rounded-control px-3 py-2.5 text-left',
      'text-body text-text hover:bg-surface-2 press',
      className,
    ]
      .filter(Boolean)
      .join(' ')}
  >
    {children}
  </button>
);

export default Popover;
