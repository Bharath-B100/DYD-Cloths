import React, { useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import API from '../config/api';
import { safeReturnPath } from '../utils/navigation';
import '../styles/auth.css';

export default function VerifyEmail() {
    const { token } = useParams();
    const location = useLocation();
    const [params] = useSearchParams();
    const destination = safeReturnPath(params.get('redirect'));
    const [email, setEmail] = useState(location.state?.email || '');
    const [busy, setBusy] = useState(false);
    const [verified, setVerified] = useState(false);
    const [feedback, setFeedback] = useState(null);
    const submit = async event => {
        event.preventDefault(); setBusy(true); setFeedback(null);
        try {
            const result = await API.post('/auth/resend-verification', { email });
            setFeedback({ text: result.message });
        } catch (error) { setFeedback({ error: true, text: error.message }); }
        finally { setBusy(false); }
    };
    const verify = async () => {
        setBusy(true); setFeedback(null);
        try {
            const result = await API.post('/auth/verify-email', { token });
            setVerified(true); setFeedback({ text: result.message });
        } catch (error) { setFeedback({ error: true, text: error.message }); }
        finally { setBusy(false); }
    };
    return <div className="auth-page"><div className="auth-wrapper"><div className="auth-container">
        <Link to="/shop" className="auth-back-link">← Back to shopping</Link>
        <div className="auth-header"><h1>{verified ? 'Email verified' : token ? 'Verify your email' : 'Check your inbox'}</h1>
            <p>{verified ? 'Your account is ready. Log in to continue.' : token ? 'Confirm your email to activate your DYD-Clothes account.' : 'Open the verification email to activate your account. The link expires in 30 minutes.'}</p></div>
        {feedback && <p role={feedback.error ? 'alert' : 'status'} style={{ marginBottom: 20 }}>{feedback.text}</p>}
        {token && !verified && <button type="button" className="btn btn-primary" onClick={verify} disabled={busy}>{busy ? 'Please wait…' : 'Verify my email'}</button>}
        {!verified && <form onSubmit={submit} style={{ marginTop: 24 }}>
            <p>Missing or expired email? Check spam, or request another link. Allow one minute between requests.</p>
            <div className="form-group"><label htmlFor="verification-email">Email address</label><input id="verification-email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></div>
            <button className="btn btn-outline" disabled={busy}>{busy ? 'Please wait…' : 'Resend verification email'}</button>
        </form>}
        <div className="auth-links"><p><Link to={`/login?redirect=${encodeURIComponent(destination)}`}>Back to login</Link> · <Link to="/support">Contact support</Link></p></div>
    </div></div></div>;
}
