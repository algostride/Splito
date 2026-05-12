import React from 'react';
import { Check } from 'lucide-react';

const ValidationBadge = ({ summary, amount }) => {
    if (!summary) return null;

    const totalAmount = parseFloat(amount) || 0;
    const computedTotal = summary.perPerson.reduce((s, p) => s + parseFloat(p.amount), 0).toFixed(2);

    return (
        <div className={`mt-3 flex items-center space-x-2 text-xs font-bold ${
            summary.valid ? 'text-green-600' : 'text-amber-600'
        }`}>
            <Check size={14} />
            {summary.totalShares !== undefined ? (
                <span>Total: {summary.totalShares} shares — ₹{computedTotal} of ₹{totalAmount}</span>
            ) : (
                <span>Total: {summary.totalPercent.toFixed(1)}% — ₹{computedTotal} of ₹{totalAmount}</span>
            )}
        </div>
    );
};

export default ValidationBadge;
