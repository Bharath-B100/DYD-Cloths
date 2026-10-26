// src/pages/Login.jsx - User Sign-in Page
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/auth.css';
import { safeReturnPath } from '../utils/navigation';

const Login = () => {
    const { login, loginWithGoogleRedirect, isLoggedIn, loading } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const destination = safeReturnPath(searchParams.get('redirect'));

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [redirecting, setRedirecting] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [verificationEmail, setVerificationEmail] = useState('');

    // If already logged in, redirect away from auth page
    useEffect(() => {
        if (!loading && isLoggedIn) {
            navigate(destination, { replace: true });
        }
    }, [isLoggedIn, loading, navigate, destination]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');
        setVerificationEmail('');

        try {
            const res = await login(email, password);
            if (res.success) {
                if (window.Utils?.showToast) window.Utils.showToast('Logged in successfully', 'success');
                navigate(destination, { replace: true });
            }
        } catch (err) {
            setError(err.message || 'Login failed. Please try again.');
            if (err.data?.code === 'EMAIL_NOT_VERIFIED') setVerificationEmail(email.trim());
        } finally {
            setSubmitting(false);
        }
    };

    const handleGoogleLogin = async () => {
        setRedirecting(true);
        setError('');
        setVerificationEmail('');
        try {
            await loginWithGoogleRedirect();
            if (window.Utils?.showToast) window.Utils.showToast('Signed in with Google!', 'success');
            navigate(destination, { replace: true });
        } catch (err) {
            console.error('Google sign-in failed:', err);
            const msg = err.code === 'auth/popup-closed-by-user'
                ? 'Sign-in cancelled'
                : err.message || 'Google Sign-In failed';
            setError(msg);
        } finally {
            setRedirecting(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-wrapper">
                <div className="auth-container">
                    <Link to="/shop" className="auth-back-link">← Back to shopping</Link>
                    <div className="auth-header">
                        <h2>Welcome Back</h2>
                        <p>Login to your account</p>
                    </div>

                    {error && <p role="alert" className="auth-error">{error}</p>}
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label htmlFor="email">Email Address</label>
                            <input 
                                type="email" 
                                id="email" 
                                placeholder="name@example.com" 
                                value={email}
                                onChange={(e) => { setEmail(e.target.value); setVerificationEmail(''); }}
                                required 
                            />
                        </div>
                        
                        <div className="form-group">
                            <label htmlFor="password">Password</label>
                            <input 
                                type="password" 
                                id="password" 
                                placeholder="Enter your password" 
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required 
                            />
                        </div>
                        
                        <button type="submit" className="btn btn-primary btn-full" disabled={submitting}>
                            {submitting ? <i className="fas fa-spinner fa-spin"></i> : 'Login'}
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

                    <div className="auth-links">{verificationEmail && <p><Link to={`/verify-email?redirect=${encodeURIComponent(destination)}`} state={{ email: verificationEmail }}>Resend verification email</Link></p>}
                        <p><Link to="/forgot-password">Forgot password?</Link></p><p>Don't have an account? <Link to={`/register?redirect=${encodeURIComponent(destination)}`}>Register here</Link></p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
