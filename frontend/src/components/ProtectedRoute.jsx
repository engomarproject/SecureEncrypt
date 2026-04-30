import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './ProtectedRoute.css';

// ── شاشة التحميل (Loading Screen Component) ───────────────────────
/**
 * مكون عرض شاشة التحميل أثناء التحقق من المصادقة
 * @param {Object} props - خصائص المكون
 * @param {string} props.message - رسالة التحميل للعرض
 * @returns {JSX.Element} واجهة شاشة التحميل
 */
const LoadingScreen = ({ message = 'Verifying...' }) => (
  <div className="protected-route-loading">
    <div className="loading-content">
      <div className="loading-spinner"></div>
      <h2>{message}</h2>
      <p>Please wait a moment</p>
      <div className="loading-progress">
        <div className="progress-bar"></div>
      </div>
    </div>
  </div>
);

// ── ProtectedRoute — مسار محمي يتطلب تسجيل الدخول فقط (بدون قيد رول) ───────────────
/**
 * مكون حماية المسارات: يسمح فقط للمستخدمين المسجلين بالدخول
 * إذا لم يكن المستخدم مسجلاً، يتم إعادة توجيهه لصفحة تسجيل الدخول
 * @param {Object} props - خصائص المكون
 * @param {React.ReactNode} props.children - المحتوى المحمي لعرضه
 * @returns {JSX.Element} المحتوى المحمي أو إعادة توجيه لصفحة الدخول
 */
const ProtectedRoute = ({ children }) => {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  // عرض شاشة التحميل أثناء التحقق من حالة المصادقة
  if (loading) return <LoadingScreen message="Verifying identity..." />;

  // إذا لم يكن المستخدم مسجلاً، إعادة توجيهه لصفحة الدخول مع حفظ المسار الأصلي
  if (!isAuthenticated || !user) {
    return (
      <Navigate
        to="/login"
        state={{ from: location, redirectTo: location.pathname }}
        replace
      />
    );
  }

  // عرض المحتوى المحمي إذا كان المستخدم مسجلاً
  return children;
};

// ── UserOnlyRoute — مسار للمستخدمين العاديين فقط (الأدمن يُعاد توجيهه) ───────────────────────
/**
 * مكون حماية المسارات للمستخدمين العاديين فقط
 * إذا كان المستخدم أدمن، يتم إعادة توجيهه تلقائياً لـ /admin
 * @param {Object} props - خصائص المكون
 * @param {React.ReactNode} props.children - المحتوى المحمي لعرضه
 * @returns {JSX.Element} المحتوى المحمي أو إعادة توجيه حسب الصلاحية
 */
// الأدمن يتحوّل تلقائياً لـ /admin
export const UserOnlyRoute = ({ children }) => {
  const { user, loading, isAuthenticated, isAdmin } = useAuth();
  const location = useLocation();

  // عرض شاشة التحميل أثناء التحقق من حالة المصادقة
  if (loading) return <LoadingScreen message="Verifying..." />;

  // إذا لم يكن المستخدم مسجلاً، إعادة توجيهه لصفحة الدخول
  if (!isAuthenticated || !user) {
    return (
      <Navigate
        to="/login"
        state={{ from: location, redirectTo: location.pathname }}
        replace
      />
    );
  }

  // ✅ الأدمن ما يدخلش /dashboard أو /profile — يتحوّل لـ /admin
  // إذا كان المستخدم أدمن، إعادة توجيهه للوحة تحكم الإدارة
  if (isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  // عرض المحتوى المحمي للمستخدم العادي
  return children;
};

// ── AdminRoute — مسار للأدمن فقط (المستخدم العادي يُعاد توجيهه) ────────────────────────────────────────
/**
 * مكون حماية المسارات للأدمن فقط
 * إذا كان المستخدم عادياً، يتم إعادة توجيهه تلقائياً لـ /dashboard
 * @param {Object} props - خصائص المكون
 * @param {React.ReactNode} props.children - المحتوى المحمي لعرضه
 * @returns {JSX.Element} المحتوى المحمي أو إعادة توجيه حسب الصلاحية
 */
// المستخدم العادي يتحوّل لـ /dashboard
export const AdminRoute = ({ children }) => {
  const { user, loading, isAuthenticated, isAdmin } = useAuth();
  const location = useLocation();

  // عرض شاشة التحميل أثناء التحقق من الصلاحيات
  if (loading) return <LoadingScreen message="Verifying permissions..." />;

  // إذا لم يكن المستخدم مسجلاً، إعادة توجيهه لصفحة الدخول
  if (!isAuthenticated || !user) {
    return (
      <Navigate
        to="/login"
        state={{ from: location, redirectTo: location.pathname }}
        replace
      />
    );
  }

  // ✅ مستخدم عادي يتحوّل للـ dashboard
  // إذا لم يكن المستخدم أدمن، إعادة توجيهه للوحة التحكم العادية
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  // عرض المحتوى المحمي للأدمن
  return children;
};

// ── PublicRouteOnly — مسار للصفحات العامة فقط (المسجلين يُعاد توجيههم) ──────────────────────────────
/**
 * مكون حماية الصفحات العامة: يمنع المستخدمين المسجلين من الوصول لها
 * إذا كان المستخدم مسجلاً، يتم إعادة توجيهه حسب دوره (أدمن أو مستخدم عادي)
 * @param {Object} props - خصائص المكون
 * @param {React.ReactNode} props.children - المحتوى العام لعرضه
 * @returns {JSX.Element} المحتوى العام أو إعادة توجيه للوحة التحكم المناسبة
 */
// لو مسجل → يحوّله حسب رولّه
export const PublicRouteOnly = ({ children }) => {
  const { user, loading, isAuthenticated, isAdmin } = useAuth();

  // عرض شاشة التحميل أثناء التحقق من حالة المصادقة
  if (loading) return <LoadingScreen message="Loading..." />;

  // إذا كان المستخدم مسجلاً، إعادة توجيهه للوحة التحكم المناسبة لدوره
  if (isAuthenticated && user) {
    return <Navigate to={isAdmin ? '/admin' : '/dashboard'} replace />;
  }

  // عرض المحتوى العام للمستخدمين غير المسجلين
  return children;
};

export default ProtectedRoute;