import { Link } from 'react-router-dom';
import { Heart, Users, ArrowUpRight } from 'lucide-react';
import { useGetFriendsQuery } from '../store/friendsApi';
import { useGetGroupsQuery } from '../store/groupsApi';
import { describeError } from '../utils/errorMessage';
import { asNumber, balanceMeaning, netTone, rupees, signedRupees } from '../utils/money';
import Screen from '../components/shell/Screen';
import Card from '../components/ui/Card';
import Avatar from '../components/ui/Avatar';
import EmptyState, { Note } from '../components/ui/EmptyState';
import { LoadingBlock } from '../components/ui/Spinner';

/**
 * What you are owed by everyone, summed.
 *
 * Each friend's total is *your* position with them, so your own net across all
 * groups is the sum of those totals rather than the negative of it: if a friend
 * is 30 behind and another is 20 ahead, you are 10 behind. Verified against
 * /balances/ by test_per_group_figures_sum_to_my_net_for_that_group.
 */
const overallNet = (friends) =>
    friends.reduce((sum, friend) => sum + asNumber(friend.total), 0);

const FriendCard = ({ friend }) => (
    <Card lift className="overflow-hidden flex flex-col">
        <div className="flex items-center gap-3 p-card">
            <Avatar name={friend.name || friend.email} size="lg" />
            <div className="min-w-0 flex-1">
                <div className="text-body font-semibold text-text truncate">
                    {friend.name || 'Member'}
                </div>
                <div className="text-meta text-faint truncate">
                    {friend.email}
                </div>
                <div className="text-meta text-faint">
                    {friend.shared_group_count} group
                    {friend.shared_group_count === 1 ? '' : 's'} in common
                </div>
            </div>
            <div className="text-right shrink-0">
                <div className="text-meta text-faint">Total</div>
                <div
                    className={`text-title font-money tnum font-semibold ${netTone(friend.total)}`}
                    title={balanceMeaning(friend.total)}
                >
                    {signedRupees(friend.total)}
                </div>
            </div>
        </div>

        {friend.per_group.length > 0 ? (
            <ul className="border-t border-border">
                {friend.per_group.map((row) => (
                    <li
                        key={row.group_id}
                        className="flex items-center justify-between gap-3 px-card min-h-row border-b border-border last:border-0"
                    >
                        <div className="min-w-0 flex flex-wrap items-center gap-2">
                            <span className="text-meta text-faint truncate">
                                {row.group_name}
                            </span>
                            <span
                                className={`text-meta font-money tnum font-semibold ${netTone(row.net)}`}
                            >
                                {balanceMeaning(row.net)} {rupees(Math.abs(asNumber(row.net)))}
                            </span>
                        </div>
                        {/* Settling is per group, so this goes to that group's
                            balances rather than settling from here. */}
                        <Link
                            to={`/groups/${row.group_id}/balances`}
                            className="press shrink-0 inline-flex items-center gap-1 px-3 h-control-sm rounded-control text-meta font-semibold bg-surface text-text border border-border hover:bg-surface-2 hover:border-border-2"
                        >
                            Settle
                            <ArrowUpRight size={13} strokeWidth={2} aria-hidden="true" />
                        </Link>
                    </li>
                ))}
            </ul>
        ) : null}
    </Card>
);

const Friends = () => {
    const { data: friends, isLoading, error } = useGetFriendsQuery();
    const { data: groups } = useGetGroupsQuery();
    const list = friends ?? [];
    const total = overallNet(list);

    return (
        <Screen>
            <div className="flex items-center gap-3">
                <Heart size={26} className="text-accent" aria-hidden="true" />
                <div>
                    <h1 className="text-title lg:text-display font-display font-semibold text-text">
                        Friends
                    </h1>
                    <p className="text-meta text-faint">Everyone who shares a group with you</p>
                </div>
            </div>

            {isLoading ? (
                <LoadingBlock text="Working out where you stand..." />
            ) : error ? (
                <Note tone="neg">{describeError(error)}</Note>
            ) : list.length === 0 ? (
                <Card>
                    <EmptyState
                        icon={<Users size={24} strokeWidth={1.75} aria-hidden="true" />}
                        title="No friends yet"
                    >
                        {groups?.length
                            ? 'Invite someone to one of your groups and they will show up here.'
                            : 'Create a group or accept an invite first. Friends are everyone who shares a group with you.'}
                    </EmptyState>
                </Card>
            ) : (
                <>
                    <Card>
                        <div className="flex flex-wrap items-center justify-between gap-4 p-card">
                            <div>
                                <p className="text-meta text-muted font-semibold">
                                    Your net across all {list.length} friend
                                    {list.length === 1 ? '' : 's'}
                                </p>
                                <p className="text-meta text-faint mt-0.5">
                                    {balanceMeaning(total)} in total
                                </p>
                            </div>
                            <p
                                className={`text-display font-money tnum font-semibold ${netTone(total)}`}
                            >
                                {signedRupees(total)}
                            </p>
                        </div>
                    </Card>

                    <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-gap">
                        {list.map((friend) => (
                            <FriendCard key={friend.user_id} friend={friend} />
                        ))}
                    </div>
                </>
            )}
        </Screen>
    );
};

export default Friends;
