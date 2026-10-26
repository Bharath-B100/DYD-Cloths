// controllers/productController.js - Updated for MongoDB

const Product = require('../models/Product');
const { requiredText, fail } = require('../services/checkout');

const productFields = ['name', 'description', 'price', 'mrp', 'discountPercent', 'sellingPrice', 'category',
    'productTypes', 'catalogTypes', 'sizes', 'colors', 'images', 'features', 'mainImage', 'stock', 'isActive', 'tags'];
const productInput = body => Object.fromEntries(productFields.filter(key => body[key] !== undefined).map(key => [key, body[key]]));

const formatINR = (amount) => new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0, maximumFractionDigits: 2
}).format(amount || 0);

// @desc    Get all products
// @route   GET /api/products
// @access  Public
const getProducts = async (req, res) => {
    try {
        const { catalogQuery, effectivePrice } = require('../services/catalogQuery');
        const { match, sort, page: requestedPage, limit } = catalogQuery(req.query);
        const total = await Product.countDocuments(match);
        const totalPages = Math.ceil(total / limit);
        const page = Math.min(requestedPage, Math.max(1, totalPages));
        const products = await Product.aggregate([
            { $match: match }, { $addFields: { catalogPrice: effectivePrice } },
            { $sort: sort }, { $skip: (page - 1) * limit }, { $limit: limit },
            { $project: { __v: 0, stockReservations: 0, catalogPrice: 0 } }
        ]);

        res.json({
            success: true,
            count: products.length,
            total,
            totalPages,
            currentPage: page,
            data: products.map(product => ({
                ...product,
                formattedPrice: formatINR(product.sellingPrice ?? product.price)
            }))
        });
        
    } catch (error) {
        console.error('Get products error:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.statusCode ? error.message : 'Server Error'
        });
    }
};

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Public
const getProductById = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id)
            .select('-__v')
            .lean();
        
        if (!product) {
            return res.status(404).json({
                success: false,
                error: 'Product not found'
            });
        }
        
        // Check if product is active
        if (!product.isActive) {
            return res.status(404).json({
                success: false,
                error: 'Product is no longer available'
            });
        }
        
        res.json({
            success: true,
            data: {
                ...product,
                formattedPrice: formatINR(product.sellingPrice ?? product.price),
                inStock: product.stock > 0
            }
        });
        
    } catch (error) {
        console.error('Get product by ID error:', error);
        
        if (error.kind === 'ObjectId') {
            return res.status(404).json({
                success: false,
                error: 'Product not found'
            });
        }
        
        res.status(500).json({
            success: false,
            error: 'Server Error'
        });
    }
};

// @desc    Create new product
// @route   POST /api/products
// @access  Private/Admin
const createProduct = async (req, res) => {
    try {
        const product = await Product.create(productInput(req.body));
        
        res.status(201).json({
            success: true,
            message: 'Product created successfully',
            data: product
        });
        
    } catch (error) {
        console.error('Create product error:', error);
        
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({
                success: false,
                error: messages.join(', ')
            });
        }
        
        res.status(500).json({
            success: false,
            error: 'Server Error'
        });
    }
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private/Admin
const updateProduct = async (req, res) => {
    try {
        const product = await Product.findByIdAndUpdate(
            req.params.id,
            { $set: productInput(req.body) },
            {
                new: true,
                runValidators: true
            }
        ).select('-__v');
        
        if (!product) {
            return res.status(404).json({
                success: false,
                error: 'Product not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Product updated successfully',
            data: product
        });
        
    } catch (error) {
        console.error('Update product error:', error);
        
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({
                success: false,
                error: messages.join(', ')
            });
        }
        
        res.status(500).json({
            success: false,
            error: 'Server Error'
        });
    }
};

// @desc    Delete product (soft delete)
// @route   DELETE /api/products/:id
// @access  Private/Admin
const deleteProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        
        if (!product) {
            return res.status(404).json({
                success: false,
                error: 'Product not found'
            });
        }
        
        product.isActive = false;
        await product.save();
        
        res.json({
            success: true,
            message: 'Product deleted successfully'
        });
        
    } catch (error) {
        console.error('Delete product error:', error);
        res.status(500).json({
            success: false,
            error: 'Server Error'
        });
    }
};

// @desc    Get product categories
// @route   GET /api/products/categories
// @access  Public
const getCategories = async (req, res) => {
    try {
        const categories = await Product.distinct('category', { isActive: true });
        
        res.json({
            success: true,
            count: categories.length,
            data: categories
        });
        
    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({
            success: false,
            error: 'Server Error'
        });
    }
};

module.exports = {
    getProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
    getCategories
};
