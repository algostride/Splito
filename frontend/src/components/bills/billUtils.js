export const createEmptyItem = () => ({
    name: '',
    amount: '',
    splitMode: 'shares',
    selectedMembers: [],
    memberShares: {},
    memberPercents: {},
});

/**
 * Split `amount` across `weights` in whole paise so the result sums exactly.
 *
 * Rounding each member independently loses or gains a paisa: 10.00 split three
 * ways became 3.33 x 3 = 9.99, which the server then rejected even though the
 * form called the split valid. Flooring and handing the leftover paise to the
 * largest fractional remainders keeps the money conserved.
 *
 * `basis` is the denominator the weights are measured against: the sum of the
 * weights in shares mode (so 3/2/1 is relative), or 100 in percent mode (so
 * 60/30 means 60% and 30% of the item and is left short rather than quietly
 * rescaled to 66.7/33.3).
 *
 * Mirrors BillSerializer._allocate on the server, so the numbers this form
 * shows are the numbers that get stored.
 */
export const allocate = (amount, weights, basis) => {
    if (!(amount > 0) || !weights.length) return weights.map(() => 0);
    const total = basis ?? weights.reduce((s, w) => s + w, 0);
    if (!(total > 0)) return weights.map(() => 0);

    const amountPaise = Math.round(amount * 100);
    const exact = weights.map(w => (w * amountPaise) / total);
    const base = exact.map(v => Math.floor(v));

    const leftover = amountPaise - base.reduce((s, v) => s + v, 0);
    // Only a genuine rounding residual (fewer paise than there are members)
    // is handed out. A larger shortfall means the weights do not cover the
    // item, and topping it up would silently rescale a 60/30 split into
    // 65/35 instead of letting the split report as invalid.
    if (leftover > 0 && leftover < weights.length) {
        const order = exact
            .map((v, i) => ({ i, frac: v - Math.floor(v) }))
            .sort((a, b) => b.frac - a.frac)
            .map(o => o.i);
        for (let k = 0; k < leftover; k++) {
            base[order[k]] += 1;
        }
    }

    return base.map(p => p / 100);
};

/**
 * Even percentages that sum to exactly 100.00.
 *
 * 100/3 rounded to 2dp is 33.33 each, totalling 99.99, so a split the user
 * explicitly asked to be even reported itself as invalid. The residual goes
 * to the last member so the displayed percentages add up.
 */
export const evenPercents = (uids) => {
    if (!uids.length) return {};
    const base = Math.floor((10000 / uids.length)) / 100;
    const assigned = Number((base * (uids.length - 1)).toFixed(2));
    const last = Number((100 - assigned).toFixed(2));

    const result = {};
    uids.forEach((uid, i) => { result[uid] = i === uids.length - 1 ? last : base; });
    return result;
};

const splitWeights = (item) => {
    if (item.splitMode === 'shares') {
        return {
            entries: item.selectedMembers
                .map(uid => ({ uid, value: parseInt(item.memberShares[uid], 10) || 0 }))
                .filter(e => e.value > 0),
            basis: null,
        };
    }
    return {
        entries: item.selectedMembers
            .map(uid => ({
                uid,
                value: Math.round((parseFloat(item.memberPercents[uid]) || 0) * 100) / 100,
            }))
            .filter(e => e.value > 0),
        basis: 100,
    };
};

export const computeAssignments = (item) => {
    const amount = parseFloat(item.amount) || 0;
    if (!item.selectedMembers.length || amount <= 0) return [];

    const { entries, basis } = splitWeights(item);
    if (!entries.length) return [];

    const allocated = allocate(amount, entries.map(e => e.value), basis);

    return entries.map((e, i) => ({
        user_id: e.uid,
        share_amount: allocated[i].toFixed(2),
        split_value: String(e.value),
    }));
};

export const hydrateItem = (apiItem) => {
    const assignments = apiItem.assignments || [];
    const amount = parseFloat(apiItem.amount) || 0;

    const hasStoredValues = assignments.length > 0 && assignments.every(
        a => a.split_value !== null && a.split_value !== undefined && a.split_value !== ''
    );
    // A row saved before split_value existed can only be described in percent,
    // so derive one from the money split instead of guessing share counts.
    const splitMode = hasStoredValues ? (apiItem.split_mode || 'shares') : 'percent';

    const memberShares = {};
    const memberPercents = {};
    assignments.forEach(a => {
        const uid = a.user_id;
        if (hasStoredValues) {
            if (splitMode === 'shares') memberShares[uid] = String(a.split_value);
            else memberPercents[uid] = String(a.split_value);
        } else {
            const pct = amount > 0 ? (parseFloat(a.share_amount) / amount) * 100 : 0;
            memberPercents[uid] = String(Number(pct.toFixed(2)));
        }
    });

    return {
        name: apiItem.name || '',
        amount: apiItem.amount ?? '',
        splitMode,
        selectedMembers: assignments.map(a => a.user_id),
        memberShares,
        memberPercents,
    };
};

export const getItemSummary = (item) => {
    const amount = parseFloat(item.amount) || 0;
    if (!item.selectedMembers.length || amount <= 0) return null;

    const { entries, basis } = splitWeights(item);
    if (!entries.length) {
        return item.splitMode === 'shares'
            ? { perPerson: [], totalShares: 0, valid: false, allocatedTotal: 0 }
            : { perPerson: [], totalPercent: 0, valid: false, allocatedTotal: 0 };
    }

    const allocated = allocate(amount, entries.map(e => e.value), basis);
    const perPerson = entries.map((e, i) => ({ userId: e.uid, amount: allocated[i].toFixed(2) }));
    // The server checks the money, not the percentages, so validity is money
    // conservation. A 33.33 x 3 percent split is short a rupee, but the
    // allocation completes it and the split is genuinely saveable.
    const allocatedTotal = allocated.reduce((s, v) => s + v, 0);

    if (item.splitMode === 'shares') {
        const totalShares = entries.reduce((sum, e) => sum + e.value, 0);
        return { perPerson, totalShares, allocatedTotal, valid: Math.abs(allocatedTotal - amount) < 0.005 };
    }

    const totalPercent = entries.reduce((sum, e) => sum + e.value, 0);
    return { perPerson, totalPercent, allocatedTotal, valid: Math.abs(allocatedTotal - amount) < 0.005 };
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

