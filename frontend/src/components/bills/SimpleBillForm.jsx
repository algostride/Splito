import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { Save, Tag } from 'lucide-react';
import { createEmptyItem, computeAssignments, getItemSummary } from './billUtils';
import SplitControls from './SplitControls';
import MemberSplitGrid from './MemberSplitGrid';
import ValidationBadge from './ValidationBadge';

const buildInitialState = (initialData, members) => {
    if (initialData) {
        const existingItem = initialData.items?.[0];
        const assignedUserIds = existingItem?.assignments?.map(a => a.user_id) || [];
        return {
            title: initialData.title || '',
            totalAmount: initialData.total_amount || '',
            paidBy: initialData.paid_by || '',
            item: existingItem ? {
                name: existingItem.name,
                amount: existingItem.amount,
                splitMode: 'shares',
                selectedMembers: assignedUserIds,
                memberShares: Object.fromEntries(assignedUserIds.map(uid => [uid, 1])),
                memberPercents: {},
            } : createEmptyItem(),
        };
    }

    const allIds = members?.map(m => m.user.id) || [];
    return {
        title: '',
        totalAmount: '',
        paidBy: '',
        item: {
            ...createEmptyItem(),
            selectedMembers: allIds,
            memberShares: Object.fromEntries(allIds.map(uid => [uid, 1])),
        },
    };
};

