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

    // If already logged in, redirect away from auth page
    useEffect(() => {
        if (!loading && isLoggedIn) {
            navigate(destination, { replace: true });
        }
    }, [isLoggedIn, loading, navigate, destination]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            const res = await login(email, password);
            if (res.success) {
                if (window.Utils?.showToast) window.Utils.showToast('Logged in successfully', 'success');
                navigate(destination, { replace: true });
            }
        } catch (err) {
            if (window.Utils?.showToast) window.Utils.showToast(err.message || 'Login failed', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleGoogleLogin = async () => {
        setRedirecting(true);
        try {
            console.log('Initiating Google OAuth single page redirect...');
            await loginWithGoogleRedirect();
        } catch (err) {
            console.error('Google redirect failed:', err);
            if (window.Utils?.showToast) window.Utils.showToast('Google Sign-In failed', 'error');
            setRedirecting(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-wrapper">
                <div className="auth-container">
                    <div className="auth-header">
                        <h2>Welcome Back</h2>
                        <p>Login to your account</p>
                    </div>

                    <form onSubmit={handleSubmit}>
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

                    <div className="auth-links">
                        <p><Link to="/forgot-password">Forgot password?</Link></p><p>Don't have an account? <Link to={`/register?redirect=${encodeURIComponent(destination)}`}>Register here</Link></p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
