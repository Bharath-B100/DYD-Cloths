const nodemailer = require('nodemailer');

function createGmailDelivery({ fetchImpl = (...args) => fetch(...args), env = process.env, now = Date.now } = {}) {
    let cached;
    let refreshing;
    const configured = () => ['GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN', 'GMAIL_SENDER'].every(key => Boolean(env[key]?.trim()));
    const accessToken = async () => {
        if (cached && cached.until > now()) return cached.token;
        if (refreshing) return refreshing;
        refreshing = (async () => {
            const response = await fetchImpl('https://oauth2.googleapis.com/token', {
                method: 'POST', signal: AbortSignal.timeout(15000),
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ client_id: env.GMAIL_CLIENT_ID, client_secret: env.GMAIL_CLIENT_SECRET, refresh_token: env.GMAIL_REFRESH_TOKEN, grant_type: 'refresh_token' })
            });
            const result = await response.json();
            if (!response.ok || !result.access_token) throw new Error(`Gmail authorization failed (HTTP ${response.status}). Reconnect the sender account if authorization was revoked.`);
            cached = { token: result.access_token, until: now() + Math.max(0, Number(result.expires_in || 3600) - 60) * 1000 };
            return cached.token;
        })();
        try { return await refreshing; } finally { refreshing = null; }
    };
    const send = async (to, content) => {
        if (!configured()) throw new Error('Gmail API delivery is not configured');
        // Nodemailer only builds MIME here; this transport never opens an SMTP connection.
        const composer = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'windows', disableFileAccess: true, disableUrlAccess: true });
        const message = await composer.sendMail({ from: { name: 'DYD-Clothes', address: env.GMAIL_SENDER }, to, ...content });
        const raw = message.message.toString('base64url');
        const request = async () => fetchImpl('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
            method: 'POST', signal: AbortSignal.timeout(15000),
            headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ raw })
        });
        let response = await request();
        // A rejected credential is safe to retry once. Do not retry timeouts or quota
        // failures automatically: the first send may have been accepted already.
        if (response.status === 401) { cached = null; response = await request(); }
        if (!response.ok) throw new Error(`Gmail delivery failed (HTTP ${response.status}). Check sender authorization, API enablement and sending limits.`);
        const result = await response.json();
        if (!result.id) throw new Error('Gmail did not confirm message acceptance');
        return { id: result.id };
    };
    return { configured, send };
}
module.exports = { createGmailDelivery };
