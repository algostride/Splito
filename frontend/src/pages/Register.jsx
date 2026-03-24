import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useRegisterMutation } from '../store/authApi';
import { setCredentials } from '../store/authSlice';
import { UserPlus, Mail, Lock, User, Sparkles } from 'lucide-react';

const Register = () => {
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [register, { isLoading }] = useRegisterMutation();
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const userData = await register({ email, name, password }).unwrap();
            dispatch(setCredentials(userData));
            navigate('/');
        } catch (err) {
            console.error('Failed to register', err);
            alert('Registration failed. Please check your data.');
        }
    };

    return (
        <div className="min-h-[80vh] flex flex-col justify-center py-12 px-6 lg:px-8 animate-fade-in-up">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="w-20 h-20 bg-blue-600 text-white rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-blue-200 mb-6">
                    <UserPlus size={40} />
                </div>
                <h2 className="text-center text-4xl font-black text-gray-900 tracking-tight">Join Splito</h2>
                <p className="mt-2 text-center text-sm text-gray-500 font-medium">Start sharing and splitting bills easily.</p>
            </div>

            <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-10 px-10 shadow-2xl shadow-blue-900/5 rounded-3xl border border-gray-100">
                    <form className="space-y-6" onSubmit={handleSubmit}>
                        <div className="space-y-1">
                            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Full Name</label>
                            <div className="relative mt-2">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full bg-gray-50 border-gray-200 border rounded-2xl pl-12 pr-4 py-4 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-bold text-gray-900"
                                    placeholder="Jane Doe"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Email address</label>
                            <div className="relative mt-2">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-gray-50 border-gray-200 border rounded-2xl pl-12 pr-4 py-4 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-bold text-gray-900"
                                    placeholder="name@example.com"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Password</label>
                            <div className="relative mt-2">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-gray-50 border-gray-200 border rounded-2xl pl-12 pr-4 py-4 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-bold text-gray-900"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full flex justify-center py-4 px-4 border border-transparent rounded-2xl shadow-xl shadow-blue-600/20 text-lg font-black text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 transition-all disabled:opacity-50"
                            >
                                {isLoading ? 'Creating account...' : 'Create Account'}
                            </button>
                        </div>
                    </form>

                    <div className="mt-8 text-center divide-y divide-gray-100">
                        <div className="pt-6">
                            <p className="text-sm text-gray-500 font-medium">
                                Already have an account?{' '}
                                <Link to="/login" className="font-bold text-blue-600 hover:text-blue-500 flex items-center justify-center mt-2 group">
                                    Sign in instead
                                    <Sparkles size={16} className="ml-1 group-hover:scale-125 transition-transform" />
                                </Link>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Register;
