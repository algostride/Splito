import React from 'react';
import { Plus } from 'lucide-react';

const ItemSidebar = ({ items, selectedIndex, onSelectItem, onAddItem }) => {
    return (
        <div className="w-56 flex-shrink-0 bg-gray-50 border-r border-gray-100 p-4 space-y-2 overflow-y-auto">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">
                Items
            </p>
            {items.map((item, idx) => {
                const isSelected = selectedIndex === idx;
                const assigneeCount = item.selectedMembers.length;
                return (
                    <div
                        key={idx}
                        onClick={() => onSelectItem(idx)}
                        className={`rounded-xl px-4 py-3 cursor-pointer transition-all ${
                            isSelected
                                ? 'bg-white border-2 border-blue-400 shadow-sm'
                                : 'bg-white border border-gray-200 hover:border-gray-300'
                        }`}
                    >
                        <div className="flex items-center justify-between">
                            <span className={`text-sm font-bold ${isSelected ? 'text-gray-900' : 'text-gray-700'}`}>
                                {item.name || `Item ${idx + 1}`}
                            </span>
                            <span className={`text-xs font-bold ${isSelected ? 'text-blue-600' : 'text-gray-400'}`}>
                                ₹{parseFloat(item.amount) || 0}
                            </span>
                        </div>
                        <div className="text-[10px] text-gray-400 mt-1 font-bold">
                            {assigneeCount} assigned
                        </div>
                    </div>
                );
            })}
            <button
                type="button"
                onClick={onAddItem}
                className="w-full bg-blue-50 text-blue-600 py-2.5 rounded-xl font-bold text-xs border-2 border-dashed border-blue-200 hover:bg-blue-100 transition-colors flex items-center justify-center space-x-1"
            >
                <Plus size={14} />
                <span>Add Item</span>
            </button>
        </div>
    );
};

export default ItemSidebar;
