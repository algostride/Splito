import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import AppShell from '../components/shell/AppShell';

/**
 * Auth gate plus the app chrome. The `state.from` carry is load-bearing: an
 * `/accept-invite/<token>` link opened while logged out has to survive the
 * trip through /login, otherwise the token is lost.
 */
const ProtectedLayout = () => {
  const token = useSelector((state) => state.auth.token);
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <AppShell />;
};

export default ProtectedLayout;
