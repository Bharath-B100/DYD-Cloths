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
        default: 0,
        min: 0
    },
    maximumDiscountAmount: {
        type: Number,
        default: null,
        min: 0
    },
    usageLimit: {
        type: Number,
        default: null,
        min: 1,
        validate: { validator: value => value == null || Number.isInteger(value), message: 'Usage limit must be a whole number' }
    },
    usedCount: {
        type: Number,
        default: 0,
        min: 0
    },
    perUserLimit: {
        type: Number,
        default: 1,
        min: 1,
        validate: { validator: value => value == null || Number.isInteger(value), message: 'Per-user limit must be a whole number' }
    },
    redemptions: {
        type: [{ _id: false, orderId: mongoose.Schema.Types.ObjectId, userId: mongoose.Schema.Types.ObjectId }],
        default: [],
        select: false
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
couponSchema.index({ isActive: 1, endDate: 1 });

couponSchema.pre('validate', function () {
    if (this.discountType === 'percentage' && this.discountValue > 100) this.invalidate('discountValue', 'Percentage discount cannot exceed 100.');
    if (this.startDate && this.endDate && this.endDate <= this.startDate) this.invalidate('endDate', 'Expiry must be after the start date.');
});

// Check if coupon is valid
couponSchema.methods.isValid = async function(cartTotal, userId, items = []) {
    if (typeof cartTotal !== 'number' || !Number.isFinite(cartTotal) || cartTotal < 0) {
        return { valid: false, message: 'A valid cart total is required' };
    }
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
    if (this.usageLimit != null && this.usedCount >= this.usageLimit) {
        return { valid: false, message: 'Coupon usage limit reached' };
    }
    
    // Check per user limit
    if (userId && this.perUserLimit != null) {
        const Order = mongoose.model('Order');
        const existingCount = await Order.countDocuments({
            user: userId,
            couponCode: this.code,
            status: { $ne: 'cancelled' }
        });
        if (existingCount >= this.perUserLimit) {
            return { valid: false, message: 'You have reached the usage limit for this coupon' };
        }
    }

    let eligibleTotal = cartTotal;
    if (this.applicableProducts.length || this.applicableCategories.length) {
        const ids = this.applicableProducts.map(String);
        eligibleTotal = items.reduce((sum, item) => {
            const eligible = ids.includes(String(item.productId)) || this.applicableCategories.includes(item.category);
            return sum + (eligible ? item.price * item.quantity : 0);
        }, 0);
        if (eligibleTotal <= 0) return { valid: false, message: 'This coupon does not apply to the items in your cart' };
    }
    return { valid: true, discount: this.calculateDiscount(eligibleTotal) };
};

// Calculate discount amount
couponSchema.methods.calculateDiscount = function(cartTotal) {
    let discount = 0;
    
    if (this.discountType === 'percentage') {
        discount = (cartTotal * this.discountValue) / 100;
        if (this.maximumDiscountAmount != null) {
            discount = Math.min(discount, this.maximumDiscountAmount);
        }
    } else {
        discount = Math.min(this.discountValue, cartTotal);
    }
    
    return Math.round(Math.max(0, Math.min(discount, cartTotal)) * 100) / 100;
};

const Coupon = mongoose.model('Coupon', couponSchema);

module.exports = Coupon;
