/**
 * How much precision each split mode carries.
 *
 * `shares` counts things, so one decimal is enough to express "half a loaf".
 * It used to be integers with a floor of 1, which made a real and intuitive
 * split impossible: 5 loaves shared as 4.5 and 0.5 is how a person actually
 * thinks about it, whereas 9 and 1 makes them do the rescaling in their head.
 * The weights are relative -- the server divides by their sum -- so 4.5 : 0.5 and
 * 9 : 1 are the same 90/10 split, but only one of them is natural to type.
 *
 * `percent` is money-adjacent, so two decimals, which is also what the input's
 * step has always offered.
 */
export const DP = { shares: 1, percent: 2 };
export const STEP = { shares: 0.1, percent: 0.01 };
export const MIN = { shares: 0.1, percent: 0 };

/**
 * A split value as the user should see it.
 *
 * The API sends `split_value` at its column's storage scale, which is six
 * decimal places, so a share of 1 arrives as "1.000000" and a backfilled
 * percentage arrives as "14.516129". Neither belongs in a text field: one is
 * pure padding, the other is more precision than anyone splitting a bill wants.
 *
 * Rounds to the mode's precision and then strips trailing zeros, so a genuine
 * value survives (0.333333 is never silently mangled) while padding does not
 * (1.000000 becomes 1, 20.000000 becomes 20). Rounding percent to 2dp means a
 * re-save writes 14.52 rather than the stored 14.516129; that is the same value
 * a user typing 14.52 would produce, and the resulting money drift is well under
 * a rupee on any realistic bill.
 */
export const trimSplitValue = (raw, splitMode) => {
    // Checked before Number(), because Number(null) and Number('') are both 0 --
    // which would turn a missing value into a real-looking 0, and a 0 share is
    // dropped as "not in the split" by computeAssignments. A missing value has
    // to stay missing.
    if (raw === null || raw === undefined || raw === '') return '';
    const n = Number(raw);
    // A value that will not parse falls back to the original rather than
    // rendering "NaN" into an input the user then has to clear.
    if (!Number.isFinite(n)) return String(raw);
    return String(Number(n.toFixed(DP[splitMode])));
};

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
        /* parseFloat, not parseInt.

           This truncated 4.5 to 4 and 0.5 to 0, and the `> 0` filter then
           dropped the 0.5 member entirely, so a half-loaf split silently gave
           the other member the whole bill. The server has always accepted
           fractional weights -- it only rejects negatives -- so this was the
           frontend refusing to represent them, and it is why shares looked like
           they worked at all: integers survive parseInt, so only the integer
           case was ever exercised.

           Rounded to the mode's precision so a stray extra decimal in the
           input cannot leak into the money. */
        return {
            entries: item.selectedMembers
                .map(uid => ({
                    uid,
                    value: Number((parseFloat(item.memberShares[uid]) || 0).toFixed(DP.shares)),
                }))
                .filter(e => e.value > 0),
            basis: null,
        };
    }
    return {
        entries: item.selectedMembers
            .map(uid => ({
                uid,
                value: Number((parseFloat(item.memberPercents[uid]) || 0).toFixed(DP.percent)),
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
            // trimSplitValue, not String(): the API sends split_value at the
            // column's six-decimal storage scale, so a share of 1 came back as
            // "1.000000" and filled the input with it.
            const value = trimSplitValue(a.split_value, splitMode);
            if (splitMode === 'shares') memberShares[uid] = value;
            else memberPercents[uid] = value;
        } else {
            // Routed through the same helper so there is one place that decides
            // what a split value looks like. It already rounded and stripped
            // here; the helper does it for both branches now.
            const pct = amount > 0 ? (parseFloat(a.share_amount) / amount) * 100 : 0;
            memberPercents[uid] = trimSplitValue(pct.toFixed(4), 'percent');
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

