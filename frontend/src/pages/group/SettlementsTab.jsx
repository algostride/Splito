import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useGetGroupMembersQuery } from '../../store/groupsApi';
import { useGetSettlementsQuery, useDeleteSettlementMutation } from '../../store/settlementsApi';
import { describeError } from '../../utils/errorMessage';
import { longDate } from '../../utils/dates';
import Screen from '../../components/shell/Screen';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import EmptyState, { Note } from '../../components/ui/EmptyState';
import { LoadingBlock } from '../../components/ui/Spinner';
import { History, ArrowRight } from 'lucide-react';
import { memberName } from './shared';
import { rupees } from '../../utils/money';

/** Settlements tab: the record of payments already made. */
const SettlementsTab = () => {
    const { id: groupId } = useParams();
    // Same reason as the Balances tab: the delete dialog names members, and
    // memberName() falls back to 'Unknown' when this query has no data, so a
    // failure produced a confirmation reading "Removing the payment of
    // ... from Unknown to Unknown" with nothing to indicate why.
    const {
        data: members,
        isLoading: isMembersLoading,
        error: membersError,
    } = useGetGroupMembersQuery(groupId);
    const { data: settlements, isLoading, error } = useGetSettlementsQuery(groupId);
    const [deleteSettlement, { isLoading: isDeleting }] = useDeleteSettlementMutation();

    const [pendingDelete, setPendingDelete] = useState(null);
    const [actionError, setActionError] = useState(null);

    const confirmDelete = async () => {
        if (!pendingDelete) return;
        try {
            setActionError(null);
            await deleteSettlement(pendingDelete.id).unwrap();
            setPendingDelete(null);
        } catch (err) {
            console.error('Failed to delete settlement', err);
            setActionError(describeError(err));
        }
    };

    return (
        <Screen>
            <Card pad="gutter">
                <div className="flex items-center gap-2 pb-5 mb-1 border-b border-border">
                    <History size={18} className="text-accent" aria-hidden="true" />
                    <h2 className="text-title font-semibold text-text">Settlements</h2>
                    {settlements?.length ? (
                        <span className="text-meta text-faint">{settlements.length}</span>
                    ) : null}
                </div>

                {isLoading ? (
                    <LoadingBlock text="Loading settlements..." size="sm" />
                ) : error ? (
                    <Note tone="neg" className="mt-4 mb-1">{describeError(error)}</Note>
                ) : !settlements?.length ? (
                    <EmptyState
                        icon={<History size={24} strokeWidth={1.75} aria-hidden="true" />}
                        title="No settlements yet"
                    >
                        Once someone records a payment, it will show up here.
                    </EmptyState>
                ) : (
                    <ul>
                        {settlements.map((settlement) => (
                            <li
                                key={settlement.id}
                                className="flex items-center gap-3 min-h-row border-b border-border last:border-0"
                            >
                                <span className="w-10 h-10 rounded-full bg-accent-soft text-accent flex items-center justify-center font-money text-[11px] font-semibold shrink-0">
                                    ₹
                                </span>
                                <span className="flex-1 min-w-0">
                                    <span className="block text-body truncate">
                                        <span className="text-pos font-semibold">
                                            {memberName(members, settlement.payer)}
                                        </span>
                                        <ArrowRight
                                            size={12}
                                            className="inline mx-1.5 text-faint"
                                            aria-hidden="true"
                                        />
                                        <span className="text-accent font-semibold">
                                            {memberName(members, settlement.payee)}
                                        </span>
                                    </span>
                                    <span className="block text-meta text-faint">
                                        {longDate(settlement.settled_at)}
                                    </span>
                                </span>
                                <span className="shrink-0 font-money tnum text-body font-semibold text-text">
                                    {rupees(settlement.amount)}
                                </span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="shrink-0 px-2"
                                    onClick={() => {
                                        // Not silently: the dialog cannot name the
                                        // payer or payee without this data.
                                        setActionError(null);
                                        setPendingDelete(settlement);
                                    }}
                                    aria-label="Delete settlement"
                                >
                                    Delete
                                </Button>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>

            <Modal
                open={Boolean(pendingDelete)}
                onClose={() => setPendingDelete(null)}
                title="Delete this settlement?"
                labelledBy="delete-settlement-title"
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setPendingDelete(null)}>
                            Cancel
                        </Button>
                        <Button
                            variant="danger"
                            onClick={confirmDelete}
                            disabled={isDeleting || isMembersLoading || Boolean(membersError)}
                        >
                            {isDeleting ? 'Deleting...' : 'Delete'}
                        </Button>
                    </>
                }
            >
                {/* Inside the dialog, not in the page body: the page body's copy
                    sat behind this modal's z-50 scrim, so a failed delete
                    looked like an unresponsive button. */}
                {actionError && <Note tone="neg" className="mb-3">{actionError}</Note>}
                {membersError ? (
                    <Note tone="neg" className="mb-3">{describeError(membersError)}</Note>
                ) : isMembersLoading ? (
                    <LoadingBlock text="Loading members..." size="sm" className="mb-3" />
                ) : null}
                <p className="text-body text-muted leading-relaxed">
                    Removing the payment of{' '}
                    <span className="font-money tnum font-semibold text-text">
                        {rupees(pendingDelete?.amount)}
                    </span>{' '}
                    from {memberName(members, pendingDelete?.payer)} to{' '}
                    {memberName(members, pendingDelete?.payee)} will put that debt back into the
                    balances. This cannot be undone.
                </p>
            </Modal>
        </Screen>
    );
};

export default SettlementsTab;
