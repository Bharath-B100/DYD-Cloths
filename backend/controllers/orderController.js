const Order = require('../models/Order');
const { quoteCheckout, requiredText, fail, isProductId } = require('../services/checkout');
const { transitionOrder, reserveInventory, releaseInventory, reserveCoupon, releaseCoupon } = require('../services/orderLifecycle');

const formatINR = amount => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount || 0);
const formatOrder = order => {
    const data = order.toObject ? order.toObject() : order;
    return { ...data, formattedTotal: formatINR(data.totalAmount), itemCount: data.items.reduce((sum, item) => sum + item.quantity, 0) };
};
const ownsOrder = (order, user) => Boolean(order.user && user && String(order.user) === String(user.id));
const handleError = (res, error) => {
    const validation = ['ValidationError', 'CastError'].includes(error.name);
    const status = error.statusCode || (validation || error.code === 11000 ? 400 : 500);
    if (status >= 500) console.error('Order operation failed:', error);
    return res.status(status).json({ success: false, error: status < 500 ? error.message : 'Unable to complete the order request. Please try again.' });
};

const quoteOrder = async (req, res) => {
    try {
        const { coupon, codEnabled, ...quote } = await quoteCheckout(req.body, req.user.id);
        res.json({ success: true, data: quote });
    } catch (error) { return handleError(res, error); }
};

const createOrder = async (req, res) => {
    let order;
    let saved = false;
    try {
        const input = req.body;
        if (input.requestId !== undefined) {
            if (typeof input.requestId !== 'string' || !/^[\w-]{8,100}$/.test(input.requestId)) throw fail('Invalid checkout request ID.');
            const existing = await Order.findOne({ user: req.user.id, requestId: input.requestId });
            if (existing) return res.status(200).json({ success: true, message: 'Order already created', data: formatOrder(existing) });
        }
        const customer = {
            name: requiredText(input.customer?.name, 'Customer name', 100),
            email: requiredText(input.customer?.email, 'Customer email', 254).toLowerCase(),
            phone: requiredText(input.customer?.phone, 'Customer phone', 30)
        };
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) throw fail('A valid customer email is required.');
        if (!/^\+?[\d\s()\-]+$/.test(customer.phone) || !/^\d{7,15}$/.test(customer.phone.replace(/\D/g, ''))) throw fail('A valid customer phone number is required.');
        const shippingAddress = Object.fromEntries(['street', 'city', 'state', 'zipCode'].map(key =>
            [key, requiredText(input.shippingAddress?.[key], `Shipping ${key}`, key === 'street' ? 300 : 100)]));
        shippingAddress.country = requiredText(input.shippingAddress?.country || 'India', 'Shipping country', 100);
        if (!['cash_on_delivery', 'razorpay'].includes(input.paymentMethod)) throw fail('Please select a supported payment method.');
        const { coupon, codEnabled, ...quote } = await quoteCheckout(input, req.user.id);
        if (input.paymentMethod === 'cash_on_delivery' && !codEnabled) throw fail('Cash on Delivery is currently unavailable.');
        if (input.paymentMethod === 'razorpay' && (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_ID.includes('YOUR_KEY'))) {
            throw fail('Online payments are currently unavailable.');
        }
        order = new Order({ ...quote, user: req.user.id, requestId: input.requestId, customer, shippingAddress, notes: input.notes,
            paymentMethod: input.paymentMethod, inventoryManaged: true, couponReservationManaged: Boolean(coupon) });
        // Validate every field before decrementing stock or consuming a coupon.
        await order.validate();
        await reserveInventory(order);
        await reserveCoupon(order, coupon);
        await order.save();
        saved = true;
        return res.status(201).json({ success: true, message: 'Order created successfully', data: formatOrder(order) });
    } catch (error) {
        if (order && !saved) {
            try { await releaseInventory(order); await releaseCoupon(order); }
            catch (cleanupError) { console.error(`Order ${order._id} reservation cleanup requires retry:`, cleanupError); }
        }
        if (error.code === 11000 && req.body.requestId) {
            const existing = await Order.findOne({ user: req.user.id, requestId: req.body.requestId });
            if (existing) return res.status(200).json({ success: true, message: 'Order already created', data: formatOrder(existing) });
        }
        return handleError(res, error);
    }
};

