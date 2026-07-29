import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Save, Tag } from 'lucide-react';
import { createEmptyItem, computeAssignments, getItemSummary, hydrateItem, evenPercents } from './billUtils';
import SplitControls from './SplitControls';
import MemberSplitGrid from './MemberSplitGrid';
import ValidationBadge from './ValidationBadge';
import Spinner from '../ui/Spinner';
import Button from '../ui/Button';
import Input, { Field, Select } from '../ui/Input';

const buildInitialState = (initialData, members) => {
    if (initialData) {
        const existingItem = initialData.items?.[0];
        return {
            title: initialData.title || '',
            totalAmount: initialData.total_amount || '',
            paidBy: initialData.paid_by || '',
            item: existingItem ? hydrateItem(existingItem) : createEmptyItem(),
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

const SimpleBillForm = ({ members, onSubmit, isSubmitting, initialData, onCancel, submitLabel = 'Save Bill' }) => {
    const currentUser = useSelector((state) => state.auth.user);
    const initialState = buildInitialState(initialData, members);

    const [title, setTitle] = useState(initialState.title);
    const [totalAmount, setTotalAmount] = useState(initialState.totalAmount);
    const [paidBy, setPaidBy] = useState(initialState.paidBy);
    const [item, setItem] = useState(initialState.item);
    const [errors, setErrors] = useState({});

    const handleAmountChange = (value) => {
        setTotalAmount(value);
        setItem(prev => ({ ...prev, amount: value }));
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
                updated.memberPercents = evenPercents(prev.selectedMembers);
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
                updated.memberPercents = evenPercents(allIds);
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
            bill_type: 'simple',
            items: [{
                name: title,
                amount: String(item.amount),
                split_mode: item.splitMode,
                assignments: computeAssignments(item)
            }]
        };
        onSubmit(payload);
    };

    const computations = computeAssignments(item);
    const summary = getItemSummary(item);

    /* noValidate: the browser and the app both validate, and the browser wins by
       blocking submit before handleSubmit ever runs. The split fields carry
       min/step for the stepper's benefit, not as a correctness gate, so a
       step-misaligned value used to surface as a native bubble in the visitor's
       locale instead of the app's own message. handleSubmit does the real
       checking. */
    return (
        <form onSubmit={handleSubmit} noValidate className="space-y-card">
            {/* Bill Details */}
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
                    placeholder="Sushi dinner"
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
                    onChange={(e) => handleAmountChange(e.target.value)}
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
            {errors.split && <p className="text-xs text-neg font-bold">{errors.split}</p>}

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-border">
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

export default SimpleBillForm;
