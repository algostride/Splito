import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useGetGroupsQuery, useCreateGroupMutation } from '../store/groupsApi';

const Dashboard = () => {
    const { data: groups, isLoading, error } = useGetGroupsQuery();
    const [createGroup, { isLoading: isCreating }] = useCreateGroupMutation();
    const [newGroupName, setNewGroupName] = useState('');
    const [showModal, setShowModal] = useState(false);

    const handleCreateGroup = async (e) => {
        e.preventDefault();
        try {
            if (!newGroupName.trim()) return;
            await createGroup({ name: newGroupName }).unwrap();
            setNewGroupName('');
            setShowModal(false);
        } catch (err) {
            console.error('Failed to create group', err);
        }
    };

    return (
        <div className="max-w-4xl mx-auto py-8">
            <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-bold text-gray-800">Your Groups</h2>
                <button
                    onClick={() => setShowModal(true)}
                    className="bg-blue-600 text-white px-5 py-2 rounded-lg shadow hover:bg-blue-700 transition"
                >
                    + Create Group
                </button>
            </div>

            {isLoading && <p className="text-gray-500">Loading your groups...</p>}
            {error && <p className="text-red-500">Failed to load groups.</p>}

            {!isLoading && !error && groups?.length === 0 && (
                <div className="bg-white p-8 rounded-lg shadow text-center">
                    <p className="text-gray-600">You are not part of any groups yet.</p>
                </div>
            )}

            {groups?.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {groups.map((group) => (
                        <Link key={group.id} to={`/groups/${group.id}`} className="block group hover:shadow-lg transition bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                            <div className="p-6">
                                <h3 className="text-xl font-semibold text-gray-800 mb-2 truncate">{group.name}</h3>
                                <p className="text-sm text-gray-500">Created by: {group.created_by?.name || group.created_by?.email}</p>
                            </div>
                        </Link>
                    ))}
                </div>
            )}

            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
                        <h3 className="text-2xl font-bold mb-4">Create New Group</h3>
                        <form onSubmit={handleCreateGroup}>
                            <input
                                type="text"
                                value={newGroupName}
                                onChange={(e) => setNewGroupName(e.target.value)}
                                placeholder="Group Name"
                                className="w-full border rounded-lg p-3 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                            />
                            <div className="flex justify-end space-x-3">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isCreating}
                                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {isCreating ? 'Creating...' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
