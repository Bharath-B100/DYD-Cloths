// models/Product.js - Product Schema for MongoDB

const mongoose = require('mongoose');

// Define Product Schema (structure)
const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Product name is required'],
        trim: true,
        maxlength: [100, 'Product name cannot exceed 100 characters']
    },
    description: {
        type: String,
        required: [true, 'Product description is required'],
        maxlength: [500, 'Description cannot exceed 500 characters']
    },
    price: {
        type: Number,
        required: [true, 'Product price is required'],
        min: [0, 'Price cannot be negative']
    },
    category: {
        type: String,
        required: true,
        enum: ['graphic', 'plain', 'sports', 'custom'],
        default: 'graphic'
    },
    productTypes: [{
        type: String,
        enum: ['men', 'women', 'kids', 'performance', 'designing']
    }],
    catalogTypes: [{
        type: String,
        enum: ['oversized', 'premium-cotton', 'bulk-cotton']
    }],
    sizes: [{
        type: String,
        enum: ['XS', 'S', 'M', 'L', 'XL', 'XXL']
    }],
    colors: [{
        type: String,
        trim: true
    }],
    images: [{
        url: String,
        altText: String
    }],
    features: [{
        type: String,
        trim: true
    }],
    mainImage: {
        type: String,
        required: true
    },
    stock: {
        type: Number,
        required: true,
        default: 100,
        min: 0
    },
    isActive: {
        type: Boolean,
        default: true
    },
    tags: [String],
    rating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
    },
    reviewsCount: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true // Adds createdAt and updatedAt automatically
});

// Create indexes for faster queries
productSchema.index({ name: 'text', description: 'text', tags: 'text' });
productSchema.index({ category: 1 });
productSchema.index({ productTypes: 1 });
productSchema.index({ catalogTypes: 1 });
productSchema.index({ price: 1 });

// Create virtual property for frontend (not stored in DB)
productSchema.virtual('formattedPrice').get(function() {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(this.price);
});

// Create Model from Schema
const Product = mongoose.model('Product', productSchema);

// Export the Model
module.exports = Product;
