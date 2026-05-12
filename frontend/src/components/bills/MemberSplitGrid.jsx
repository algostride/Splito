import React from 'react';

const MemberSplitGrid = ({
    members,
    item,
    computations,
    onToggleMember,
    onShareChange,
    onPercentChange
}) => {
    return (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="p-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                    {members?.map(membership => {
                        const uid = membership.user.id;
                        const isSelected = item.selectedMembers.includes(uid);
                        const userInitial = (membership.user.name || membership.user.email)[0].toUpperCase();
                        const computed = computations.find(a => a.user_id === uid);
                        return (
                            <div
                                key={uid}
                                onClick={() => onToggleMember(uid)}
                                className={`rounded-xl p-3 text-center cursor-pointer transition-all ${
                                    isSelected
                                        ? 'bg-blue-600 text-white space-y-1.5'
                                        : 'bg-gray-100 text-gray-400 space-y-1.5 hover:bg-blue-50 hover:text-blue-400'
                                }`}
                            >
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mx-auto ${
                                    isSelected ? 'bg-blue-500' : 'bg-gray-200'
                                }`}>
                                    {userInitial}
                                </div>
                                <div className="text-[10px] font-bold truncate">
                                    {membership.user.name || membership.user.email.split('@')[0]}
                                </div>
                                <input
                                    type="number"
                                    step={item.splitMode === 'shares' ? '1' : '0.01'}
                                    min={item.splitMode === 'percent' ? '0' : '1'}
                                    placeholder={item.splitMode === 'shares' ? '1' : '0'}
                                    value={item.splitMode === 'shares'
                                        ? (item.memberShares[uid] || '')
                                        : (item.memberPercents[uid] || '')
                                    }
                                    disabled={!isSelected}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => {
                                        e.stopPropagation();
                                        item.splitMode === 'shares'
                                            ? onShareChange(uid, e.target.value)
                                            : onPercentChange(uid, e.target.value);
                                    }}
                                    className={`w-full border rounded-lg px-2 py-1 text-xs font-black text-center outline-none ${
                                        isSelected
                                            ? 'bg-blue-700 border-blue-800 text-white placeholder:text-blue-400'
                                            : 'bg-gray-200 border-gray-300 text-gray-400 placeholder:text-gray-400 cursor-not-allowed'
                                    }`}
                                />
                                <div className={`text-[10px] font-black ${
                                    isSelected ? 'text-blue-200' : 'text-transparent'
                                }`}>
                                    {computed ? `= ₹${computed.amount}` : '\u00A0'}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default MemberSplitGrid;
