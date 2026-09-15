const Razorpay = require('razorpay');
const crypto = require('crypto');
const Order = require('../models/Order');
const { fail, isProductId } = require('../services/checkout');

let razorpay;
const getRazorpay = () => {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_ID.includes('YOUR_KEY')) {
        throw fail('Payment gateway is not configured. Please contact support.', 503);
    }
    if (!razorpay) razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
    return razorpay;
};

// Dependency injection lets regression tests exercise payment decisions without a gateway or database.
function createPaymentHandlers({ OrderModel = Order, gateway = getRazorpay,
    keyId = () => process.env.RAZORPAY_KEY_ID, keySecret = () => process.env.RAZORPAY_KEY_SECRET } = {}) {
    const errorResponse = (res, error) => {
        if (!error.statusCode) console.error('Payment operation failed:', error);
        return res.status(error.statusCode || 500).json({ success: false, error: error.statusCode ? error.message : 'Unable to complete payment request.' });
    };
    const ownedOrder = async (req) => {
        if (!isProductId(req.body.orderId)) throw fail('A valid orderId is required.');
        const order = await OrderModel.findById(req.body.orderId);
        if (!order) throw fail('Order not found.', 404);
        if (String(order.user) !== String(req.user.id) && req.user.role !== 'admin') throw fail('You are not authorized to access this order.', 403);
        if (order.paymentMethod !== 'razorpay') throw fail('This order is not payable through the online gateway.');
        return order;
    };
    const paymentData = paymentOrder => ({ id: paymentOrder.id, currency: paymentOrder.currency, amount: paymentOrder.amount, key: keyId() });

    const createPaymentOrder = async (req, res) => {
        let lockedOrder;
        try {
            const order = await ownedOrder(req);
            if (order.status === 'cancelled' || ['paid', 'refunded'].includes(order.paymentStatus)) throw fail('This order cannot accept another payment.');
            const expectedAmount = Math.round(order.totalAmount * 100);
            if (!Number.isSafeInteger(expectedAmount) || expectedAmount < 100) throw fail('The order total is not payable through this gateway.');
            const client = gateway();
            if (order.razorpayOrderId) {
                const existing = await client.orders.fetch(order.razorpayOrderId);
                if (existing.amount !== expectedAmount || existing.currency !== 'INR') throw fail('Stored gateway order does not match this order.', 409);
                return res.json({ success: true, data: paymentData(existing) });
            }
            lockedOrder = await OrderModel.findOneAndUpdate({ _id: order._id, status: order.status,
                paymentStatus: order.paymentStatus, razorpayOrderId: null,
                $or: [{ paymentCreationStartedAt: null }, { paymentCreationStartedAt: { $lt: new Date(Date.now() - 120000) } }] },
            { $set: { paymentCreationStartedAt: new Date() } }, { new: true });
            if (!lockedOrder) throw fail('A payment request is already in progress. Please retry shortly.', 409);
            const paymentOrder = await client.orders.create({ amount: expectedAmount, currency: 'INR',
                receipt: order.orderNumber, notes: { orderId: String(order._id) } });
            const updated = await OrderModel.findOneAndUpdate({ _id: order._id, status: order.status,
                razorpayOrderId: null, paymentCreationStartedAt: lockedOrder.paymentCreationStartedAt },
            { $set: { razorpayOrderId: paymentOrder.id, paymentCreationStartedAt: null } }, { new: true });
            if (!updated) throw fail('Order changed during payment setup. Please refresh before paying.', 409);
            return res.json({ success: true, data: paymentData(paymentOrder) });
        } catch (error) { return errorResponse(res, error); }
        finally {
            if (lockedOrder) {
                try { await OrderModel.updateOne({ _id: lockedOrder._id, paymentCreationStartedAt: lockedOrder.paymentCreationStartedAt }, { $set: { paymentCreationStartedAt: null } }); }
                catch (error) { console.error('Could not release payment setup lock:', error); }
            }
        }
    };

    const verifyPayment = async (req, res) => {
        try {
            const order = await ownedOrder(req);
            const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
            if (typeof razorpay_order_id !== 'string' || typeof razorpay_payment_id !== 'string' ||
                typeof razorpay_signature !== 'string' || !/^[a-f\d]{64}$/i.test(razorpay_signature)) throw fail('Missing or invalid payment verification fields.');
            // A signed same-value payment for another order must never pay this order.
            if (!order.razorpayOrderId || razorpay_order_id !== order.razorpayOrderId) throw fail('Payment does not belong to this order.');
            if (!keySecret()) throw fail('Payment gateway is not configured.', 503);
            const expected = crypto.createHmac('sha256', keySecret()).update(`${order.razorpayOrderId}|${razorpay_payment_id}`).digest();
            if (!crypto.timingSafeEqual(expected, Buffer.from(razorpay_signature, 'hex'))) throw fail('Payment verification failed. Invalid signature.');
            if (order.paymentStatus === 'paid') {
                if (order.razorpayPaymentId !== razorpay_payment_id) throw fail('Order has already been paid by another payment.', 409);
                return res.json({ success: true, message: 'Payment already verified', data: { razorpay_payment_id, razorpay_order_id, refundRequired: Boolean(order.refundRequired) } });
            }
            if (order.paymentStatus === 'refunded') throw fail('This order has already been refunded.', 409);
            const payment = await gateway().payments.fetch(razorpay_payment_id);
            if (payment.order_id !== order.razorpayOrderId || payment.currency !== 'INR' || payment.amount !== Math.round(order.totalAmount * 100)) {
                throw fail('Payment amount, currency, or order does not match.');
            }
            if (payment.status !== 'captured') throw fail('Payment has not been captured yet. Please retry after payment completes.', 409);
            const cancelled = order.status === 'cancelled';
            const updated = await OrderModel.findOneAndUpdate({ _id: order._id, razorpayOrderId: order.razorpayOrderId,
                status: order.status, paymentStatus: order.paymentStatus }, { $set: {
                paymentStatus: 'paid', razorpayPaymentId: razorpay_payment_id,
                status: cancelled ? 'cancelled' : order.status === 'pending' ? 'confirmed' : order.status,
                refundRequired: cancelled
            } }, { new: true });
            if (!updated) throw fail('Order changed during verification. Please retry verification.', 409);
            return res.json({ success: true, message: cancelled ? 'Payment received for a cancelled order. A refund is required.' : 'Payment verified successfully',
                data: { razorpay_payment_id, razorpay_order_id, refundRequired: cancelled } });
        } catch (error) { return errorResponse(res, error); }
    };

    const getPaymentKey = async (req, res) => {
        try { gateway(); return res.json({ success: true, key: keyId() }); }
        catch (error) { return errorResponse(res, error); }
    };
    return { createPaymentOrder, verifyPayment, getPaymentKey };
}

module.exports = { ...createPaymentHandlers(), createPaymentHandlers };
