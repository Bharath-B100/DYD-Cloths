// firebase-auth.js - Google Sign-In using Firebase Compat SDK
// Uses the compat layer (v8-style API) which works correctly on localhost
// without COOP/COEP header conflicts

(function () {
    'use strict';

    const FIREBASE_CONFIG = {
        apiKey: "AIzaSyD3db2yC0MkxwtWAGcFs4PHC8fA6Hx52ro",
        authDomain: "tshirtbusiness-bac1a.firebaseapp.com",
        projectId: "tshirtbusiness-bac1a",
        storageBucket: "tshirtbusiness-bac1a.firebasestorage.app",
        messagingSenderId: "385040815590",
        appId: "1:385040815590:web:acd4cc29e2cbe62b0c3227",
        measurementId: "G-B6QD1WZ8WW"
    };

    let auth = null;
    let provider = null;
    let initialized = false;

    // Load Firebase compat SDK scripts dynamically, then init
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }
            const s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = () => reject(new Error('Failed to load: ' + src));
            document.head.appendChild(s);
        });
    }

    async function initFirebase() {
        if (initialized) return true;
        try {
            await loadScript('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
            await loadScript('https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js');

            if (!firebase.apps.length) {
                firebase.initializeApp(FIREBASE_CONFIG);
            }

            auth = firebase.auth();
            provider = new firebase.auth.GoogleAuthProvider();
            provider.addScope('email');
            provider.addScope('profile');
            provider.setCustomParameters({ prompt: 'select_account' });

            initialized = true;
            console.log('[FirebaseAuth] Initialized successfully.');

            // Listen for redirect login result after page load
            window.addEventListener('DOMContentLoaded', () => {
                auth.getRedirectResult().then(async (result) => {
                    if (result && result.user) {
                        const idToken = await result.user.getIdToken();
                        console.log('[FirebaseAuth] Redirect sign-in result retrieved successfully:', result.user.email);
                        if (window.Utils && window.Utils.showToast) {
                            window.Utils.showToast('Google Sign-In successful. Logging in...', 'success');
                        }
                        if (window.AuthManager && window.AuthManager.loginWithGoogle) {
                            await window.AuthManager.loginWithGoogle(idToken);
                        }
                    }
                }).catch((error) => {
                    console.error('[FirebaseAuth] getRedirectResult error:', error.code, error.message);
                    if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
                        if (window.Utils && window.Utils.showToast) {
                            window.Utils.showToast('Google login failed: ' + error.message, 'error');
                        }
                    }
                });
            });

            return true;
        } catch (err) {
            console.error('[FirebaseAuth] Initialization failed:', err);
            return false;
        }
    }

    // Sign in with Google redirect
    async function signInWithGoogle() {
        const ready = await initFirebase();
        if (!ready) {
            return { success: false, error: 'Firebase failed to load. Check your internet connection.' };
        }

        try {
            console.log('[FirebaseAuth] Initiating Redirect Sign-In...');
            await auth.signInWithRedirect(provider);
            return { success: true, redirecting: true };
        } catch (error) {
            console.error('[FirebaseAuth] Redirect sign-in error:', error.code, error.message);
            return { success: false, error: error.message, code: error.code };
        }
    }

    // Expose on window for auth.js to use
    window.firebaseAuth = {
        signInWithGoogle
    };

    // Automatically initialize Firebase on load to intercept redirect results
    initFirebase();

    console.log('[FirebaseAuth] Module loaded, window.firebaseAuth set.');
})();
