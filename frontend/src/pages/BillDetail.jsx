import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useGetGroupMembersQuery } from '../store/groupsApi';
import { useGetBillDetailQuery, useUpdateBillMutation, useDeleteBillMutation } from '../store/billsApi';
import {
    ArrowLeft,
    Receipt,
    Save,
    Pencil,
    Trash2,
    Calendar,
    ChevronRight,
    Sparkles
} from 'lucide-react';
import SimpleBillForm from '../components/bills/SimpleBillForm';
import CompoundBillForm from '../components/bills/CompoundBillForm';

const BillDetail = () => {
    const { id: groupId, billId } = useParams();
    const navigate = useNavigate();
    const { data: members, isLoading: loadingMembers } = useGetGroupMembersQuery(groupId);
    const { data: bill, isLoading: billLoading } = useGetBillDetailQuery(billId);
    const [updateBill, { isLoading: isUpdating }] = useUpdateBillMutation();
    const [deleteBill, { isLoading: isDeleting }] = useDeleteBillMutation();

    const [isEditing, setIsEditing] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const billType = bill?.items?.length === 1 ? 'simple' : 'compound';

    const handleUpdate = async (extraPayload) => {
        try {
            await updateBill({
                id: billId,
                group: groupId,
                currency: 'INR',
                ...extraPayload,
            }).unwrap();
            setIsEditing(false);
        } catch (err) {
            console.error('Failed to update bill', err);
        }
    };

    const handleDelete = async () => {
        try {
            await deleteBill(billId).unwrap();
            navigate(`/groups/${groupId}`);
        } catch (err) {
            console.error('Failed to delete bill', err);
        }
    };

    const isLoading = billLoading || loadingMembers;
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-gray-500 font-medium">Loading bill...</p>
            </div>
        );
    }

    if (!bill) {
        return <div className="p-8 max-w-4xl mx-auto text-red-500 text-center font-bold">Bill not found.</div>;
    }

    return (
        <div className="max-w-4xl mx-auto py-8 px-4 animate-fade-in-up">
            <Link to={`/groups/${groupId}`} className="flex items-center text-blue-600 hover:text-blue-800 mb-6 transition-colors font-semibold group">
                <ArrowLeft size={20} className="mr-2 group-hover:-translate-x-1 transition-transform" />
                Back to Group
            </Link>

            <div className="bg-white p-10 rounded-3xl shadow-xl shadow-blue-900/5 border border-gray-100">
                <div className="flex items-center justify-between mb-10 border-b border-gray-50 pb-6">
                    <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                            <Receipt size={24} />
                        </div>
                        <div>
                            <h2 className="text-3xl font-black text-gray-900 tracking-tight">{bill.title}</h2>
                            <div className="flex items-center text-sm text-gray-400 mt-1">
                                <Calendar size={14} className="mr-1" />
                                {new Date(bill.created_at).toLocaleDateString()}
                                <ChevronRight size={12} className="mx-1" />
                                Paid by {bill.paid_by_detail?.name || bill.created_by?.name || 'Unknown'}
                            </div>
                        </div>
                    </div>
                    {!isEditing && (
                        <div className="flex items-center space-x-3">
                            <button
                                onClick={() => setIsEditing(true)}
                                className="flex items-center space-x-2 bg-blue-50 text-blue-600 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-100 transition-all"
                            >
                                <Pencil size={16} />
                                <span>Edit</span>
                            </button>
                            <button
                                onClick={() => setShowDeleteConfirm(true)}
                                className="flex items-center space-x-2 bg-red-50 text-red-500 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-red-100 transition-all"
                            >
                                <Trash2 size={16} />
                                <span>Delete</span>
                            </button>
                        </div>
                    )}
                </div>

                {showDeleteConfirm && (
                    <div className="mb-8 p-6 bg-red-50 border border-red-100 rounded-2xl">
                        <p className="text-red-700 font-bold mb-4">Are you sure you want to delete this bill?</p>
                        <div className="flex items-center space-x-3">
                            <button
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="bg-red-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-red-600 transition-all disabled:opacity-50"
                            >
                                {isDeleting ? 'Deleting...' : 'Yes, Delete'}
                            </button>
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="text-gray-500 px-5 py-2.5 rounded-xl text-sm font-bold hover:text-gray-700 transition-all"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {isEditing ? (
                    billType === 'simple' ? (
                        <SimpleBillForm
                            members={members}
                            onSubmit={handleUpdate}
                            isSubmitting={isUpdating}
                            initialData={bill}
                            onCancel={() => setIsEditing(false)}
                        />
                    ) : (
                        <CompoundBillForm
                            members={members}
                            onSubmit={handleUpdate}
                            isSubmitting={isUpdating}
                            initialData={bill}
                            onCancel={() => setIsEditing(false)}
                        />
                    )
                ) : (
                    <div className="space-y-8">
                        <div className="grid grid-cols-2 gap-6">
                            <div className="bg-gray-50 rounded-2xl p-6">
                                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Total Amount</p>
                                <p className="text-3xl font-black text-gray-900">₹{Number(bill.total_amount).toFixed(2)}</p>
                            </div>
                            <div className="bg-gray-50 rounded-2xl p-6">
                                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Created By</p>
                                <p className="text-lg font-bold text-gray-900">{bill.created_by?.name || bill.created_by?.email?.split('@')[0] || 'Unknown'}</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center space-x-2 text-blue-900">
                                <Sparkles size={20} className="text-blue-500" />
                                <h3 className="text-xl font-black tracking-tight">Line Items</h3>
                            </div>

                            {bill.items.map((item, idx) => (
                                <div key={item.id || idx} className="bg-gray-50/50 p-6 rounded-2xl border border-gray-100 space-y-4">
                                    <div className="flex justify-between items-center">
                                        <h4 className="font-bold text-gray-900">{item.name}</h4>
                                        <p className="font-extrabold text-lg text-gray-900">₹{Number(item.amount).toFixed(2)}</p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {item.assignments.map((assignment, aIdx) => {
                                            const member = members?.find(m => m.user.id === assignment.user_id);
                                            return (
                                                <div key={aIdx} className="flex items-center space-x-2 bg-white border border-gray-100 rounded-xl px-3 py-2">
                                                    <div className="w-6 h-6 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-600">
                                                        {(member?.user?.name || member?.user?.email || 'U')[0].toUpperCase()}
                                                    </div>
                                                    <span className="text-xs font-bold text-gray-700">{member?.user?.name || 'Unknown'}</span>
                                                    <span className="text-xs font-black text-blue-600">₹{Number(assignment.share_amount).toFixed(2)}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BillDetail;
