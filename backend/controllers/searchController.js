// controllers/searchController.js - Advanced search functionality

const Product = require('../models/Product');

// @desc    Search products with autocomplete
// @route   GET /api/search
// @access  Public
const searchProducts = async (req, res) => {
    try {
        const { q, limit = 10, category, minPrice, maxPrice, sort } = req.query;
        
        if (!q || q.length < 2) {
            return res.status(400).json({
                success: false,
                error: 'Search query must be at least 2 characters'
            });
        }
        
        // Build search query
        let query = {
            isActive: true,
            $or: [
                { name: { $regex: q, $options: 'i' } },
                { description: { $regex: q, $options: 'i' } },
                { category: { $regex: q, $options: 'i' } },
                { tags: { $in: [new RegExp(q, 'i')] } }
            ]
        };
        
        // Add filters
        if (category) {
            query.category = category;
        }
        
        if (minPrice || maxPrice) {
            query.price = {};
            if (minPrice) query.price.$gte = parseFloat(minPrice);
            if (maxPrice) query.price.$lte = parseFloat(maxPrice);
        }
        
        // Build sort
        let sortOption = {};
        switch (sort) {
            case 'price_asc':
                sortOption = { price: 1 };
                break;
            case 'price_desc':
                sortOption = { price: -1 };
                break;
            case 'rating':
                sortOption = { rating: -1 };
                break;
            default:
                sortOption = { name: 1 };
        }
        
        const products = await Product.find(query)
            .sort(sortOption)
            .limit(parseInt(limit))
            .lean();
        
        // Get total count
        const total = await Product.countDocuments(query);
        
        res.status(200).json({
            success: true,
            data: {
                products,
                total,
                query: q
            }
        });
        
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
};

// @desc    Get search suggestions (autocomplete)
// @route   GET /api/search/suggest
// @access  Public
const getSuggestions = async (req, res) => {
    try {
        const { q, limit = 5 } = req.query;
        
        if (!q || q.length < 1) {
            return res.status(400).json({
                success: false,
                error: 'Query required'
            });
        }
        
        // Get product name suggestions
        const products = await Product.find({
            isActive: true,
            name: { $regex: q, $options: 'i' }
        })
        .limit(parseInt(limit))
        .select('name category mainImage')
        .lean();
        
        // Get category suggestions
        const categories = await Product.distinct('category', {
            category: { $regex: q, $options: 'i' }
        });
        
        res.status(200).json({
            success: true,
            data: {
                products,
                categories: categories.slice(0, parseInt(limit))
            }
        });
        
    } catch (error) {
        console.error('Suggestions error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
};

module.exports = {
    searchProducts,
    getSuggestions
};