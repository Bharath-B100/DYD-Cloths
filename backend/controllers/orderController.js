// controllers/orderController.js - Updated for MongoDB

const Order = require('../models/Order');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');

const formatINR = (amount) => new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
}).format(amount || 0);

// @desc    Create new order
// @route   POST /api/orders
// @access  Public
const createOrder = async (req, res) => {
    try {
        const { customer, items, shippingAddress, tax = 0, notes, paymentMethod, couponCode } = req.body;
        
        if (!customer || !customer.name || !customer.email) {
            return res.status(400).json({ success: false, error: 'Customer name and email are required' });
        }
        
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, error: 'Order must contain at least one item' });
        }
        
        if (!shippingAddress || !shippingAddress.street || !shippingAddress.city || !shippingAddress.state || !shippingAddress.zipCode) {
            return res.status(400).json({ success: false, error: 'Complete shipping address is required' });
        }
        
        // Server-side price calculation (Security Fix)
        let calculatedSubtotal = 0;
        for (const item of items) {
            if (item.productId && (item.productId.startsWith('studio-') || item.productId.startsWith('custom-'))) {
                // Trust the generated custom price for studio items
                calculatedSubtotal += (item.price * item.quantity);
            } else {
                // Enforce actual DB price for standard items to prevent client-side spoofing
                const product = await Product.findById(item.productId);
                if (!product) {
                    return res.status(404).json({ success: false, error: `Product not found: ${item.name}` });
                }
                item.price = product.price;
                calculatedSubtotal += (product.price * item.quantity);
            }
        }
        
        let calculatedDiscount = 0;
        if (couponCode) {
            const coupon = await Coupon.findOne({ code: couponCode.toUpperCase(), isActive: true });
            if (coupon) {
                const validation = await coupon.isValid(calculatedSubtotal, req.user ? req.user.id : null);
                if (validation.valid) {
                    calculatedDiscount = validation.discount;
                }
            }
        }

        const afterDiscount = calculatedSubtotal - calculatedDiscount;
        // Standard shipping rule: Free if > 499, else 49 (or fallback to original logic)
        let finalShippingFee = (afterDiscount >= 499 || afterDiscount <= 0) ? 0 : 49;
        
        const totalAmount = afterDiscount + finalShippingFee + tax;
        
        const orderData = { 
            user: req.user ? req.user.id : null,
            customer, 
            items, 
            shippingAddress, 
            subtotal: calculatedSubtotal, 
            discountAmount: calculatedDiscount,
            couponCode: couponCode || null,
            shippingFee: finalShippingFee, 
            tax, 
            totalAmount, 
            notes, 
            paymentMethod 
        };
        
        const order = await Order.create(orderData);
        
        for (const item of items) {
            // Only update stock for real products (ObjectId format)
            // Custom products have IDs like 'custom-123...' or 'studio-123...'
            if (item.productId && !item.productId.startsWith('custom-') && !item.productId.startsWith('studio-')) {
                try {
                    await Product.findByIdAndUpdate(item.productId, { $inc: { stock: -item.quantity } }, { new: true });
                } catch (stockError) {
                    console.warn(`Could not update stock for product ${item.productId}:`, stockError.message);
                }
            }
        }
        
        const populatedOrder = await Order.findById(order._id).select('-__v').lean();
        
        res.status(201).json({
            success: true,
            message: 'Order created successfully',
            data: { ...populatedOrder, formattedTotal: formatINR(populatedOrder.totalAmount), orderNumber: populatedOrder.orderNumber }
        });
        
    } catch (error) {
        console.error('Create order error:', error);
        
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ success: false, error: messages.join(', ') });
        }

        if (error.code === 11000) {
            return res.status(400).json({ success: false, error: 'Duplicate order number. Please try again.' });
        }
        
        res.status(500).json({ success: false, error: error.message || 'Server Error' });
    }
};

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private/Admin
const getOrders = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        
        let query = {};
        if (req.query.status) query.status = req.query.status;
        if (req.query.email) query['customer.email'] = req.query.email;
        
        if (req.query.startDate || req.query.endDate) {
            query.createdAt = {};
            if (req.query.startDate) query.createdAt.$gte = new Date(req.query.startDate);
            if (req.query.endDate) query.createdAt.$lte = new Date(req.query.endDate);
        }
        
        const total = await Order.countDocuments(query);
        
        const orders = await Order.find(query).select('-__v').sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
        
        const totalPages = Math.ceil(total / limit);
        
        res.json({
            success: true,
            count: orders.length,
            total,
            totalPages,
            currentPage: page,
            data: orders.map(order => ({ ...order, formattedTotal: formatINR(order.totalAmount), itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0) }))
        });
        
    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private/Admin or order owner
