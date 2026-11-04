const Order = require('../models/Order');
const email = require('./email');
async function deliverOrderConfirmation(id, { resend = false } = {}) {
    const now = new Date();
    const claim = await Order.findOneAndUpdate({ _id: id, status: { $ne: 'cancelled' },
        ...(resend ? {} : { 'confirmationEmail.status': { $ne: 'sent' } }),
        $or: [{ 'confirmationEmail.attemptedAt': { $exists: false } }, { 'confirmationEmail.attemptedAt': { $lt: new Date(Date.now() - 120000) } }]
    }, { $set: { 'confirmationEmail.status': 'sending', 'confirmationEmail.attemptedAt': now }, $inc: { 'confirmationEmail.attempts': 1 } }, { returnDocument: 'after' });
    if (!claim) return 'skipped';
    try {
        await email.sendOrderConfirmation(claim);
    } catch (error) {
        const status = error.status || error.responseCode;
        const reason = error.code === 'EAUTH' ? 'sender_authentication_failed' : /authorization failed/i.test(error.message) ? 'gmail_authorization_failed' : /not configured/i.test(error.message) ? 'email_not_configured' : 'delivery_failed';
        console.error('Order confirmation delivery failed', { orderNumber: claim.orderNumber, reason, status: status || null });
        await Order.updateOne({ _id: id, 'confirmationEmail.attemptedAt': now }, { $set: { 'confirmationEmail.status': 'failed', 'confirmationEmail.failureReason': reason } });
        return 'failed';
    }
    // A storage failure after provider acceptance must not be treated as a send failure.
    await Order.updateOne({ _id: id, 'confirmationEmail.attemptedAt': now }, { $set: { 'confirmationEmail.status': 'sent', 'confirmationEmail.sentAt': new Date() }, $unset: { 'confirmationEmail.failureReason': 1 } });
    return 'sent';
}
module.exports = { deliverOrderConfirmation };
