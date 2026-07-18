import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useGetGroupMembersQuery, useInviteMemberMutation } from '../../store/groupsApi';
import { describeError } from '../../utils/errorMessage';
import Screen from '../../components/shell/Screen';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Avatar from '../../components/ui/Avatar';
import EmptyState, { Note } from '../../components/ui/EmptyState';
import { Field } from '../../components/ui/Input';
import { LoadingBlock } from '../../components/ui/Spinner';
import { UserPlus, Check, Copy } from 'lucide-react';

/**
 * Members tab, plus the invite flow.
 *
 * The mock has a per-member Remove button here. It is deliberately missing:
 * there is no DELETE on any membership route, so the button could not do
 * anything. Adding one is backend work and is not part of this change.
 */
const MembersTab = () => {
    const { id: groupId } = useParams();
    const currentUserId = useSelector((state) => state.auth.user?.id);
    const { data: members, isLoading, error } = useGetGroupMembersQuery(groupId);
    const [inviteMember, { isLoading: isInviting }] = useInviteMemberMutation();

    const [email, setEmail] = useState('');
    const [inviteToken, setInviteToken] = useState(null);
    const [inviteError, setInviteError] = useState(null);
    const [copied, setCopied] = useState(false);

    const handleInvite = async (e) => {
        e.preventDefault();
        try {
            if (!email.trim()) return;
            setInviteError(null);
            const res = await inviteMember({ id: groupId, email }).unwrap();
            setInviteToken(res.token);
            setEmail('');
        } catch (err) {
            console.error('Failed to invite member', err);
            setInviteError(describeError(err));
        }
    };

    // Tracked so it can be cleared. The bare setTimeout below outlived the
    // component, so navigating to another tab inside those 2s called
    // setCopied on an unmounted component.
    const copyTimer = useRef(null);
    useEffect(() => () => clearTimeout(copyTimer.current), []);

    const copyLink = async () => {
        const link = `${window.location.origin}/accept-invite/${inviteToken}`;
        try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            clearTimeout(copyTimer.current);
            copyTimer.current = setTimeout(() => setCopied(false), 2000);
        } catch {
            // Clipboard access can be refused; the link is on screen and
            // selectable either way, so there is nothing useful to report.
            setCopied(false);
        }
    };

    return (
        <Screen>
            <Card pad="gutter">
                <div className="flex items-center gap-2 pb-5 mb-1 border-b border-border">
                    <UserPlus size={18} className="text-accent" aria-hidden="true" />
                    <h2 className="text-title font-semibold text-text">Members</h2>
                    {members?.length ? (
                        <span className="text-meta text-faint">{members.length}</span>
                    ) : null}
                </div>

                {isLoading ? (
                    <LoadingBlock text="Loading members..." size="sm" />
                ) : error ? (
                    <Note tone="neg" className="mt-4 mb-1">{describeError(error)}</Note>
                ) : !members?.length ? (
                    /* Previously a memberless group rendered the header over an
                       empty ul, which reads as a failed load rather than an
                       empty group. The action points at the invite form below,
                       which is the only way to get out of this state. */
                    <EmptyState
                        icon={<UserPlus size={24} strokeWidth={1.75} aria-hidden="true" />}
                        title="No members yet"
                    >
                        This group has nobody in it. Use the form below to invite someone.
                    </EmptyState>
                ) : (
                    <ul>
                        {members?.map((membership) => {
                            const name = membership.user.name || membership.user.email;
                            const isYou = membership.user.id === currentUserId;
                            return (
                                <li
                                    key={membership.id}
                                    className="flex items-center gap-3 min-h-row border-b border-border last:border-0"
                                >
                                    <Avatar name={name} size="lg" />
                                    <span className="flex-1 min-w-0">
                                        <span className="block text-body font-semibold text-text truncate">
                                            {name}
                                            {isYou ? (
                                                <span className="text-meta text-faint font-normal">
                                                    {' '}
                                                    (you)
                                                </span>
                                            ) : null}
                                        </span>
                                        <span className="block text-meta text-faint truncate">
                                            {membership.user.email}
                                        </span>
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </Card>

            <Card pad="gutter">
                <div className="flex items-center gap-2 pb-5 mb-4 border-b border-border">
                    <UserPlus size={18} className="text-accent" aria-hidden="true" />
                    <h2 className="text-title font-semibold text-text">Invite someone new</h2>
                </div>

                <form onSubmit={handleInvite} className="flex flex-col gap-4">
                    {inviteError && <Note tone="neg">{inviteError}</Note>}
                    <Field
                        type="email"
                        label="Email address"
                        placeholder="friend@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                    <Button type="submit" disabled={isInviting}>
                        {isInviting ? 'Working...' : 'Get invite link'}
                    </Button>
                </form>

                {inviteToken ? (
                    <div className="mt-5 p-4 bg-accent-soft border border-accent/30 rounded-control">
                        <div className="flex items-center justify-between gap-3 mb-2">
                            <p className="text-body font-semibold text-text">
                                Invite link ready
                            </p>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={copyLink}
                                aria-label="Copy invite link"
                            >
                                {copied ? (
                                    <Check size={15} strokeWidth={2} aria-hidden="true" />
                                ) : (
                                    <Copy size={15} strokeWidth={2} aria-hidden="true" />
                                )}
                                {copied ? 'Copied' : 'Copy'}
                            </Button>
                        </div>
                        <input
                            type="text"
                            readOnly
                            value={`${window.location.origin}/accept-invite/${inviteToken}`}
                            onFocus={(e) => e.target.select()}
                            className="w-full bg-surface border border-border rounded-control px-3 py-2 text-meta font-mono text-accent select-all"
                        />
                        <p className="text-meta text-faint mt-2">
                            Share this link with them. It only works for the address you entered.
                        </p>
                    </div>
                ) : null}
            </Card>
        </Screen>
    );
};

export default MembersTab;
