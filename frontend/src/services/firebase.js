/**
 * ============================================
 * مشروع أداة التشفير وفك التشفير الآمنة
 * الطالب: عمر حمدي عبد العزيز - 22510462
 * الملف: firebase.js - إعدادات ربط Firebase (Frontend)
 * ============================================
 */

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAnalytics } from 'firebase/analytics';

// ============================================
// إعدادات Firebase Web App
// ============================================
const firebaseConfig = {
  apiKey: "AIzaSyBCwEfp2-DWRyDaBVTLZzCPKa7SKW2PjKo",
  authDomain: "omar-encryption-project-87055.firebaseapp.com",
  projectId: "omar-encryption-project-87055",
  storageBucket: "omar-encryption-project-87055.firebasestorage.app",
  messagingSenderId: "946263866066",
  appId: "1:946263866066:web:d3127ed2661c635cf60b0b",
  measurementId: "G-8VGB9ZBG6P"
};

// ============================================
// تهيئة تطبيق Firebase
// ============================================
const app = initializeApp(firebaseConfig);

// ============================================
// تصدير خدمات Firebase
// ============================================
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

let analytics;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}
export { analytics };

export default app;