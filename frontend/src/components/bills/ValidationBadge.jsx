import { Check, AlertTriangle } from 'lucide-react';

const ValidationBadge = ({ summary, amount }) => {
  if (!summary) return null;

  const totalAmount = (parseFloat(amount) || 0).toFixed(2);
  // Use the allocated total rather than re-summing the per-member figures,
  // which are already rounded and drifted by paise.
  const computedTotal = (summary.allocatedTotal ?? 0).toFixed(2);

  return (
    <div
      className={[
        'flex items-center gap-2 text-meta font-semibold',
        summary.valid ? 'text-pos' : 'text-warn',
      ].join(' ')}
    >
      {summary.valid ? (
        <Check size={14} strokeWidth={2} aria-hidden="true" />
      ) : (
        <AlertTriangle size={14} strokeWidth={2} aria-hidden="true" />
      )}
      {summary.totalShares !== undefined ? (
        <span>
          Total: {summary.totalShares} shares —{' '}
          <span className="font-money tnum">₹{computedTotal}</span> of{' '}
          <span className="font-money tnum">₹{totalAmount}</span>
        </span>
      ) : (
        <span>
          Total: {Number(summary.totalPercent).toFixed(2)}% —{' '}
          <span className="font-money tnum">₹{computedTotal}</span> of{' '}
          <span className="font-money tnum">₹{totalAmount}</span>
        </span>
      )}
    </div>
  );
};

export default ValidationBadge;
