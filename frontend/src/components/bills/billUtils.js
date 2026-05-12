export const createEmptyItem = () => ({
    name: '',
    amount: '',
    splitMode: 'shares',
    selectedMembers: [],
    memberShares: {},
    memberPercents: {},
});

export const computeAssignments = (item) => {
    const amount = parseFloat(item.amount) || 0;
    if (!item.selectedMembers.length || amount <= 0) return [];

    if (item.splitMode === 'shares') {
        const totalShares = item.selectedMembers.reduce(
            (sum, uid) => sum + (parseInt(item.memberShares[uid]) || 0), 0
        );
        if (totalShares <= 0) return [];
        return item.selectedMembers
            .filter(uid => parseInt(item.memberShares[uid]) > 0)
            .map(uid => ({
                user_id: uid,
                share_amount: String(((parseInt(item.memberShares[uid]) || 0) * amount / totalShares).toFixed(2))
            }));
    } else {
        return item.selectedMembers
            .filter(uid => parseFloat(item.memberPercents[uid]) > 0)
            .map(uid => ({
                user_id: uid,
                share_amount: String(((parseFloat(item.memberPercents[uid]) || 0) * amount / 100).toFixed(2))
            }));
    }
};

export const getItemSummary = (item) => {
    const amount = parseFloat(item.amount) || 0;
    if (!item.selectedMembers.length || amount <= 0) return null;

    if (item.splitMode === 'shares') {
        const totalShares = item.selectedMembers.reduce(
            (sum, uid) => sum + (parseInt(item.memberShares[uid]) || 0), 0
        );
        if (totalShares <= 0) return null;
        return {
            perPerson: item.selectedMembers
                .filter(uid => parseInt(item.memberShares[uid]) > 0)
                .map(uid => {
                    const shares = parseInt(item.memberShares[uid]) || 0;
                    return { userId: uid, amount: (shares * amount / totalShares).toFixed(2) };
                }),
            totalShares,
            valid: totalShares > 0
        };
    } else {
        const tp = item.selectedMembers.reduce(
            (sum, uid) => sum + (parseFloat(item.memberPercents[uid]) || 0), 0
        );
        return {
            perPerson: item.selectedMembers
                .filter(uid => parseFloat(item.memberPercents[uid]) > 0)
                .map(uid => {
                    const pct = parseFloat(item.memberPercents[uid]) || 0;
                    return { userId: uid, amount: (pct * amount / 100).toFixed(2) };
                }),
            totalPercent: tp,
            valid: Math.abs(tp - 100) < 0.01
        };
    }
};

export const getOverviewTotals = (items) => {
    const totals = {};
    items.forEach(item => {
        const assignments = computeAssignments(item);
        assignments.forEach(a => {
            if (!totals[a.user_id]) totals[a.user_id] = { amount: 0, itemCount: 0 };
            totals[a.user_id].amount += parseFloat(a.share_amount);
            totals[a.user_id].itemCount += 1;
        });
    });
    return totals;
};

export const validateBill = ({ title, totalAmount, paidBy, items }) => {
    const errors = {};

    if (!title?.trim()) errors.title = 'Title is required';
    if (!totalAmount || parseFloat(totalAmount) <= 0) errors.totalAmount = 'Amount must be greater than 0';
    if (!paidBy) errors.paidBy = 'Select who paid';

    const itemsTotal = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const total = parseFloat(totalAmount) || 0;

    if (items.length > 1 && Math.abs(itemsTotal - total) > 0.01) {
        errors.itemsMismatch = `Item amounts (₹${itemsTotal.toFixed(2)}) don't match total (₹${total.toFixed(2)})`;
    }

    items.forEach((item, idx) => {
        if (items.length > 1) {
            if (!item.name?.trim()) errors[`item_${idx}_name`] = 'Name required';
            if (!item.amount || parseFloat(item.amount) <= 0) errors[`item_${idx}_amount`] = 'Amount required';
        }
        const summary = getItemSummary(item);
        if (summary && !summary.valid) {
            errors[`item_${idx}_split`] = 'Split does not match item amount';
        }
    });

    return { valid: Object.keys(errors).length === 0, errors };
};
