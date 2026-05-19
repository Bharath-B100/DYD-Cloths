// models/Order.js - Order Schema for MongoDB

const mongoose = require('mongoose');

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
        default: 1
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    image: {
        type: String,
        required: true
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
            default: 'USA',
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
        default: 5.99,
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
    status: {
        type: String,
        required: true,
        enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
        default: 'pending'
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

// Generate order number before saving
// Generate order number BEFORE validation (works with insertMany)
orderSchema.pre('validate', async function () {
    if (!this.orderNumber) {
        const date = new Date();
        const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        this.orderNumber = `ORD-${dateStr}-${randomNum}`;
    }
});
// Generate tracking number when status changes to shipped
orderSchema.pre('save', async function() {
    // Generate tracking number when status becomes 'shipped'
    if (this.isModified('status') && this.status === 'shipped' && !this.trackingNumber) {
        const date = new Date();
        const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
        const randomNum = Math.floor(100000 + Math.random() * 900000);
        this.trackingNumber = `TRK-${dateStr}-${randomNum}`;
    }
});


// Create indexes
orderSchema.index({ 'customer.email': 1 });
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
        maximumFractionDigits: 0
    }).format(this.totalAmount);
});

orderSchema.virtual('shippingInfo').get(function() {
    return `${this.shippingAddress.street}, ${this.shippingAddress.city}, ${this.shippingAddress.state} ${this.shippingAddress.zipCode}`;
});

// Create Model
const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
