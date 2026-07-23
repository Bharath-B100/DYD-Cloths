// routes/orderRoutes.js - Updated routes

const express = require('express');
const router = express.Router();
const {
    createOrder,
    getOrders,
    getOrderById,
    updateOrderStatus,
    trackOrder,
    cancelOrder
} = require('../controllers/orderController');

const { protect } = require('../middleware/auth');
const { adminProtect } = require('../middleware/admin');

// Public routes
router.get('/track', trackOrder);

// Protected routes (User)
router.post('/', protect, createOrder);
router.put('/:id/cancel', protect, cancelOrder);

// Protected routes: users can only access their own orders; admins manage all orders.
router.get('/', adminProtect, getOrders);
router.get('/:id', protect, getOrderById);
router.put('/:id/status', adminProtect, updateOrderStatus);

module.exports = router;
