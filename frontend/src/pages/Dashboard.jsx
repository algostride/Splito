import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { Plus, Users, LayoutDashboard } from 'lucide-react';
import { useGetGroupsQuery, useCreateGroupMutation } from '../store/groupsApi';
import { describeError } from '../utils/errorMessage';
import { balanceMeaning, netTone, rupees, signedRupees } from '../utils/money';
import Screen from '../components/shell/Screen';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import EmptyState, { Note } from '../components/ui/EmptyState';
import { Field } from '../components/ui/Input';
import { LoadingBlock } from '../components/ui/Spinner';
import { notify } from '../store/toastSlice';

/**
 * One card per group, in a responsive grid.
 *
 * This replaces a four-column table that had a separate card list below `md`,
 * so the same data was rendered twice in two shapes and the table's roles
 * (`table`/`row`/`columnheader`) meant a grid migration could never be a
 * superset of the old markup. One component now covers every width.
 *
 * Columns are sized off the real content width rather than guessed. `Screen`
 * gives `p-gutter` (32px a side) inside `max-w-[1360px]`, and the rail is 68px
 * at `md` and 248px from `lg`, so a card is:
 *
 *   768  md   636 content  2-up 306   3-up 196
 *   1024 lg   712 content  2-up 344   3-up 221
 *   1280 xl   968 content  2-up 472   3-up 307
 *   1440      1128 content 3-up 360
 *   1536+     1360 content 3-up 437   (Screen caps the column)
 *
 * Three-up only clears a readable card at `xl`, where 307px leaves 259px of
 * text after `p-card`. Four-up is never viable: at 1440 it would leave 216px,
 * which breaks a long group name across three lines and cannot hold a signed
 * money figure beside its label. So one column on a phone, two from `md`, three
 * from `xl`.
 *
 * The name is clamped to two lines rather than truncated. The table's
 * `truncate` cut a long name with no ellipsis room to judge it by, and the
 * seeded 90-character group exists to make sure wrapping is visible.
 */
const GroupGrid = ({ groups }) => (
    <ul aria-label="Groups" className="grid gap-card md:grid-cols-2 xl:grid-cols-3">
        {groups.map((group) => (
            <li key={group.id} className="min-w-0">
                <Card pad="card" lift className="h-full">
                    <Link
                        to={`/groups/${group.id}`}
                        className="flex h-full flex-col gap-4 press"
                    >
                        <div className="flex items-start gap-3">
                            <span
                                className="w-avatar-lg h-avatar-lg rounded-control bg-accent-soft text-accent flex items-center justify-center shrink-0"
                                aria-hidden="true"
                            >
                                <Users size={20} strokeWidth={1.75} />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block text-body font-semibold text-text line-clamp-2 break-words">
                                    {group.name}
                                </span>
                                <span className="block text-meta text-faint mt-0.5">
                                    {group.member_count} member
                                    {group.member_count === 1 ? '' : 's'}
                                </span>
                            </span>
                        </div>

                        {/* Figures sit on their own row so the two money columns
                            align across every card in the grid. The previous
                            table got that from table cells; a grid has to ask
                            for it, and `tnum` keeps the digits the same width. */}
                        <div className="mt-auto flex items-end justify-between gap-3 border-t border-border pt-3">
                            <span className="min-w-0">
                                <span
                                    className={`block font-money tnum text-body font-semibold ${netTone(group.your_net)}`}
                                    title={balanceMeaning(group.your_net)}
                                >
                                    {signedRupees(group.your_net)}
                                </span>
                                <span className="block text-meta text-faint truncate">
                                    {balanceMeaning(group.your_net)}
                                </span>
                            </span>
                            <span className="shrink-0 text-right">
                                <span className="block font-money tnum text-body text-muted">
                                    {rupees(group.total_spend)}
                                </span>
                                <span className="block text-meta text-faint">group spend</span>
                            </span>
                        </div>
                    </Link>
                </Card>
            </li>
        ))}
    </ul>
);


const Dashboard = () => {
    const { data: groups, isLoading, error } = useGetGroupsQuery();
    const dispatch = useDispatch();
    const [createGroup, { isLoading: isCreating }] = useCreateGroupMutation();
    const [newGroupName, setNewGroupName] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [createError, setCreateError] = useState(null);

    const closeModal = () => {
        setShowModal(false);
        setCreateError(null);
    };

    const handleCreateGroup = async (e) => {
        e.preventDefault();
        try {
            if (!newGroupName.trim()) return;
            setCreateError(null);
            await createGroup({ name: newGroupName }).unwrap();
            // The modal closing was the only signal that anything happened, and
            // a new group appearing in the list is easy to miss.
            dispatch(notify(`Created "${newGroupName.trim()}"`));
            setNewGroupName('');
            closeModal();
        } catch (err) {
            console.error('Failed to create group', err);
            setCreateError(describeError(err));
        }
    };

    return (
        <Screen>
            <div className="flex flex-wrap justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                    <LayoutDashboard size={26} className="text-accent" aria-hidden="true" />
                    <h1 className="text-title lg:text-display font-display font-semibold text-text">
                        Your groups
                    </h1>
                </div>
                <Button onClick={() => setShowModal(true)}>
                    <Plus size={18} strokeWidth={2} aria-hidden="true" />
                    Create group
                </Button>
            </div>

            {isLoading && <LoadingBlock text="Loading your groups..." />}

            {error && <Note tone="neg">{describeError(error)}</Note>}

            {!isLoading && !error && groups?.length === 0 && (
                <Card>
                    <EmptyState
                        icon={<Plus size={24} strokeWidth={2} aria-hidden="true" />}
                        title="No groups yet"
                        action={
                            <Button onClick={() => setShowModal(true)} className="mt-2">
                                <Plus size={18} strokeWidth={2} aria-hidden="true" />
                                Create your first group
                            </Button>
                        }
                    >
                        Create a group to start splitting bills with your flatmates.
                    </EmptyState>
                </Card>
            )}

            {groups?.length > 0 && (
                <GroupGrid groups={groups} />
            )}

            <Modal
                open={showModal}
                onClose={closeModal}
                title="New group"
                labelledBy="create-group-title"
            >
                <form onSubmit={handleCreateGroup} className="flex flex-col gap-4">
                    <Field
                        label="Group name"
                        placeholder="Flat 302, Indiranagar"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        error={createError}
                        required
                    />
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={closeModal}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isCreating}>
                            {isCreating ? 'Creating...' : 'Create group'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </Screen>
    );
};

export default Dashboard;
