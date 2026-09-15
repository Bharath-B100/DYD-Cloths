// controllers/cartController.js - Cart synchronization for logged-in users

const User = require('../models/User');

function normalizeCart(cart) {
    if (!Array.isArray(cart) || cart.length > 100) throw new Error('Cart must contain at most 100 items.');
    return cart.map(item => {
        if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !item.id || item.id.length > 100 ||
            typeof item.name !== 'string' || !item.name.trim() || item.name.length > 200 ||
            typeof item.price !== 'number' || !Number.isFinite(item.price) || item.price < 0 ||
            !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 999) {
            throw new Error('Each cart item needs a valid product, price, and whole-number quantity.');
        }
        const clean = { id: item.id, name: item.name.trim(), price: item.price, quantity: item.quantity };
        for (const field of ['size', 'color', 'image', 'lineKey', 'designId']) {
            if (item[field] !== undefined) {
                if (typeof item[field] !== 'string' || item[field].length > (field === 'image' ? 8_000_000 : field === 'lineKey' ? 2000 : 200)) throw new Error(`Invalid cart ${field}.`);
                clean[field] = item[field];
            }
        }
        if (Number.isSafeInteger(item.maxStock) && item.maxStock >= 0) clean.maxStock = item.maxStock;
        if (item.customDesign != null) {
            if (typeof item.customDesign !== 'object' || Array.isArray(item.customDesign)) throw new Error('Invalid saved design.');
            clean.customDesign = item.customDesign;
        }
        return clean;
    });
}

// @desc    Sync cart with user account
// @route   POST /api/user/cart/sync
// @access  Private
const syncCart = async (req, res) => {
    try {
        const { cart } = req.body;
        const userId = req.user.id;
        
        if (!cart || !Array.isArray(cart)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid cart data'
            });
        }
        
        // Get user
        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        
        // Reject an invalid snapshot rather than silently deleting valid-looking lines from it.
        let validCart;
        try { validCart = normalizeCart(cart); }
        catch (error) { return res.status(400).json({ success: false, error: error.message }); }
        
        // Save cart to user's session (you can store in a separate collection if needed)
        // For now, we'll just store in user document
        user.lastCart = validCart;
        user.lastCartUpdate = Date.now();
        await user.save({ validateBeforeSave: false });
        
        res.status(200).json({
            success: true,
            message: 'Cart synced successfully',
            data: {
                syncedItems: validCart.length,
                timestamp: user.lastCartUpdate
            }
        });
        
    } catch (error) {
        console.error('Sync cart error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error during cart sync'
        });
    }
};

// @desc    Get saved cart for user
// @route   GET /api/user/cart
// @access  Private
const getSavedCart = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId).select('lastCart lastCartUpdate');
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        
        res.status(200).json({
            success: true,
            data: {
                cart: user.lastCart || [],
                lastUpdated: user.lastCartUpdate || null
            }
        });
        
    } catch (error) {
        console.error('Get saved cart error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
};

// @desc    Clear saved cart for user
// @route   DELETE /api/user/cart
// @access  Private
const clearSavedCart = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        
        user.lastCart = [];
        user.lastCartUpdate = Date.now();
        await user.save({ validateBeforeSave: false });
        
        res.status(200).json({
            success: true,
            message: 'Cart cleared successfully'
        });
        
    } catch (error) {
        console.error('Clear saved cart error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
};

module.exports = {
    syncCart,
    getSavedCart,
    clearSavedCart,
    normalizeCart
};
