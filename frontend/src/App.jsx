import { Link, RouterProvider, createBrowserRouter } from 'react-router-dom';
import RootLayout from './layouts/RootLayout';
import ProtectedLayout from './layouts/ProtectedLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import GroupDetail from './pages/GroupDetail';
import BillsTab from './pages/group/BillsTab';
import BalancesTab from './pages/group/BalancesTab';
import SettlementsTab from './pages/group/SettlementsTab';
import MembersTab from './pages/group/MembersTab';
import AddBill from './pages/AddBill';
import BillDetail from './pages/BillDetail';
import AcceptInvite from './pages/AcceptInvite';

const NotFound = () => (
  <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
    <h1 className="text-6xl font-black text-text mb-4">404</h1>
    <p className="text-muted font-medium mb-6">Page not found</p>
    {/* A router link, not an <a href>: a plain anchor is a full page reload,
        which throws away the app and re-hydrates from scratch. */}
    <Link to="/" className="text-accent font-bold hover:text-accent-ink">Go to Dashboard</Link>
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
            // Bill sub-routes are siblings of `groups/:id`, not children, so
            // they render without the group header and tab bar. React Router
            // ranks the fully-matching leaf above the layout, which only
            // matches when one of its own children continues the path.
            { path: 'groups/:id/add-bill', element: <AddBill /> },
            { path: 'groups/:id/bills/:billId', element: <BillDetail /> },
            { path: 'groups/:id/bills/:billId/edit', element: <AddBill /> },
            {
              path: 'groups/:id',
              element: <GroupDetail />,
              children: [
                // Bills is the index route, so the first tab needs no segment.
                // This is what makes the tabs linkable and reload-safe, which
                // the old local `useState` tab was not.
                { index: true, element: <BillsTab /> },
                { path: 'balances', element: <BalancesTab /> },
                { path: 'settlements', element: <SettlementsTab /> },
                { path: 'members', element: <MembersTab /> },
                // Otherwise /groups/<id>/nonsense matches the layout, renders
                // the header and tab bar, and then an empty outlet.
                { path: '*', element: <NotFound /> },
              ],
            },
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
