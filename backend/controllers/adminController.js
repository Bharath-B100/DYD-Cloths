// controllers/adminController.js - Admin operations

const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { transitionOrder } = require('../services/orderLifecycle');
const { dateRange, pageNumber, escapeRegex } = require('../utils/validation');
const mongoose = require('mongoose');

const formatINR = (amount) => new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0, maximumFractionDigits: 2
}).format(amount || 0);

const normalizeProductData = (productData, files = {}) => {
    const allowed = ['name', 'description', 'price', 'stock', 'mrp', 'sellingPrice', 'discountPercent', 'category', 'mainImage', 'imageUrls', 'images', 'sizes', 'colors', 'tags', 'features', 'productTypes', 'catalogTypes', 'isActive', 'isFeatured', 'fabric', 'weight'];
    productData = Object.fromEntries(Object.entries(productData).filter(([key]) => allowed.includes(key)));
    if (files.thumbnail?.[0]) {
        productData.mainImage = files.thumbnail[0].path;
    } else if (files.image?.[0]) {
        productData.mainImage = files.image[0].path;
    }

    const uploadedGallery = (files.gallery || []).map(file => ({
        url: file.path,
        altText: productData.name || 'Product image'
    }));

    const urlGallery = productData.imageUrls
        ? String(productData.imageUrls)
            .split(/\r?\n|,/)
            .map(url => url.trim())
            .filter(Boolean)
            .map(url => ({ url, altText: productData.name || 'Product image' }))
        : [];

    if (uploadedGallery.length || urlGallery.length) {
        productData.images = [...uploadedGallery, ...urlGallery];
    }

    ['sizes', 'colors', 'tags', 'features', 'productTypes', 'catalogTypes'].forEach(field => {
        if (productData[field] && typeof productData[field] === 'string') {
            productData[field] = productData[field]
                .split(',')
                .map(value => value.trim())
                .filter(Boolean);
        }
    });

    delete productData.imageUrls;
    return productData;
};

// ======================
// DASHBOARD STATISTICS
// ======================

// @desc    Get dashboard statistics
// @route   GET /api/admin/dashboard
// @access  Private/Admin
const getDashboardStats = async (req, res) => {
    try {
        // Get date ranges
        const today = new Date();
        const startOfToday = new Date(today.setHours(0, 0, 0, 0));
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const startOfYear = new Date(today.getFullYear(), 0, 1);
        
        // Get statistics concurrently
        const [
            totalOrders,
            totalRevenue,
            totalCustomers,
            totalProducts,
            todayOrders,
            todayRevenue,
            monthlyRevenue,
            yearlyRevenue,
            recentOrders,
            lowStockProducts,
            topSellingProducts
        ] = await Promise.all([
            Order.countDocuments(),
            Order.aggregate([
                { $match: { paymentStatus: 'paid', status: { $ne: 'cancelled' } } },
                { $group: { _id: null, total: { $sum: '$totalAmount' } } }
            ]),
            User.countDocuments({ role: 'customer' }),
            Product.countDocuments({ isActive: true }),
            Order.countDocuments({ createdAt: { $gte: startOfToday } }),
            Order.aggregate([
                { $match: { paymentStatus: 'paid', status: { $ne: 'cancelled' }, createdAt: { $gte: startOfToday } } },
                { $group: { _id: null, total: { $sum: '$totalAmount' } } }
            ]),
            Order.aggregate([
                { $match: { paymentStatus: 'paid', status: { $ne: 'cancelled' }, createdAt: { $gte: startOfMonth } } },
                { $group: { _id: null, total: { $sum: '$totalAmount' } } }
            ]),
            Order.aggregate([
                { $match: { paymentStatus: 'paid', status: { $ne: 'cancelled' }, createdAt: { $gte: startOfYear } } },
                { $group: { _id: null, total: { $sum: '$totalAmount' } } }
            ]),
            Order.find().sort({ createdAt: -1 }).limit(10).select('orderNumber customer.name totalAmount status createdAt').lean(),
            Product.find({ stock: { $lt: 20 } }).sort({ stock: 1 }).limit(10).select('name price stock mainImage').lean(),
            Order.aggregate([
                { $unwind: '$items' },
                { $group: { _id: '$items.productId', totalSold: { $sum: '$items.quantity' }, totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } } } },
                { $sort: { totalSold: -1 } },
                { $limit: 10 },
                { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' } },
                { $unwind: '$product' },
                { $project: { productId: '$_id', productName: '$product.name', productImage: '$product.mainImage', totalSold: 1, totalRevenue: 1 } }
            ])
        ]);
        
        res.status(200).json({
            success: true,
            data: {
                overview: {
                    totalOrders,
                    totalRevenue: totalRevenue[0]?.total || 0,
                    totalCustomers,
                    totalProducts,
                    todayOrders,
                    todayRevenue: todayRevenue[0]?.total || 0,
                    monthlyRevenue: monthlyRevenue[0]?.total || 0,
                    yearlyRevenue: yearlyRevenue[0]?.total || 0
                },
                recentOrders,
                lowStockProducts: lowStockProducts.map(p => ({ ...p, stockStatus: p.stock === 0 ? 'Out of Stock' : p.stock < 5 ? 'Very Low' : 'Low' })),
                topSellingProducts
            }
        });
        
    } catch (error) {
        console.error('Get dashboard stats error:', error);
        res.status(error.statusCode || 500).json({ success: false, error: error.statusCode ? error.message : 'Server error' });
    }
};

