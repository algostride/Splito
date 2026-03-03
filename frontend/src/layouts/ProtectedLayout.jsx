import React, { useEffect } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { logout } from '../store/authSlice';
import { api } from '../store/api';

const ProtectedLayout = () => {
    const token = useSelector((state) => state.auth.token);
    const dispatch = useDispatch();

    // Basic interceptor handling for 401s (a more robust approach would be at the axios/rtk-query level)
    // We handle it in RTK query by checking responses or just clearing token on unauthorized.

    if (!token) {
        return <Navigate to="/login" replace />;
    }

    return (
        <div className="min-h-screen flex flex-col">
            <nav className="bg-blue-600 text-white p-4 flex justify-between">
                <h1 className="text-xl font-bold">Splito</h1>
                <button
                    onClick={() => dispatch(logout())}
                    className="bg-blue-500 px-4 py-2 rounded hover:bg-blue-700"
                >
                    Logout
                </button>
            </nav>
            <main className="flex-1 p-4">
                <Outlet />
            </main>
        </div>
    );
};

export default ProtectedLayout;
