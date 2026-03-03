import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { useLoginMutation } from '../store/authApi';
import { setCredentials } from '../store/authSlice';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [login, { isLoading, error }] = useLoginMutation();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const { access, refresh } = await login({ email, password }).unwrap();
            dispatch(setCredentials({ user: { email }, token: access }));
            localStorage.setItem('refresh_token', refresh);
            navigate('/');
        } catch (err) {
            console.error('Failed to log in', err);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
            <div className="w-full max-w-md p-8 bg-white rounded-xl shadow-lg text-center">
                <h2 className="text-3xl font-extrabold text-blue-900 mb-6 tracking-tight">Login to Splito</h2>
                {error && <p className="text-red-500 mb-4 text-sm font-medium">Login failed. Please check your credentials.</p>}
                <form onSubmit={handleSubmit} className="space-y-5">
                    <input
                        type="email"
                        placeholder="Email Address"
                        required
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                    <input
                        type="password"
                        placeholder="Password"
                        required
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg shadow-md hover:bg-blue-700 hover:shadow-lg focus:ring-4 focus:ring-blue-300 transition-all disabled:opacity-50"
                    >
                        {isLoading ? 'Logging in...' : 'Sign In'}
                    </button>
                </form>
                <p className="mt-6 text-gray-600">
                    Don't have an account? <Link to="/register" className="text-blue-600 font-semibold hover:underline">Register</Link>
                </p>
            </div>
        </div>
    );
};

export default Login;