// ======================
// ORDER MANAGEMENT
// ======================

// @desc    Get all orders with filters
// @route   GET /api/admin/orders
// @access  Private/Admin
const getAllOrders = async (req, res) => {
    try {
        const page = pageNumber(req.query.page, 1);
        const limit = pageNumber(req.query.limit, 20, 100);
        const skip = (page - 1) * limit;
        
        const filter = {};
        
        if (req.query.status) filter.status = req.query.status;
        if (req.query.paymentStatus) filter.paymentStatus = req.query.paymentStatus;
        
        Object.assign(filter, dateRange(req.query.startDate, req.query.endDate));
        
        if (req.query.search) {
            filter.$or = [
                { orderNumber: { $regex: escapeRegex(req.query.search), $options: 'i' } },
                { 'customer.name': { $regex: escapeRegex(req.query.search), $options: 'i' } },
                { 'customer.email': { $regex: escapeRegex(req.query.search), $options: 'i' } }
            ];
        }
        
        const total = await Order.countDocuments(filter);
        
        const orders = await Order.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();
        
        const orderStats = await Order.aggregate([
            { $match: filter },
            { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' }, totalOrders: { $sum: 1 }, avgOrderValue: { $avg: '$totalAmount' } } }
        ]);
        
        res.status(200).json({
            success: true,
            data: {
                orders,
                pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
                stats: orderStats[0] || { totalRevenue: 0, totalOrders: 0, avgOrderValue: 0 }
            }
        });
        
    } catch (error) {
        console.error('Get all orders error:', error);
        res.status(error.statusCode || 500).json({ success: false, error: error.statusCode ? error.message : 'Server error' });
    }
};

// @desc    Update order status
// @route   PUT /api/admin/orders/:id/status
// @access  Private/Admin
const updateOrderStatus = async (req, res) => {
    try {
        const order = await transitionOrder(req.params.id, req.body.status, {
            trackingNumber: req.body.trackingNumber,
            trackingUrl: req.body.trackingUrl
        });
        res.json({ success: true, message: `Order status updated to ${order.status}`, data: order });
    } catch (error) {
        res.status(error.statusCode || 500).json({ success: false, error: error.statusCode ? error.message : 'Could not update order' });
    }
};
// @desc    Update payment status
// @route   PUT /api/admin/orders/:id/payment-status
// @access  Private/Admin
const updatePaymentStatus = async (req, res) => {
    try {
        const { paymentStatus } = req.body;
        const { id } = req.params;
        
        const validStatuses = ['pending', 'paid', 'failed', 'refunded'];
        if (!validStatuses.includes(paymentStatus)) {
            return res.status(400).json({ success: false, error: 'Invalid payment status' });
        }
        
        const order = await Order.findById(id);
        
        if (!order) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }
        if (order.paymentMethod !== 'cash_on_delivery' || paymentStatus !== 'paid' || order.status !== 'delivered') {
            return res.status(400).json({ success: false, error: 'Only payment collected for a delivered COD order can be recorded manually. Online payments and refunds require gateway verification.' });
        }
        order.paymentStatus = 'paid';
        await order.save();
        
        res.status(200).json({ success: true, message: `Payment status updated to ${paymentStatus}`, data: order });
        
    } catch (error) {
        console.error('Update payment status error:', error);
        res.status(error.statusCode || 500).json({ success: false, error: error.statusCode ? error.message : 'Server error' });
    }
};

