import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
    useGetGroupDetailQuery,
    useGetGroupMembersQuery,
    useInviteMemberMutation
} from '../store/groupsApi';

const GroupDetail = () => {
    const { id } = useParams();
    const { data: group, isLoading: isGroupLoading } = useGetGroupDetailQuery(id);
    const { data: members, isLoading: isMembersLoading } = useGetGroupMembersQuery(id);
    const [inviteMember, { isLoading: isInviting }] = useInviteMemberMutation();

    const [email, setEmail] = useState('');
    const [inviteToken, setInviteToken] = useState(null);

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

    if (isGroupLoading || isMembersLoading) return <div className="p-8 max-w-4xl mx-auto text-gray-500">Loading group details...</div>;
    if (!group) return <div className="p-8 max-w-4xl mx-auto text-red-500">Group not found.</div>;

    const inviteLink = inviteToken ? `${window.location.origin}/accept-invite/${inviteToken}` : '';

    return (
        <div className="max-w-5xl mx-auto py-8">
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
                    {/* Bills and Balances will go here in Phase 8/9 */}
                    <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
                        <h3 className="text-xl font-bold mb-4 text-gray-800">Group Bills</h3>
                        <p className="text-gray-500 italic">Bills and line items will be displayed here in Phase 8.</p>
                    </div>

                    <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
                        <h3 className="text-xl font-bold mb-4 text-gray-800">Settlements</h3>
                        <p className="text-gray-500 italic">Balances and settlements will be displayed here in Phase 9.</p>
                    </div>
                </div>

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
        </div>
    );
};

export default GroupDetail;
