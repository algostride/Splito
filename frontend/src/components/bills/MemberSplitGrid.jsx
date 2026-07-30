import Card from '../ui/Card';
import { initials } from '../ui/styles';
import { DP, STEP, MIN } from './billUtils';
import StepperInput from '../ui/StepperInput';

const MemberSplitGrid = ({
    members,
    item,
    computations,
    onToggleMember,
    onShareChange,
    onPercentChange
}) => {
    /* The Card is a labelled group because these inputs otherwise have no
       name: a screen reader reaches a bare "1" with nothing to say what it is.
       The member name sits next to it, but adjacency is not an association. */
    return (
        <Card
            role="group"
            aria-label="Split between members"
            className="overflow-hidden"
        >
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
<StepperInput
    value={rawValue}
    onChange={(next) => {
        item.splitMode === 'shares' ? onShareChange(uid, next) : onPercentChange(uid, next);
    }}
    min={MIN[item.splitMode]}
    step={STEP[item.splitMode]}
    precision={DP[item.splitMode]}
    disabled={!isSelected}
    placeholder={item.splitMode === 'shares' ? '1' : '0'}
    decrementLabel={`Decrease split for ${membership.user.name || membership.user.email}`}
    incrementLabel={`Increase split for ${membership.user.name || membership.user.email}`}
    inputClassName={`text-meta font-money tnum font-semibold ${
        isSelected
            ? 'bg-accent-ink border-accent-ink text-on-accent placeholder:text-accent-2'
            : 'bg-surface-3 border-border-2 text-faint placeholder:text-faint cursor-not-allowed'
    }`}
/>
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
