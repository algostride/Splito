/**
 * The live region that renders toasts.
 *
 * `role="status"` with `aria-live="polite"` is what makes a message announce
 * without stealing focus. Errors switch the region to `assertive` so a failure
 * interrupts, because an unrequested failure is worth interrupting for while a
 * success is not.
 *
 * The region is rendered always, not conditionally on having messages. A live
 * region that is inserted into the DOM at the same moment as its text is
 * unreliable: some screen readers only announce changes to a region that was
 * already present, so a toast that mounts with its own content can be missed.
 */

import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { CheckCircle2, XCircle, X } from 'lucide-react';
import { dismiss } from '../../store/toastSlice';

const TONE = {
    pos: { icon: CheckCircle2, cls: 'border-pos/30 bg-pos-soft text-pos', label: 'Success' },
    neg: { icon: XCircle, cls: 'border-neg/30 bg-neg-soft text-neg', label: 'Error' },
};

const ToastRegion = () => {
    const items = useSelector((state) => state.toast.items);
    const dispatch = useDispatch();
    const hasError = items.some((t) => t.tone === 'neg');

    // Escape clears the stack. A toast is transient feedback, not a modal, so
    // it should never trap or block the page.
    useEffect(() => {
        if (items.length === 0) return undefined;
        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                event.stopImmediatePropagation();
                items.forEach((t) => dispatch(dismiss(t.id)));
            }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [items, dispatch]);

    return (
        <div
            // Pointer-events-none on the wrapper so the stack never swallows a
            // click meant for the page underneath; each toast opts back in.
            className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none max-w-[min(22rem,calc(100vw-2rem))]"
            role="status"
            // Named, because Spinner also carries role="status" for its own
            // loading announcements, and two unnamed status regions cannot be
            // told apart by assistive tech or by a test.
            aria-label="Notifications"
            aria-live={hasError ? 'assertive' : 'polite'}
        >
            {items.map((item) => {
                const tone = TONE[item.tone] ?? TONE.pos;
                const Icon = tone.icon;
                return (
                    <div
                        key={item.id}
                        className={`pointer-events-auto flex items-start gap-3 rounded-card border p-3 shadow-pop ${tone.cls}`}
                    >
                        <Icon size={17} strokeWidth={2} className="shrink-0 mt-0.5" aria-hidden="true" />
                        <p className="flex-1 text-body leading-snug">
                            <span className="sr-only">{tone.label}: </span>
                            {item.message}
                        </p>
                        <button
                            type="button"
                            onClick={() => dispatch(dismiss(item.id))}
                            aria-label="Dismiss notification"
                            className="shrink-0 p-1 rounded-control hover:opacity-70"
                        >
                            <X size={14} strokeWidth={2.25} aria-hidden="true" />
                        </button>
                    </div>
                );
            })}
        </div>
    );
};

export default ToastRegion;
