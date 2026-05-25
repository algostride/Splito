import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import RootLayout from './layouts/RootLayout';
import ProtectedLayout from './layouts/ProtectedLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import GroupDetail from './pages/GroupDetail';
import AddBill from './pages/AddBill';
import BillDetail from './pages/BillDetail';
import AcceptInvite from './pages/AcceptInvite';

const NotFound = () => (
  <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
    <h1 className="text-6xl font-black text-gray-900 mb-4">404</h1>
    <p className="text-gray-500 font-medium mb-6">Page not found</p>
    <a href="/" className="text-blue-600 font-bold hover:text-blue-800">Go to Dashboard</a>
  </div>
);

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      {
        path: '',
        element: <ProtectedLayout />,
        children: [
          { index: true, element: <Dashboard /> },
          { path: 'groups/:id', element: <GroupDetail /> },
          { path: 'groups/:id/add-bill', element: <AddBill /> },
          { path: 'groups/:id/bills/:billId', element: <BillDetail /> },
          { path: 'accept-invite/:token', element: <AcceptInvite /> },
        ]
      },
      { path: 'login', element: <Login /> },
      { path: 'register', element: <Register /> },
      { path: '*', element: <NotFound /> },
    ]
  }
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
