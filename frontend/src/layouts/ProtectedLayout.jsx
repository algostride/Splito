import { Outlet, Navigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { logoutAndReset } from '../store';

const ProtectedLayout = () => {
    const token = useSelector((state) => state.auth.token);
    const dispatch = useDispatch();

    if (!token) {
        return <Navigate to="/login" replace />;
    }

    return (
        <div className="min-h-screen flex flex-col">
            <nav className="bg-blue-600 text-white p-4 flex justify-between">
                <h1 className="text-xl font-bold">Splito</h1>
                <button
                    onClick={() => dispatch(logoutAndReset())}
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