// ======================
// @desc    Delete order
// @route   DELETE /api/admin/orders/:id
// @access  Private/Admin
const deleteOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const order = await Order.findById(id);
        
        if (!order) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }
        return res.status(409).json({ success: false, error: 'Orders are retained for customer history and payment reconciliation. Cancel an eligible order instead.' });
        
        
    } catch (error) {
        console.error('Delete order error:', error);
        res.status(error.statusCode || 500).json({ success: false, error: error.statusCode ? error.message : 'Server error' });
    }
};

// PRODUCT MANAGEMENT
// ======================
const getAdminProducts = async (req, res) => {
    try {
        const page = pageNumber(req.query.page, 1);
        const limit = pageNumber(req.query.limit, 100, 100);
        const [products, total] = await Promise.all([
            Product.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            Product.countDocuments()
        ]);
        res.json({ success: true, data: products, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
    } catch {
        res.status(500).json({ success: false, error: 'Could not load products' });
    }
};

// @desc    Create new product
// @route   POST /api/admin/products
// @access  Private/Admin
const createProduct = async (req, res) => {
    try {
        const productData = normalizeProductData(req.body, req.files);
        const product = await Product.create(productData);
        
        res.status(201).json({ success: true, message: 'Product created successfully', data: product });
        
    } catch (error) {
        console.error('Create product error:', error);
        
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ success: false, error: messages.join(', ') });
        }
        
        if (error.code === 11000) {
            return res.status(400).json({ success: false, error: 'Product with this name already exists' });
        }
        
        res.status(error.statusCode || 500).json({ success: false, error: error.statusCode ? error.message : 'Server error' });
    }
};

// @desc    Update product
// @route   PUT /api/admin/products/:id
// @access  Private/Admin
const updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = normalizeProductData(req.body, req.files);
        
        const product = await Product.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
        
        if (!product) {
            return res.status(404).json({ success: false, error: 'Product not found' });
        }
        
        res.status(200).json({ success: true, message: 'Product updated successfully', data: product });
        
    } catch (error) {
        console.error('Update product error:', error);
        
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ success: false, error: messages.join(', ') });
        }
        
        res.status(error.statusCode || 500).json({ success: false, error: error.statusCode ? error.message : 'Server error' });
    }
};

// @desc    Delete product (soft delete)
// @route   DELETE /api/admin/products/:id
// @access  Private/Admin
const deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const product = await Product.findById(id);
        
        if (!product) {
            return res.status(404).json({ success: false, error: 'Product not found' });
        }
        
        product.isActive = false;
        await product.save();
        
        res.status(200).json({ success: true, message: 'Product deleted successfully' });
        
    } catch (error) {
        console.error('Delete product error:', error);
        res.status(error.statusCode || 500).json({ success: false, error: error.statusCode ? error.message : 'Server error' });
    }
};

