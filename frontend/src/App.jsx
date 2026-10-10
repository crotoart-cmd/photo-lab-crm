import { useEffect } from 'react';
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
import PublicHome from './pages/PublicHome';
import PublicFilm from './pages/PublicFilm';
import PublicRepair from './pages/PublicRepair';
import PublicContact from './pages/PublicContact';
import PublicSpeed from './pages/PublicSpeed';
import PublicPrint from './pages/PublicPrint';
import PublicScan from './pages/PublicScan';
import PublicAccessories from './pages/PublicAccessories';
import PublicBlog from './pages/PublicBlog';
import PublicFaq from './pages/PublicFaq';
import PublicShell from './components/public/PublicShell';
import { adminAbsoluteUrl, isCrmHost } from './config/siteHosts';

function AdminRedirect() {
  useEffect(() => {
    window.location.replace(adminAbsoluteUrl(`${window.location.pathname}${window.location.search}`));
  }, []);
  return (
    <div className="min-h-screen flex items-center justify-center text-[var(--color-label-secondary)] text-[15px]">
      Đang chuyển tới trang quản lý…
    </div>
  );
}

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
  if (!isCrmHost()) {
    return (
      <Routes>
        <Route element={<PublicShell />}>
          <Route path="/" element={<PublicHome />} />
          <Route path="/film" element={<PublicFilm />} />
          <Route path="/toc-do" element={<PublicSpeed />} />
          <Route path="/in-analog" element={<PublicPrint />} />
          <Route path="/scan" element={<PublicScan />} />
          <Route path="/sua-may" element={<PublicRepair />} />
          <Route path="/phu-kien" element={<PublicAccessories />} />
          <Route path="/blog" element={<PublicBlog />} />
          <Route path="/lien-he" element={<PublicContact />} />
          <Route path="/faq" element={<PublicFaq />} />
        </Route>
        <Route path="/delivery/:slug" element={<DeliveryGallery />} />
        <Route path="/repair/confirm/:token" element={<RepairConfirm />} />
        <Route path="*" element={<AdminRedirect />} />
      </Routes>
    );
  }

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
