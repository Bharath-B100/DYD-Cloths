import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import API from '../config/api';
import { recoveryError } from '../utils/recoveryError';
import { useAuth } from '../context/AuthContext';
import '../styles/auth.css';

export default function PasswordRecovery() {
    const { token } = useParams();
    const { acceptSession } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmation, setConfirmation] = useState('');
    const [busy, setBusy] = useState(false);
    const [feedback, setFeedback] = useState(null);

    const showError = details => {
        setFeedback({ error: true, ...details });
        if (details.field) document.getElementById(details.field)?.focus();
    };

    const submit = async event => {
        event.preventDefault();
        if (busy) return;
        if (token && password.length < 6) { showError({ field: 'new-password', text: 'Choose a password with at least 6 characters.' }); return; }
        if (token && password !== confirmation) { showError({ field: 'confirm-password', text: 'The passwords don’t match. Enter the same password in both fields.' }); return; }
        setBusy(true);
        setFeedback(null);
        try {
            if (token) {
                const response = await API.patch(`/auth/reset-password/${encodeURIComponent(token)}`, { password, passwordConfirm: confirmation });
                acceptSession(response.token, response.data.user);
                navigate('/profile', { replace: true });
            } else {
                const response = await API.post('/auth/forgot-password', { email });
                setFeedback({ text: response.message });
            }
        } catch (error) {
            showError(recoveryError(error, Boolean(token)));
        } finally { setBusy(false); }
    };

    return <div className="auth-page"><div className="auth-wrapper"><div className="auth-container">
                    <Link to="/shop" className="auth-back-link">← Back to shopping</Link>
        <div className="auth-header"><h2>{token ? 'Choose a new password' : 'Reset your password'}</h2><p>{token ? 'Use at least six characters.' : 'Enter your account email to request a reset link.'}</p></div>
        <form onSubmit={submit}>
            {token ? <>
                <div className="form-group"><label htmlFor="new-password">New password</label><input id="new-password" aria-invalid={feedback?.field === 'new-password'} aria-describedby={feedback?.field === 'new-password' ? 'recovery-feedback' : undefined} type="password" autoComplete="new-password" minLength={6} required value={password} onChange={e => { setPassword(e.target.value); setFeedback(null); }} /></div>
                <div className="form-group"><label htmlFor="confirm-password">Confirm password</label><input id="confirm-password" aria-invalid={feedback?.field === 'confirm-password'} aria-describedby={feedback?.field === 'confirm-password' ? 'recovery-feedback' : undefined} type="password" autoComplete="new-password" minLength={6} required value={confirmation} onChange={e => { setConfirmation(e.target.value); setFeedback(null); }} /></div>
            </> : <div className="form-group"><label htmlFor="reset-email">Email address</label><input id="reset-email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></div>}
            {feedback && <p id="recovery-feedback" role={feedback.error ? 'alert' : 'status'} style={{ marginBottom: 16, color: feedback.error ? 'var(--danger, #b91c1c)' : 'inherit' }}>{feedback.text}{feedback.newLink && <> <Link to="/forgot-password">Request a new reset link</Link></>}</p>}
            <button className="btn btn-primary btn-full" disabled={busy}>{busy ? 'Please wait…' : token ? 'Save password' : 'Send reset link'}</button>
        </form>
        <div className="auth-links"><p><Link to="/verify-email">Verify your account</Link> · <Link to="/login">Back to login</Link> · <Link to="/support">Contact support</Link></p></div>
    </div></div></div>;
}