const SimpleBillForm = ({ members, onSubmit, isSubmitting, initialData, onCancel }) => {
    const currentUser = useSelector((state) => state.auth.user);
    const initialState = buildInitialState(initialData, members);

    const [title, setTitle] = useState(initialState.title);
    const [totalAmount, setTotalAmount] = useState(initialState.totalAmount);
    const [paidBy, setPaidBy] = useState(initialState.paidBy);
    const [item, setItem] = useState(initialState.item);
    const [errors, setErrors] = useState({});

    const handleAmountChange = (value) => {
        setTotalAmount(value);
        if (!initialData) {
            setItem(prev => ({ ...prev, amount: value }));
        }
    };

    const handleToggleMember = (userId) => {
        setItem(prev => {
            const idx = prev.selectedMembers.indexOf(userId);
            if (idx >= 0) {
                const newSelected = prev.selectedMembers.filter(id => id !== userId);
                const newShares = { ...prev.memberShares };
                const newPercents = { ...prev.memberPercents };
                delete newShares[userId];
                delete newPercents[userId];
                return { ...prev, selectedMembers: newSelected, memberShares: newShares, memberPercents: newPercents };
            } else {
                const newSelected = [...prev.selectedMembers, userId];
                const newShares = { ...prev.memberShares };
                const newPercents = { ...prev.memberPercents };
                if (prev.splitMode === 'shares') {
                    newShares[userId] = 1;
                } else {
                    newPercents[userId] = '';
                }
                return { ...prev, selectedMembers: newSelected, memberShares: newShares, memberPercents: newPercents };
            }
        });
    };

    const handleSplitModeToggle = (mode) => {
        setItem(prev => {
            const updated = { ...prev, splitMode: mode };
            if (mode === 'shares') {
                const newShares = {};
                prev.selectedMembers.forEach(uid => { newShares[uid] = 1; });
                updated.memberShares = newShares;
            } else {
                const count = prev.selectedMembers.length || 1;
                const evenPct = 100 / count;
                const newPercents = {};
                prev.selectedMembers.forEach(uid => {
                    newPercents[uid] = parseFloat(evenPct.toFixed(2));
                });
                updated.memberPercents = newPercents;
            }
            return updated;
        });
    };

    const handleSplitEvenly = () => {
        if (!members) return;
        const allIds = members.map(m => m.user.id);
        setItem(prev => {
            const updated = { ...prev, selectedMembers: allIds };
            if (prev.splitMode === 'shares') {
                updated.memberShares = Object.fromEntries(allIds.map(uid => [uid, 1]));
            } else {
                const evenPct = 100 / allIds.length;
                updated.memberPercents = Object.fromEntries(allIds.map(uid => [uid, parseFloat(evenPct.toFixed(2))]));
            }
            return updated;
        });
    };

    const handleShareChange = (userId, value) => {
        setItem(prev => ({
            ...prev,
            memberShares: { ...prev.memberShares, [userId]: value === '' ? '' : value }
        }));
    };

    const handlePercentChange = (userId, value) => {
        setItem(prev => ({
            ...prev,
            memberPercents: { ...prev.memberPercents, [userId]: value === '' ? '' : value }
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setErrors({});

        const newErrors = {};
        if (!title?.trim()) newErrors.title = 'Title is required';
        if (!totalAmount || parseFloat(totalAmount) <= 0) newErrors.totalAmount = 'Amount must be greater than 0';
        if (!paidBy) newErrors.paidBy = 'Select who paid';

        const summary = getItemSummary(item);
        if (summary && !summary.valid) {
            newErrors.split = 'Split does not match bill amount';
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        const payload = {
            title,
            total_amount: totalAmount,
            paid_by: paidBy || currentUser?.id,
            items: [{
                name: title,
                amount: String(item.amount),
                assignments: computeAssignments(item)
            }]
        };
        onSubmit(payload);
    };

    const computations = computeAssignments(item);
    const summary = getItemSummary(item);

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Bill Details */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Title</label>
                    <div className="relative">
                        <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={14} />
                        <input
                            type="text"
                            required
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className={`w-full bg-gray-50 border rounded-lg pl-9 pr-3 py-2.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all outline-none ${
                                errors.title ? 'border-red-300' : 'border-gray-200'
                            }`}
                            placeholder="e.g. Sushi Dinner"
                        />
                    </div>
                    {errors.title && <p className="text-xs text-red-500 font-bold">{errors.title}</p>}
                </div>

                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Amount</label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 text-sm font-bold">₹</span>
                        <input
                            type="number"
                            step="0.01"
                            required
                            value={totalAmount}
                            onChange={(e) => handleAmountChange(e.target.value)}
                            className={`w-full bg-gray-50 border rounded-lg pl-7 pr-3 py-2.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all outline-none ${
                                errors.totalAmount ? 'border-red-300' : 'border-gray-200'
                            }`}
                            placeholder="0.00"
                        />
                    </div>
                    {errors.totalAmount && <p className="text-xs text-red-500 font-bold">{errors.totalAmount}</p>}
                </div>

                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Paid by</label>
                    <select
                        required
                        value={paidBy}
                        onChange={(e) => setPaidBy(e.target.value)}
                        className={`w-full bg-gray-50 border rounded-lg px-3 py-2.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all outline-none ${
                            errors.paidBy ? 'border-red-300' : 'border-gray-200'
                        }`}
                    >
                        <option value="" disabled>Select member...</option>
                        {members?.map(m => (
                            <option key={m.user.id} value={m.user.id}>{m.user.name || m.user.email}</option>
                        ))}
                    </select>
                    {errors.paidBy && <p className="text-xs text-red-500 font-bold">{errors.paidBy}</p>}
                </div>
            </div>

            {/* Split Controls */}
            <SplitControls
                splitMode={item.splitMode}
                onToggleMode={handleSplitModeToggle}
                onSplitEvenly={handleSplitEvenly}
            />

            {/* Member Grid */}
            <MemberSplitGrid
                members={members}
                item={item}
                computations={computations}
                summary={summary}
                onToggleMember={handleToggleMember}
                onShareChange={handleShareChange}
                onPercentChange={handlePercentChange}
            />

            {/* Validation */}
            <ValidationBadge summary={summary} amount={item.amount} />
            {errors.split && <p className="text-xs text-red-500 font-bold">{errors.split}</p>}

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                {onCancel && (
                    <button
                        type="button"
                        onClick={onCancel}
                        className="text-gray-400 py-2.5 px-4 text-sm font-bold hover:text-gray-600 transition-colors"
                    >
                        Cancel
                    </button>
                )}
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-blue-600 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-blue-600/20 hover:bg-blue-700 hover:-translate-y-0.5 transition-all disabled:opacity-50 flex items-center justify-center space-x-2 ml-auto"
                >
                    {isSubmitting ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>Saving...</span>
                        </>
                    ) : (
                        <>
                            <Save size={16} />
                            <span>Save Bill</span>
                        </>
                    )}
                </button>
            </div>
        </form>
    );
};

export default SimpleBillForm;