const getOrderById = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id).select('-__v').lean();
        
        if (!order) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }
        
        res.json({
            success: true,
            data: { ...order, formattedTotal: formatINR(order.totalAmount), itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0), shippingInfo: `${order.shippingAddress.street}, ${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.zipCode}` }
        });
        
    } catch (error) {
        console.error('Get order by ID error:', error);
        
        if (error.kind === 'ObjectId') {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }
        
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};

// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Private/Admin
const updateOrderStatus = async (req, res) => {
    try {
        const { status } = req.body;
        
        if (!status) {
            return res.status(400).json({ success: false, error: 'Status is required' });
        }
        
        const order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true, runValidators: true }).select('-__v');
        
        if (!order) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }
        
        res.json({ success: true, message: 'Order status updated successfully', data: order });
        
    } catch (error) {
        console.error('Update order status error:', error);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};

// @desc    Get order by order number or email
// @route   GET /api/orders/track
// @access  Public
const trackOrder = async (req, res) => {
    try {
        const { orderNumber, email } = req.query;
        
        if (!orderNumber && !email) {
            return res.status(400).json({ success: false, error: 'Order number or email is required' });
        }
        
        let query = {};
        if (orderNumber) query.orderNumber = orderNumber;
        if (email) query['customer.email'] = email.toLowerCase();
        
        const orders = await Order.find(query).select('-__v').sort({ createdAt: -1 }).lean();
        
        if (orders.length === 0) {
            return res.status(404).json({ success: false, error: 'No orders found' });
        }
        
        res.json({
            success: true,
            count: orders.length,
            data: orders.map(order => ({ orderNumber: order.orderNumber, status: order.status, totalAmount: order.totalAmount, formattedTotal: formatINR(order.totalAmount), createdAt: order.createdAt, estimatedDelivery: order.estimatedDelivery, itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0) }))
        });
        
    } catch (error) {
        console.error('Track order error:', error);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};

// @desc    Cancel order (User)
// @route   PUT /api/orders/:id/cancel
// @access  Private
const cancelOrder = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        
        if (!order) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }
        
        // Make sure user owns the order (if not admin)
        if (order.user && order.user.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Not authorized to cancel this order' });
        }
        
        // Check if order can be cancelled
        if (order.status !== 'pending' && order.status !== 'confirmed' && order.status !== 'processing') {
            return res.status(400).json({ success: false, error: 'Order cannot be cancelled at this stage' });
        }
        
        order.status = 'cancelled';
        
        // Handle refund logic for inventory if it was paid
        if (order.paymentStatus === 'paid') {
            order.paymentStatus = 'refunded';
            for (const item of order.items) {
                if (item.productId && !item.productId.startsWith('custom-') && !item.productId.startsWith('studio-')) {
                    try {
                        await Product.findByIdAndUpdate(item.productId, { $inc: { stock: item.quantity } });
                    } catch (error) {
                        console.warn(`Could not restore stock for product ${item.productId}:`, error.message);
                    }
                }
            }
        }
        
        await order.save();
        res.json({ success: true, message: 'Order cancelled successfully', data: order });
        
    } catch (error) {
        console.error('Cancel order error:', error);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};

module.exports = { createOrder, getOrders, getOrderById, updateOrderStatus, trackOrder, cancelOrder };