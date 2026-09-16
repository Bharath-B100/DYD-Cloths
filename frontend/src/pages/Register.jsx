// src/pages/Register.jsx - User Sign-up Page
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/auth.css';
import { safeReturnPath } from '../utils/navigation';

const Register = () => {
    const { register, loginWithGoogleRedirect, isLoggedIn, loading } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const destination = safeReturnPath(searchParams.get('redirect'));

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [passwordConfirm, setPasswordConfirm] = useState('');
    const [redirecting, setRedirecting] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!loading && isLoggedIn) {
            navigate(destination, { replace: true });
        }
    }, [isLoggedIn, loading, navigate, destination]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (password !== passwordConfirm) {
            if (window.Utils?.showToast) window.Utils.showToast('Passwords do not match', 'error');
            return;
        }

        setSubmitting(true);
        try {
            const res = await register({ name, email, phone, password, passwordConfirm });
            if (res.success) {
                if (window.Utils?.showToast) window.Utils.showToast('Registered successfully! Logging in...', 'success');
                // Automatically log in the user after registration
                navigate(destination, { replace: true });
            }
        } catch (err) {
            if (window.Utils?.showToast) window.Utils.showToast(err.message || 'Registration failed', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleGoogleLogin = async () => {
        setRedirecting(true);
        try {
            await loginWithGoogleRedirect();
            if (window.Utils?.showToast) window.Utils.showToast('Signed in with Google!', 'success');
            navigate(destination, { replace: true });
        } catch (err) {
            console.error('Google sign-in failed:', err);
            const msg = err.code === 'auth/popup-closed-by-user'
                ? 'Sign-in cancelled'
                : err.message || 'Google Sign-In failed';
            if (window.Utils?.showToast) window.Utils.showToast(msg, 'error');
        } finally {
            setRedirecting(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-wrapper">
                <div className="auth-container">
                    <div className="auth-header">
                        <h2>Create Account</h2>
                        <p>Join D<span style={{ color: 'var(--primary)' }}>Y</span>D-Clothes today</p>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label htmlFor="name">Full Name</label>
                            <input 
                                type="text" 
                                id="name" 
                                placeholder="John Doe" 
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required 
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="email">Email Address</label>
                            <input 
                                type="email" 
                                id="email" 
                                placeholder="name@example.com" 
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required 
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="phone">Phone Number</label>
                            <input 
                                type="tel" 
                                id="phone" 
                                placeholder="+91 98765 43210" 
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                required 
                            />
                        </div>
                        
                        <div className="form-group">
                            <label htmlFor="password">Password</label>
                            <input 
                                type="password" 
                                id="password" 
                                placeholder="Create a password" minLength={6} 
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required 
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="passwordConfirm">Confirm Password</label>
                            <input 
                                type="password" 
                                id="passwordConfirm" 
                                placeholder="Confirm your password" 
                                value={passwordConfirm}
                                onChange={(e) => setPasswordConfirm(e.target.value)}
                                required 
                            />
                        </div>
                        
                        <button type="submit" className="btn btn-primary btn-full" disabled={submitting}>
                            {submitting ? <i className="fas fa-spinner fa-spin"></i> : 'Register'}
                        </button>
                    </form>

                    <div className="social-divider">
                        <span>or</span>
                    </div>

                    <button 
                        id="googleAuthBtn" 
                        type="button" 
                        className="social-btn google btn-full" 
                        onClick={handleGoogleLogin} 
                        disabled={redirecting}
                    >
                        {redirecting ? (
                            <>
                                <i className="fas fa-spinner fa-spin"></i>
                                <span>Redirecting...</span>
                            </>
                        ) : (
                            <>
                                <i className="fab fa-google" style={{ color: '#db4437' }}></i>
                                <span>Continue with Google</span>
                            </>
                        )}
                    </button>

                    <div className="auth-links">
                        <p>Already have an account? <Link to={`/login?redirect=${encodeURIComponent(destination)}`}>Login here</Link></p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Register;
