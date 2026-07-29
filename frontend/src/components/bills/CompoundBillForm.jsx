import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Save, Tag, Trash2, Edit3, Check, Plus, X } from 'lucide-react';
import { createEmptyItem, computeAssignments, getItemSummary, getOverviewTotals, hydrateItem, evenPercents } from './billUtils';
import SplitControls from './SplitControls';
import MemberSplitGrid from './MemberSplitGrid';
import ValidationBadge from './ValidationBadge';
import ItemSidebar from './ItemSidebar';
import Spinner from '../ui/Spinner';
import { UnderlineTabs } from '../ui/Tabs';
import Card from '../ui/Card';
import Button from '../ui/Button';
import IconButton from '../ui/IconButton';
import Input, { Field, Select } from '../ui/Input';

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
            items: (initialData.items || []).map(hydrateItem),
        };
    }
    return { title: '', totalAmount: '', paidBy: '', items: [createEmptyItem()] };
};

const CompoundBillForm = ({ members, onSubmit, isSubmitting, initialData, onCancel, submitLabel = 'Save Bill' }) => {
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
        // The open editor is index-based too, so leaving it pointed at a
        // shifted row would write the typed name onto the wrong item.
        if (editingItemIdx === index) cancelEditItem();
        else if (editingItemIdx !== null && editingItemIdx > index) setEditingItemIdx(editingItemIdx - 1);
    };

    const updateItem = (index, patch) => {
        setItems(prev => {
            const newItems = structuredClone(prev);
            Object.assign(newItems[index], patch);
            return newItems;
        });
    };

    const handleSplitModeToggle = (index, mode) => {
        const newItems = structuredClone(items);
        newItems[index].splitMode = mode;
        if (mode === 'shares') {
            newItems[index].selectedMembers.forEach(uid => {
                newItems[index].memberShares[uid] = 1;
            });
        } else {
            newItems[index].memberPercents = evenPercents(newItems[index].selectedMembers);
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
            item.memberPercents = evenPercents(allIds);
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
            // Seed the bucket the item's mode actually reads, otherwise a
            // percent-mode item shows a full set of blank inputs.
            if (newItems[index].splitMode === 'shares') {
                allIds.forEach(uid => {
                    newItems[index].memberShares[uid] = 1;
                });
            } else {
                newItems[index].memberPercents = evenPercents(allIds);
            }
            setItems(newItems);
        }
    };

    const startEditItem = (idx) => {
        setEditingItemIdx(idx);
        setEditItemName(items[idx].name || '');
        setEditItemAmount(items[idx].amount || '');
    };

    const saveEditItem = () => {
        if (editingItemIdx === null) return;
        updateItem(editingItemIdx, { name: editItemName, amount: editItemAmount });
        setErrors(prev => {
            const next = { ...prev };
            delete next[`item_${editingItemIdx}_name`];
            delete next[`item_${editingItemIdx}_amount`];
            return next;
        });
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
            else if (item.selectedMembers.length === 0) {
                // A brand new item has nobody assigned, and the split summary is
                // null in that case, so without this the request went out with
                // empty assignments and came back as a 400 from the server.
                newErrors[`item_${idx}_split`] = 'Assign at least one member';
            } else {
                const summary = getItemSummary(item);
                if (summary && !summary.valid) {
                    newErrors[`item_${idx}_split`] = 'Split does not match item amount';
                }
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
            bill_type: 'compound',
            items: items.map(item => ({
                name: item.name,
                amount: String(item.amount),
                split_mode: item.splitMode,
                assignments: computeAssignments(item)
            }))
        };
        onSubmit(payload);
    };

    const itemsTotal = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const overviewTotals = getOverviewTotals(items);
    const total = parseFloat(totalAmount) || 0;
    const itemsMatch = Math.abs(itemsTotal - total) < 0.01;

    /* noValidate: see SimpleBillForm. The browser blocking submit before
       handleSubmit ran turned a step-misaligned split value into a native bubble
       rather than the app's own message. */
    return (
        <form onSubmit={handleSubmit} noValidate>
            {/* Overview / Items / Splits is component state, not a route, so
                it uses the presentational half of the tab bar. */}
            <UnderlineTabs
                tabs={TABS}
                active={activeTab}
                onChange={setActiveTab}
                height="h-13"
                className="border-b border-border mb-5"
            />

            {/* Tab 1: Overview */}
            {activeTab === 'overview' && (
                <div className="space-y-gap">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-card">
                        <Field
                            label="Title"
                            hint="What was this for?"
                            error={errors.title}
                            leading={<Tag size={14} strokeWidth={2} />}
                            type="text"
                            required
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Team dinner"
                        />

                        <Field
                            label="Amount"
                            error={errors.totalAmount}
                            leading={<span className="text-body font-semibold">&#8377;</span>}
                            inset="money"
                            type="number"
                            step="0.01"
                            className="font-money tnum"
                            required
                            value={totalAmount}
                            onChange={(e) => setTotalAmount(e.target.value)}
                            placeholder="0.00"
                        />

                        <Field
                            as={Select}
                            label="Paid by"
                            error={errors.paidBy}
                            required
                            value={paidBy}
                            onChange={(e) => setPaidBy(e.target.value)}
                        >
                            <option value="" disabled>
                                Select member
                            </option>
                            {members?.map((m) => (
                                <option key={m.user.id} value={m.user.id}>
                                    {m.user.name || m.user.email}
                                </option>
                            ))}
                        </Field>
                    </div>

                    {/* Overview Summary */}
                    <Card pad="card" className="bg-surface-2">
                        <div className="flex justify-between text-body">
                            <span className="text-faint font-semibold">Items</span>
                            <span className="font-semibold text-text tnum">{items.length}</span>
                        </div>
                        <div className="flex justify-between text-body">
                            <span className="text-faint font-semibold">Item total</span>
                            <span className={`font-money tnum font-semibold ${itemsMatch ? 'text-pos' : 'text-warn'}`}>
                                ₹{itemsTotal.toFixed(2)}
                            </span>
                        </div>
                        <div className="flex justify-between text-body">
                            <span className="text-faint font-semibold">Bill total</span>
                            <span className="font-money tnum font-semibold text-accent">
                                ₹{total.toFixed(2)}
                            </span>
                        </div>
                        {errors.itemsMismatch && (
                            <p className="text-meta text-neg font-semibold">{errors.itemsMismatch}</p>
                        )}

                        {/* Per-person overview */}
                        {Object.keys(overviewTotals).length > 0 && (
                            <div className="border-t border-border pt-3 mt-3">
                                <p className="text-meta text-faint uppercase tracking-wider mb-2">
                                    Per person totals
                                </p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
                                    {Object.entries(overviewTotals).map(([uid, data]) => {
                                        const member = members?.find(m => m.user.id === uid);
                                        return (
                                            <div key={uid} className="bg-surface rounded-control px-3 py-2 border border-border">
                                                <div className="text-meta text-muted truncate">
                                                    {member?.user.name || member?.user.email.split('@')[0] || 'Unknown'}
                                                </div>
                                                <div className="text-body font-money tnum font-semibold text-accent">
                                                    ₹{data.amount.toFixed(2)}
                                                </div>
                                                <div className="text-meta text-faint">
                                                    {data.itemCount} {data.itemCount === 1 ? 'item' : 'items'}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </Card>
                </div>
            )}

            {/* Tab 2: Items */}
            {activeTab === 'items' && (
                <div className="space-y-2">
                    {items.map((item, idx) => {
                        const isEditing = editingItemIdx === idx;
                        const assigneeCount = item.selectedMembers.length;
                        const itemSummary = getItemSummary(item);
                        return (
                            <div
                                key={idx}
                                className={`rounded-card overflow-hidden transition-colors ${
                                    isEditing ? 'border-2 border-accent/50 bg-accent-soft' : 'border border-border bg-surface hover:border-border-2'
                                }`}
                            >
                                <div className="px-card py-3 flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-meta font-semibold ${
                                            isEditing ? 'bg-accent text-on-accent' : 'bg-surface-3 text-muted'
                                        }`}>
                                            {idx + 1}
                                        </div>
                                        {isEditing ? (
                                            <div className="flex items-center space-x-2">
                                                <Input
                                                    size="sm"
                                                    type="text"
                                                    aria-label="Item name"
                                                    value={editItemName}
                                                    onChange={(e) => setEditItemName(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            saveEditItem();
                                                        }
                                                    }}
                                                    placeholder="Item name"
                                                    autoFocus
                                                />
                                                <div className="relative">
                                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-faint text-xs font-bold">₹</span>
                                                    <Input
                                                        size="sm"
                                                        inset="money"
                                                        type="number"
                                                        step="0.01"
                                                        aria-label="Item amount"
                                                        className="w-28 font-money tnum"
                                                        value={editItemAmount}
                                                        onChange={(e) => setEditItemAmount(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                saveEditItem();
                                                            }
                                                        }}
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <div>
                                                <span className="text-sm font-bold text-text">{item.name || `Item ${idx + 1}`}</span>
                                                <span className="text-xs font-bold text-faint ml-2">₹{(parseFloat(item.amount) || 0).toFixed(2)}</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        {isEditing ? (
                                            <>
                                                <IconButton tone="settle" label="Save item name" onClick={saveEditItem}>
                                                    <Check size={16} strokeWidth={2} aria-hidden="true" />
                                                </IconButton>
                                                <IconButton label="Cancel editing" onClick={cancelEditItem}>
                                                    <X size={16} strokeWidth={2} aria-hidden="true" />
                                                </IconButton>
                                            </>
                                        ) : (
                                            <>
                                                <span className={`text-meta font-semibold px-2 py-0.5 rounded-control ${
                                                    assigneeCount === 0
                                                        ? 'text-neg bg-neg-soft'
                                                        : itemSummary?.valid
                                                            ? 'text-pos bg-pos-soft'
                                                            : 'text-warn bg-warn-soft'
                                                }`}>
                                                    {assigneeCount} assigned
                                                </span>
                                                <IconButton
                                                    label={`Rename ${item.name || `item ${idx + 1}`}`}
                                                    onClick={() => startEditItem(idx)}
                                                >
                                                    <Edit3 size={15} strokeWidth={1.75} aria-hidden="true" />
                                                </IconButton>
                                                {items.length > 1 && (
                                                    <IconButton
                                                        tone="danger"
                                                        label={`Remove ${item.name || `item ${idx + 1}`}`}
                                                        onClick={() => handleRemoveItem(idx)}
                                                    >
                                                        <Trash2 size={15} strokeWidth={1.75} aria-hidden="true" />
                                                    </IconButton>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                                {errors[`item_${idx}_name`] && (
                                    <p className="px-card pb-2 text-meta text-neg font-semibold">{errors[`item_${idx}_name`]}</p>
                                )}
                                {errors[`item_${idx}_amount`] && (
                                    <p className="px-card pb-2 text-meta text-neg font-semibold">{errors[`item_${idx}_amount`]}</p>
                                )}
                                {errors[`item_${idx}_split`] && (
                                    <p className="px-card pb-2 text-meta text-neg font-semibold">{errors[`item_${idx}_split`]}</p>
                                )}
                            </div>
                        );
                    })}
                    <button
                        type="button"
                        onClick={handleAddItem}
                        className="w-full press flex items-center justify-center gap-1 py-3 rounded-card text-body font-semibold bg-accent-soft text-accent border-2 border-dashed border-accent/40 hover:border-accent transition-colors"
                    >
                        <Plus size={16} strokeWidth={2} aria-hidden="true" />
                        Add item
                    </button>
                </div>
            )}

            {/* Tab 3: Splits. The row stacks below md: beside the pane, the
                sidebar took 224px of a 348px phone viewport, leaving the split
                grid about 124px -- and that grid pins a 112px amount input, so
                nothing was left for the member names. */}
            {activeTab === 'splits' && (
                <div className="flex flex-col md:flex-row min-h-[420px] rounded-card border border-border overflow-hidden">
                    <ItemSidebar
                        items={items}
                        selectedIndex={selectedItemIndex}
                        onSelectItem={handleSelectItem}
                        onAddItem={handleAddItem}
                    />

                    <div className="flex-1 p-4 md:p-6">
                        {selectedItemIndex !== null ? (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="text-title font-semibold text-text">
                                            {items[selectedItemIndex].name || `Item ${selectedItemIndex + 1}`}
                                        </h4>
                                        <p className="text-meta font-money tnum font-semibold text-faint">
                                            ₹{(parseFloat(items[selectedItemIndex].amount) || 0).toFixed(2)}
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
                                    <p className="text-meta text-neg font-semibold">{errors[`item_${selectedItemIndex}_split`]}</p>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-center py-12">
                                <div className="w-avatar-lg h-avatar-lg bg-surface-2 rounded-card flex items-center justify-center mb-4">
                                    <Edit3 size={24} strokeWidth={1.75} className="text-faint" aria-hidden="true" />
                                </div>
                                <p className="text-body font-semibold text-faint">
                                    Select an item from the sidebar
                                </p>
                                <p className="text-meta text-faint mt-1">to configure how it is split</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Error Summary */}
            {errors.itemsMismatch && activeTab !== 'overview' && (
                <div className="mt-4 p-3 bg-neg-soft border border-neg/40 rounded-control text-meta text-neg font-semibold">
                    {errors.itemsMismatch}
                </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-6 border-t border-border mt-6">
                {onCancel && (
                    <Button variant="ghost" onClick={onCancel}>
                        Cancel
                    </Button>
                )}
                <Button type="submit" disabled={isSubmitting} className="ml-auto">
                    {isSubmitting ? (
                        <>
                            {/* One spinner definition, not a copy per form. */}
                            <Spinner size="xs" tone="onAccent" label="Saving" />
                            <span>Saving...</span>
                        </>
                    ) : (
                        <>
                            <Save size={16} strokeWidth={2} aria-hidden="true" />
                            <span>{submitLabel}</span>
                        </>
                    )}
                </Button>
            </div>
        </form>
    );
};

export default CompoundBillForm;
