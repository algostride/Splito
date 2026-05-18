import React, { useState } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useGetGroupMembersQuery } from '../store/groupsApi';
import { useCreateBillMutation } from '../store/billsApi';
import { ArrowLeft, Receipt, Layers } from 'lucide-react';
import SimpleBillForm from '../components/bills/SimpleBillForm';
import CompoundBillForm from '../components/bills/CompoundBillForm';

const AddBill = () => {
    const { id: groupId } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { data: members, isLoading: loadingMembers } = useGetGroupMembersQuery(groupId);
    const [createBill, { isLoading: isSubmitting }] = useCreateBillMutation();

    const initialType = searchParams.get('type');
    const [billType, setBillType] = useState(
        initialType === 'simple' || initialType === 'compound' ? initialType : null
    );

    const handleSubmit = async (payload) => {
        try {
            await createBill({ group: groupId, currency: 'INR', ...payload }).unwrap();
            navigate(`/groups/${groupId}`);
        } catch (err) {
            console.error('Failed to create bill', err);
        }
    };

    if (loadingMembers) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-gray-500 font-medium">Loading members...</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto py-8 px-4 animate-fade-in-up">
            <Link to={`/groups/${groupId}`} className="flex items-center text-blue-600 hover:text-blue-800 mb-6 transition-colors font-semibold group">
                <ArrowLeft size={20} className="mr-2 group-hover:-translate-x-1 transition-transform" />
                Back to Group
            </Link>

            <div className="bg-white p-10 rounded-3xl shadow-xl shadow-blue-900/5 border border-gray-100">
                <div className="flex items-center space-x-3 mb-10 border-b border-gray-50 pb-6">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                        <Receipt size={24} />
                    </div>
                    <h2 className="text-3xl font-black text-gray-900 tracking-tight">Add New Bill</h2>
                </div>

                {!billType ? (
                    <div className="space-y-6">
                        <p className="text-gray-500 font-medium text-center">What kind of bill is this?</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <button
                                type="button"
                                onClick={() => setBillType('simple')}
                                className="group p-8 rounded-2xl border-2 border-gray-100 hover:border-blue-500 bg-gray-50 hover:bg-blue-50 transition-all text-left space-y-3"
                            >
                                <div className="w-12 h-12 bg-white group-hover:bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center shadow-sm transition-colors">
                                    <Receipt size={24} />
                                </div>
                                <h4 className="font-black text-gray-900 text-lg">Simple Bill</h4>
                                <p className="text-sm text-gray-400 font-medium">Split a single amount among members</p>
                            </button>
                            <button
                                type="button"
                                onClick={() => setBillType('compound')}
                                className="group p-8 rounded-2xl border-2 border-gray-100 hover:border-blue-500 bg-gray-50 hover:bg-blue-50 transition-all text-left space-y-3"
                            >
                                <div className="w-12 h-12 bg-white group-hover:bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center shadow-sm transition-colors">
                                    <Layers size={24} />
                                </div>
                                <h4 className="font-black text-gray-900 text-lg">Compound Bill</h4>
                                <p className="text-sm text-gray-400 font-medium">Add multiple items with individual splits</p>
                            </button>
                        </div>
                    </div>
                ) : billType === 'simple' ? (
                    <SimpleBillForm
                        members={members}
                        onSubmit={handleSubmit}
                        isSubmitting={isSubmitting}
                    />
                ) : (
                    <CompoundBillForm
                        members={members}
                        onSubmit={handleSubmit}
                        isSubmitting={isSubmitting}
                    />
                )}
            </div>
        </div>
    );
};

export default AddBill;