// @desc    Bulk update product stock
// @route   PUT /api/admin/products/bulk/stock
// @access  Private/Admin
const bulkUpdateStock = async (req, res) => {
    try {
        const { updates } = req.body;
        
        if (!Array.isArray(updates) || updates.length === 0) {
            return res.status(400).json({ success: false, error: 'Please provide updates array' });
        }
        if (updates.length > 100 || updates.some(update => !update || !mongoose.isValidObjectId(update.productId) || !Number.isInteger(update.stock) || update.stock < 0)) {
            return res.status(400).json({ success: false, error: 'Each stock update needs a valid product and non-negative whole quantity (up to 100 products)' });
        }
        
        const bulkOps = updates.map(update => ({
            updateOne: { filter: { _id: update.productId }, update: { $set: { stock: update.stock } } }
        }));
        
        const result = await Product.bulkWrite(bulkOps);
        return res.json({ success: true, message: `Stock updated for ${result.modifiedCount} products`, data: result });
        
    } catch (error) {
        console.error('Bulk update stock error:', error);
        res.status(error.statusCode || 500).json({ success: false, error: error.statusCode ? error.message : 'Server error' });
    }
};

// @desc    Bulk update product pricing
// @route   PUT /api/admin/products/bulk/pricing
// @access  Private/Admin
const bulkUpdatePricing = async (req, res) => {
    try {
        const { updates } = req.body;
        
        if (!Array.isArray(updates) || updates.length === 0) {
            return res.status(400).json({ success: false, error: 'Please provide updates array' });
        }
        if (updates.length > 100 || updates.some(update => !update || !mongoose.isValidObjectId(update.productId) || !Number.isFinite(update.sellingPrice) || update.sellingPrice < 0 || (update.price !== undefined && (!Number.isFinite(update.price) || update.price < 0)) || (update.mrp != null && (!Number.isFinite(update.mrp) || update.mrp < update.sellingPrice)) || (update.discountPercent !== undefined && (!Number.isFinite(update.discountPercent) || update.discountPercent < 0 || update.discountPercent > 100)))) {
            return res.status(400).json({ success: false, error: 'Provide valid non-negative pricing, MRP at least the selling price, and discount from 0 to 100' });
        }
        
        const bulkOps = updates.map(u => ({
            updateOne: {
                filter: { _id: u.productId },
                update: {
                    $set: {
                        mrp: (u.mrp !== undefined && u.mrp !== null && u.mrp > 0) ? u.mrp : null,
                        discountPercent: u.discountPercent || 0,
                        sellingPrice: u.sellingPrice,
                        price: u.price !== undefined ? u.price : u.sellingPrice
                    }
                }
            }
        }));
        
        const result = await Product.bulkWrite(bulkOps);
        
        res.status(200).json({ success: true, message: `Pricing updated for ${result.modifiedCount} products`, data: result });
        
    } catch (error) {
        console.error('Bulk update pricing error:', error);
        res.status(error.statusCode || 500).json({ success: false, error: error.statusCode ? error.message : 'Server error' });
    }
};

// ======================
// CUSTOMER MANAGEMENT
// ======================

// @desc    Get all customers
// @route   GET /api/admin/customers
// @access  Private/Admin
const getAllCustomers = async (req, res) => {
    try {
        const page = pageNumber(req.query.page, 1);
        const limit = pageNumber(req.query.limit, 20, 100);
        const skip = (page - 1) * limit;
        
        const filter = {};
        
        if (req.query.search) {
            filter.$or = [
                { name: { $regex: escapeRegex(req.query.search), $options: 'i' } },
                { email: { $regex: escapeRegex(req.query.search), $options: 'i' } }
            ];
        }
        
        if (req.query.isActive !== undefined) {
            filter.isActive = req.query.isActive === 'true';
        }
        
        const total = await User.countDocuments(filter);
        
        const customers = await User.find(filter)
            .select('-password -passwordResetToken -passwordResetExpires')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();
        
        const customerStats = await Promise.all([
            User.countDocuments({ role: 'customer' }),
            User.countDocuments({ role: 'customer', isActive: true }),
            User.countDocuments({ role: 'admin' })
        ]);
        
        res.status(200).json({
            success: true,
            data: {
                customers,
                pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
                stats: { total: customerStats[0], active: customerStats[1], admins: customerStats[2] }
            }
        });
        
    } catch (error) {
        console.error('Get all customers error:', error);
        res.status(error.statusCode || 500).json({ success: false, error: error.statusCode ? error.message : 'Server error' });
    }
};

