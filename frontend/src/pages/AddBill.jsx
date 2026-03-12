import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useGetGroupMembersQuery } from '../store/groupsApi';
import { useCreateBillMutation } from '../store/billsApi';

const AddBill = () => {
    const { id: groupId } = useParams();
    const navigate = useNavigate();
    const { data: members, isLoading: loadingMembers } = useGetGroupMembersQuery(groupId);
    const [createBill, { isLoading: isCreating }] = useCreateBillMutation();

    const [title, setTitle] = useState('');
    const [totalAmount, setTotalAmount] = useState('');
    const [currency, setCurrency] = useState('USD');
    const [items, setItems] = useState([{ name: '', amount: '', assignments: [] }]);

    const handleAddItem = () => {
        setItems([...items, { name: '', amount: '', assignments: [] }]);
    };

    const handleItemChange = (index, field, value) => {
        const newItems = [...items];
        newItems[index][field] = value;
        setItems(newItems);
    };

    const handleAssignmentChange = (itemIdx, userId, shareAmount) => {
        const newItems = [...items];
        const assignments = newItems[itemIdx].assignments;
        const existingIdx = assignments.findIndex(a => a.user_id === userId);

        if (shareAmount === '' || parseFloat(shareAmount) === 0) {
            if (existingIdx >= 0) assignments.splice(existingIdx, 1);
        } else {
            if (existingIdx >= 0) {
                assignments[existingIdx].share_amount = shareAmount;
            } else {
                assignments.push({ user_id: userId, share_amount: shareAmount });
            }
        }
        setItems(newItems);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                group: groupId,
                title,
                total_amount: totalAmount,
                currency,
                items: items.map(item => ({
                    name: item.name,
                    amount: String(item.amount),
                    assignments: item.assignments.map(a => ({
                        ...a,
                        share_amount: String(a.share_amount)
                    }))
                }))
            };
            await createBill(payload).unwrap();
            navigate(`/groups/${groupId}`);
        } catch (err) {
            console.error('Failed to create bill', err);
            alert('Failed to create bill. Please check inputs.');
        }
    };

    if (loadingMembers) return <div className="p-8 text-center text-gray-500">Loading members...</div>;

    return (
        <div className="max-w-4xl mx-auto py-8 px-4">
            <Link to={`/groups/${groupId}`} className="text-blue-600 hover:underline mb-6 inline-block font-medium">&larr; Back to Group</Link>
            <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-100">
                <h2 className="text-3xl font-extrabold text-gray-800 mb-8 border-b pb-4">Add a New Bill</h2>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Description / Title</label>
                            <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border-gray-300 border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="e.g. Dinner" />
                        </div>
                        <div className="flex space-x-4">
                            <div className="flex-1">
                                <label className="block text-sm font-bold text-gray-700 mb-2">Total Amount</label>
                                <input type="number" step="0.01" required value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} className="w-full border-gray-300 border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="0.00" />
                            </div>
                            <div className="w-1/3">
                                <label className="block text-sm font-bold text-gray-700 mb-2">Currency</label>
                                <input type="text" required value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full border-gray-300 border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                            </div>
                        </div>
                    </div>

                    <div className="pt-8">
                        <h3 className="text-xl font-bold text-gray-800 mb-4">Line Items</h3>
                        {items.map((item, idx) => (
                            <div key={idx} className="bg-gray-50 bg-opacity-50 p-5 rounded-xl border border-gray-200 mb-6 shadow-sm">
                                <div className="flex flex-col sm:flex-row sm:space-x-4 mb-4 space-y-4 sm:space-y-0">
                                    <div className="flex-1">
                                        <input type="text" required value={item.name} onChange={(e) => handleItemChange(idx, 'name', e.target.value)} placeholder="Item name (e.g. Pizza)" className="w-full border-gray-300 border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                                    </div>
                                    <div className="sm:w-1/3">
                                        <input type="number" step="0.01" required value={item.amount} onChange={(e) => handleItemChange(idx, 'amount', e.target.value)} placeholder="Item cost" className="w-full border-gray-300 border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                                    </div>
                                </div>

                                <p className="text-sm font-bold text-gray-700 mb-3">Split item cost among:</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                    {members?.map(membership => {
                                        const assigned = item.assignments.find(a => a.user_id === membership.user.id);
                                        const userInitial = (membership.user.name || membership.user.email)[0].toUpperCase();
                                        return (
                                            <div key={membership.user.id} className="flex items-center space-x-3 bg-white p-3 rounded-lg border border-gray-200 shadow-sm transition hover:border-blue-300">
                                                <div className="w-6 h-6 flex-shrink-0 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">
                                                    {userInitial}
                                                </div>
                                                <div className="truncate flex-1 text-sm font-medium text-gray-700" title={membership.user.name || membership.user.email}>
                                                    {membership.user.name || membership.user.email.split('@')[0]}
                                                </div>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    placeholder="$0.00"
                                                    value={assigned ? assigned.share_amount : ''}
                                                    onChange={(e) => handleAssignmentChange(idx, membership.user.id, e.target.value)}
                                                    className="w-20 border-gray-300 border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}

                        <button type="button" onClick={handleAddItem} className="text-blue-600 font-semibold hover:underline mt-2 flex items-center">
                            <span className="mr-1 text-lg">+</span> Add another item
                        </button>
                    </div>

                    <div className="pt-8 mt-8 border-t border-gray-200 text-right">
                        <button type="submit" disabled={isCreating} className="bg-green-600 text-white px-8 py-3 rounded-lg shadow-md font-bold text-lg hover:bg-green-700 hover:shadow-lg focus:ring-4 focus:ring-green-300 disabled:opacity-50 transition-all">
                            {isCreating ? 'Saving...' : 'Save Bill'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddBill;
