import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Check, X } from 'lucide-react';
import { useAcceptInviteMutation } from '../store/groupsApi';
import Screen from '../components/shell/Screen';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import { LoadingBlock } from '../components/ui/Spinner';
import { buttonClass } from '../components/ui/styles';

const AcceptInvite = () => {
    const { token } = useParams();
    const navigate = useNavigate();
    const [acceptInvite] = useAcceptInviteMutation();
    const [status, setStatus] = useState('loading'); // loading, success, error
    const [message, setMessage] = useState('Verifying your invite link...');

    /* A tokenless URL is handled here rather than by setting state in the
       effect, for two reasons. React's set-state-in-effect rule objects to the
       synchronous call, and it is genuinely a different condition rather than an
       outcome: nothing was attempted, so there is no async result to store. It
       is also correct when the token appears or disappears while mounted, which
       *useParams can do without a remount -- a state initialiser would miss
       that. Previously this left `status` at 'loading' forever, so the page was
       a spinner that never resolved and never explained itself. */
    const missingToken = !token;

    useEffect(() => {
        // The delayed redirect has to be cancellable. Left running, a logout
        // or a manual click inside those 2.5s got undone by navigate('/')
        // firing afterwards and throwing the user back out of the app.
        let redirectTimer = null;

        const processInvite = async () => {
            try {
                await acceptInvite(token).unwrap();
                setStatus('success');
                setMessage('Successfully joined the group!');
                // Pause briefly so the user sees the success message
                redirectTimer = setTimeout(() => {
                    navigate('/');
                }, 2500);
            } catch (err) {
                setStatus('error');
                setMessage(err?.data?.error || 'Invalid or expired invite token. You might already be a member.');
            }
        };

        if (!token) return undefined;

        processInvite();

        return () => {
            if (redirectTimer) clearTimeout(redirectTimer);
        };
    }, [token, acceptInvite, navigate]);

    return (
        // This route lives under ProtectedLayout, so it renders inside the app
        // shell. It used to carry its own `min-h-screen`, which made it taller
        // than the viewport and pushed a scrollbar onto a single status card.
        // The vertical padding is on a wrapper rather than passed to Screen,
        // whose own padding would have raced it in the stylesheet.
        <Screen>
            <div className="py-12">
                <Card pad="gutter" className="max-w-md mx-auto">
                    {missingToken && (
                        <EmptyState
                            tone="neg"
                            icon={<X size={28} strokeWidth={2.5} aria-hidden="true" />}
                            title="Invite Link Incomplete"
                            action={
                                <Link to="/" className={buttonClass({ className: 'mt-2' })}>
                                    Go to Dashboard
                                </Link>
                            }
                        >
                            This link is missing its invite token. Ask whoever invited you to send
                            it again.
                        </EmptyState>
                    )}

                    {!missingToken && status === 'loading' && (
                        <LoadingBlock text={message} size="lg" />
                    )}

                    {!missingToken && status === 'success' && (
                        <EmptyState
                            tone="pos"
                            icon={<Check size={28} strokeWidth={2.5} aria-hidden="true" />}
                            title="You're In!"
                        >
                            {message} Taking you to your dashboard...
                        </EmptyState>
                    )}

                    {!missingToken && status === 'error' && (
                        <EmptyState
                            tone="neg"
                            icon={<X size={28} strokeWidth={2.5} aria-hidden="true" />}
                            title="Join Failed"
                            action={
                                <Link to="/" className={buttonClass({ className: 'mt-2' })}>
                                    Go to Dashboard
                                </Link>
                            }
                        >
                            {message}
                        </EmptyState>
                    )}
                </Card>
            </div>
        </Screen>
    );
};

export default AcceptInvite;
