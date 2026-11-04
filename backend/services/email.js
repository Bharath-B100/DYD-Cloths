const nodemailer = require('nodemailer');
const { passwordResetEmail } = require('./passwordResetEmail');

const gmail = require('./gmailDelivery').createGmailDelivery();
const provider = () => {
    const configured = (process.env.EMAIL_PROVIDER || '').trim().toLowerCase();
    if (configured) return configured;
    if (process.env.RESEND_API_KEY) return 'resend';
    if (process.env.BREVO_API_KEY) return 'brevo';
    if (process.env.GMAIL_REFRESH_TOKEN) return 'gmail';
    return 'smtp';
};

const isConfigured = () => {
    if (!process.env.PUBLIC_SITE_URL) return false;
    const p = provider();
    if (p === 'resend') return Boolean(process.env.RESEND_API_KEY);
    if (p === 'brevo') return Boolean(process.env.BREVO_API_KEY);
    if (p === 'gmail') return gmail.configured();
    if (p === 'smtp') return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
    return false;
};

const sendPasswordReset = async (email, token) => {
    if (!isConfigured()) throw new Error('Email delivery is not configured');
    const site = new URL(process.env.PUBLIC_SITE_URL);
    if (!['http:', 'https:'].includes(site.protocol)) throw new Error('Invalid public site URL');
    const resetURL = new URL(`/reset-password/${token}`, site).toString();
    await sendEmail(email, passwordResetEmail(resetURL));
};

const sendEmail = async (email, content) => {
    if (!isConfigured()) throw new Error('Email delivery is not configured');
    const p = provider();

    if (p === 'resend') {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            signal: AbortSignal.timeout(15000),
            headers: {
                'Authorization': `Bearer ${process.env.RESEND_API_KEY.trim()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: process.env.RESEND_FROM || 'DYD-Clothes <onboarding@resend.dev>',
                to: [email],
                subject: content.subject,
                html: content.html,
                text: content.text
            })
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(`Resend delivery failed (HTTP ${response.status}): ${result.message || JSON.stringify(result)}`);
        }
        return { id: result.id };
    }

    if (p === 'brevo') {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            signal: AbortSignal.timeout(15000),
            headers: {
                'api-key': process.env.BREVO_API_KEY.trim(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sender: { name: 'DYD-Clothes', email: process.env.BREVO_SENDER || process.env.SMTP_USER || 'dydclothes.admin@gmail.com' },
                to: [{ email }],
                subject: content.subject,
                htmlContent: content.html,
                textContent: content.text
            })
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(`Brevo delivery failed (HTTP ${response.status}): ${result.message || JSON.stringify(result)}`);
        }
        return { id: result.messageId };
    }

    if (p === 'gmail') return gmail.send(email, content);

    const port = Number(process.env.SMTP_PORT || 587);
    const transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: port === 465,
        requireTLS: process.env.NODE_ENV === 'production',
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
        connectionTimeout: 10000,
        socketTimeout: 15000,
        disableFileAccess: true,
        disableUrlAccess: true
    });
    await transport.sendMail({ from: process.env.SMTP_FROM, to: email, ...content });
};

const sendEmailVerification = async (email, token) => {
    const site = new URL(process.env.PUBLIC_SITE_URL);
    if (!['http:', 'https:'].includes(site.protocol)) throw new Error('Invalid public site URL');
    const url = new URL('/verify-email/' + token, site).toString();
    const content = passwordResetEmail(url);
    content.subject = 'Verify your DYD-Clothes email';
    content.html = content.html.replaceAll('Reset your password', 'Verify your email').replace('Your password reset link is ready.', 'Activate your DYD-Clothes account.').replace('A fresh start.<br>A new password.', 'Your ideas.<br>Your account.').replace('We received a request to reset your DYD-Clothes password. Use the button below to choose a new one and get back to creating.', 'Welcome to DYD-Clothes. Confirm that this email belongs to you to activate your account and start creating.').replace('Reset my password', 'Verify my email').replace("Didn't request a reset?", "Didn't create an account?").replace("You can safely ignore this email. Your password won't change unless you complete the reset.", 'Ignore this email if you did not sign up. The account will stay unverified.').replaceAll('10 minutes', '30 minutes').replaceAll('reset link', 'verification link');
    content.text = `Verify your DYD-Clothes email\n\nOpen this link within 30 minutes to activate your account:\n${url}\n\nIf you did not sign up, ignore this email. The account will stay unverified.`;
    await sendEmail(email, content);
};

const sendOrderConfirmation = async order => sendEmail(order.customer.email, require('./orderConfirmationEmail').orderConfirmationEmail(order, process.env.PUBLIC_SITE_URL));

module.exports = { isConfigured, sendPasswordReset, sendEmailVerification, sendOrderConfirmation };
