// routes/orderRoutes.js - Updated routes

const express = require('express');
const router = express.Router();
const {
    createOrder,
    getOrders,
    getOrderById,
    updateOrderStatus,
    trackOrder
} = require('../controllers/orderController');

// Public routes
router.post('/', createOrder);
router.get('/track', trackOrder);

// Admin routes (will add authentication middleware in Phase 5)
router.get('/', getOrders);
router.get('/:id', getOrderById);
router.put('/:id/status', updateOrderStatus);

module.exports = router;