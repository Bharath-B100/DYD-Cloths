const nodemailer = require('nodemailer');
const { passwordResetEmail } = require('./passwordResetEmail');

const isConfigured = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM && process.env.PUBLIC_SITE_URL);

const sendPasswordReset = async (email, token) => {
    if (!isConfigured()) throw new Error('Email delivery is not configured');
    const site = new URL(process.env.PUBLIC_SITE_URL);
    if (!['http:', 'https:'].includes(site.protocol)) throw new Error('Invalid public site URL');
    const resetURL = new URL(`/reset-password/${token}`, site).toString();
    await sendEmail(email, passwordResetEmail(resetURL));
};

const sendEmail = async (email, content) => {
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

module.exports = { isConfigured, sendPasswordReset, sendEmailVerification };
