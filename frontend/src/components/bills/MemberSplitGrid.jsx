// Split precision, duplicated here until the modes' rules live with the rest of
// the split arithmetic in billUtils.
const DP = { shares: 1, percent: 2 };
const STEP = { shares: 1, percent: 0.01 };
const MIN = { shares: 1, percent: 0 };

import Card from '../ui/Card';
import { initials } from '../ui/styles';

const MemberSplitGrid = ({
    members,
    item,
    computations,
    onToggleMember,
    onShareChange,
    onPercentChange
}) => {
    return (
        <Card className="overflow-hidden">
            <div className="p-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {members?.map(membership => {
                        const uid = membership.user.id;
                        const isSelected = item.selectedMembers.includes(uid);
                        // `initials` rather than indexing the string directly:
                        // `(name || email)[0]` throws a TypeError when a member
                        // somehow arrives with both empty, and this grid maps
                        // every member, so one bad row would take down the whole
                        // split editor. `initials` returns '?' instead, and is
                        // what Avatar already uses.
                        const userInitial = initials(
                            membership.user.name || membership.user.email,
                        );
                        const computed = computations.find(a => a.user_id === uid);
                        const current = parseFloat(rawValue);
                        const base = Number.isNaN(current) ? MIN[item.splitMode] : current;
                        const stepBy = (dir) => {
                            const next = Math.max(
                                MIN[item.splitMode],
                                Number((base + dir * STEP[item.splitMode]).toFixed(DP[item.splitMode])),
                            );
                            item.splitMode === 'shares'
                                ? onShareChange(uid, String(next))
                                : onPercentChange(uid, String(next));
                        };
                        const rawValue = item.splitMode === 'shares'
                            ? (item.memberShares[uid] || '')
                            : (item.memberPercents[uid] || '');
                        return (
                            <div
                                key={uid}
                                onClick={() => onToggleMember(uid)}
                                className={`flex items-start gap-3 px-3 py-3 rounded-control cursor-pointer transition-colors ${
                                    isSelected
                                        ? 'bg-accent text-on-accent'
                                        : 'bg-canvas text-muted hover:bg-accent-soft hover:text-accent'
                                }`}
                            >
                                <div className="flex-1 flex items-center gap-2 min-w-0 min-h-8">
                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                                        isSelected ? 'bg-accent' : 'bg-surface-3'
                                    }`}>
                                        {userInitial}
                                    </div>
                                    <div className="text-xs font-bold min-w-0 break-words leading-snug">
                                        {membership.user.name || membership.user.email.split('@')[0]}
                                    </div>
                                </div>
                                <div className="flex flex-col items-stretch gap-1 shrink-0 w-28">
<div className="relative flex items-center">
                                    <button
                                        type="button"
                                        disabled={!isSelected}
                                        onClick={(e) => { e.stopPropagation(); stepBy(-1); }}
                                        aria-label={`Decrease split for ${membership.user.name || membership.user.email}`}
                                        className={`absolute left-0 h-full w-6 flex items-center justify-center text-sm font-black leading-none transition-colors ${!isSelected ? 'text-faint' : 'text-muted hover:text-text'}`}
                                    >
                                        &minus;
                                    </button>
                                    <input
                                        type="number"
                                        value={rawValue}
                                        disabled={!isSelected}
                                        min={MIN[item.splitMode]}
                                        step={STEP[item.splitMode]}
                                        placeholder={item.splitMode === 'shares' ? '1' : '0'}
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => {
                                            item.splitMode === 'shares'
                                                ? onShareChange(uid, e.target.value)
                                                : onPercentChange(uid, e.target.value);
                                        }}
                                        className={`no-number-spinner w-full min-w-0 h-8 text-center pl-7 pr-7 border rounded-control ${
                                            isSelected
                                                ? 'bg-accent-ink border-accent-ink text-on-accent placeholder:text-accent-2'
                                                : 'bg-surface-3 border-border-2 text-faint placeholder:text-faint cursor-not-allowed'
                                        }`}
                                    />
                                    <button
                                        type="button"
                                        disabled={!isSelected}
                                        onClick={(e) => { e.stopPropagation(); stepBy(1); }}
                                        aria-label={`Increase split for ${membership.user.name || membership.user.email}`}
                                        className={`absolute right-0 h-full w-6 flex items-center justify-center text-sm font-black leading-none transition-colors ${!isSelected ? 'text-faint' : 'text-muted hover:text-text'}`}
                                    >
                                        +
                                    </button>
                                </div>
                                    <div className={`h-4 flex items-center justify-end text-meta font-money tnum font-semibold ${
                                        isSelected ? 'text-on-accent/70' : 'text-faint'
                                    } ${computed ? '' : 'opacity-60'}`}>
                                        {computed ? `₹${computed.share_amount}` : '₹0.00'}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </Card>
    );
};

export default MemberSplitGrid;
