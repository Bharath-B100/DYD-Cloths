// routes/couponRoutes.js - Coupon routes

const express = require('express');
const router = express.Router();
const {
    validateCoupon,
    createCoupon,
    getAllCoupons,
    updateCoupon,
    deleteCoupon
} = require('../controllers/couponController');
const { protect } = require('../middleware/auth');
const { adminProtect } = require('../middleware/admin');

// Public routes
router.post('/validate', protect, validateCoupon);

// Admin routes
router.post('/', adminProtect, createCoupon);
router.get('/', adminProtect, getAllCoupons);
router.put('/:id', adminProtect, updateCoupon);
router.patch('/:id', adminProtect, updateCoupon);
router.delete('/:id', adminProtect, deleteCoupon);

module.exports = router;