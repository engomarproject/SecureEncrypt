import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { auth } from '../services/firebase';
import api from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user,           setUser]           = useState(null);
  const [isAdmin,        setIsAdmin]        = useState(false);
  const [loading,        setLoading]        = useState(true);
  const [adminLoading,   setAdminLoading]   = useState(false);
  const [error,          setError]          = useState(null);

  // ── جلب حالة الأدمن ────────────────────────────────────────────────
  const fetchAdminStatus = async (currentUser) => {
    setAdminLoading(true);
    try {
      // ✅ true = اجبر تجديد الـ token دايماً
      const token = await currentUser.getIdToken(true);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      localStorage.setItem('idToken', token);

      const res          = await api.get('/user/profile');
      const isAdminValue = res.data?.data?.user?.is_admin === true;
      setIsAdmin(isAdminValue);
      return isAdminValue;
    } catch (err) {
      console.error('fetchAdminStatus error:', err.message);
      setIsAdmin(false);
      return false;
    } finally {
      setAdminLoading(false);
    }
  };

  // ── مراقبة Firebase Auth ────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      try {
        if (currentUser) {
          setUser(currentUser);
          await fetchAdminStatus(currentUser);
        } else {
          setUser(null);
          setIsAdmin(false);
          setAdminLoading(false);
          localStorage.removeItem('idToken');
          delete api.defaults.headers.common['Authorization'];
        }
      } catch (err) {
        console.error('Auth State Error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // ── تحديث التوكن كل 50 دقيقة ──────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(async () => {
      try {
        // ✅ true = اجبر تجديد الـ token
        const token = await user.getIdToken(true);
        localStorage.setItem('idToken', token);
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      } catch (err) {
        console.error('Token refresh error:', err);
      }
    }, 50 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user]);

  // ── Login ──────────────────────────────────────────────────────────
  const login = async (email, password) => {
    try {
      setError(null);
      const credential = await signInWithEmailAndPassword(auth, email, password);
      return credential.user;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // ── Register ───────────────────────────────────────────────────────
  const register = async (email, password, fullName) => {
    try {
      setError(null);
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(credential.user, { displayName: fullName });

      // ✅ نجيب token جديد بعد إنشاء الحساب
      const token = await credential.user.getIdToken(true);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      localStorage.setItem('idToken', token);

      await api.post('/signup', {
        email,
        fullName,
        uid: credential.user.uid,
      });
      return credential.user;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // ── Logout ─────────────────────────────────────────────────────────
  const logout = async () => {
    try {
      setError(null);
      await signOut(auth);
      setUser(null);
      setIsAdmin(false);
      localStorage.removeItem('idToken');
      delete api.defaults.headers.common['Authorization'];
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const value = {
    user,
    isAdmin,
    loading:            loading || adminLoading,
    error,
    login,
    register,
    logout,
    isAuthenticated:    !!user,
    refreshAdminStatus: () => user && fetchAdminStatus(user),
  };

  return (
    <AuthContext.Provider value={value}>
      {(!loading && !adminLoading) && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export default AuthContext;