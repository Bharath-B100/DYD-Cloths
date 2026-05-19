// controllers/couponController.js - Coupon management

const Coupon = require('../models/Coupon');

// @desc    Validate coupon
// @route   POST /api/coupons/validate
// @access  Public
const validateCoupon = async (req, res) => {
    try {
        const { code, cartTotal } = req.body;
        const userId = req.user?.id;
        
        if (!code) {
            return res.status(400).json({
                success: false,
                error: 'Coupon code is required'
            });
        }
        
        const coupon = await Coupon.findOne({ 
            code: code.toUpperCase(),
            isActive: true
        });
        
        if (!coupon) {
            return res.status(404).json({
                success: false,
                error: 'Invalid coupon code'
            });
        }
        
        const result = await coupon.isValid(cartTotal, userId);
        
        if (!result.valid) {
            return res.status(400).json({
                success: false,
                error: result.message
            });
        }
        
        res.status(200).json({
            success: true,
            data: {
                coupon: {
                    code: coupon.code,
                    discountType: coupon.discountType,
                    discountValue: coupon.discountValue,
                    discountAmount: result.discount
                },
                discountAmount: result.discount
            }
        });
        
    } catch (error) {
        console.error('Validate coupon error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
};

// Admin: Create coupon
const createCoupon = async (req, res) => {
    try {
        const coupon = await Coupon.create(req.body);
        
        res.status(201).json({
            success: true,
            message: 'Coupon created successfully',
            data: coupon
        });
        
    } catch (error) {
        console.error('Create coupon error:', error);
        
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                error: 'Coupon code already exists'
            });
        }
        
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
};

// Admin: Get all coupons
const getAllCoupons = async (req, res) => {
    try {
        const coupons = await Coupon.find().sort({ createdAt: -1 });
        
        res.status(200).json({
            success: true,
            data: coupons
        });
        
    } catch (error) {
        console.error('Get coupons error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
};

// Admin: Update coupon
const updateCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        const coupon = await Coupon.findByIdAndUpdate(id, req.body, {
            new: true,
            runValidators: true
        });
        
        if (!coupon) {
            return res.status(404).json({
                success: false,
                error: 'Coupon not found'
            });
        }
        
        res.status(200).json({
            success: true,
            message: 'Coupon updated successfully',
            data: coupon
        });
        
    } catch (error) {
        console.error('Update coupon error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
};

// Admin: Delete coupon
const deleteCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        const coupon = await Coupon.findByIdAndDelete(id);
        
        if (!coupon) {
            return res.status(404).json({
                success: false,
                error: 'Coupon not found'
            });
        }
        
        res.status(200).json({
            success: true,
            message: 'Coupon deleted successfully'
        });
        
    } catch (error) {
        console.error('Delete coupon error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
};

module.exports = {
    validateCoupon,
    createCoupon,
    getAllCoupons,
    updateCoupon,
    deleteCoupon
};