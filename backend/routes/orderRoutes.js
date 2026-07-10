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

// Public routes
router.get('/track', trackOrder);

// Protected routes (User)
router.post('/', protect, createOrder);
router.put('/:id/cancel', protect, cancelOrder);

// Admin routes (will add authentication middleware in Phase 5)
router.get('/', getOrders);
router.get('/:id', getOrderById);
router.put('/:id/status', updateOrderStatus);

module.exports = router;