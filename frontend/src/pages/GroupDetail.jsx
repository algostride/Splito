import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
    useGetGroupDetailQuery,
    useGetGroupMembersQuery,
    useInviteMemberMutation
} from '../store/groupsApi';
import { useGetBillsQuery } from '../store/billsApi';
import { useGetBalancesQuery, useCreateSettlementMutation } from '../store/settlementsApi';
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
    Users
} from 'lucide-react';

const GroupDetail = () => {
    const { id } = useParams();
    const { data: group, isLoading: isGroupLoading } = useGetGroupDetailQuery(id);
    const { data: members, isLoading: isMembersLoading } = useGetGroupMembersQuery(id);
    const { data: bills, isLoading: isBillsLoading } = useGetBillsQuery(id);
    const { data: balances, isLoading: isBalancesLoading } = useGetBalancesQuery(id);

    const [inviteMember, { isLoading: isInviting }] = useInviteMemberMutation();
    const [createSettlement, { isLoading: isSettling }] = useCreateSettlementMutation();

    const [email, setEmail] = useState('');
    const [inviteToken, setInviteToken] = useState(null);

    // Settle Modal State
    const [showSettleModal, setShowSettleModal] = useState(false);
    const [settlePayer, setSettlePayer] = useState('');
    const [settlePayee, setSettlePayee] = useState('');
    const [settleAmount, setSettleAmount] = useState('');

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

    if (isGroupLoading || isMembersLoading || isBillsLoading || isBalancesLoading) {
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    {/* Bills Section */}
                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative">
                        <div className="flex justify-between items-center mb-8">
                            <div className="flex items-center space-x-2">
                                <Receipt className="text-blue-600" size={24} />
                                <h3 className="text-xl font-extrabold text-gray-800">Recent Bills</h3>
                            </div>
                            <Link to={`/groups/${id}/add-bill`} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg hover:bg-blue-700 hover:shadow-xl transition-all flex items-center space-x-2">
                                <Plus size={18} />
                                <span>Add Bill</span>
                            </Link>
                        </div>

                        {bills?.length === 0 ? (
                            <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                <Receipt size={40} className="mx-auto text-gray-300 mb-4" />
                                <p className="text-gray-500 font-medium italic">No bills yet. Time to split dinner?</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {bills?.map(bill => (
                                    <div key={bill.id} className="flex justify-between items-center p-5 border border-gray-50 rounded-xl hover:bg-blue-50 transition-all bg-gray-50/50 group">
                                        <div className="flex items-center space-x-4">
                                            <div className="w-10 h-10 bg-white shadow-sm border border-gray-100 rounded-lg flex items-center justify-center text-blue-600">
                                                <Receipt size={20} />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-gray-900">{bill.title}</h4>
                                                <p className="text-xs text-gray-400 flex items-center mt-0.5">
                                                    By {bill.created_by?.name || bill.created_by?.email.split('@')[0]}
                                                    <ChevronRight size={12} className="mx-1" />
                                                    {new Date(bill.created_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-extrabold text-lg text-gray-900">{Number(bill.total_amount).toFixed(2)} <span className="text-xs text-gray-400 ml-0.5 font-bold uppercase">{bill.currency}</span></p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Settlements & Balances Section */}
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

                        {balances && Object.keys(balances).length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {Object.values(balances).map(bal => {
                                    const net = parseFloat(bal.net_balance);
                                    let bgClass = "bg-gray-50 border-gray-100";
                                    let colorClass = "text-gray-400";
                                    let statusText = "Settled up";

                                    if (net > 0) {
                                        bgClass = "bg-green-50 border-green-100";
                                        colorClass = "text-green-600";
                                        statusText = `gets back $${net.toFixed(2)}`;
                                    }
                                    else if (net < 0) {
                                        bgClass = "bg-red-50 border-red-100";
                                        colorClass = "text-red-500";
                                        statusText = `owes $${Math.abs(net).toFixed(2)}`;
                                    }

                                    return (
                                        <div key={bal.user_id || bal.user_name} className={`p-5 border rounded-2xl transition-all hover:shadow-md ${bgClass} flex items-center space-x-4`}>
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border shadow-sm ${net >= 0 ? 'bg-white text-green-600 border-green-200' : 'bg-white text-red-500 border-red-200'}`}>
                                                {(bal.user_name || 'U')[0]}
                                            </div>
                                            <div className="overflow-hidden">
                                                <p className="font-bold text-gray-900 text-sm truncate">{bal.user_name || 'Member'}</p>
                                                <p className={`text-xs font-bold uppercase tracking-wider ${colorClass}`}>{statusText}</p>
                                            </div>
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
                </div>

                {/* Members Sidebar */}
                <div className="space-y-8">
                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                        <div className="flex items-center space-x-2 mb-8">
                            <UserIcon className="text-blue-900" size={20} />
                            <h3 className="text-lg font-extrabold text-gray-900">Members ({members?.length || 0})</h3>
                        </div>

                        <ul className="space-y-4 mb-10">
                            {members?.map(membership => {
                                const initial = (membership.user.name || membership.user.email || 'U')[0].toUpperCase();
                                return (
                                    <li key={membership.id} className="flex items-center space-x-4">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-white flex items-center justify-center font-bold shadow-md">
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
                </div>
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
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-gray-400 text-lg">$</span>
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
        </div>
    );
};

export default GroupDetail;
