import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { Save, Tag, Trash2, Edit3, Check, X } from 'lucide-react';
import { createEmptyItem, computeAssignments, getItemSummary, getOverviewTotals } from './billUtils';
import SplitControls from './SplitControls';
import MemberSplitGrid from './MemberSplitGrid';
import ValidationBadge from './ValidationBadge';
import ItemSidebar from './ItemSidebar';

const TABS = [
    { key: 'overview', label: 'Overview' },
    { key: 'items', label: 'Items' },
    { key: 'splits', label: 'Splits' },
];

const buildInitialState = (initialData) => {
    if (initialData) {
        return {
            title: initialData.title || '',
            totalAmount: initialData.total_amount || '',
            paidBy: initialData.paid_by || '',
            items: initialData.items.map(item => {
                const assignedUserIds = item.assignments?.map(a => a.user_id) || [];
                return {
                    name: item.name,
                    amount: item.amount,
                    splitMode: 'shares',
                    selectedMembers: assignedUserIds,
                    memberShares: Object.fromEntries(assignedUserIds.map(uid => [uid, 1])),
                    memberPercents: {},
                };
            }),
        };
    }
    return { title: '', totalAmount: '', paidBy: '', items: [createEmptyItem()] };
};

const CompoundBillForm = ({ members, onSubmit, isSubmitting, initialData, onCancel }) => {
    const currentUser = useSelector((state) => state.auth.user);
    const initialState = buildInitialState(initialData);

    const [activeTab, setActiveTab] = useState('overview');
    const [title, setTitle] = useState(initialState.title);
    const [totalAmount, setTotalAmount] = useState(initialState.totalAmount);
    const [paidBy, setPaidBy] = useState(initialState.paidBy);
    const [items, setItems] = useState(initialState.items);
    const [selectedItemIndex, setSelectedItemIndex] = useState(null);
    const [errors, setErrors] = useState({});
    const [editingItemIdx, setEditingItemIdx] = useState(null);
    const [editItemName, setEditItemName] = useState('');
    const [editItemAmount, setEditItemAmount] = useState('');

    const handleAddItem = () => {
        setItems([...items, createEmptyItem()]);
    };

    const handleRemoveItem = (index) => {
        if (items.length <= 1) return;
        const newItems = items.filter((_, i) => i !== index);
        setItems(newItems);
        if (selectedItemIndex === index) setSelectedItemIndex(null);
        else if (selectedItemIndex > index) setSelectedItemIndex(selectedItemIndex - 1);
    };

    const handleItemChange = (index, field, value) => {
        const newItems = structuredClone(items);
        newItems[index][field] = value;
        setItems(newItems);
    };

    const handleSplitModeToggle = (index, mode) => {
        const newItems = structuredClone(items);
        newItems[index].splitMode = mode;
        if (mode === 'shares') {
            newItems[index].selectedMembers.forEach(uid => {
                newItems[index].memberShares[uid] = 1;
            });
        } else {
            const count = newItems[index].selectedMembers.length || 1;
            const evenPct = 100 / count;
            newItems[index].selectedMembers.forEach(uid => {
                newItems[index].memberPercents[uid] = parseFloat(evenPct.toFixed(2));
            });
        }
        setItems(newItems);
    };

    const handleToggleMember = (itemIdx, userId) => {
        const newItems = structuredClone(items);
        const item = newItems[itemIdx];
        const idx = item.selectedMembers.indexOf(userId);

        if (idx >= 0) {
            item.selectedMembers = item.selectedMembers.filter(id => id !== userId);
            delete item.memberShares[userId];
            delete item.memberPercents[userId];
        } else {
            item.selectedMembers = [...item.selectedMembers, userId];
            if (item.splitMode === 'shares') {
                item.memberShares[userId] = 1;
            } else {
                item.memberPercents[userId] = '';
            }
        }
        setItems(newItems);
    };

    const handleSplitEvenly = (itemIdx) => {
        if (!members) return;
        const newItems = structuredClone(items);
        const item = newItems[itemIdx];
        const allIds = members.map(m => m.user.id);
        item.selectedMembers = allIds;

        if (item.splitMode === 'shares') {
            allIds.forEach(uid => { item.memberShares[uid] = 1; });
        } else {
            const evenPct = 100 / allIds.length;
            allIds.forEach(uid => {
                item.memberPercents[uid] = parseFloat(evenPct.toFixed(2));
            });
        }
        setItems(newItems);
    };

    const handleShareChange = (itemIdx, userId, value) => {
        const newItems = structuredClone(items);
        newItems[itemIdx].memberShares[userId] = value === '' ? '' : value;
        setItems(newItems);
    };

    const handlePercentChange = (itemIdx, userId, value) => {
        const newItems = structuredClone(items);
        newItems[itemIdx].memberPercents[userId] = value === '' ? '' : value;
        setItems(newItems);
    };

    const handleSelectItem = (index) => {
        if (selectedItemIndex === index) {
            setSelectedItemIndex(null);
            return;
        }
        setSelectedItemIndex(index);
        const item = items[index];
        if (item.selectedMembers.length === 0 && members) {
            const newItems = structuredClone(items);
            const allIds = members.map(m => m.user.id);
            newItems[index].selectedMembers = allIds;
            allIds.forEach(uid => {
                newItems[index].memberShares[uid] = 1;
            });
            setItems(newItems);
        }
    };

    const startEditItem = (idx) => {
        setEditingItemIdx(idx);
        setEditItemName(items[idx].name);
        setEditItemAmount(items[idx].amount);
    };

    const saveEditItem = () => {
        if (editingItemIdx === null) return;
        handleItemChange(editingItemIdx, 'name', editItemName);
        handleItemChange(editingItemIdx, 'amount', editItemAmount);
        setEditingItemIdx(null);
    };

    const cancelEditItem = () => {
        setEditingItemIdx(null);
        setEditItemName('');
        setEditItemAmount('');
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setErrors({});

        const newErrors = {};
        if (!title?.trim()) newErrors.title = 'Title is required';
        if (!totalAmount || parseFloat(totalAmount) <= 0) newErrors.totalAmount = 'Amount must be greater than 0';
        if (!paidBy) newErrors.paidBy = 'Select who paid';

        const itemsTotal = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
        const total = parseFloat(totalAmount) || 0;
        if (Math.abs(itemsTotal - total) > 0.01) {
            newErrors.itemsMismatch = `Item amounts (₹${itemsTotal.toFixed(2)}) don't match total (₹${total.toFixed(2)})`;
        }

        items.forEach((item, idx) => {
            if (!item.name?.trim()) newErrors[`item_${idx}_name`] = 'Name required';
            if (!item.amount || parseFloat(item.amount) <= 0) newErrors[`item_${idx}_amount`] = 'Amount required';
            const summary = getItemSummary(item);
            if (summary && !summary.valid) {
                newErrors[`item_${idx}_split`] = 'Split does not match item amount';
            }
        });

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        const payload = {
            title,
            total_amount: totalAmount,
            paid_by: paidBy || currentUser?.id,
            items: items.map(item => ({
                name: item.name,
                amount: String(item.amount),
                assignments: computeAssignments(item)
            }))
        };
        onSubmit(payload);
    };

    const itemsTotal = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const overviewTotals = getOverviewTotals(items);
    const total = parseFloat(totalAmount) || 0;
    const itemsMatch = Math.abs(itemsTotal - total) < 0.01;

    return (
        <form onSubmit={handleSubmit} className="space-y-0">
            {/* Tab Bar */}
            <div className="flex space-x-8 border-b border-gray-100 mb-6">
                {TABS.map(tab => (
                    <button
                        key={tab.key}
                        type="button"
                        onClick={() => setActiveTab(tab.key)}
                        className={`pb-3 text-sm font-bold border-b-2 transition-all ${
                            activeTab === tab.key
                                ? 'text-blue-600 border-blue-600'
                                : 'text-gray-400 border-transparent hover:text-gray-600'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab 1: Overview */}
            {activeTab === 'overview' && (
                <div className="space-y-5">
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
                                    placeholder="e.g. Team Dinner"
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
                                    onChange={(e) => setTotalAmount(e.target.value)}
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

                    {/* Overview Summary */}
                    <div className="bg-gray-50 rounded-xl p-5 space-y-3">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-400 font-bold">Items</span>
                            <span className="font-black text-gray-900">{items.length}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-400 font-bold">Item Total</span>
                            <span className={`font-black ${itemsMatch ? 'text-green-600' : 'text-amber-600'}`}>
                                ₹{itemsTotal.toFixed(2)}
                            </span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-400 font-bold">Bill Total</span>
                            <span className="font-black text-blue-600">₹{total.toFixed(2)}</span>
                        </div>
                        {errors.itemsMismatch && (
                            <p className="text-xs text-red-500 font-bold">{errors.itemsMismatch}</p>
                        )}

                        {/* Per-person overview */}
                        {Object.keys(overviewTotals).length > 0 && (
                            <div className="border-t border-gray-200 pt-3 mt-3">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Per Person Totals</p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                    {Object.entries(overviewTotals).map(([uid, data]) => {
                                        const member = members?.find(m => m.user.id === uid);
                                        return (
                                            <div key={uid} className="bg-white rounded-lg px-3 py-2 border border-gray-100">
                                                <div className="text-xs font-bold text-gray-700 truncate">
                                                    {member?.user.name || member?.user.email.split('@')[0] || 'Unknown'}
                                                </div>
                                                <div className="text-sm font-black text-blue-600">
                                                    ₹{data.amount.toFixed(2)}
                                                </div>
                                                <div className="text-[10px] text-gray-400 font-bold">
                                                    {data.itemCount} {data.itemCount === 1 ? 'item' : 'items'}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Tab 2: Items */}
            {activeTab === 'items' && (
                <div className="space-y-3">
                    {items.map((item, idx) => {
                        const isEditing = editingItemIdx === idx;
                        const assigneeCount = item.selectedMembers.length;
                        const itemSummary = getItemSummary(item);
                        return (
                            <div
                                key={idx}
                                className={`rounded-xl overflow-hidden transition-all ${
                                    isEditing ? 'border-2 border-blue-400 bg-blue-50' : 'border border-gray-200 bg-white hover:border-gray-300'
                                }`}
                            >
                                <div className="px-5 py-4 flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                                            isEditing ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
                                        }`}>
                                            {idx + 1}
                                        </div>
                                        {isEditing ? (
                                            <div className="flex items-center space-x-2">
                                                <input
                                                    type="text"
                                                    value={editItemName}
                                                    onChange={(e) => setEditItemName(e.target.value)}
                                                    className="bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                                    placeholder="Item name"
                                                    autoFocus
                                                />
                                                <div className="relative">
                                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-300 text-xs font-bold">₹</span>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={editItemAmount}
                                                        onChange={(e) => setEditItemAmount(e.target.value)}
                                                        className="w-24 bg-white border border-gray-300 rounded-lg pl-6 pr-2 py-1.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <div>
                                                <span className="text-sm font-bold text-gray-900">{item.name || `Item ${idx + 1}`}</span>
                                                <span className="text-xs font-bold text-gray-400 ml-2">₹{parseFloat(item.amount) || 0}</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        {isEditing ? (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={saveEditItem}
                                                    className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                                >
                                                    <Check size={16} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={cancelEditItem}
                                                    className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                                    itemSummary?.valid ? 'text-green-600 bg-green-50' : 'text-amber-600 bg-amber-50'
                                                }`}>
                                                    {assigneeCount} assigned
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => startEditItem(idx)}
                                                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                                >
                                                    <Edit3 size={14} />
                                                </button>
                                                {items.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveItem(idx)}
                                                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                                {errors[`item_${idx}_name`] && (
                                    <p className="px-5 pb-2 text-xs text-red-500 font-bold">{errors[`item_${idx}_name`]}</p>
                                )}
                                {errors[`item_${idx}_amount`] && (
                                    <p className="px-5 pb-2 text-xs text-red-500 font-bold">{errors[`item_${idx}_amount`]}</p>
                                )}
                            </div>
                        );
                    })}
                    <button
                        type="button"
                        onClick={handleAddItem}
                        className="w-full bg-blue-50 text-blue-600 py-3 rounded-xl font-bold text-sm border-2 border-dashed border-blue-200 hover:bg-blue-100 transition-colors"
                    >
                        + Add Item
                    </button>
                </div>
            )}

            {/* Tab 3: Splits */}
            {activeTab === 'splits' && (
                <div className="flex min-h-[400px]">
                    <ItemSidebar
                        items={items}
                        selectedIndex={selectedItemIndex}
                        onSelectItem={handleSelectItem}
                        onAddItem={handleAddItem}
                    />

                    <div className="flex-1 p-6">
                        {selectedItemIndex !== null ? (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="font-black text-gray-900">
                                            {items[selectedItemIndex].name || `Item ${selectedItemIndex + 1}`}
                                        </h4>
                                        <p className="text-xs text-gray-400 font-bold">
                                            ₹{parseFloat(items[selectedItemIndex].amount) || 0}
                                        </p>
                                    </div>
                                </div>

                                <SplitControls
                                    splitMode={items[selectedItemIndex].splitMode}
                                    onToggleMode={(mode) => handleSplitModeToggle(selectedItemIndex, mode)}
                                    onSplitEvenly={() => handleSplitEvenly(selectedItemIndex)}
                                />

                                <MemberSplitGrid
                                    members={members}
                                    item={items[selectedItemIndex]}
                                    computations={computeAssignments(items[selectedItemIndex])}
                                    onToggleMember={(userId) => handleToggleMember(selectedItemIndex, userId)}
                                    onShareChange={(userId, value) => handleShareChange(selectedItemIndex, userId, value)}
                                    onPercentChange={(userId, value) => handlePercentChange(selectedItemIndex, userId, value)}
                                />

                                <ValidationBadge
                                    summary={getItemSummary(items[selectedItemIndex])}
                                    amount={items[selectedItemIndex].amount}
                                />
                                {errors[`item_${selectedItemIndex}_split`] && (
                                    <p className="text-xs text-red-500 font-bold">{errors[`item_${selectedItemIndex}_split`]}</p>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-center py-12">
                                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                                    <Edit3 size={24} className="text-gray-300" />
                                </div>
                                <p className="text-gray-400 font-bold text-sm">Select an item from the sidebar</p>
                                <p className="text-gray-300 text-xs mt-1">to configure how it's split</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Error Summary */}
            {errors.itemsMismatch && activeTab !== 'overview' && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-xs font-bold">
                    {errors.itemsMismatch}
                </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-6 border-t border-gray-100 mt-6">
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

export default CompoundBillForm;
