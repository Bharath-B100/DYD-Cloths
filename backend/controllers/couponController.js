// controllers/couponController.js - Coupon management

const Coupon = require('../models/Coupon');
const { quoteCheckout, requiredText, fail } = require('../services/checkout');

const couponFields = ['code', 'description', 'discountType', 'discountValue', 'minimumOrderAmount',
    'maximumDiscountAmount', 'usageLimit', 'perUserLimit', 'startDate', 'endDate', 'isActive',
    'applicableProducts', 'applicableCategories'];
const couponInput = body => {
    const normalized = { ...body };
    if (normalized.minimumOrderAmount === undefined && normalized.minCartTotal !== undefined) normalized.minimumOrderAmount = normalized.minCartTotal;
    if (normalized.maximumDiscountAmount === undefined && normalized.maxDiscount !== undefined) normalized.maximumDiscountAmount = Number(normalized.maxDiscount) || null;
    if (normalized.endDate === undefined && normalized.expiresAt !== undefined) normalized.endDate = normalized.expiresAt;
    return Object.fromEntries(couponFields.filter(key => normalized[key] !== undefined).map(key => [key, normalized[key]]));
};
const couponError = (res, error) => res.status(error.statusCode || (['ValidationError', 'CastError'].includes(error.name) || error.code === 11000 ? 400 : 500))
    .json({ success: false, error: error.code === 11000 ? 'Coupon code already exists' :
        error.statusCode || ['ValidationError', 'CastError'].includes(error.name) ? error.message : 'Could not complete coupon request' });

// @desc    Validate coupon
// @route   POST /api/coupons/validate
// @access  Public
const validateCoupon = async (req, res) => {
    try {
        const { code, cartTotal, items } = req.body;
        const userId = req.user?.id;
        const normalizedCode = requiredText(code, 'Coupon code', 80).toUpperCase();
        if (items !== undefined) {
            const quote = await quoteCheckout({ items, couponCode: normalizedCode }, userId);
            return res.json({ success: true, data: { coupon: { code: normalizedCode,
                discountType: quote.coupon.discountType, discountValue: quote.coupon.discountValue,
                discountAmount: quote.discountAmount }, discountAmount: quote.discountAmount } });
        }
        if (typeof cartTotal !== 'number' || !Number.isFinite(cartTotal) || cartTotal < 0) throw fail('A valid cart total is required.');
        
        const coupon = await Coupon.findOne({ 
            code: normalizedCode,
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
        return couponError(res, error);
    }
};

// Admin: Create coupon
const createCoupon = async (req, res) => {
    try {
        const coupon = await Coupon.create(couponInput(req.body));
        
        res.status(201).json({
            success: true,
            message: 'Coupon created successfully',
            data: coupon
        });
        
    } catch (error) {
        console.error('Create coupon error:', error);
        
        return couponError(res, error);
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
        const coupon = await Coupon.findById(id);
        
        if (!coupon) {
            return res.status(404).json({
                success: false,
                error: 'Coupon not found'
            });
        }
        coupon.set(couponInput(req.body));
        await coupon.save();
        
        res.status(200).json({
            success: true,
            message: 'Coupon updated successfully',
            data: coupon
        });
        
    } catch (error) {
        console.error('Update coupon error:', error);
        return couponError(res, error);
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
