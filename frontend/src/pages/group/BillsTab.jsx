import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useGetBillsQuery, useDeleteBillMutation } from '../../store/billsApi';
import { describeError } from '../../utils/errorMessage';
import { rupees } from '../../utils/money';
import Screen from '../../components/shell/Screen';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Popover, { PopoverItem } from '../../components/ui/Popover';
import EmptyState from '../../components/ui/EmptyState';
import { Note } from '../../components/ui/EmptyState';
import { LoadingBlock } from '../../components/ui/Spinner';
import { Receipt, MoreVertical, Pencil, Trash2 } from 'lucide-react';

/** One bill row. */
const BillRow = ({ bill, groupId, open, onToggleMenu, onEdit, onDelete }) => {
    const payer = bill.paid_by_detail?.name || bill.created_by?.name || 'Unknown';
    const date = new Date(bill.created_at).toLocaleDateString();

    return (
        <li className="flex items-center gap-3 min-h-row border-b border-border last:border-0">
            <Link
                to={`/groups/${groupId}/bills/${bill.id}`}
                className="flex-1 min-w-0 flex items-center gap-3 py-3"
            >
                <span className="w-10 h-10 rounded-control bg-accent-soft text-accent flex items-center justify-center shrink-0">
                    <Receipt size={18} strokeWidth={1.75} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block text-body font-semibold text-text truncate">
                        {bill.title}
                    </span>
                    <span className="block text-meta text-faint truncate">
                        Paid by {payer} · {date}
                    </span>
                </span>
            </Link>

            <span className="shrink-0 font-money tnum text-body font-semibold text-text whitespace-nowrap">
                {bill.total_amount?.toFixed?.(2) ?? bill.total_amount}{' '}
                <span className="text-meta text-faint">{bill.currency}</span>
            </span>

            <Popover
                open={open}
                onClose={onToggleMenu}
                trigger={
                    <button
                        type="button"
                        aria-label={`Actions for ${bill.title}`}
                        onClick={onToggleMenu}
                        className="press shrink-0 p-2 rounded-control text-faint hover:bg-surface-2 hover:text-text"
                    >
                        <MoreVertical size={16} strokeWidth={1.75} aria-hidden="true" />
                    </button>
                }
            >
                <PopoverItem
                    onSelect={() => {
                        onToggleMenu();
                        onEdit(bill);
                    }}
                >
                    <Pencil size={15} strokeWidth={1.75} aria-hidden="true" />
                    Edit
                </PopoverItem>
                <PopoverItem
                    className="text-neg hover:bg-neg-soft"
                    onSelect={() => {
                        onToggleMenu();
                        onDelete(bill);
                    }}
                >
                    <Trash2 size={15} strokeWidth={1.75} aria-hidden="true" />
                    Delete
                </PopoverItem>
            </Popover>
        </li>
    );
};

/**
 * Bills tab. Owns its own query, so switching tabs no longer waits on the
 * other three. The delete confirmation is a Modal rather than the inline
 * overlay it used to be: the overlay put a click handler on the scrim and a
 * stopPropagation on the confirm button, which meant a drag that started on
 * "Yes" and released on the scrim still deleted.
 */
const BillsTab = () => {
    const { id: groupId } = useParams();
    const navigate = useNavigate();
    const { data: bills, isLoading, error } = useGetBillsQuery(groupId);
    const [deleteBill, { isLoading: isDeleting }] = useDeleteBillMutation();

    const [openMenu, setOpenMenu] = useState(null);
    const [pendingDelete, setPendingDelete] = useState(null);
    const [actionError, setActionError] = useState(null);

    const confirmDelete = async () => {
        if (!pendingDelete) return;
        try {
            setActionError(null);
            await deleteBill(pendingDelete).unwrap();
            setPendingDelete(null);
        } catch (err) {
            console.error('Failed to delete bill', err);
            setActionError(describeError(err));
        }
    };

    return (
        <Screen>
            {actionError && (
                <Note tone="neg" className="mb-4">{actionError}</Note>
            )}

            <Card pad="gutter">
                <div className="flex items-center gap-2 pb-5 mb-1 border-b border-border">
                    <Receipt size={18} className="text-accent" aria-hidden="true" />
                    <h2 className="text-title font-semibold text-text">Bills</h2>
                    {bills?.length ? (
                        <span className="text-meta text-faint">{bills.length}</span>
                    ) : null}
                </div>

                {isLoading ? (
                    <LoadingBlock text="Loading bills..." size="sm" />
                ) : error ? (
                    <Note tone="neg" className="mt-4 mb-1">{describeError(error)}</Note>
                ) : !bills?.length ? (
                    <EmptyState
                        icon={<Receipt size={24} strokeWidth={1.75} aria-hidden="true" />}
                        title="No bills yet"
                    >
                        Add a bill to start splitting.
                    </EmptyState>
                ) : (
                    <ul>
                        {bills.map((bill) => (
                            <BillRow
                                key={bill.id}
                                bill={bill}
                                groupId={groupId}
                                open={openMenu === bill.id}
                                onToggleMenu={() =>
                                    setOpenMenu(openMenu === bill.id ? null : bill.id)
                                }
                                onEdit={(b) =>
                                    navigate(`/groups/${groupId}/bills/${b.id}/edit`)
                                }
                                onDelete={setPendingDelete}
                            />
                        ))}
                    </ul>
                )}
            </Card>

            <Modal
                open={Boolean(pendingDelete)}
                onClose={() => setPendingDelete(null)}
                title="Delete this bill?"
                labelledBy="delete-bill-title"
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setPendingDelete(null)}>
                            Cancel
                        </Button>
                        <Button variant="danger" onClick={confirmDelete} disabled={isDeleting}>
                            {isDeleting ? 'Deleting...' : 'Delete bill'}
                        </Button>
                    </>
                }
            >
                <p className="text-body text-muted leading-relaxed">
                    <span className="font-semibold text-text">{pendingDelete?.title}</span> will be
                    removed and the group's balances recalculated. This cannot be undone.
                </p>
            </Modal>
        </Screen>
    );
};

export default BillsTab;
