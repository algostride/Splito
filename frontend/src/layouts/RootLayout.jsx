import React from 'react';
import { Outlet } from 'react-router-dom';

const RootLayout = () => {
    return (
        <div className="bg-gray-50 min-h-screen">
            <Outlet />
        </div>
    );
};

export default RootLayout;
