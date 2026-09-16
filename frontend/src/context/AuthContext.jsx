// src/context/AuthContext.jsx - React Authentication Context Provider
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { auth, googleProvider } from '../config/firebase';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import API from '../config/api';

const AuthContext = createContext(null);

const getStoredUser = () => {
    const saved = localStorage.getItem('user');
    if (!saved || saved === 'undefined') return null;

    try {
        return JSON.parse(saved);
    } catch (error) {
        console.warn('[AuthContext] Ignoring invalid stored user data:', error);
        localStorage.removeItem('user');
        return null;
    }
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(getStoredUser);
    const [token, setToken] = useState(() => localStorage.getItem('token') || null);
    const [loading, setLoading] = useState(true);
    const [settings, setSettings] = useState(null);
    const googleExchangeRef = useRef(null);
    const exchangedFirebaseUserRef = useRef(null);

    const setSession = useCallback((jwtToken, userData) => {
        localStorage.setItem('token', jwtToken);
        localStorage.setItem('user', JSON.stringify(userData));
        setToken(jwtToken);
        setUser(userData);
    }, []);

    const logoutLocal = useCallback(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
    }, []);

    // Redirect completion and the Firebase observer can report the same user.
    // Reuse an active exchange so they cannot create duplicate backend logins.
    const loginWithGoogleToken = useCallback((idToken) => {
        if (!idToken) {
            return Promise.reject(new Error('Missing Firebase ID token'));
        }

        const activeExchange = googleExchangeRef.current;
        if (activeExchange?.idToken === idToken) {
            return activeExchange.promise;
        }

        const exchangePromise = (async () => {
            const res = await API.post('/auth/google-login', { idToken });
            if (res.success && res.token && res.data?.user) {
                setSession(res.token, res.data.user);
                return { success: true };
            }
            throw new Error('Invalid response from server');
        })();

        googleExchangeRef.current = { idToken, promise: exchangePromise };
        const clearExchange = () => {
            if (googleExchangeRef.current?.promise === exchangePromise) {
                googleExchangeRef.current = null;
            }
        };
        exchangePromise.then(clearExchange, clearExchange);

        return exchangePromise;
    }, [setSession]);

    const restoreFirebaseSession = useCallback(async (firebaseUser, { force = false } = {}) => {
        if (!firebaseUser) return false;
        if (!force && localStorage.getItem('token')) return true;
        if (!force && exchangedFirebaseUserRef.current === firebaseUser.uid) return true;

        const idToken = await firebaseUser.getIdToken();
        const result = await loginWithGoogleToken(idToken);
        if (result.success) {
            exchangedFirebaseUserRef.current = firebaseUser.uid;
        }
        return result.success;
    }, [loginWithGoogleToken]);

    const restoreBackendSession = useCallback(async () => {
        const storedToken = localStorage.getItem('token');
        if (!storedToken) {
            logoutLocal();
            return false;
        }

        try {
            const res = await API.get('/auth/me');
            if (res.success && res.data?.user) {
                setUser(res.data.user);
                setToken(storedToken);
                localStorage.setItem('user', JSON.stringify(res.data.user));
                return true;
            }

            // A successful but malformed response is not a transient outage.
            logoutLocal();
        } catch (error) {
            // API emits auth-unauthorized and clears storage on a JSON 401.
            // Keep the session for network/5xx failures so a temporary outage
            // does not log a customer out locally.
            if (!localStorage.getItem('token')) {
                logoutLocal();
            } else {
                console.warn('[AuthContext] Session verification failed; retaining local session:', error);
            }
        }

        return false;
    }, [logoutLocal]);

    useEffect(() => {
        let cancelled = false;
        let unsubscribe = () => {};

        const handleUnauthorized = () => {
            logoutLocal();
        };
        window.addEventListener('auth-unauthorized', handleUnauthorized);

        const loadSettings = async () => {
            try {
                const settingsRes = await API.get('/settings');
                if (!cancelled && settingsRes.success && settingsRes.data) {
                    setSettings(settingsRes.data);
                    window.SiteSettings = settingsRes.data;
                }
            } catch (error) {
                console.error('Failed to load settings:', error);
            }
        };

        const initializeAuth = async () => {
            // Restore existing backend session on load (no redirect result to handle)
            await restoreBackendSession();

            if (cancelled) return;

            unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
                if (cancelled || !firebaseUser || localStorage.getItem('token')) return;

                try {
                    await restoreFirebaseSession(firebaseUser);
                } catch (error) {
                    console.error('[AuthContext] Firebase session restore failed:', error);
                }
            });

            if (!cancelled) {
                setLoading(false);
            }
        };

        void initializeAuth();
        void loadSettings();

        return () => {
            cancelled = true;
            unsubscribe();
            window.removeEventListener('auth-unauthorized', handleUnauthorized);
        };
    }, [logoutLocal, restoreBackendSession, restoreFirebaseSession]);

    const loginWithGoogleRedirect = async () => {
        // Use popup — works on localhost + all origins without redirect callback setup.
        const result = await signInWithPopup(auth, googleProvider);
        const firebaseUser = result.user;
        // Exchange the fresh Firebase token for a backend JWT immediately.
        await restoreFirebaseSession(firebaseUser, { force: true });
        return { success: true };
    };

    const login = async (email, password) => {
        const res = await API.post('/auth/login', { email, password });
        const userData = res.data?.user || res.user;
        if (res.success && res.token && userData) {
            setSession(res.token, userData);
            return { success: true };
        }
        throw new Error(res.message || 'Login failed');
    };

    const register = async (userData) => {
        const res = await API.post('/auth/register', userData);
        const registeredUser = res.data?.user || res.user;
        if (res.success && res.token && registeredUser) {
            setSession(res.token, registeredUser);
            return { success: true, message: res.message };
        }
        throw new Error(res.message || 'Registration failed');
    };

    const updateProfile = async (updates) => {
        const res = await API.put('/auth/update-profile', updates);
        if (res.success && res.data?.user) {
            setUser(res.data.user);
            localStorage.setItem('user', JSON.stringify(res.data.user));
            return { success: true };
        }
        throw new Error(res.message || 'Failed to update profile');
    };

    const logout = async () => {
        exchangedFirebaseUserRef.current = null;
        try {
            await API.post('/auth/logout');
        } catch (err) {
            console.warn('Backend logout failed, continuing local logout:', err);
        }
        await signOut(auth).catch(() => {});
        logoutLocal();
    };

    const isAdmin = () => user?.role === 'admin';

    return (
        <AuthContext.Provider value={{
            user,
            token,
            loading,
            settings,
            setSettings,
            loginWithGoogleRedirect,
            login,
            register,
            logout,
            updateProfile,
            refreshUser: restoreBackendSession,
            acceptSession: setSession,
            isAdmin,
            isLoggedIn: !!user
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
