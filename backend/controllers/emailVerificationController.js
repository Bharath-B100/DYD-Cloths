const crypto = require('crypto');
const User = require('../models/User');
const emailService = require('../services/email');
const validator = require('validator');
const hash = token => crypto.createHash('sha256').update(token).digest('hex');
const message = 'If this email belongs to an active, unverified account, a verification link will arrive shortly. Check your spam folder too.';

// Atomic cooldown prevents simultaneous requests from sending multiple emails.
async function sendVerification(userId) {
    if (!emailService.isConfigured()) throw new Error('Email delivery is not configured');
    const token = crypto.randomBytes(32).toString('hex');
    const user = await User.findOneAndUpdate({ _id: userId, isActive: true, emailVerified: { $ne: true },
        $or: [{ emailVerificationSentAt: { $exists: false } }, { emailVerificationSentAt: null }, { emailVerificationSentAt: { $lte: new Date(Date.now() - 60000) } }]
    }, { $set: { emailVerificationToken: hash(token), emailVerificationExpires: new Date(Date.now() + 30 * 60000), emailVerificationSentAt: new Date() } }, { new: true });
    if (!user) return;
    try { await emailService.sendEmailVerification(user.email, token); }
    catch (error) {
        await User.updateOne({ _id: userId, emailVerificationToken: hash(token) }, { $unset: { emailVerificationToken: 1, emailVerificationExpires: 1, emailVerificationSentAt: 1 } });
        throw error;
    }
}
async function resendVerification(req, res) {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!validator.isEmail(email)) return res.status(400).json({ success: false, error: 'Enter a valid email address.' });
    try {
        if (!emailService.isConfigured()) return res.status(503).json({ success: false, error: 'Email verification is temporarily unavailable. Please try again later.' });
        const user = await User.findOne({ email, isActive: true, emailVerified: { $ne: true } });
        if (user) await sendVerification(user._id);
        return res.json({ success: true, message });
    } catch {
        return res.status(503).json({ success: false, error: 'We could not send the verification email. Please try again later.' });
    }
}
async function verifyEmail(req, res) {
    const token = req.body.token;
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return res.status(400).json({ success: false, error: 'This verification link is invalid. Request a new link.' });
    try {
        const user = await User.findOneAndUpdate({ emailVerificationToken: hash(token), emailVerificationExpires: { $gt: new Date() }, emailVerified: { $ne: true }, isActive: true }, {
            $set: { emailVerified: true }, $unset: { emailVerificationToken: 1, emailVerificationExpires: 1, emailVerificationSentAt: 1 }
        }, { new: true });
        if (!user) return res.status(400).json({ success: false, error: 'This link has expired or was already used. Try logging in, or request a new link.' });
        return res.json({ success: true, message: 'Email verified. You can now log in.' });
    } catch { return res.status(500).json({ success: false, error: 'Unable to verify your email. Please try again.' }); }
}
module.exports = { sendVerification, resendVerification, verifyEmail };
