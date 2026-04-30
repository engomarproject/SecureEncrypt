import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute, { PublicRouteOnly, AdminRoute, UserOnlyRoute } from './components/ProtectedRoute';
import Home            from './pages/Home';
import Login           from './pages/Login';
import Register        from './pages/Register';
import Dashboard       from './pages/Dashboard';
import FirstKeyDisplay from './pages/FirstKeyDisplay';
import AdminDashboard  from './pages/AdminDashboard';
import Profile         from './pages/Profile';
import Omar            from './pages/omar';
import './App.css';

const AppLoading = () => (
  <div className="app-loading">
    <div className="loading-spinner"></div>
    <h2>Loading Application...</h2>
    <p>Please wait a moment</p>
  </div>
);

const AppContent = () => {
  const { loading } = useAuth();
  if (loading) return <AppLoading />;

  return (
    <Layout>
      <Routes>
        {/* الصفحة الرئيسية متاحة للجميع */}
        <Route path="/"         element={<Home />} />
        <Route path="/login"    element={<PublicRouteOnly><Login /></PublicRouteOnly>} />
        <Route path="/register" element={<PublicRouteOnly><Register /></PublicRouteOnly>} />

        {/* صفحة تعليمية عامة متاحة للجميع */}
        <Route path="/omar" element={<Omar />} />

        {/* first-key — بعد التسجيل مباشرة */}
        <Route path="/first-key" element={<ProtectedRoute><FirstKeyDisplay /></ProtectedRoute>} />

        {/* dashboard — مستخدمين عاديين فقط */}
        <Route path="/dashboard" element={<UserOnlyRoute><Dashboard /></UserOnlyRoute>} />

        {/* profile — متاح للجميع (أدمن + مستخدم عادي) عشان كل واحد يشوف بروفايله */}
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

        {/* admin — أدمن فقط */}
        <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
};

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/*" element={<AppContent />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;