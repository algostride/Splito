import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useGetGroupMembersQuery } from '../store/groupsApi';
import { useCreateBillMutation, useGetBillDetailQuery, useUpdateBillMutation } from '../store/billsApi';
import { ArrowLeft, Receipt } from 'lucide-react';
import { describeError } from '../utils/errorMessage';
import SimpleBillForm from '../components/bills/SimpleBillForm';
import CompoundBillForm from '../components/bills/CompoundBillForm';
import Screen from '../components/shell/Screen';
import { notify } from '../store/toastSlice';
import Card from '../components/ui/Card';
import { Note } from '../components/ui/EmptyState';
import BillTypeOptions from '../components/bills/BillTypeOptions';
import { LoadingBlock } from '../components/ui/Spinner';

const AddBill = () => {
    const { id: groupId, billId } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const isEdit = Boolean(billId);

    const { data: members, isLoading: loadingMembers } = useGetGroupMembersQuery(groupId);
    const { data: bill, isLoading: billLoading, error: billError } = useGetBillDetailQuery(billId, { skip: !isEdit });
    const dispatch = useDispatch();
    const [createBill, { isLoading: isCreating }] = useCreateBillMutation();
    const [updateBill, { isLoading: isUpdating }] = useUpdateBillMutation();

    const requestedType = searchParams.get('type');
    const [chosenType, setChosenType] = useState(
        requestedType === 'simple' || requestedType === 'compound' ? requestedType : null
    );
    const [submitError, setSubmitError] = useState(null);

    // A saved bill keeps the type it was created with. Editing picks the form
    // from the stored value, and there is no way to convert between the two.
    const billType = isEdit ? (bill?.bill_type || 'compound') : chosenType;

    const handleSubmit = async (payload) => {
        setSubmitError(null);
        try {
            if (isEdit) {
                await updateBill({ id: billId, group: groupId, currency: bill?.currency || 'INR', ...payload }).unwrap();
                dispatch(notify(`Updated "${payload.title}"`));
                navigate(`/groups/${groupId}/bills/${billId}`);
            } else {
                await createBill({ group: groupId, currency: 'INR', ...payload }).unwrap();
                // Navigating straight to the group looked like the save
                // silently doing nothing when it worked.
                dispatch(notify(`Added "${payload.title}"`));
                navigate(`/groups/${groupId}`);
            }
        } catch (err) {
            console.error(isEdit ? 'Failed to update bill' : 'Failed to create bill', err);
            setSubmitError(describeError(err));
        }
    };

    // One frame for every state. The three separate roots this used to have
    // meant the loading spinner had no page padding while the form did.
    const backTo = isEdit ? `/groups/${groupId}/bills/${billId}` : `/groups/${groupId}`;
    const showChooser = !isEdit && !billType;
    const formProps = isEdit
        ? { initialData: bill, onCancel: () => navigate(`/groups/${groupId}/bills/${billId}`), submitLabel: 'Save Changes' }
        : {};

    return (
        <Screen width="max-w-4xl">
            <Link
                to={backTo}
                className="inline-flex items-center text-accent hover:text-accent-ink transition-colors font-semibold"
            >
                <ArrowLeft size={18} strokeWidth={2} className="mr-2" aria-hidden="true" />
                {isEdit ? 'Back to bill' : 'Back to group'}
            </Link>

            {loadingMembers || (isEdit && billLoading) ? (
                <LoadingBlock text={`Loading ${isEdit ? 'bill' : 'members'}...`} />
            ) : isEdit && (billError || !bill) ? (
                <Note tone="neg">Could not load this bill for editing.</Note>
            ) : (
                <Card pad="gutter">
                    {!showChooser && (
                        <div className="flex items-center gap-3 pb-5 mb-5 border-b border-border">
                            <div className="w-12 h-12 bg-accent-soft text-accent rounded-control flex items-center justify-center shrink-0">
                                <Receipt size={22} strokeWidth={1.75} aria-hidden="true" />
                            </div>
                            <h1 className="text-title lg:text-display font-display font-semibold text-text">
                                {isEdit ? 'Edit bill' : 'Add new bill'}
                            </h1>
                        </div>
                    )}

                    {submitError && <Note tone="neg" className="mb-5">{submitError}</Note>}

                    {showChooser ? (
                        <BillTypeOptions onSelect={setChosenType} />
                    ) : billType === 'simple' ? (
                        <SimpleBillForm
                            members={members}
                            onSubmit={handleSubmit}
                            isSubmitting={isCreating || isUpdating}
                            {...formProps}
                        />
                    ) : (
                        <CompoundBillForm
                            members={members}
                            onSubmit={handleSubmit}
                            isSubmitting={isCreating || isUpdating}
                            {...formProps}
                        />
                    )}
                </Card>
            )}
        </Screen>
    );
};

export default AddBill;
