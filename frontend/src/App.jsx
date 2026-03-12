import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import RootLayout from './layouts/RootLayout';
import ProtectedLayout from './layouts/ProtectedLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import GroupDetail from './pages/GroupDetail';
import AddBill from './pages/AddBill';
import AcceptInvite from './pages/AcceptInvite';

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
          { path: 'accept-invite/:token', element: <AcceptInvite /> },
        ]
      },
      { path: 'login', element: <Login /> },
      { path: 'register', element: <Register /> },
    ]
  }
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