// @desc    Get customer details
// @route   GET /api/admin/customers/:id
// @access  Private/Admin
const getCustomerDetails = async (req, res) => {
    try {
        const { id } = req.params;
        
        const customer = await User.findById(id).select('-password -passwordResetToken -passwordResetExpires').lean();
        
        if (!customer || customer.role !== 'customer') {
            return res.status(404).json({ success: false, error: 'Customer not found' });
        }
        
        const orders = await Order.find({ 'customer.email': customer.email }).sort({ createdAt: -1 }).limit(10).select('orderNumber totalAmount status createdAt').lean();
        
        const orderStats = await Order.aggregate([
            { $match: { 'customer.email': customer.email } },
            { $group: { _id: null, totalOrders: { $sum: 1 }, totalSpent: { $sum: '$totalAmount' }, avgOrderValue: { $avg: '$totalAmount' } } }
        ]);
        
        res.status(200).json({
            success: true,
            data: {
                customer,
                orders,
                stats: orderStats[0] || { totalOrders: 0, totalSpent: 0, avgOrderValue: 0 }
            }
        });
        
    } catch (error) {
        console.error('Get customer details error:', error);
        res.status(error.statusCode || 500).json({ success: false, error: error.statusCode ? error.message : 'Server error' });
    }
};

// @desc    Update customer status
// @route   PUT /api/admin/customers/:id/status
// @access  Private/Admin
const updateCustomerStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { isActive } = req.body;
        
        if (typeof isActive !== 'boolean') {
            return res.status(400).json({ success: false, error: 'isActive must be boolean' });
        }
        
        const customer = await User.findById(id);
        
        if (!customer) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        
        if (!isActive && (customer.role === 'admin' || String(customer._id) === String(req.user._id))) {
            return res.status(403).json({ success: false, error: 'Cannot deactivate an administrator or your own account' });
        }
        customer.isActive = isActive;
        await customer.save({ validateBeforeSave: false });
        
        res.status(200).json({ success: true, message: `User ${isActive ? 'activated' : 'deactivated'} successfully`, data: customer });
        
    } catch (error) {
        console.error('Update customer status error:', error);
        res.status(error.statusCode || 500).json({ success: false, error: error.statusCode ? error.message : 'Server error' });
    }
};

// @desc    Update user role
// @route   PUT /api/admin/customers/:id/role
// @access  Private/Admin
const updateUserRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;
        
        if (!['admin', 'customer'].includes(role)) {
            return res.status(400).json({ success: false, error: 'Invalid role' });
        }
        
        const targetUser = await User.findById(id);
        if (!targetUser) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        
        // Protect the primary admin
        if (targetUser.email === 'admin@tshirtco.com' || String(targetUser._id) === String(req.user._id)) {
            return res.status(403).json({ success: false, error: 'Cannot change the role of the primary administrator' });
        }
        
        // Enforce the 2-admin limit
        if (role === 'admin' && targetUser.role !== 'admin') {
            const adminCount = await User.countDocuments({ role: 'admin' });
            if (adminCount >= 2) {
                return res.status(403).json({ success: false, error: 'Maximum limit of 2 administrators reached.' });
            }
        }
        
        const updatedUser = await User.findByIdAndUpdate(
            id,
            { role },
            { new: true, runValidators: false }
        ).select('-password');
        
        res.status(200).json({ 
            success: true, 
            message: `User role updated to ${role} successfully`, 
            data: updatedUser 
        });
        
    } catch (error) {
        console.error('Update user role error:', error);
        res.status(500).json({ success: false, error: error.message || 'Server error' });
    }
};

// ======================
// @desc    Delete customer
// @route   DELETE /api/admin/customers/:id
// @access  Private/Admin
const deleteCustomer = async (req, res) => {
    try {
        const { id } = req.params;
        const customer = await User.findById(id);
        
        if (!customer) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        
        if (customer.role === 'admin' || String(customer._id) === String(req.user._id)) {
            return res.status(403).json({ success: false, error: 'Cannot delete the primary administrator' });
        }
        
        customer.isActive = false;
        await customer.save({ validateBeforeSave: false });
        res.status(200).json({ success: true, message: 'Customer deactivated; order history has been retained' });
        
    } catch (error) {
        console.error('Delete customer error:', error);
        res.status(error.statusCode || 500).json({ success: false, error: error.statusCode ? error.message : 'Server error' });
    }
};

