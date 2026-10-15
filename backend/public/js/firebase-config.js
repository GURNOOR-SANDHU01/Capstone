/**
 * Shared Firebase Client SDK Initialization Module
 * Exports: app, auth, db, analytics
 */

import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { getAnalytics, isSupported } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-analytics.js';

// Configuration from Section 2 of specification
export const firebaseConfig = {
  apiKey: window.FIREBASE_WEB_API_KEY || 'AIzaSyDemoKeySentienceApp2026SecurePlaceHolder',
  authDomain: 'sentience-6f40e.firebaseapp.com',
  projectId: 'sentience-6f40e',
  storageBucket: 'sentience-6f40e.firebasestorage.app',
  messagingSenderId: '773838901854',
  appId: '1:773838901854:web:0d735ab31ebb3709821acf',
  measurementId: 'G-TLELP51BQM'
};

// Singleton initialization to prevent duplicate-app errors
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);

// Safe conditional Analytics initialization
export let analytics = null;
if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
      console.log('Firebase Analytics initialized');
    }
  }).catch(() => {
    // Analytics optional in offline or local test environments
  });
}
