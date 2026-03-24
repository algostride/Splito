import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useGetGroupsQuery, useCreateGroupMutation } from '../store/groupsApi';
import { Plus, Users, LayoutDashboard } from 'lucide-react';

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
        <div className="max-w-4xl mx-auto py-8 animate-fade-in-up">
            <div className="flex justify-between items-center mb-8">
                <div className="flex items-center space-x-3 text-blue-900">
                    <LayoutDashboard size={32} />
                    <h2 className="text-3xl font-extrabold tracking-tight">Your Groups</h2>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="bg-blue-600 text-white px-6 py-2.5 rounded-xl shadow-lg hover:bg-blue-700 hover:shadow-xl transition-all flex items-center space-x-2 font-semibold"
                >
                    <Plus size={20} />
                    <span>Create Group</span>
                </button>
            </div>

            {isLoading && (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-gray-500 font-medium italic">Loading your amazing groups...</p>
                </div>
            )}

            {error && (
                <div className="bg-red-50 p-6 rounded-xl border border-red-200 text-center">
                    <p className="text-red-500 font-semibold">Oops! Failed to load groups. Please try refreshing.</p>
                </div>
            )}

            {!isLoading && !error && groups?.length === 0 && (
                <div className="bg-white p-12 rounded-2xl shadow-sm border border-gray-100 text-center space-y-4">
                    <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Plus size={40} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-800">No groups yet</h3>
                    <p className="text-gray-500 max-w-xs mx-auto">Create a group to start splitting bills with your friends!</p>
                </div>
            )}

            {groups?.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {groups.map((group) => (
                        <Link key={group.id} to={`/groups/${group.id}`} className="block group hover:-translate-y-1 transition-all duration-300 bg-white rounded-2xl shadow-sm hover:shadow-xl border border-gray-100 overflow-hidden">
                            <div className="p-6">
                                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                    <Users size={24} />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2 truncate">{group.name}</h3>
                                <p className="text-sm text-gray-500 flex items-center">
                                    <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                                    Active Group
                                </p>
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