// ANALYTICS & REPORTS
// ======================

// @desc    Get sales analytics
// @route   GET /api/admin/analytics/sales
// @access  Private/Admin
const getSalesAnalytics = async (req, res) => {
    try {
        const { period = 'month', year = new Date().getFullYear() } = req.query;
        if (!Number.isInteger(Number(year)) || Number(year) < 2000 || Number(year) > 2100) return res.status(400).json({ success: false, error: 'Invalid analytics year' });
        
        let matchStage = {};
        let groupStage = {};
        let sortStage = {};
        
        switch (period) {
            case 'day':
                const last30Days = new Date();
                last30Days.setDate(last30Days.getDate() - 30);
                matchStage = { createdAt: { $gte: last30Days }, paymentStatus: 'paid', status: { $ne: 'cancelled' } };
                groupStage = { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, date: { $first: '$createdAt' }, totalSales: { $sum: '$totalAmount' }, orderCount: { $sum: 1 }, avgOrderValue: { $avg: '$totalAmount' } };
                sortStage = { _id: 1 };
                break;
            case 'month':
                const startOfYear = new Date(`${year}-01-01T00:00:00.000Z`);
                const endOfYear = new Date(`${year}-12-31T23:59:59.999Z`);
                matchStage = { createdAt: { $gte: startOfYear, $lte: endOfYear }, paymentStatus: 'paid', status: { $ne: 'cancelled' } };
                groupStage = { _id: { $month: '$createdAt' }, month: { $first: { $month: '$createdAt' } }, totalSales: { $sum: '$totalAmount' }, orderCount: { $sum: 1 }, avgOrderValue: { $avg: '$totalAmount' } };
                sortStage = { _id: 1 };
                break;
            case 'year':
                const fiveYearsAgo = new Date();
                fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
                matchStage = { createdAt: { $gte: fiveYearsAgo }, paymentStatus: 'paid', status: { $ne: 'cancelled' } };
                groupStage = { _id: { $year: '$createdAt' }, year: { $first: { $year: '$createdAt' } }, totalSales: { $sum: '$totalAmount' }, orderCount: { $sum: 1 }, avgOrderValue: { $avg: '$totalAmount' } };
                sortStage = { _id: 1 };
                break;
            default:
                return res.status(400).json({ success: false, error: 'Invalid period. Use day, month, or year' });
        }
        
        const salesData = await Order.aggregate([{ $match: matchStage }, { $group: groupStage }, { $sort: sortStage }]);
        
        const summary = await Order.aggregate([
            { $match: matchStage },
            { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' }, totalOrders: { $sum: 1 }, avgOrderValue: { $avg: '$totalAmount' }, maxOrder: { $max: '$totalAmount' }, minOrder: { $min: '$totalAmount' } } }
        ]);
        
        res.status(200).json({
            success: true,
            data: { period, year: period === 'month' ? Number(year) : null, salesData, summary: summary[0] || { totalRevenue: 0, totalOrders: 0, avgOrderValue: 0, maxOrder: 0, minOrder: 0 } }
        });
        
    } catch (error) {
        console.error('Get sales analytics error:', error);
        res.status(error.statusCode || 500).json({ success: false, error: error.statusCode ? error.message : 'Server error' });
    }
};

// @desc    Get product analytics
// @route   GET /api/admin/analytics/products
// @access  Private/Admin
const getProductAnalytics = async (req, res) => {
    try {
        const topSelling = await Order.aggregate([
            { $match: { paymentStatus: 'paid', status: { $ne: 'cancelled' } } },
            { $unwind: '$items' },
            { 
                $group: { 
                    _id: '$items.productId', 
                    productName: { $first: '$items.name' }, 
                    productImage: { $first: '$items.image' },
                    totalSold: { $sum: '$items.quantity' }, 
                    totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } } 
                } 
            },
            { $sort: { totalSold: -1 } },
            { $limit: 10 }
        ]);
        
        const byCategory = await Product.aggregate([
            { $group: { _id: '$category', count: { $sum: 1 }, totalStock: { $sum: '$stock' }, avgPrice: { $avg: '$price' } } },
            { $sort: { count: -1 } }
        ]);
        
        const stockStatus = await Product.aggregate([
            { $group: { _id: { $cond: [{ $eq: ['$stock', 0] }, 'Out of Stock', { $cond: [{ $lt: ['$stock', 5] }, 'Very Low', { $cond: [{ $lt: ['$stock', 20] }, 'Low', 'In Stock'] }] }] }, count: { $sum: 1 } } }
        ]);
        
        res.status(200).json({ success: true, data: { topSelling, byCategory, stockStatus } });
        
    } catch (error) {
        console.error('Get product analytics error:', error);
        res.status(error.statusCode || 500).json({ success: false, error: error.statusCode ? error.message : 'Server error' });
    }
};

