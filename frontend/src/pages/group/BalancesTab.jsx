import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useParams } from 'react-router-dom';
import { useGetGroupMembersQuery } from '../../store/groupsApi';
import {
    useGetUserDebtsQuery,
    useCreateSettlementMutation,
} from '../../store/settlementsApi';
import { describeError } from '../../utils/errorMessage';
import Screen from '../../components/shell/Screen';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Avatar from '../../components/ui/Avatar';
import EmptyState, { Note } from '../../components/ui/EmptyState';
import { Field, Select } from '../../components/ui/Input';
import { LoadingBlock } from '../../components/ui/Spinner';
import { Scale, CheckCircle2, ChevronDown } from 'lucide-react';
import { asNumber, balanceSentence, rupees } from '../../utils/money';
import { notify } from '../../store/toastSlice';
import { memberName } from './shared';

/**
 * Balances tab: per-member net position, expandable into who each member owes
 * or is owed by, plus the settle-up dialog.
 *
 * This is the "Net Balances" section that used to live inside the Settlements
 * tab. Splitting it out is the four-tab structure the mock uses, and it means
 * the tab you land on is the thing you came for.
 */
const BalancesTab = () => {
    const { id: groupId } = useParams();
    // isLoading/error are needed, not optional. The dialog's two member
    // <Select>s render only a disabled placeholder until this resolves, so
    // if the query failed the user got a dialog they could not complete
    // and no explanation of why.
    const {
        data: members,
        isLoading: isMembersLoading,
        error: membersError,
    } = useGetGroupMembersQuery(groupId);
    const { data: debts, isLoading, error } = useGetUserDebtsQuery(groupId);
    const [createSettlement, { isLoading: isSettling }] = useCreateSettlementMutation();
    const dispatch = useDispatch();

    const [expanded, setExpanded] = useState(null);
    const [showSettle, setShowSettle] = useState(false);
    const [payer, setPayer] = useState('');
    const [payee, setPayee] = useState('');
    const [amount, setAmount] = useState('');
    const [settleError, setSettleError] = useState(null);

    const closeSettle = () => {
        setShowSettle(false);
        setPayer('');
        setPayee('');
        setAmount('');
        setSettleError(null);
    };

    /* The server's own rule for Settlement.amount: two decimal places, and more
       than zero. Stated here so it is checked before the request rather than by
       the browser's step mismatch or by a rejected POST.

       This must not be a keystroke filter. Truncating a third decimal, or
       refusing the keystroke, means someone typing 4.5 then 6 to reach 4.56
       silently loses the digit. The form is noValidate, so the value is allowed
       into the field and the message appears on submit, which is the same
       bargain the bill forms make. */
    const MONEY = /^[0-9]+(\.[0-9]{1,2})?$/;

    const validateAmount = () => {
        const value = String(amount).trim();
        if (!value) return 'Enter an amount.';
        if (!MONEY.test(value)) return 'Use at most 2 decimal places.';
        if (Number(value) <= 0) return 'Amount must be more than 0.';
        return null;
    };

    const handleSettle = async (e) => {
        e.preventDefault();
        const amountError = validateAmount();
        if (amountError) {
            setSettleError(amountError);
            return;
        }
        try {
            setSettleError(null);
            await createSettlement({
                group: groupId,
                payer,
                payee,
                amount: String(amount),
            }).unwrap();
            // Recording a payment closes the dialog and refetches balances.
            // Without this there is no confirmation that the refetch was not
            // just a failure that looked like success.
            dispatch(notify(
                `Recorded ${rupees(amount)} from ${memberName(members, payer)} ` +
                    `to ${memberName(members, payee)}`,
            ));
            closeSettle();
        } catch (err) {
            console.error('Failed to create settlement', err);
            // The other three handlers kept the server's reason and put it on
            // screen; this one used a bare alert() and dropped it.
            setSettleError(describeError(err));
        }
    };

    return (
        <Screen>
            <Card pad="gutter">
                <div className="flex items-center justify-between gap-3 pb-5 mb-1 border-b border-border">
                    <div className="flex items-center gap-2">
                        <Scale size={18} className="text-accent" aria-hidden="true" />
                        <h2 className="text-title font-semibold text-text">Balances</h2>
                    </div>
                    <Button variant="settle" size="sm" onClick={() => setShowSettle(true)}>
                        <CheckCircle2 size={15} strokeWidth={2} aria-hidden="true" />
                        Settle up
                    </Button>
                </div>

                {isLoading ? (
                    <LoadingBlock text="Crunching the numbers..." size="sm" />
                ) : error ? (
                    <Note tone="neg" className="mt-4 mb-1">{describeError(error)}</Note>
                ) : !debts?.length ? (
                    <EmptyState
                        tone="pos"
                        icon={<CheckCircle2 size={24} strokeWidth={1.75} aria-hidden="true" />}
                        title="Nothing to split yet"
                    >
                        Add a bill and the balances will appear here.
                    </EmptyState>
                ) : (
                    <ul>
                        {debts.map((debt) => {
                            const net = asNumber(debt.net_balance);
                            const isOpen = expanded === debt.user_id;
                            const hasDetail = debt.owes.length > 0 || debt.gets_from.length > 0;
                            const tone = net > 0 ? 'pos' : net < 0 ? 'neg' : 'muted';
                            // Was "gets back" / "owes", a third phrasing of
                            // the same balance.
                            const status = balanceSentence(net);

                            return (
                                <li
                                    key={debt.user_id}
                                    className="border-b border-border last:border-0"
                                >
                                    <button
                                        type="button"
                                        onClick={() => setExpanded(isOpen ? null : debt.user_id)}
                                        aria-expanded={isOpen}
                                        disabled={!hasDetail}
                                        className="w-full flex items-center gap-3 min-h-row text-left press disabled:pointer-events-none"
                                    >
                                        <Avatar name={debt.user_name} />
                                        <span className="flex-1 min-w-0">
                                            <span className="block text-body font-semibold text-text truncate">
                                                {debt.user_name || 'Member'}
                                            </span>
                                            <span
                                                className={`block text-meta font-semibold ${
                                                    tone === 'pos'
                                                        ? 'text-pos'
                                                        : tone === 'neg'
                                                          ? 'text-neg'
                                                          : 'text-faint'
                                                }`}
                                            >
                                                {status}
                                            </span>
                                        </span>
                                        {hasDetail ? (
                                            <ChevronDown
                                                size={16}
                                                className={`shrink-0 text-faint transition-transform ${
                                                    isOpen ? 'rotate-180' : ''
                                                }`}
                                                aria-hidden="true"
                                            />
                                        ) : null}
                                    </button>

                                    {isOpen && hasDetail ? (
                                        <div className="pb-4 pl-13 space-y-4 animate-fade-in">
                                            {debt.owes.length > 0 ? (
                                                <div>
                                                    <p className="text-meta text-faint uppercase tracking-wider mb-1.5">
                                                        Owes to
                                                    </p>
                                                    {debt.owes.map((entry) => (
                                                        <div
                                                            key={entry.user_id}
                                                            className="flex items-center justify-between py-1"
                                                        >
                                                            <span className="text-body text-muted truncate">
                                                                {entry.user_name}
                                                            </span>
                                                            <span className="font-money tnum text-body font-semibold text-neg">
                                                                {rupees(entry.amount)}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : null}
                                            {debt.gets_from.length > 0 ? (
                                                <div>
                                                    <p className="text-meta text-faint uppercase tracking-wider mb-1.5">
                                                        Gets from
                                                    </p>
                                                    {debt.gets_from.map((entry) => (
                                                        <div
                                                            key={entry.user_id}
                                                            className="flex items-center justify-between py-1"
                                                        >
                                                            <span className="text-body text-muted truncate">
                                                                {entry.user_name}
                                                            </span>
                                                            <span className="font-money tnum text-body font-semibold text-pos">
                                                                {rupees(entry.amount)}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : null}
                                        </div>
                                    ) : null}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </Card>

            <Modal
                open={showSettle}
                onClose={closeSettle}
                title="Record a payment"
                labelledBy="settle-title"
                footer={
                    <>
                        <Button variant="ghost" onClick={closeSettle}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            form="settle-form"
                            disabled={isSettling || isMembersLoading || Boolean(membersError)}
                        >
                            {isSettling ? 'Recording...' : 'Record payment'}
                        </Button>
                    </>
                }
            >
                {/* noValidate for the same reason as the bill forms: the browser
                    was blocking submit on a step mismatch and showing its own
                    bubble. The rules above are the app's, and they are stated in
                    the app's own words. */}
                <form id="settle-form" onSubmit={handleSettle} noValidate className="flex flex-col gap-4">
                    {settleError && <Note tone="neg">{settleError}</Note>}
                    {membersError ? (
                        <Note tone="neg">{describeError(membersError)}</Note>
                    ) : isMembersLoading ? (
                        <LoadingBlock text="Loading members..." size="sm" />
                    ) : null}
                    <Field
                        as={Select}
                        label="Who paid?"
                        value={payer}
                        onChange={(e) => setPayer(e.target.value)}
                        required
                    >
                        <option value="" disabled>
                            Choose a member
                        </option>
                        {members?.map((m) => (
                            <option key={m.user.id} value={m.user.id}>
                                {m.user.name || m.user.email}
                            </option>
                        ))}
                    </Field>
                    <Field
                        as={Select}
                        label="Who was paid?"
                        value={payee}
                        onChange={(e) => setPayee(e.target.value)}
                        required
                    >
                        <option value="" disabled>
                            Choose a member
                        </option>
                        {members?.map((m) => (
                            <option key={m.user.id} value={m.user.id}>
                                {m.user.name || m.user.email}
                            </option>
                        ))}
                    </Field>
                    <Field
                        label="How much?"
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        required
                    />
                </form>
            </Modal>
        </Screen>
    );
};

export default BalancesTab;
