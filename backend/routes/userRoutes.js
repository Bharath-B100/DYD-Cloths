// routes/userRoutes.js - User specific routes (cart, profile, etc.)

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
    syncCart,
    getSavedCart,
    clearSavedCart
} = require('../controllers/cartController');

// All routes require authentication
router.use(protect);

// Cart routes
router.post('/cart/sync', syncCart);
router.get('/cart', getSavedCart);
router.delete('/cart', clearSavedCart);

module.exports = router;