// @desc    Export data (CSV format)
// @route   GET /api/admin/export/:type
// @access  Private/Admin
const exportData = async (req, res) => {
    try {
        const { type } = req.params;
        const { startDate, endDate } = req.query;
        
        let data;
        let filename;
        let headers;
        
        switch (type) {
            case 'orders':
                const dateFilter = dateRange(startDate, endDate);
                                data = await Order.find(dateFilter).sort({ createdAt: -1 }).lean();
                
                const ordersCSV = data.map(order => ({
                    'Order Number': order.orderNumber,
                    'Customer Name': order.customer.name,
                    'Customer Email': order.customer.email,
                    'Total Amount': order.totalAmount,
                    'Formatted Total': formatINR(order.totalAmount),
                    'Status': order.status,
                    'Payment Status': order.paymentStatus,
                    'Created At': order.createdAt,
                    'Items': order.items.map(item => `${item.name} (${item.quantity} x ${formatINR(item.price)})`).join('; ')
                }));
                
                filename = `orders_${new Date().toISOString().split('T')[0]}.csv`;
                headers = Object.keys(ordersCSV[0] || {});
                data = ordersCSV;
                break;
            case 'products':
                data = await Product.find().lean();
                const productsCSV = data.map(product => ({
                    'Name': product.name,
                    'Category': product.category,
                    'Price': product.price,
                    'Stock': product.stock,
                    'Active': product.isActive,
                    'Created At': product.createdAt
                }));
                filename = `products_${new Date().toISOString().split('T')[0]}.csv`;
                headers = Object.keys(productsCSV[0] || {});
                data = productsCSV;
                break;
            case 'customers':
                data = await User.find({ role: 'customer' }).select('name email phone createdAt lastLogin').lean();
                const customersCSV = data.map(customer => ({
                    'Name': customer.name,
                    'Email': customer.email,
                    'Phone': customer.phone || '',
                    'Joined': customer.createdAt,
                    'Last Login': customer.lastLogin || ''
                }));
                filename = `customers_${new Date().toISOString().split('T')[0]}.csv`;
                headers = Object.keys(customersCSV[0] || {});
                data = customersCSV;
                break;
            default:
                return res.status(400).json({ success: false, error: 'Invalid export type. Use orders, products, or customers' });
        }
        
        res.status(200).json({ success: true, data: { type, filename, headers, rows: data, count: data.length } });
        
    } catch (error) {
        console.error('Export data error:', error);
        res.status(error.statusCode || 500).json({ success: false, error: error.statusCode ? error.message : 'Server error' });
    }
};

module.exports = {
    getAdminProducts,
    getDashboardStats,
    getAllOrders,
    updateOrderStatus,
    updatePaymentStatus,
    deleteOrder,
    createProduct,
    updateProduct,
    deleteProduct,
    bulkUpdateStock,
    bulkUpdatePricing,
    getAllCustomers,
    getCustomerDetails,
    updateCustomerStatus,
    deleteCustomer,
    getSalesAnalytics,
    getProductAnalytics,
    exportData,
    updateUserRole
};
