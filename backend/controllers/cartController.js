// controllers/cartController.js - Cart synchronization for logged-in users

const User = require('../models/User');

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
        
        // Validate cart items
        const validCart = cart.filter(item => 
            item.id && 
            item.name && 
            typeof item.price === 'number' &&
            item.quantity > 0
        );
        
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
    clearSavedCart
};