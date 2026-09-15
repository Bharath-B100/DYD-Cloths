import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import API from '../config/api';
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

    const submit = async event => {
        event.preventDefault();
        if (token && password !== confirmation) { setFeedback({ error: true, text: 'Passwords do not match.' }); return; }
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
            setFeedback({ error: true, text: error.message });
        } finally { setBusy(false); }
    };

    return <div className="auth-page"><div className="auth-wrapper"><div className="auth-container">
        <div className="auth-header"><h2>{token ? 'Choose a new password' : 'Reset your password'}</h2><p>{token ? 'Use at least six characters.' : 'Enter your account email to request a reset link.'}</p></div>
        <form onSubmit={submit}>
            {token ? <>
                <div className="form-group"><label htmlFor="new-password">New password</label><input id="new-password" type="password" autoComplete="new-password" minLength={6} required value={password} onChange={e => setPassword(e.target.value)} /></div>
                <div className="form-group"><label htmlFor="confirm-password">Confirm password</label><input id="confirm-password" type="password" autoComplete="new-password" minLength={6} required value={confirmation} onChange={e => setConfirmation(e.target.value)} /></div>
            </> : <div className="form-group"><label htmlFor="reset-email">Email address</label><input id="reset-email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></div>}
            {feedback && <p role={feedback.error ? 'alert' : 'status'} style={{ marginBottom: 16, color: feedback.error ? 'var(--danger, #b91c1c)' : 'inherit' }}>{feedback.text}</p>}
            <button className="btn btn-primary btn-full" disabled={busy}>{busy ? 'Please wait…' : token ? 'Save password' : 'Send reset link'}</button>
        </form>
        <div className="auth-links"><p><Link to="/login">Back to login</Link> · <Link to="/support">Contact support</Link></p></div>
    </div></div></div>;
}
