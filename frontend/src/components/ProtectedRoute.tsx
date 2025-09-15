
import { Navigate, Outlet } from 'react-router-dom';
import { isAuthenticated } from '../config/api';

const ProtectedRoute = () => {
  return isAuthenticated() ? <Outlet /> : <Navigate to="/login" replace />;
};

export default ProtectedRoute;