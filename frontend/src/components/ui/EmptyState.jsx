/**
 * The "nothing here yet" panel.
 *
 * Four bespoke versions existed (no groups, no bills, all settled, no
 * settlements). `action` takes an already-styled element, normally a Button.
 */

const DISC = {
  accent: 'bg-accent-soft text-accent',
  pos: 'bg-pos-soft text-pos',
  neg: 'bg-neg-soft text-neg',
  warn: 'bg-warn-soft text-warn',
};

const EmptyState = ({ icon, title, tone = 'accent', children, action, className = '' }) => (
  <div
    className={[
      'flex flex-col items-center justify-center gap-3 px-card py-12 text-center',
      className,
    ]
      .filter(Boolean)
      .join(' ')}
  >
    {icon ? (
      <span
        className={[
          'w-12 h-12 rounded-full flex items-center justify-center',
          DISC[tone] ?? DISC.accent,
        ].join(' ')}
      >
        {icon}
      </span>
    ) : null}
    <h3 className="text-title font-semibold text-text">{title}</h3>
    {children ? <p className="text-meta text-faint max-w-sm leading-relaxed">{children}</p> : null}
    {action}
  </div>
);

export default EmptyState;

/**
 * Inline caution strip, for something worth flagging but not worth a screen.
 * Distinct from EmptyState: it sits inside a card, left-aligned, one line.
 */
export const Note = ({ children, tone = 'warn', className = '' }) => {
  const dot = tone === 'neg' ? 'bg-neg' : tone === 'pos' ? 'bg-pos' : 'bg-warn';
  return (
    <div
      className={[
        'flex items-start gap-3 px-4 py-3 rounded-control border border-border bg-surface-2/60',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span className={['w-1.5 h-1.5 rounded-full mt-2 shrink-0', dot].join(' ')} />
      <span className="text-meta text-muted leading-relaxed">{children}</span>
    </div>
  );
};
