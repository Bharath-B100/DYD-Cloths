/**
 * paymentController.js
 * Handles Razorpay payment order creation and webhook verification.
 */

const Razorpay = require('razorpay');
const crypto = require('crypto');
const Order = require('../models/Order');

// Lazy-initialize so the module loads cleanly even before env vars are confirmed
let _razorpay = null;
const getRazorpay = () => {
    if (!_razorpay) {
        if (!process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID === 'rzp_test_YOUR_KEY_ID') {
            throw new Error('RAZORPAY_KEY_ID is not configured. Please set it in your .env file.');
        }
        _razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET
        });
    }
    return _razorpay;
};

// @desc    Create a Razorpay order (called before checkout)
// @route   POST /api/payment/create-order
// @access  Private
exports.createPaymentOrder = async (req, res) => {
    try {
        const { amount, currency = 'INR', receipt } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ success: false, error: 'Valid amount is required' });
        }

        if (!process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID === 'rzp_test_YOUR_KEY_ID') {
            return res.status(400).json({ success: false, error: 'Payment gateway not configured. Please contact support.' });
        }

        // Razorpay expects amount in paise (1 INR = 100 paise)
        const razorpay = getRazorpay();
        const options = {
            amount: Math.round(amount * 100),
            currency,
            receipt: receipt || `receipt_${Date.now()}`,
            payment_capture: 1  // Auto capture
        };

        const razorpayOrder = await razorpay.orders.create(options);

        res.status(200).json({
            success: true,
            data: {
                id: razorpayOrder.id,
                currency: razorpayOrder.currency,
                amount: razorpayOrder.amount,
                key: process.env.RAZORPAY_KEY_ID
            }
        });
    } catch (error) {
        console.error('Create payment order error:', error);
        res.status(500).json({ success: false, error: 'Failed to create payment order' });
    }
};

// @desc    Verify Razorpay payment signature & confirm order
// @route   POST /api/payment/verify
// @access  Private
exports.verifyPayment = async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            orderId  // Our internal MongoDB Order ID
        } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ success: false, error: 'Missing payment verification fields' });
        }

        // Create expected signature using HMAC-SHA256
        const body = razorpay_order_id + '|' + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest('hex');

        const isAuthentic = expectedSignature === razorpay_signature;

        if (!isAuthentic) {
            return res.status(400).json({ success: false, error: 'Payment verification failed. Invalid signature.' });
        }

        // Update order payment status to 'paid' if we have the order ID
        if (orderId) {
            const order = await Order.findById(orderId);
            if (!order) {
                return res.status(404).json({ success: false, error: 'Order not found for verification' });
            }
            if (String(order.user) !== String(req.user.id) && req.user.role !== 'admin') {
                return res.status(403).json({ success: false, error: 'You are not authorized to verify this order.' });
            }

            // Security check: Verify that the amount paid on Razorpay matches the actual order total
            const razorpay = getRazorpay();
            const rzpOrder = await razorpay.orders.fetch(razorpay_order_id);
            
            const expectedAmountInPaise = Math.round(order.totalAmount * 100);
            if (rzpOrder.amount !== expectedAmountInPaise) {
                console.error(`Fraud attempt detected: Order ${orderId} total is ${expectedAmountInPaise} paise, but Razorpay order ${razorpay_order_id} was for ${rzpOrder.amount} paise.`);
                return res.status(400).json({ success: false, error: 'Payment amount mismatch. Transaction rejected.' });
            }

            await Order.findByIdAndUpdate(orderId, {
                paymentStatus: 'paid',
                paymentMethod: 'razorpay',
                razorpayOrderId: razorpay_order_id,
                razorpayPaymentId: razorpay_payment_id,
                status: 'confirmed'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Payment verified successfully',
            data: {
                razorpay_payment_id,
                razorpay_order_id
            }
        });
    } catch (error) {
        console.error('Verify payment error:', error);
        res.status(500).json({ success: false, error: 'Payment verification failed' });
    }
};

// @desc    Get Razorpay public key for frontend
// @route   GET /api/payment/key
// @access  Private
exports.getPaymentKey = async (req, res) => {
    res.status(200).json({
        success: true,
        key: process.env.RAZORPAY_KEY_ID
    });
};
