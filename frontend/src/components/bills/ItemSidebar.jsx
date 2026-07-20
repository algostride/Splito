import { Plus } from 'lucide-react';

const ItemSidebar = ({ items, selectedIndex, onSelectItem, onAddItem }) => {
  // Full width above the split pane on a phone rather than 224px beside it: at
  // 412px that left the split grid ~124px, and it pins a 112px amount input.
  // The divider moves with it, and the scroll area is capped so a long item list
  // cannot push the split editor off the screen.
  return (
    <div className="w-full md:w-56 flex-shrink-0 bg-canvas border-b md:border-b-0 md:border-r border-border p-3 space-y-2 overflow-y-auto max-h-44 md:max-h-none">
      <p className="text-meta text-faint uppercase tracking-wider mb-2">Items</p>
      {items.map((item, idx) => {
        const isSelected = selectedIndex === idx;
        return (
          <button
            key={idx}
            type="button"
            onClick={() => onSelectItem(idx)}
            aria-pressed={isSelected}
            className={[
              'w-full text-left press rounded-card px-4 py-3 transition-colors',
              isSelected
                ? 'bg-surface border-2 border-accent/50'
                : 'bg-surface border border-border hover:border-border-2',
            ].join(' ')}
          >
            <span className="flex items-center justify-between gap-2">
              <span
                className={[
                  'text-body font-semibold truncate',
                  isSelected ? 'text-text' : 'text-muted',
                ].join(' ')}
              >
                {item.name || `Item ${idx + 1}`}
              </span>
              <span
                className={[
                  'font-money tnum text-meta font-semibold shrink-0',
                  isSelected ? 'text-accent' : 'text-faint',
                ].join(' ')}
              >
                ₹{(parseFloat(item.amount) || 0).toFixed(2)}
              </span>
            </span>
            <span className="block text-meta text-faint mt-1">
              {item.selectedMembers.length} assigned
            </span>
          </button>
        );
      })}
      {/* A dashed outline reads as "create another", which a filled button
          would not, so this one stays a dashed target rather than a Button. */}
      <button
        type="button"
        onClick={onAddItem}
        className="w-full press flex items-center justify-center gap-1 py-2.5 rounded-card text-meta font-semibold bg-accent-soft text-accent border-2 border-dashed border-accent/40 hover:border-accent transition-colors"
      >
        <Plus size={14} strokeWidth={2} aria-hidden="true" />
        <span>Add item</span>
      </button>
    </div>
  );
};

export default ItemSidebar;
