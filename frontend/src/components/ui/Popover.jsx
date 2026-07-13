/**
 * Anchored popover, for menus that are not modals.
 *
 * This is the "Add bill" type picker on GroupDetail, which previously kept its
 * own outside-mousedown and Escape handling inline. Keeping the dismissal
 * logic here is the point: three call sites had each grown their own version
 * and only one of them handled the keyboard.
 *
 * Keyboard behaviour is Escape and an outside click. Arrow keys and focus
 * movement are not handled yet.
 */

import { useEffect, useRef } from 'react';

const Popover = ({ open, onClose, trigger, children, align = 'right', className = '' }) => {
  const wrapRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const onPointerDown = (event) => {
      if (!wrapRef.current?.contains(event.target)) onClose();
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

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
