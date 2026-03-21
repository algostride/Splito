import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
    useGetGroupDetailQuery,
    useGetGroupMembersQuery,
    useInviteMemberMutation
} from '../store/groupsApi';
import { useGetBillsQuery } from '../store/billsApi';
import { useGetBalancesQuery, useCreateSettlementMutation } from '../store/settlementsApi';

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

    if (isGroupLoading || isMembersLoading || isBillsLoading || isBalancesLoading) return <div className="p-8 max-w-4xl mx-auto text-gray-500">Loading group details...</div>;
    if (!group) return <div className="p-8 max-w-4xl mx-auto text-red-500">Group not found.</div>;

    const inviteLink = inviteToken ? `${window.location.origin}/accept-invite/${inviteToken}` : '';

    return (
        <div className="max-w-5xl mx-auto py-8 px-4">
            <Link to="/" className="text-blue-600 hover:underline mb-6 inline-block font-medium">&larr; Back to Dashboard</Link>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8 flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold text-gray-800 mb-2">{group.name}</h2>
                    <p className="text-sm text-gray-500">
                        Created on {new Date(group.created_at).toLocaleDateString()}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    {/* Bills Section */}
                    <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-gray-800">Group Bills</h3>
                            <Link to={`/groups/${id}/add-bill`} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow hover:bg-blue-700 transition">
                                + Add Bill
                            </Link>
                        </div>

                        {bills?.length === 0 ? (
                            <p className="text-gray-500 italic text-center py-6">No bills added to this group yet.</p>
                        ) : (
                            <div className="space-y-4">
                                {bills?.map(bill => (
                                    <div key={bill.id} className="flex justify-between items-center p-4 border border-gray-100 rounded-lg hover:shadow-md transition bg-gray-50">
                                        <div>
                                            <h4 className="font-semibold text-gray-800">{bill.title}</h4>
                                            <p className="text-xs text-gray-500">Added by {bill.created_by?.name || bill.created_by?.email} on {new Date(bill.created_at).toLocaleDateString()}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-lg text-gray-800">{Number(bill.total_amount).toFixed(2)} {bill.currency}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Settlements & Balances Section */}
                    <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-gray-800">Balances</h3>
                            <button onClick={() => setShowSettleModal(true)} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow hover:bg-green-700 transition">
                                Settle Up
                            </button>
                        </div>

                        {balances && Object.keys(balances).length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {Object.values(balances).map(balanceObj => {
                                    // Based on standard dict of maps we probably receive an array of objects
                                    // if it's `{ "user_id": { net_balance: X, user_name: Y } }` or an array
                                    const bal = balanceObj.net_balance !== undefined ? balanceObj : { net_balance: 0, user_name: 'Unknown' };
                                    const net = parseFloat(bal.net_balance);
                                    let colorClass = "text-gray-600";
                                    let text = "Settled up";
                                    if (net > 0) { colorClass = "text-green-600"; text = `gets back $${net.toFixed(2)}`; }
                                    else if (net < 0) { colorClass = "text-red-500"; text = `owes $${Math.abs(net).toFixed(2)}`; }

                                    return (
                                        <div key={bal.user_id || bal.user_name} className="p-4 border border-gray-100 rounded-lg bg-gray-50 flex flex-col justify-center items-center text-center">
                                            <h4 className="font-bold text-gray-800 mb-1">{bal.user_name || bal.user_email || 'Member'}</h4>
                                            <p className={`font-semibold ${colorClass}`}>{text}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="text-gray-500 italic text-center py-6">All balances are settled or no bills exist.</p>
                        )}
                    </div>
                </div>

                {/* Members Sidebar */}
                <div className="space-y-8">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-gray-800">Members ({members?.length || 0})</h3>
                        </div>

                        <ul className="space-y-4 mb-8">
                            {members?.map(membership => {
                                const initial = (membership.user.name || membership.user.email || 'U')[0].toUpperCase();
                                return (
                                    <li key={membership.id} className="flex items-center space-x-3 bg-gray-50 p-2 rounded-lg">
                                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold shadow-sm border border-blue-200">
                                            {initial}
                                        </div>
                                        <div className="overflow-hidden">
                                            <p className="font-semibold text-gray-800 text-sm truncate">{membership.user.name || 'Unknown'}</p>
                                            <p className="text-xs text-gray-500 truncate">{membership.user.email}</p>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>

                        <div className="border-t pt-6">
                            <h4 className="font-bold text-sm text-gray-800 mb-3">Invite new member</h4>
                            <form onSubmit={handleInvite} className="space-y-3">
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Email address"
                                    className="w-full text-sm border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                                    required
                                />
                                <button
                                    type="submit"
                                    disabled={isInviting}
                                    className="w-full bg-gray-800 text-white font-medium text-sm py-2.5 rounded-lg hover:bg-gray-900 focus:ring-4 focus:ring-gray-300 transition-all disabled:opacity-50"
                                >
                                    {isInviting ? 'Generating...' : 'Generate Invite Link'}
                                </button>
                            </form>

                            {inviteToken && (
                                <div className="mt-5 p-4 bg-green-50 border border-green-200 rounded-lg text-sm">
                                    <p className="text-green-800 font-bold mb-2">Invite link generated!</p>
                                    <p className="text-xs text-green-700 mb-2">Share this URL with the new member:</p>
                                    <input
                                        type="text"
                                        readOnly
                                        value={inviteLink}
                                        className="w-full bg-white border border-green-300 p-2.5 rounded text-xs select-all focus:outline-none focus:border-green-500"
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Settle Up Modal */}
            {showSettleModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
                        <h3 className="text-2xl font-bold mb-6 text-gray-800">Record a Payment</h3>
                        <form onSubmit={handleSettle} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Who paid?</label>
                                <select required value={settlePayer} onChange={e => setSettlePayer(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2.5">
                                    <option value="" disabled>Select payer...</option>
                                    {members?.map(m => <option key={m.user.id} value={m.user.id}>{m.user.name || m.user.email}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Who received the payment?</label>
                                <select required value={settlePayee} onChange={e => setSettlePayee(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2.5">
                                    <option value="" disabled>Select payee...</option>
                                    {members?.map(m => <option key={m.user.id} value={m.user.id}>{m.user.name || m.user.email}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Amount</label>
                                <input required type="number" step="0.01" value={settleAmount} onChange={e => setSettleAmount(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2.5" placeholder="0.00" />
                            </div>
                            <div className="flex justify-end space-x-3 pt-4 border-t">
                                <button type="button" onClick={() => setShowSettleModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                                <button type="submit" disabled={isSettling} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 font-bold">
                                    {isSettling ? 'Recording...' : 'Save Payment'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GroupDetail;
