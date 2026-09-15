const nodemailer = require('nodemailer');

const isConfigured = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM && process.env.PUBLIC_SITE_URL);

const sendPasswordReset = async (email, token) => {
    if (!isConfigured()) throw new Error('Email delivery is not configured');
    const site = new URL(process.env.PUBLIC_SITE_URL);
    if (!['http:', 'https:'].includes(site.protocol)) throw new Error('Invalid public site URL');
    const resetURL = new URL(`/reset-password/${token}`, site).toString();
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
    await transport.sendMail({
        from: process.env.SMTP_FROM,
        to: email,
        subject: 'Reset your DYD-Clothes password',
        text: `Use this link within 10 minutes to reset your password:\n${resetURL}\n\nIf you did not request this, you can ignore this email.`
    });
};

module.exports = { isConfigured, sendPasswordReset };
