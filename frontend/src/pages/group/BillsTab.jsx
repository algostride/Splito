import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useGetBillsQuery, useDeleteBillMutation } from '../../store/billsApi';
import { describeError } from '../../utils/errorMessage';
import { groupByMonth, dateStamp } from '../../utils/dates';
import { deriveBillStatus, billStatusLabel } from '../../utils/billStatus';
import { rupees } from '../../utils/money';
import Screen from '../../components/shell/Screen';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Popover, { PopoverItem } from '../../components/ui/Popover';
import EmptyState, { Note } from '../../components/ui/EmptyState';
import { LoadingBlock } from '../../components/ui/Spinner';
import { Receipt, MoreVertical, Pencil, Trash2 } from 'lucide-react';

const STATUS_TONE = {
    owe: 'text-neg',
    owed: 'text-pos',
    none: 'text-faint',
};

/**
 * What this bill means for the signed-in user.
 *
 * Lives in the right-hand cluster rather than under the title. In the left
 * column it sat on the same axis as the bill name, which made the two compete
 * and left the most useful fact about the bill reading as a subtitle. Beside
 * the total it reads as a pair: your part, then the whole bill.
 *
 * The state is spelled out in text rather than carried by tone alone, since
 * colour is not an accessible signal. Never truncated: a half-cut "you are owed
 * ₹1,24" is worse than no status, and the cluster is shrink-0 so the title
 * absorbs the difference instead.
 */
const BillStatus = ({ status }) => {
    if (status.kind === 'none') {
        return (
            <span className="block text-meta text-faint whitespace-nowrap">
                not involved
            </span>
        );
    }
    return (
        <span
            className={`block text-meta font-semibold tnum whitespace-nowrap ${STATUS_TONE[status.kind]}`}
        >
            {billStatusLabel(status)} {rupees(status.amount)}
        </span>
    );
};

/** One bill row: date stamp, icon, title, status, total, actions. */
const BillRow = ({ bill, groupId, currentUserId, open, onToggleMenu, onEdit, onDelete }) => {
    const stamp = dateStamp(bill.created_at);
    const status = deriveBillStatus(bill, currentUserId);
    const payer = bill.paid_by_detail?.name || bill.created_by?.name || 'Unknown';

    return (
        <li className="flex items-center gap-3 min-h-row border-b border-border last:border-0">
            {/* Day over month, so the eye can pick out a date without reading
                the month heading above it. The visual parts are hidden from
                assistive tech; the paid-by line still carries the date in
                full. */}
            <time dateTime={stamp.iso} className="shrink-0 w-9 text-center leading-tight">
                <span
                    aria-hidden="true"
                    className="block font-money tnum text-body font-semibold text-text"
                >
                    {stamp.day}
                </span>
                <span
                    aria-hidden="true"
                    className="block text-[10px] uppercase tracking-wide text-faint"
                >
                    {stamp.month}
                    {stamp.year ? ` ${stamp.year}` : ''}
                </span>
            </time>

            <Link
                to={`/groups/${groupId}/bills/${bill.id}`}
                className="flex-1 min-w-0 flex items-center gap-3 py-3"
            >
                <span className="flex w-10 h-10 rounded-control bg-accent-soft text-accent items-center justify-center shrink-0">
                    <Receipt size={18} strokeWidth={1.75} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block text-body font-semibold text-text truncate">
                        {bill.title}
                    </span>
                    <span className="block text-meta text-faint truncate">
                        Paid by {payer} · {bill.created_at}
                    </span>
                </span>
            </Link>

            <span className="shrink-0 flex items-baseline gap-3">
                <BillStatus status={status} />
                <span className="shrink-0 font-money tnum text-body font-semibold text-text whitespace-nowrap">
                    {bill.total_amount?.toFixed?.(2) ?? bill.total_amount}{' '}
                    <span className="text-meta text-faint">{bill.currency}</span>
                </span>
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
    const currentUserId = useSelector((state) => state.auth.user?.id);

    const [openMenu, setOpenMenu] = useState(null);
    const [pendingDelete, setPendingDelete] = useState(null);
    const [actionError, setActionError] = useState(null);

    // Memoised so the month sections are not rebuilt into new objects on every
    // render, which would remount the rows and drop an open popover.
    const months = useMemo(() => groupByMonth(bills), [bills]);

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
                    /* A section per month, not one long list with heading rows
                       styled to look like headings. A real <section> with a real
                       <h3> means a screen reader can jump between months, and the
                       heading is in the accessibility tree rather than being a
                       div that only looks like one. */
                    <div>
                        {months.map((month) => (
                            /* The gap between months lives on the section, not the
                               heading. `first:pt-0` on the <h3> would match every
                               heading, because each is the first child of its own
                               section, so only the first month lost its padding. */
                            <section
                                key={month.key}
                                aria-labelledby={`month-${month.key}`}
                                className="pt-5 first:pt-0"
                            >
                                {/* The count is a sibling of the heading, not
                                    inside it. As a child it became part of the
                                    accessible name, so the section was announced
                                    as "March 20261" and aria-labelledby carried
                                    that through to the region. */}
                                <div className="flex items-baseline gap-2 pb-2">
                                    <h3
                                        id={`month-${month.key}`}
                                        className="text-meta font-semibold uppercase tracking-wide text-faint"
                                    >
                                        {month.label}
                                    </h3>
                                    <span
                                        aria-hidden="true"
                                        className="font-money tnum text-meta text-faint/70"
                                    >
                                        {month.bills.length}
                                    </span>
                                </div>
                                <ul>
                                    {month.bills.map((bill) => (
                                        <BillRow
                                            key={bill.id}
                                            bill={bill}
                                            groupId={groupId}
                                            currentUserId={currentUserId}
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
                            </section>
                        ))}
                    </div>
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
