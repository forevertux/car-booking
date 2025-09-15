import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './store/authStore';
import { getAuthToken } from './config/api';

// Pages
import Login from './pages/Login';
import MainApp from './pages/MainApp';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  const { fetchUserDetails, user } = useAuthStore();

  useEffect(() => {
    if (getAuthToken() && !user) {
      fetchUserDetails();
    }
  }, [fetchUserDetails, user]);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<MainApp />} />
          <Route path="/*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
