/**
 * Modal dialog.
 *
 * Three separate implementations existed: Dashboard's create-group modal
 * (backdrop click only), GroupDetail's settle-up modal (nothing), and a
 * bill-type popover (Escape + outside mousedown). Only the popover handled the
 * keyboard, and none of them locked background scroll or handled focus.
 *
 * Behaviour here: Escape closes, a backdrop click closes but a drag that
 * starts inside and ends on the backdrop does not, focus moves to the panel on
 * open and returns to the trigger on close, and Tab cycles within the panel.
 */

import { useEffect, useRef } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const Modal = ({ open, onClose, title, children, footer, labelledBy, className = '' }) => {
  const panelRef = useRef(null);
  const returnFocusRef = useRef(null);

  /* The latest onClose, held in a ref so the effect below can depend on `open`
     alone.

     Taking `onClose` as a dependency was the whole bug. Every call site in the
     app passes an inline arrow -- `onClose={() => setPendingDelete(null)}` and
     friends -- so every render produced a new function identity, the effect
     re-fired, and its cleanup restored focus to the opener before the effect
     body moved focus to the panel again. Typing one character in any modal
     field therefore threw the caret out of the input, and you had to click back
     in before every keystroke.

     useCallback at the call sites would fix the symptom and then rot: inline
     arrows are the house style and useCallback appears nowhere outside
     useTheme. A ref makes the effect insensitive to it entirely. */
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return undefined;

    returnFocusRef.current = document.activeElement;
    // The panel itself, not its first field: focusing an input on open scrolled
    // the create-group modal so the caret was in view before a name was typed.
    panelRef.current?.focus();

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        // stopImmediatePropagation, not stopPropagation. This listener and the
        // Drawer's are both on `document`, and stopPropagation does not stop
        // another listener on the same node -- so one Escape closed the modal
        // and the drawer behind it together.
        event.stopImmediatePropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const items = Array.from(panelRef.current?.querySelectorAll(FOCUSABLE) ?? []);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      // Wrap only when focus is leaving the panel, so a Tab that briefly goes
      // to the browser chrome is not yanked back to the start of the dialog.
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);

    // Lock the root scroller, which is <html>, not <body>: `body { overflow }`
    // only makes the body its own scroll container and leaves the page's
    // scrollbar in place. No width compensation is needed because
    // `scrollbar-gutter: stable` in index.css already reserves the space.
    const root = document.documentElement;
    const prevOverflow = root.style.overflow;
    root.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      root.style.overflow = prevOverflow;
      if (returnFocusRef.current instanceof HTMLElement) returnFocusRef.current.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* The handler lives on the backdrop itself, not on the wrapper: a click
          that lands on this element reports it as its own target, so putting
          the check on the parent would never match. The panel is a sibling, so
          clicks inside it cannot dismiss the dialog. */}
      <div
        className="absolute inset-0 bg-scrim/45 animate-[fade-in_160ms_ease-out_both]"
        onMouseDown={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={[
          'relative w-full sm:max-w-md max-h-[90vh] flex flex-col gap-4 overflow-y-auto',
          'rounded-t-card sm:rounded-card border border-border bg-surface shadow-pop',
          // outline-none is deliberate and stays: the panel takes focus
          // programmatically on open so a screen reader lands inside the
          // dialog, and that is a focus target rather than a control the
          // user tabbed to, so it should not draw a ring.
          'px-card py-card outline-none',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {title ? (
          <h2 id={labelledBy} className="text-title font-semibold text-text">
            {title}
          </h2>
        ) : null}
        {children}
        {footer ? <div className="flex justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  );
};

export default Modal;
