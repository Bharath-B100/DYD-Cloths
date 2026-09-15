// src/config/firebase.js - Modular Firebase configuration
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const FIREBASE_HOSTED_AUTH_DOMAIN = 'tshirtbusiness-bac1a.firebaseapp.com';
const isLocalhost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);

// Set VITE_FIREBASE_AUTH_DOMAIN for each deployed site. It must be the same
// public host that serves the app and proxies /__/auth to Firebase. Keeping
// Firebase's hosted domain locally avoids HTTPS/proxy issues during Vite dev.
const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim()
    || (isLocalhost ? FIREBASE_HOSTED_AUTH_DOMAIN : window.location.hostname);

const FIREBASE_CONFIG = {
    apiKey: "AIzaSyD3db2yC0MkxwtWAGcFs4PHC8fA6Hx52ro",
    authDomain,
    projectId: "tshirtbusiness-bac1a",
    storageBucket: "tshirtbusiness-bac1a.firebasestorage.app",
    messagingSenderId: "385040815590",
    appId: "1:385040815590:web:acd4cc29e2cbe62b0c3227",
    measurementId: "G-B6QD1WZ8WW"
};

const app = initializeApp(FIREBASE_CONFIG);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');
googleProvider.setCustomParameters({ prompt: 'select_account' });
export default app;
