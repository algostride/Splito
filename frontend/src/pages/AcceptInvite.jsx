import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAcceptInviteMutation } from '../store/groupsApi';

const AcceptInvite = () => {
    const { token } = useParams();
    const navigate = useNavigate();
    const [acceptInvite] = useAcceptInviteMutation();
    const [status, setStatus] = useState('loading'); // loading, success, error
    const [message, setMessage] = useState('Verifying your invite link...');

    useEffect(() => {
        const processInvite = async () => {
            try {
                await acceptInvite(token).unwrap();
                setStatus('success');
                setMessage('Successfully joined the group!');
                // Pause briefly so the user sees the success message
                setTimeout(() => {
                    navigate('/');
                }, 2500);
            } catch (err) {
                setStatus('error');
                setMessage(err?.data?.error || 'Invalid or expired invite token. You might already be a member.');
            }
        };

        if (token) {
            processInvite();
        }
    }, [token, acceptInvite, navigate]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full bg-white shadow-xl rounded-2xl p-8 text-center border border-gray-100">

                {status === 'loading' && (
                    <div className="flex flex-col items-center space-y-6">
                        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        <h2 className="text-xl font-semibold text-gray-800">Joining Group...</h2>
                        <p className="text-gray-500 font-medium">{message}</p>
                    </div>
                )}

                {status === 'success' && (
                    <div className="flex flex-col items-center space-y-6 animate-fade-in-up">
                        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center shadow-inner">
                            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path></svg>
                        </div>
                        <h2 className="text-3xl font-extrabold text-gray-900">You're In!</h2>
                        <p className="text-lg text-green-600 font-medium">{message}</p>
                        <p className="text-sm text-gray-400">Taking you to your dashboard...</p>
                    </div>
                )}

                {status === 'error' && (
                    <div className="flex flex-col items-center space-y-6">
                        <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center shadow-inner">
                            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </div>
                        <h2 className="text-3xl font-extrabold text-gray-900">Join Failed</h2>
                        <p className="text-red-500 font-medium">{message}</p>
                        <Link to="/" className="mt-6 w-full inline-flex justify-center items-center px-4 py-3 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all">
                            Go to Dashboard
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AcceptInvite;
