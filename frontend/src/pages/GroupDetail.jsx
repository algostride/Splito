import { useState } from 'react';
import { Outlet, useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Plus } from 'lucide-react';
import {
    useGetGroupDetailQuery,
    useGetGroupMembersQuery
} from '../store/groupsApi';
import { useGetUserDebtsQuery } from '../store/settlementsApi';
import { describeError } from '../utils/errorMessage';
import Screen from '../components/shell/Screen';
import Tabs from '../components/ui/Tabs';
import Button from '../components/ui/Button';
import { LoadingBlock } from '../components/ui/Spinner';
import { Note } from '../components/ui/EmptyState';
import { asNumber, balanceSentence } from '../utils/money';

/**
 * The group layout route: sticky header, underline tab bar, and an outlet.
 *
 * The header and tab bar sit *outside* `Screen`, which is the whole point.
 * `Screen` owns the entrance animation, and that animation is a fade on the
 * container it wraps. If the sticky header were inside it, the header would be
 * dragged through opacity 0 whenever a tab animated in. Keeping it out here
 * means the header is painted once and never animates again, on any tab, and
 * each tab's body animates exactly once via its own `Screen`.
 *
 * Because this is a layout route, switching tabs does not remount it, so the
 * header never re-renders its animation. Tabs are real routes now rather than
 * local state, which means they survive a reload and can be linked.
 */
const GroupDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const currentUserId = useSelector((state) => state.auth.user?.id);
    const [membersErrorDismissed, setMembersErrorDismissed] = useState(false);

    const {
        data: group,
        isLoading: isGroupLoading,
        error: groupError,
    } = useGetGroupDetailQuery(id);
    const { data: members, isLoading: isMembersLoading, error: membersError } =
        useGetGroupMembersQuery(id);
    // Only used for the "you are ..." line in the header. The Balances tab
    // queries the same thing, and RTK Query shares the cache entry, so this
    // costs no extra request.
    const { data: debts } = useGetUserDebtsQuery(id);

    if (isGroupLoading) {
        return (
            <Screen>
                <LoadingBlock text="Loading group..." />
            </Screen>
        );
    }

    if (groupError || !group) {
        return (
            <Screen>
                <Note tone="neg">
                    {groupError ? describeError(groupError) : 'Group not found.'}
                </Note>
            </Screen>
        );
    }

    const mine = debts?.find((d) => d.user_id === currentUserId);
    const net = asNumber(mine?.net_balance);
    // Was "you are down" for the negative case, which no other screen used.
    const position = mine ? balanceSentence(net) : null;

    const tabs = [
        { to: `/groups/${id}`, label: 'Bills', end: true },
        { to: `/groups/${id}/balances`, label: 'Balances' },
        { to: `/groups/${id}/settlements`, label: 'Settlements' },
        { to: `/groups/${id}/members`, label: 'Members' },
    ];

    return (
        <div className="flex-1 min-w-0 flex flex-col">
            <div className="sticky top-14 md:top-0 z-20 bg-bg">
                <header className="min-h-20 py-4 border-b border-border bg-surface flex items-center justify-between gap-4 px-gutter">
                    <div className="min-w-0">
                        <h1 className="text-title lg:text-display font-display font-semibold leading-tight text-text truncate">
                            {group.name}
                        </h1>
                        <p className="text-meta text-faint leading-tight mt-0.5 truncate">
                            {isMembersLoading
                                ? 'Loading members...'
                                : `${members?.length ?? 0} member${members?.length === 1 ? '' : 's'}`}
                            {position ? ` · ${position}` : ''}
                        </p>
                    </div>
                    {/* The form itself stays a page: it is deep-linkable and
                        the compound one is a three-tab editor. */}
                    <Button
                        className="shrink-0"
                        onClick={() => navigate(`/groups/${id}/add-bill`)}
                    >
                        <Plus size={16} strokeWidth={2.4} aria-hidden="true" />
                        <span className="hidden sm:inline">Add bill</span>
                    </Button>
                </header>

                <div className="border-b border-border bg-surface">
                    <div className="px-gutter">
                        <Tabs tabs={tabs} />
                    </div>
                </div>
            </div>

            {membersError && !membersErrorDismissed && (
                <div className="px-gutter pt-5">
                    <Note tone="neg">
                        <span className="flex items-center justify-between gap-4">
                            Could not load members: {describeError(membersError)}
                            <button
                                type="button"
                                onClick={() => setMembersErrorDismissed(true)}
                                className="shrink-0 font-semibold underline"
                            >
                                Dismiss
                            </button>
                        </span>
                    </Note>
                </div>
            )}

            <Outlet />
        </div>
    );
};

export default GroupDetail;
