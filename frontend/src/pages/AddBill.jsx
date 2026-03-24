import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useGetGroupMembersQuery } from '../store/groupsApi';
import { useCreateBillMutation } from '../store/billsApi';
import {
    ArrowLeft,
    Receipt,
    DollarSign,
    Tag,
    PlusCircle,
    Users,
    Sparkles,
    Save
} from 'lucide-react';

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

    if (loadingMembers) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-gray-500 font-medium">Loading members...</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto py-8 px-4 animate-fade-in-up">
            <Link to={`/groups/${groupId}`} className="flex items-center text-blue-600 hover:text-blue-800 mb-6 transition-colors font-semibold group">
                <ArrowLeft size={20} className="mr-2 group-hover:-translate-x-1 transition-transform" />
                Back to Group
            </Link>

            <div className="bg-white p-10 rounded-3xl shadow-xl shadow-blue-900/5 border border-gray-100">
                <div className="flex items-center space-x-3 mb-10 border-b border-gray-50 pb-6">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                        <Receipt size={24} />
                    </div>
                    <h2 className="text-3xl font-black text-gray-900 tracking-tight">Add New Bill</h2>
                </div>

                <form onSubmit={handleSubmit} className="space-y-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest ml-1">What is this for?</label>
                            <div className="relative">
                                <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                                <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-gray-50 border-gray-200 border rounded-2xl pl-12 pr-4 py-4 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-bold text-gray-900" placeholder="e.g. Sushi Dinner" />
                            </div>
                        </div>
                        <div className="flex space-x-4">
                            <div className="flex-1 space-y-2">
                                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Total Bill</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-gray-300">$</span>
                                    <input type="number" step="0.01" required value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} className="w-full bg-gray-50 border-gray-200 border rounded-2xl pl-8 pr-4 py-4 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-black text-gray-900" placeholder="0.00" />
                                </div>
                            </div>
                            <div className="w-1/3 space-y-2">
                                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Currency</label>
                                <input type="text" required value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full bg-gray-50 border-gray-200 border rounded-2xl px-4 py-4 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-black text-gray-900 text-center uppercase" />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="flex items-center space-x-2 text-blue-900">
                            <Sparkles size={20} className="text-blue-500" />
                            <h3 className="text-xl font-black tracking-tight">Line Items & Splits</h3>
                        </div>

                        {items.map((item, idx) => (
                            <div key={idx} className="bg-gray-50/50 p-8 rounded-3xl border border-gray-100 space-y-6 hover:bg-white hover:shadow-lg transition-all duration-300">
                                <div className="flex flex-col sm:flex-row sm:space-x-4 space-y-4 sm:space-y-0">
                                    <div className="flex-1">
                                        <input type="text" required value={item.name} onChange={(e) => handleItemChange(idx, 'name', e.target.value)} placeholder="Item name (e.g. Margherita Pizza)" className="w-full bg-white border-gray-200 border rounded-xl px-5 py-3 focus:ring-2 focus:ring-blue-500 transition-all outline-none font-bold text-gray-700" />
                                    </div>
                                    <div className="sm:w-1/3 relative">
                                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
                                        <input type="number" step="0.01" required value={item.amount} onChange={(e) => handleItemChange(idx, 'amount', e.target.value)} placeholder="0.00" className="w-full bg-white border-gray-200 border rounded-xl pl-9 pr-4 py-3 focus:ring-2 focus:ring-blue-500 transition-all outline-none font-black text-gray-900" />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center space-x-2 text-gray-400">
                                        <Users size={14} />
                                        <p className="text-[10px] font-black uppercase tracking-widest">Assign shares for this item</p>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                        {members?.map(membership => {
                                            const assigned = item.assignments.find(a => a.user_id === membership.user.id);
                                            const userInitial = (membership.user.name || membership.user.email)[0].toUpperCase();
                                            const isFocused = assigned && assigned.share_amount > 0;
                                            return (
                                                <div key={membership.user.id} className={`flex items-center space-x-3 p-3 rounded-2xl border transition-all ${isFocused ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-200' : 'bg-white border-gray-100 text-gray-700 hover:border-blue-200'}`}>
                                                    <div className={`w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-bold border transition-colors ${isFocused ? 'bg-blue-500 border-blue-400' : 'bg-blue-50 border-blue-100 text-blue-600'}`}>
                                                        {userInitial}
                                                    </div>
                                                    <div className="truncate flex-1 text-xs font-bold" title={membership.user.name || membership.user.email}>
                                                        {membership.user.name || membership.user.email.split('@')[0]}
                                                    </div>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        placeholder="0.00"
                                                        value={assigned ? assigned.share_amount : ''}
                                                        onChange={(e) => handleAssignmentChange(idx, membership.user.id, e.target.value)}
                                                        className={`w-16 border rounded-lg px-2 py-1.5 text-xs font-black outline-none transition-all ${isFocused ? 'bg-blue-700 border-blue-800 text-white placeholder:text-blue-400' : 'bg-gray-50 border-gray-200 text-gray-900 focus:bg-white focus:ring-1 focus:ring-blue-500'}`}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        ))}

                        <button type="button" onClick={handleAddItem} className="bg-blue-50 text-blue-600 px-6 py-4 rounded-2xl font-black text-sm hover:bg-blue-100 transition-all flex items-center justify-center w-full border-2 border-dashed border-blue-200 group">
                            <PlusCircle size={20} className="mr-2 group-hover:rotate-90 transition-transform duration-300" />
                            Add another item
                        </button>
                    </div>

                    <div className="pt-8 border-t border-gray-50">
                        <button type="submit" disabled={isCreating} className="w-full bg-blue-600 text-white py-5 rounded-3xl shadow-xl shadow-blue-600/20 font-black text-xl hover:bg-blue-700 hover:-translate-y-1 transition-all disabled:opacity-50 flex items-center justify-center space-x-3">
                            {isCreating ? (
                                <>
                                    <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                                    <span>Saving Bill...</span>
                                </>
                            ) : (
                                <>
                                    <Save size={24} />
                                    <span>Save Final Bill</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddBill;
