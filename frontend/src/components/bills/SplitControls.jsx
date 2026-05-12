import React from 'react';
import { Percent, Hash } from 'lucide-react';

const SplitControls = ({ splitMode, onToggleMode, onSplitEvenly }) => {
    return (
        <div className="flex items-center justify-between">
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                <button
                    type="button"
                    onClick={() => onToggleMode('shares')}
                    className={`flex items-center space-x-1 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                        splitMode === 'shares'
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-400 hover:text-gray-600'
                    }`}
                >
                    <Hash size={12} />
                    <span>Shares</span>
                </button>
                <button
                    type="button"
                    onClick={() => onToggleMode('percent')}
                    className={`flex items-center space-x-1 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                        splitMode === 'percent'
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-400 hover:text-gray-600'
                    }`}
                >
                    <Percent size={12} />
                    <span>Percent</span>
                </button>
            </div>
            <button
                type="button"
                onClick={onSplitEvenly}
                className="text-xs font-bold text-blue-500 hover:text-blue-700 bg-blue-50 px-4 py-2 rounded-lg transition-colors"
            >
                Split Evenly
            </button>
        </div>
    );
};

export default SplitControls;
