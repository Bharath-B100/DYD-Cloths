// models/Order.js - Order Schema for MongoDB

const mongoose = require('mongoose');
const crypto = require('crypto');

// Define Order Item Schema (nested in Order)
const orderItemSchema = new mongoose.Schema({
    productId: {
        type: String,
        ref: 'Product',
        required: true
    },
    name: {
        type: String,
        required: true
    },
    size: {
        type: String,
        required: true
    },
    color: {
        type: String,
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 1,
        default: 1,
        validate: [Number.isInteger, 'Item quantity must be a whole number']
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    image: {
        type: String,
        required: true
    },
    customDesign: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    }
});

// Define Order Schema
const orderSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    orderNumber: {
        type: String,
        unique: true,
        required: true
    },
    requestId: { type: String, maxlength: 100 },
    customer: {
        name: {
            type: String,
            required: [true, 'Customer name is required'],
            trim: true
        },
        email: {
            type: String,
            required: [true, 'Customer email is required'],
            lowercase: true,
            trim: true
        },
        phone: {
            type: String,
            required: [true, 'Customer phone number is required'],
            trim: true
        }
    },
    items: [orderItemSchema],
    shippingAddress: {
        street: {
            type: String,
            required: true,
            trim: true
        },
        city: {
            type: String,
            required: true,
            trim: true
        },
        state: {
            type: String,
            required: true,
            trim: true
        },
        zipCode: {
            type: String,
            required: true,
            trim: true
        },
        trackingNumber: {
            type: String,
            default: null
        },
        trackingUrl: {
            type: String,
            default: null
        },        
        country: {
            type: String,
            required: true,
            default: 'India',
            trim: true
        }
    },
    subtotal: {
        type: Number,
        required: true,
        min: 0
    },
    shippingFee: {
        type: Number,
        required: true,
        default: 99,
        min: 0
    },
    tax: {
        type: Number,
        required: true,
        default: 0,
        min: 0
    },
    totalAmount: {
        type: Number,
        required: true,
        min: 0
    },
    couponCode: {
        type: String,
        default: null
    },
    discountAmount: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        required: true,
        enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
        default: 'pending'
    },
    cancelReason: {
        type: String,
        default: null
    },
    paymentStatus: {
        type: String,
        required: true,
        enum: ['pending', 'paid', 'failed', 'refunded'],
        default: 'pending'
    },
    paymentMethod: {
        type: String,
        enum: ['credit_card', 'paypal', 'cash_on_delivery', 'razorpay', null],
        default: null
    },
    razorpayOrderId: {
        type: String,
        default: null
    },
    razorpayPaymentId: {
        type: String,
        default: null
    },
    paymentCreationStartedAt: { type: Date, default: null },
    inventoryManaged: { type: Boolean, default: false },
    inventoryReleased: { type: Boolean, default: false },
    inventoryReleasePending: { type: Boolean, default: false },
    couponReservationManaged: { type: Boolean, default: false },
    refundRequired: { type: Boolean, default: false },
    notes: {
        type: String,
        maxlength: [500, 'Notes cannot exceed 500 characters']
    },
    estimatedDelivery: {
        type: Date
    }
}, {
    timestamps: true
});

// Generate before validation for newly constructed/saved orders.
orderSchema.pre('validate', async function () {
    if (!this.orderNumber) {
        const date = new Date();
        const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
        this.orderNumber = `ORD-${dateStr}-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    }
});
// Tracking numbers must come from the carrier; a random local number is not trackable.

// Create indexes
orderSchema.index({ 'customer.email': 1 });
orderSchema.index({ user: 1, requestId: 1 }, { unique: true, partialFilterExpression: { requestId: { $type: 'string' } } });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ 'customer.name': 'text', 'customer.email': 'text' });

// Create virtual properties
orderSchema.virtual('itemCount').get(function() {
    return this.items.reduce((total, item) => total + item.quantity, 0);
});

orderSchema.virtual('formattedTotal').get(function() {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0, maximumFractionDigits: 2
    }).format(this.totalAmount);
});

orderSchema.virtual('shippingInfo').get(function() {
    return `${this.shippingAddress.street}, ${this.shippingAddress.city}, ${this.shippingAddress.state} ${this.shippingAddress.zipCode}`;
});

// Create Model
const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
