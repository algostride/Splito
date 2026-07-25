import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useGetGroupMembersQuery } from '../store/groupsApi';
import { useGetBillDetailQuery, useDeleteBillMutation } from '../store/billsApi';
import { describeError } from '../utils/errorMessage';
import { longDate } from '../utils/dates';
import {
    ArrowLeft,
    Receipt,
    Pencil,
    Trash2,
    Calendar,
    ChevronRight,
    Sparkles
} from 'lucide-react';
import Screen from '../components/shell/Screen';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { Note } from '../components/ui/EmptyState';
import { LoadingBlock } from '../components/ui/Spinner';
import Avatar from '../components/ui/Avatar';

const BillDetail = () => {
    const { id: groupId, billId } = useParams();
    const navigate = useNavigate();
    const { data: members, isLoading: loadingMembers } = useGetGroupMembersQuery(groupId);
    // `error` was not destructured, so a 500 fell into the `!bill` branch and
    // was reported as "Bill not found." -- telling the user the bill is gone
    // when it is still there and the request is what failed.
    const { data: bill, isLoading: billLoading, error: billError } = useGetBillDetailQuery(billId);
    const [deleteBill, { isLoading: isDeleting }] = useDeleteBillMutation();

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteError, setDeleteError] = useState(null);

    const handleDelete = async () => {
        try {
            setDeleteError(null);
            await deleteBill(billId).unwrap();
            navigate(`/groups/${groupId}`);
        } catch (err) {
            console.error('Failed to delete bill', err);
            setDeleteError(describeError(err));
        }
    };

    const isLoading = billLoading || loadingMembers;
    const memberName = (id) =>
        members?.find((m) => m.user.id === id)?.user?.name || 'Unknown';

    return (
        <Screen width="max-w-4xl">
            <Link
                to={`/groups/${groupId}`}
                className="inline-flex items-center text-accent hover:text-accent-ink transition-colors font-semibold"
            >
                <ArrowLeft size={18} strokeWidth={2} className="mr-2" aria-hidden="true" />
                Back to group
            </Link>

            {isLoading ? (
                <LoadingBlock text="Loading bill..." />
            ) : billError ? (
                <Note tone="neg">{describeError(billError)}</Note>
            ) : !bill ? (
                <Note tone="neg">Bill not found.</Note>
            ) : (
                <Card pad="gutter">
                    <div className="flex flex-wrap justify-between items-start gap-4 pb-5 mb-5 border-b border-border">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-12 h-12 bg-accent-soft text-accent rounded-control flex items-center justify-center shrink-0">
                                <Receipt size={22} strokeWidth={1.75} aria-hidden="true" />
                            </div>
                            <div className="min-w-0">
                                <h1 className="text-title lg:text-display font-display font-semibold text-text truncate">
                                    {bill.title}
                                </h1>
                                <div className="flex items-center text-meta text-faint mt-1">
                                    <Calendar size={13} className="mr-1" aria-hidden="true" />
                                    {longDate(bill.created_at)}
                                    <ChevronRight size={12} className="mx-1" aria-hidden="true" />
                                    Paid by {bill.paid_by_detail?.name || bill.created_by?.name || 'Unknown'}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => navigate(`/groups/${groupId}/bills/${billId}/edit`)}
                            >
                                <Pencil size={15} strokeWidth={2} aria-hidden="true" />
                                Edit
                            </Button>
                            <Button variant="danger" size="sm" onClick={() => setShowDeleteConfirm(true)}>
                                <Trash2 size={15} strokeWidth={2} aria-hidden="true" />
                                Delete
                            </Button>
                        </div>
                    </div>

                    {showDeleteConfirm && (
                        <div className="mb-5 p-4 bg-neg-soft border border-neg/30 rounded-control">
                            <p className="text-body font-semibold text-neg mb-3">
                                Delete this bill? Balances will be recalculated.
                            </p>
                            {deleteError && (
                                <Note tone="neg" className="mb-3">{deleteError}</Note>
                            )}
                            <div className="flex items-center gap-2">
                                <Button variant="danger" size="sm" onClick={handleDelete} disabled={isDeleting}>
                                    {isDeleting ? 'Deleting...' : 'Yes, delete'}
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(false)}>
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-card mb-6">
                        <div className="bg-surface-2 rounded-card p-card">
                            <p className="text-meta text-faint uppercase tracking-wider mb-1.5">
                                Total amount
                            </p>
                            <p className="text-title font-display font-semibold font-money tnum text-text">
                                ₹{Number(bill.total_amount).toFixed(2)}
                            </p>
                        </div>
                        <div className="bg-surface-2 rounded-card p-card">
                            <p className="text-meta text-faint uppercase tracking-wider mb-1.5">
                                Created by
                            </p>
                            <p className="text-title font-semibold text-text truncate">
                                {bill.created_by?.name || bill.created_by?.email?.split('@')[0] || 'Unknown'}
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-text">
                            <Sparkles size={18} className="text-accent" aria-hidden="true" />
                            <h2 className="text-title font-semibold">Line items</h2>
                        </div>

                        {bill.items.map((item, idx) => (
                            <div key={item.id || idx} className="bg-surface-2 rounded-card p-card space-y-3">
                                <div className="flex justify-between items-center gap-3">
                                    <h3 className="text-body font-semibold text-text truncate">{item.name}</h3>
                                    <p className="font-money tnum text-body font-semibold text-text shrink-0">
                                        ₹{Number(item.amount).toFixed(2)}
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {item.assignments.map((assignment, aIdx) => (
                                        <div
                                            key={aIdx}
                                            className="flex items-center gap-2 bg-surface border border-border rounded-control px-3 py-1.5"
                                        >
                                            <Avatar name={memberName(assignment.user_id)} size="xs" />
                                            <span className="text-meta text-muted">
                                                {memberName(assignment.user_id)}
                                            </span>
                                            <span className="text-meta font-money tnum font-semibold text-accent">
                                                ₹{Number(assignment.share_amount).toFixed(2)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}
        </Screen>
    );
};

export default BillDetail;