const getOrders = async (req, res) => {
    try {
        const page = Math.max(1, Math.min(100000, parseInt(req.query.page, 10) || 1));
        const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 10));
        const query = {};
        if (req.query.status) query.status = requiredText(req.query.status, 'Status', 30);
        if (req.query.email) query['customer.email'] = requiredText(req.query.email, 'Email', 254).toLowerCase();
        if (req.query.startDate || req.query.endDate) {
            query.createdAt = {};
            for (const [field, operator] of [['startDate', '$gte'], ['endDate', '$lte']]) {
                if (req.query[field]) {
                    const date = new Date(requiredText(req.query[field], field, 40));
                    if (Number.isNaN(date.getTime())) throw fail('Invalid date filter.');
                    query.createdAt[operator] = date;
                }
            }
        }
        const total = await Order.countDocuments(query);
        const orders = await Order.find(query).select('-__v').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean();
        res.json({ success: true, count: orders.length, total, totalPages: Math.ceil(total / limit), currentPage: page, data: orders.map(formatOrder) });
    } catch (error) { return handleError(res, error); }
};

const getOrderById = async (req, res) => {
    try {
        if (!isProductId(req.params.id)) throw fail('Order not found', 404);
        const order = await Order.findById(req.params.id).select('-__v').lean();
        if (!order) throw fail('Order not found', 404);
        if (req.user.role !== 'admin' && !ownsOrder(order, req.user)) throw fail('You are not authorized to access this order.', 403);
        res.json({ success: true, data: { ...formatOrder(order),
            shippingInfo: `${order.shippingAddress.street}, ${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.zipCode}` } });
    } catch (error) { return handleError(res, error); }
};

const updateOrderStatus = async (req, res) => {
    try {
        const order = await transitionOrder(req.params.id, req.body.status, req.body);
        res.json({ success: true, message: 'Order status updated successfully', data: formatOrder(order) });
    } catch (error) { return handleError(res, error); }
};

const trackOrder = async (req, res) => {
    try {
        const orderNumber = requiredText(req.query.orderNumber, 'Order number', 80).toUpperCase();
        const email = requiredText(req.query.email, 'Email', 254).toLowerCase();
        const orders = await Order.find({ orderNumber, 'customer.email': email })
            .select('orderNumber status totalAmount createdAt estimatedDelivery items.quantity shippingAddress.trackingNumber shippingAddress.trackingUrl cancelReason')
            .sort({ createdAt: -1 }).lean();
        if (!orders.length) throw fail('No orders found', 404);
        res.json({ success: true, count: orders.length, data: orders.map(order => ({ orderNumber: order.orderNumber,
            status: order.status, cancelReason: order.cancelReason, totalAmount: order.totalAmount, formattedTotal: formatINR(order.totalAmount), createdAt: order.createdAt,
            estimatedDelivery: order.estimatedDelivery, trackingNumber: order.shippingAddress?.trackingNumber || null,
            trackingUrl: order.shippingAddress?.trackingUrl || null, itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0) })) });
    } catch (error) { return handleError(res, error); }
};

const cancelOrder = async (req, res) => {
    try {
        if (!isProductId(req.params.id)) throw fail('Order not found', 404);
        const order = await Order.findById(req.params.id);
        if (!order) throw fail('Order not found', 404);
        if (req.user.role !== 'admin' && !ownsOrder(order, req.user)) throw fail('Not authorized to cancel this order', 403);
        const cancelled = await transitionOrder(order._id, 'cancelled', { cancelReason: 'Cancelled by user' });
        res.json({ success: true, message: cancelled.refundRequired ? 'Order cancelled. Your paid amount is awaiting a refund.' : 'Order cancelled successfully', data: formatOrder(cancelled) });
    } catch (error) { return handleError(res, error); }
};

module.exports = { createOrder, quoteOrder, getOrders, getOrderById, updateOrderStatus, trackOrder, cancelOrder };
