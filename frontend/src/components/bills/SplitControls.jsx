import { Percent, Hash } from 'lucide-react';
import Button from '../ui/Button';

/**
 * Split mode toggle plus the "split evenly" shortcut.
 *
 * The shares/percent switch is a two-state control, not a row of tabs, so it
 * stays a pair of buttons rather than using UnderlineTabs: the underline means
 * "you are on this page", and a mode toggle is not a page.
 */
const SplitControls = ({ splitMode, onToggleMode, onSplitEvenly }) => {
    const option = (mode, Icon, label) => (
        <button
            key={mode}
            type="button"
            aria-pressed={splitMode === mode}
            onClick={() => onToggleMode(mode)}
            className={[
                'press flex items-center gap-1 px-3 py-1.5 rounded-control text-meta font-semibold transition-colors',
                splitMode === mode
                    ? 'bg-accent text-on-accent'
                    : 'text-faint hover:text-text',
            ].join(' ')}
        >
            <Icon size={13} strokeWidth={2} aria-hidden="true" />
            <span>{label}</span>
        </button>
    );

    return (
        <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={onSplitEvenly}>
                Split evenly
            </Button>
            <div
                role="group"
                aria-label="Split mode"
                className="flex items-center bg-surface-2 rounded-control p-0.5"
            >
                {option('shares', Hash, 'Shares')}
                {option('percent', Percent, 'Percent')}
            </div>
        </div>
    );
};

export default SplitControls;
