import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
    useGetGroupDetailQuery,
    useGetGroupMembersQuery,
    useInviteMemberMutation
} from '../store/groupsApi';
import { useGetBillsQuery, useDeleteBillMutation } from '../store/billsApi';
import {
    useGetUserDebtsQuery,
    useGetSettlementsQuery,
    useCreateSettlementMutation,
    useDeleteSettlementMutation
} from '../store/settlementsApi';
import {
    ArrowLeft,
    Calendar,
    Plus,
    UserPlus,
    Receipt,
    Wallet,
    CheckCircle2,
    XCircle,
    Copy,
    User as UserIcon,
    ChevronRight,
    Users,
    Trash2,
    History,
    ArrowRight,
    ChevronDown,
    MoreVertical,
    Pencil,
    Layers,
    X
} from 'lucide-react';

const GroupDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { data: group, isLoading: isGroupLoading } = useGetGroupDetailQuery(id);
    const { data: members, isLoading: isMembersLoading } = useGetGroupMembersQuery(id);
    const { data: bills, isLoading: isBillsLoading } = useGetBillsQuery(id);
    const { data: userDebts, isLoading: isUserDebtsLoading } = useGetUserDebtsQuery(id);
    const { data: settlements, isLoading: isSettlementsLoading } = useGetSettlementsQuery(id);

    const [inviteMember, { isLoading: isInviting }] = useInviteMemberMutation();
    const [createSettlement, { isLoading: isSettling }] = useCreateSettlementMutation();
    const [deleteBill, { isLoading: isDeletingBill }] = useDeleteBillMutation();
    const [deleteSettlement] = useDeleteSettlementMutation();

    const [email, setEmail] = useState('');
    const [inviteToken, setInviteToken] = useState(null);

    const [showSettleModal, setShowSettleModal] = useState(false);
    const [settlePayer, setSettlePayer] = useState('');
    const [settlePayee, setSettlePayee] = useState('');
    const [settleAmount, setSettleAmount] = useState('');

    const [deleteBillConfirm, setDeleteBillConfirm] = useState(null);
    const [deleteSettlementConfirm, setDeleteSettlementConfirm] = useState(null);
    const [activeBillMenu, setActiveBillMenu] = useState(null);
    const billMenuRef = useRef(null);

    const [activeTab, setActiveTab] = useState('bills');
    const [selectedUser, setSelectedUser] = useState(null);
    const [showBillTypeModal, setShowBillTypeModal] = useState(false);

    const handleInvite = async (e) => {
        e.preventDefault();
        try {
            if (!email.trim()) return;
            const res = await inviteMember({ id, email }).unwrap();
            setInviteToken(res.token);
            setEmail('');
        } catch (err) {
            console.error('Failed to invite member', err);
        }
    };

    const handleSettle = async (e) => {
        e.preventDefault();
        try {
            await createSettlement({
                group: id,
                payer: settlePayer,
                payee: settlePayee,
                amount: String(settleAmount)
            }).unwrap();
            setShowSettleModal(false);
            setSettlePayer('');
            setSettlePayee('');
            setSettleAmount('');
        } catch (err) {
            console.error('Failed to create settlement', err);
            alert('Settlement failed. Check details.');
        }
    };

    const handleDeleteBill = async (billId) => {
        try {
            await deleteBill(billId).unwrap();
            setDeleteBillConfirm(null);
        } catch (err) {
            console.error('Failed to delete bill', err);
            alert('Failed to delete bill.');
        }
    };

    const handleDeleteSettlement = async (settlementId) => {
        try {
            await deleteSettlement(settlementId).unwrap();
            setDeleteSettlementConfirm(null);
        } catch (err) {
            console.error('Failed to delete settlement', err);
            alert('Failed to delete settlement.');
        }
    };

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (billMenuRef.current && !billMenuRef.current.contains(e.target)) {
                setActiveBillMenu(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const getMemberName = (userId) => {
        const member = members?.find(m => m.user.id === userId);
        return member?.user?.name || member?.user?.email || 'Unknown';
    };

    if (isGroupLoading || isMembersLoading || isBillsLoading || isUserDebtsLoading || isSettlementsLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-gray-500 font-medium">Crunching the numbers...</p>
            </div>
        );
    }

    if (!group) return <div className="p-8 max-w-4xl mx-auto text-red-500 text-center font-bold">Group not found.</div>;

    const inviteLink = inviteToken ? `${window.location.origin}/accept-invite/${inviteToken}` : '';

    return (
        <div className="max-w-5xl mx-auto py-8 px-4 animate-fade-in-up">
            <Link to="/" className="flex items-center text-blue-600 hover:text-blue-800 mb-6 transition-colors font-semibold group">
                <ArrowLeft size={20} className="mr-2 group-hover:-translate-x-1 transition-transform" />
                Back to Dashboard
            </Link>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 mb-8 flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
                <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg">
                        <Users size={32} />
                    </div>
                    <div>
                        <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">{group.name}</h2>
                        <div className="flex items-center text-sm text-gray-400 mt-1">
                            <Calendar size={14} className="mr-1" />
                            Created on {new Date(group.created_at).toLocaleDateString()}
                        </div>
                    </div>
                </div>
            </div>

            {/* Tab Bar */}
            <div className="flex space-x-1 bg-gray-100 rounded-xl p-1 mb-8 max-w-sm">
                <button
                    onClick={() => { setActiveTab('bills'); setSelectedUser(null); }}
                    className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-bold transition-all ${activeTab === 'bills' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Bills
                </button>
                <button
                    onClick={() => { setActiveTab('settlements'); setSelectedUser(null); }}
                    className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-bold transition-all ${activeTab === 'settlements' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Settlements
                </button>
                <button
                    onClick={() => setActiveTab('members')}
                    className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-bold transition-all ${activeTab === 'members' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Members
                </button>
            </div>

            <div className="space-y-8">
                {/* Bills Tab */}
                {activeTab === 'bills' && (
                        <>
                            {/* Bills Section */}
                            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 relative">
                                <div className="flex justify-between items-center mb-8">
                                    <div className="flex items-center space-x-2">
                                        <Receipt className="text-blue-600" size={24} />
                                        <h3 className="text-xl font-extrabold text-gray-800">Recent Bills</h3>
                                    </div>
                                    <button onClick={() => setShowBillTypeModal(true)} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg hover:bg-blue-700 hover:shadow-xl transition-all flex items-center space-x-2">
                                        <Plus size={18} />
                                        <span>Add Bill</span>
                                    </button>
                                </div>

                                {bills?.length === 0 ? (
                                    <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                        <Receipt size={40} className="mx-auto text-gray-300 mb-4" />
                                        <p className="text-gray-500 font-medium italic">No bills yet. Time to split dinner?</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {bills?.map(bill => (
                                            <div key={bill.id} className="relative flex items-center justify-between p-5 border border-gray-50 rounded-xl hover:bg-blue-50 transition-all bg-gray-50/50">
                                                <Link to={`/groups/${id}/bills/${bill.id}`} className="flex items-center space-x-4 flex-1 min-w-0 cursor-pointer">
                                                    <div className="w-10 h-10 bg-white shadow-sm border border-gray-100 rounded-lg flex items-center justify-center text-blue-600 flex-shrink-0">
                                                        <Receipt size={20} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <h4 className="font-bold text-gray-900">{bill.title}</h4>
                                                        <p className="text-xs text-gray-400 flex items-center mt-0.5">
                                                            Paid by {bill.paid_by_detail?.name || bill.paid_by_detail?.email?.split('@')[0] || bill.created_by?.name || bill.created_by?.email?.split('@')[0] || 'Unknown'}
                                                            <ChevronRight size={12} className="mx-1" />
                                                            {new Date(bill.created_at).toLocaleDateString()}
                                                        </p>
                                                    </div>
                                                </Link>
                                                <div className="flex items-center space-x-3 flex-shrink-0 ml-4">
                                                    <p className="font-extrabold text-lg text-gray-900">{Number(bill.total_amount).toFixed(2)} <span className="text-xs text-gray-400 ml-0.5 font-bold uppercase">{bill.currency}</span></p>
                                                    <div className="relative" ref={activeBillMenu === bill.id ? billMenuRef : undefined}>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setActiveBillMenu(activeBillMenu === bill.id ? null : bill.id);
                                                            }}
                                                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                                                        >
                                                            <MoreVertical size={16} />
                                                        </button>
                                                        {activeBillMenu === bill.id && (
                                                            <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-gray-100 rounded-xl shadow-xl z-20 py-1 animate-fade-in-up">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setActiveBillMenu(null);
                                                                        navigate(`/groups/${id}/bills/${bill.id}`);
                                                                    }}
                                                                    className="w-full flex items-center space-x-2 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                                                                >
                                                                    <Pencil size={14} />
                                                                    <span>Edit</span>
                                                                </button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setActiveBillMenu(null);
                                                                        setDeleteBillConfirm(bill.id);
                                                                    }}
                                                                    className="w-full flex items-center space-x-2 px-4 py-2.5 text-sm font-bold text-red-500 hover:bg-red-50 transition-colors"
                                                                >
                                                                    <Trash2 size={14} />
                                                                    <span>Delete</span>
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {deleteBillConfirm === bill.id && (
                                                    <div className="absolute inset-0 bg-white border border-red-200 rounded-xl p-4 flex items-center justify-between z-10 shadow-lg">
                                                        <p className="text-sm font-bold text-red-600">Delete this bill?</p>
                                                        <div className="flex items-center space-x-2">
                                                            <button
                                                                onClick={() => handleDeleteBill(bill.id)}
                                                                disabled={isDeletingBill}
                                                                className="bg-red-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-600 transition-all disabled:opacity-50"
                                                            >
                                                                {isDeletingBill ? '...' : 'Yes'}
                                                            </button>
                                                            <button
                                                                onClick={() => setDeleteBillConfirm(null)}
                                                                className="text-gray-400 px-3 py-1.5 rounded-lg text-xs font-bold hover:text-gray-600 transition-all"
                                                            >
                                                                No
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* Settlements Tab */}
                    {activeTab === 'settlements' && (
                        <div className="space-y-8">
                        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                            <div className="flex justify-between items-center mb-8">
                                <div className="flex items-center space-x-2 text-green-600">
                                    <Wallet size={24} />
                                    <h3 className="text-xl font-extrabold text-gray-800">Net Balances</h3>
                                </div>
                                <button onClick={() => setShowSettleModal(true)} className="bg-green-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg hover:bg-green-700 hover:shadow-xl transition-all flex items-center space-x-2">
                                    <CheckCircle2 size={18} />
                                    <span>Settle Up</span>
                                </button>
                            </div>

                            {userDebts && userDebts.length > 0 ? (
                                <div className="space-y-3">
                                    {userDebts.map(userDebt => {
                                        const net = parseFloat(userDebt.net_balance);
                                        const isSelected = selectedUser === userDebt.user_id;
                                        let bgClass = "bg-gray-50 border-gray-100";
                                        let colorClass = "text-gray-400";
                                        let statusText = "Settled up";

                                        if (net > 0) {
                                            bgClass = "bg-green-50 border-green-100";
                                            colorClass = "text-green-600";
                                            statusText = `gets back ₹${net.toFixed(2)}`;
                                        } else if (net < 0) {
                                            bgClass = "bg-red-50 border-red-100";
                                            colorClass = "text-red-500";
                                            statusText = `owes ₹${Math.abs(net).toFixed(2)}`;
                                        }

                                        return (
                                            <div key={userDebt.user_id}>
                                                <button
                                                    onClick={() => setSelectedUser(isSelected ? null : userDebt.user_id)}
                                                    className={`w-full p-5 border rounded-2xl transition-all hover:shadow-md ${bgClass} flex items-center space-x-4 text-left`}
                                                >
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border shadow-sm ${net >= 0 ? 'bg-white text-green-600 border-green-200' : 'bg-white text-red-500 border-red-200'}`}>
                                                        {(userDebt.user_name || 'U')[0]}
                                                    </div>
                                                    <div className="flex-1 overflow-hidden">
                                                        <p className="font-bold text-gray-900 text-sm truncate">{userDebt.user_name || 'Member'}</p>
                                                        <p className={`text-xs font-bold uppercase tracking-wider ${colorClass}`}>{statusText}</p>
                                                    </div>
                                                    {(userDebt.owes.length > 0 || userDebt.gets_from.length > 0) && (
                                                        <ChevronDown
                                                            size={18}
                                                            className={`text-gray-400 transition-transform ${isSelected ? 'rotate-180' : ''}`}
                                                        />
                                                    )}
                                                </button>

                                                {isSelected && (userDebt.owes.length > 0 || userDebt.gets_from.length > 0) && (
                                                    <div className="mt-2 ml-6 p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-3 animate-fade-in-up">
                                                        {userDebt.owes.length > 0 && (
                                                            <div>
                                                                <p className="text-xs font-bold text-red-400 uppercase tracking-wider mb-2">Owes to</p>
                                                                {userDebt.owes.map(debt => (
                                                                    <div key={debt.user_id} className="flex items-center justify-between py-1.5">
                                                                        <span className="text-sm font-medium text-gray-700">{debt.user_name}</span>
                                                                        <span className="text-sm font-bold text-red-500">₹{debt.amount}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {userDebt.gets_from.length > 0 && (
                                                            <div>
                                                                <p className="text-xs font-bold text-green-400 uppercase tracking-wider mb-2">Gets from</p>
                                                                {userDebt.gets_from.map(debt => (
                                                                    <div key={debt.user_id} className="flex items-center justify-between py-1.5">
                                                                        <span className="text-sm font-medium text-gray-700">{debt.user_name}</span>
                                                                        <span className="text-sm font-bold text-green-600">₹{debt.amount}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed">
                                    <CheckCircle2 size={40} className="mx-auto text-green-200 mb-4" />
                                    <p className="text-gray-500 font-medium italic">Everything is square!</p>
                                </div>
                            )}
                        </div>

                        {/* Settlement History Section */}
                        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                            <div className="flex items-center space-x-2 mb-8">
                                <History className="text-purple-600" size={24} />
                                <h3 className="text-xl font-extrabold text-gray-800">Settlement History</h3>
                            </div>

                            {settlements?.length === 0 ? (
                                <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                    <History size={40} className="mx-auto text-gray-300 mb-4" />
                                    <p className="text-gray-500 font-medium italic">No settlements recorded yet.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {settlements?.map(settlement => (
                                        <div key={settlement.id} className="group flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 hover:bg-gray-100 transition-all relative">
                                            <div className="flex items-center space-x-3 overflow-hidden">
                                                <div className="w-8 h-8 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                                                    ₹
                                                </div>
                                                <div className="truncate">
                                                    <p className="text-sm font-bold text-gray-900 truncate">
                                                        <span className="text-green-600">{getMemberName(settlement.payer)}</span>
                                                        <ArrowRight size={12} className="inline mx-1.5 text-gray-400" />
                                                        <span className="text-blue-600">{getMemberName(settlement.payee)}</span>
                                                    </p>
                                                    <p className="text-xs text-gray-400 mt-0.5">
                                                        {new Date(settlement.settled_at).toLocaleDateString()} at {new Date(settlement.settled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center space-x-3 flex-shrink-0">
                                                <p className="font-extrabold text-lg text-gray-900">₹{Number(settlement.amount).toFixed(2)}</p>
                                                <button
                                                    onClick={() => setDeleteSettlementConfirm(settlement.id)}
                                                    className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                    title="Delete settlement"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>

                                            {deleteSettlementConfirm === settlement.id && (
                                                <div onClick={() => setDeleteSettlementConfirm(null)} className="absolute inset-0 bg-white/80 backdrop-blur-sm border border-red-200 rounded-xl p-4 flex items-center justify-between z-10 shadow-lg cursor-pointer">
                                                    <p className="text-sm font-bold text-red-600">Delete this settlement?</p>
                                                    <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                                                        <button
                                                            onClick={() => handleDeleteSettlement(settlement.id)}
                                                            className="bg-red-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-600 transition-all"
                                                        >
                                                            Yes
                                                        </button>
                                                        <button
                                                            onClick={() => setDeleteSettlementConfirm(null)}
                                                            className="text-gray-400 px-3 py-1.5 rounded-lg text-xs font-bold hover:text-gray-600 transition-all"
                                                        >
                                                            No
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        </div>
                    )}

                {/* Members Tab */}
                {activeTab === 'members' && (
                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                        <div className="flex items-center space-x-2 mb-8">
                            <UserIcon className="text-blue-900" size={24} />
                            <h3 className="text-xl font-extrabold text-gray-800">Members ({members?.length || 0})</h3>
                        </div>

                        <ul className="space-y-4 mb-10">
                            {members?.map(membership => {
                                const initial = (membership.user.name || membership.user.email || 'U')[0].toUpperCase();
                                return (
                                    <li key={membership.id} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-white flex items-center justify-center font-bold shadow-md text-lg">
                                            {initial}
                                        </div>
                                        <div className="overflow-hidden">
                                            <p className="font-bold text-gray-900 text-sm truncate">{membership.user.name || 'Unknown'}</p>
                                            <p className="text-xs text-gray-400 truncate">{membership.user.email}</p>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>

                        <div className="border-t pt-8">
                            <div className="flex items-center space-x-2 mb-4">
                                <UserPlus className="text-gray-400" size={16} />
                                <h4 className="font-bold text-xs text-gray-400 uppercase tracking-widest leading-none">Invite someone new</h4>
                            </div>
                            <form onSubmit={handleInvite} className="space-y-3">
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="friend@email.com"
                                    className="w-full text-sm border-gray-200 border rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all placeholder:text-gray-300"
                                    required
                                />
                                <button
                                    type="submit"
                                    disabled={isInviting}
                                    className="w-full bg-gray-900 text-white font-bold text-sm py-3.5 rounded-xl hover:bg-black focus:ring-4 focus:ring-gray-300 transition-all disabled:opacity-50 shadow-md"
                                >
                                    {isInviting ? 'Working...' : 'Get Invite Link'}
                                </button>
                            </form>

                            {inviteToken && (
                                <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-2xl animate-fade-in-up">
                                    <div className="flex items-center justify-between mb-3 text-blue-900">
                                        <p className="font-bold text-sm">Magic link ready!</p>
                                        <Copy size={14} className="cursor-pointer" />
                                    </div>
                                    <input
                                        type="text"
                                        readOnly
                                        value={inviteLink}
                                        className="w-full bg-white border border-blue-200 p-2.5 rounded-lg text-xs select-all focus:outline-none font-mono text-blue-600"
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Settle Up Modal */}
            {showSettleModal && (
                <div className="fixed inset-0 bg-blue-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md border border-white animate-fade-in-up">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-2xl font-black text-gray-900 tracking-tight">Record Payment</h3>
                            <button onClick={() => setShowSettleModal(false)} className="text-gray-400 hover:text-gray-600"><XCircle size={24} /></button>
                        </div>
                        <form onSubmit={handleSettle} className="space-y-6">
                            <div>
                                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Who paid?</label>
                                <select required value={settlePayer} onChange={e => setSettlePayer(e.target.value)} className="w-full border-gray-200 border rounded-xl p-3.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all outline-none">
                                    <option value="" disabled>Choose member...</option>
                                    {members?.map(m => <option key={m.user.id} value={m.user.id}>{m.user.name || m.user.email}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Who was paid?</label>
                                <select required value={settlePayee} onChange={e => setSettlePayee(e.target.value)} className="w-full border-gray-200 border rounded-xl p-3.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all outline-none">
                                    <option value="" disabled>Choose member...</option>
                                    {members?.map(m => <option key={m.user.id} value={m.user.id}>{m.user.name || m.user.email}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">How much?</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-gray-400 text-lg">₹</span>
                                    <input required type="number" step="0.01" value={settleAmount} onChange={e => setSettleAmount(e.target.value)} className="w-full border-gray-200 border rounded-xl p-3.5 pl-8 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all outline-none text-lg font-bold" placeholder="0.00" />
                                </div>
                            </div>
                            <div className="flex flex-col space-y-3 pt-6">
                                <button type="submit" disabled={isSettling} className="w-full bg-green-600 text-white rounded-2xl py-4 shadow-lg shadow-green-200 hover:bg-green-700 hover:shadow-xl disabled:opacity-50 font-black text-lg transition-all tracking-tight">
                                    {isSettling ? 'Recording...' : 'Settle Debt'}
                                </button>
                                <button type="button" onClick={() => setShowSettleModal(false)} className="w-full text-gray-400 py-2 font-bold hover:text-gray-600 transition-colors">Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Bill Type Selection Modal */}
            {showBillTypeModal && (
                <div className="fixed inset-0 flex items-start justify-center pt-16 p-4 z-50">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-gray-100 animate-fade-in-up">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <h3 className="text-lg font-black text-gray-900">Choose Bill Type</h3>
                            <button onClick={() => setShowBillTypeModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors p-1">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <button
                                onClick={() => { setShowBillTypeModal(false); navigate(`/groups/${id}/add-bill?type=simple`); }}
                                className="w-full group p-5 rounded-2xl border-2 border-gray-100 hover:border-blue-500 bg-gray-50 hover:bg-blue-50 transition-all text-left flex items-center space-x-4"
                            >
                                <div className="w-12 h-12 bg-white group-hover:bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center shadow-sm transition-colors flex-shrink-0">
                                    <Receipt size={22} />
                                </div>
                                <div>
                                    <h4 className="font-black text-gray-900">Simple Bill</h4>
                                    <p className="text-sm text-gray-400 font-medium">Split a single amount among members</p>
                                </div>
                            </button>
                            <button
                                onClick={() => { setShowBillTypeModal(false); navigate(`/groups/${id}/add-bill?type=compound`); }}
                                className="w-full group p-5 rounded-2xl border-2 border-gray-100 hover:border-blue-500 bg-gray-50 hover:bg-blue-50 transition-all text-left flex items-center space-x-4"
                            >
                                <div className="w-12 h-12 bg-white group-hover:bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center shadow-sm transition-colors flex-shrink-0">
                                    <Layers size={22} />
                                </div>
                                <div>
                                    <h4 className="font-black text-gray-900">Compound Bill</h4>
                                    <p className="text-sm text-gray-400 font-medium">Add multiple items with individual splits</p>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GroupDetail;
