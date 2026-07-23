// models/Coupon.js - Coupon/Discount Schema

const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
    code: {
        type: String,
        required: [true, 'Coupon code is required'],
        unique: true,
        uppercase: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    discountType: {
        type: String,
        enum: ['percentage', 'fixed'],
        required: true,
        default: 'percentage'
    },
    discountValue: {
        type: Number,
        required: true,
        min: 0
    },
    minimumOrderAmount: {
        type: Number,
        default: 0
    },
    maximumDiscountAmount: {
        type: Number,
        default: null
    },
    usageLimit: {
        type: Number,
        default: null
    },
    usedCount: {
        type: Number,
        default: 0
    },
    perUserLimit: {
        type: Number,
        default: 1
    },
    startDate: {
        type: Date,
        default: Date.now
    },
    endDate: {
        type: Date,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    applicableProducts: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
    }],
    applicableCategories: [{
        type: String
    }]
}, {
    timestamps: true
});

// Index for faster lookups
couponSchema.index({ code: 1 });
couponSchema.index({ isActive: 1, endDate: 1 });

// Check if coupon is valid
couponSchema.methods.isValid = async function(cartTotal, userId) {
    // Check if active
    if (!this.isActive) return { valid: false, message: 'Coupon is inactive' };
    
    // Check date range
    const now = new Date();
    if (now < this.startDate) return { valid: false, message: 'Coupon not yet active' };
    if (now > this.endDate) return { valid: false, message: 'Coupon has expired' };
    
    // Check minimum order amount
    if (cartTotal < this.minimumOrderAmount) {
        return { 
            valid: false, 
            message: `Minimum order amount of ${this.minimumOrderAmount} required` 
        };
    }
    
    // Check usage limit
    if (this.usageLimit && this.usedCount >= this.usageLimit) {
        return { valid: false, message: 'Coupon usage limit reached' };
    }
    
    // Check per user limit
    if (userId) {
        const Order = mongoose.model('Order');
        const existingOrder = await Order.findOne({
            user: userId,
            couponCode: this.code,
            status: { $ne: 'cancelled' }
        });
        if (existingOrder) {
            return { valid: false, message: 'You have already used this coupon code' };
        }
    }
    
    return { valid: true, discount: this.calculateDiscount(cartTotal) };
};

// Calculate discount amount
couponSchema.methods.calculateDiscount = function(cartTotal) {
    let discount = 0;
    
    if (this.discountType === 'percentage') {
        discount = (cartTotal * this.discountValue) / 100;
        if (this.maximumDiscountAmount) {
            discount = Math.min(discount, this.maximumDiscountAmount);
        }
    } else {
        discount = Math.min(this.discountValue, cartTotal);
    }
    
    return Math.round(discount);
};

const Coupon = mongoose.model('Coupon', couponSchema);

module.exports = Coupon;