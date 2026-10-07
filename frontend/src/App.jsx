import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Films from './pages/Films';
import Inventory from './pages/Inventory';
import Retail from './pages/Retail';
import Profile from './pages/Profile';
import DeliveryGallery from './pages/DeliveryGallery';
import Repairs from './pages/Repairs';
import RepairConfirm from './pages/RepairConfirm';

function PrivateRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[var(--color-label-secondary)] text-[15px]">
        Đang tải...
      </div>
    );
  }
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/delivery/:slug" element={<DeliveryGallery />} />
      <Route path="/repair/confirm/:token" element={<RepairConfirm />} />
      <Route
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="customers" element={<Customers />} />
        <Route path="films" element={<Films />} />
        <Route path="repairs" element={<Repairs />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="retail" element={<Retail />} />
        <Route path="profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
