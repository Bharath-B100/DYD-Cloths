// controllers/authController.js - Handle authentication

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Order = require('../models/Order');

// ======================
// HELPER FUNCTIONS
// ======================

// Generate JWT Token
const generateToken = (userId) => {
    return jwt.sign(
        { id: userId },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
    );
};

// Create and send token response
const createSendToken = (user, statusCode, res) => {
    const token = generateToken(user._id);
    
    // Remove password from output
    user.password = undefined;
    
    // Cookie options
    const cookieOptions = {
        expires: new Date(
            Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
        ),
        httpOnly: true, // Cookie cannot be accessed by JavaScript
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        sameSite: 'strict'
    };
    
    // Set cookie
    res.cookie('jwt', token, cookieOptions);
    
    res.status(statusCode).json({
        success: true,
        token,
        data: {
            user
        }
    });
};

// ======================
// CONTROLLERS
// ======================

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
    try {
        const { name, email, password, passwordConfirm, phone } = req.body;
        
        // Validation
        if (!name || !email || !password || !passwordConfirm) {
            return res.status(400).json({
                success: false,
                error: 'Please provide all required fields'
            });
        }
        
        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                error: 'User with this email already exists'
            });
        }
        
        // Create new user
        const newUser = await User.create({
            name,
            email,
            password,
            passwordConfirm,
            phone: phone || ''
        });
        
        // Update last login
        newUser.lastLogin = Date.now();
        await newUser.save({ validateBeforeSave: false });
        
        // Send token response
        createSendToken(newUser, 201, res);
        
    } catch (error) {
        console.error('Registration error:', error);
        
        // Handle validation errors
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                error: messages.join(', ')
            });
        }
        
        res.status(500).json({
            success: false,
            error: 'Server error during registration'
        });
    }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Check if email and password exist
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Please provide email and password'
            });
        }
        
        // Find user and select password (since it's normally excluded)
const user = await User.findOne({ email }).select('+password');

if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({
        success: false,
        error: 'Incorrect email or password'
    });
}

        // Check if account is active
        if (!user.isActive) {
            return res.status(401).json({
                success: false,
                error: 'Your account has been deactivated'
            });
        }
        
        // Update last login
        user.lastLogin = Date.now();
        await user.save({ validateBeforeSave: false });
        
        // Send token response
        createSendToken(user, 200, res);
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error during login'
        });
    }
};

// @desc    Logout user
// @route   GET /api/auth/logout
// @access  Private
const logout = (req, res) => {
    try {
        // Clear the JWT cookie
        res.cookie('jwt', 'loggedout', {
            expires: new Date(Date.now() + 1000),
            httpOnly: true
        });
        
        res.status(200).json({
            success: true,
            message: 'Logged out successfully'
        });
        
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error during logout'
        });
    }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .populate({
                path: 'wishlist',
                select: 'name price mainImage'
            });
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        
        res.status(200).json({
            success: true,
            data: {
                user
            }
        });
        
    } catch (error) {
        console.error('Get me error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
};

// @desc    Update user profile
// @route   PUT /api/auth/update-profile
// @access  Private
const updateProfile = async (req, res) => {
    try {
        // Fields that can be updated
        const allowedUpdates = ['name', 'email', 'phone', 'avatar'];
        const updates = {};
        
        // Filter allowed fields
        Object.keys(req.body).forEach(key => {
            if (allowedUpdates.includes(key)) {
                updates[key] = req.body[key];
            }
        });
        
        // If email is being updated, check if it's already taken
        if (updates.email) {
            const existingUser = await User.findOne({ 
                email: updates.email,
                _id: { $ne: req.user.id }
            });
            
            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    error: 'Email is already taken'
                });
            }
        }
        
        // Update user
        const user = await User.findByIdAndUpdate(
            req.user.id,
            updates,
            {
                new: true,
                runValidators: true
            }
        );
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        
        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            data: {
                user
            }
        });
        
    } catch (error) {
        console.error('Update profile error:', error);
        
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                error: messages.join(', ')
            });
        }
        
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
};

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword, newPasswordConfirm } = req.body;
        
        // Validation
        if (!currentPassword || !newPassword || !newPasswordConfirm) {
            return res.status(400).json({
                success: false,
                error: 'Please provide all password fields'
            });
        }
        
        if (newPassword !== newPasswordConfirm) {
            return res.status(400).json({
                success: false,
                error: 'New passwords do not match'
            });
        }
        
        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                error: 'Password must be at least 6 characters'
            });
        }
        
        // Get user with password
        const user = await User.findById(req.user.id).select('+password');
        
        // Check current password
        if (!(await user.comparePassword(currentPassword))) {
            return res.status(401).json({
                success: false,
                error: 'Current password is incorrect'
            });
        }
        
        // Update password
        user.password = newPassword;
        user.passwordConfirm = newPasswordConfirm;
        await user.save();
        
        // Generate new token
        createSendToken(user, 200, res);
        
    } catch (error) {
        console.error('Change password error:', error);
        
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                error: messages.join(', ')
            });
        }
        
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
};

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'Please provide your email'
            });
        }
        
        // Find user
        const user = await User.findOne({ email });
        
        if (!user) {
            // Don't reveal that user doesn't exist (security)
            return res.status(200).json({
                success: true,
                message: 'If an account exists with this email, you will receive password reset instructions'
            });
        }
        
        // Generate reset token
        const resetToken = user.createPasswordResetToken();
        await user.save({ validateBeforeSave: false });
        
        // In a real app, you would send an email here
        // For now, we'll just return the token (in development only)
        const resetURL = `${req.protocol}://${req.get('host')}/api/auth/reset-password/${resetToken}`;
        
        // Don't show URL in production
        const message = process.env.NODE_ENV === 'development' 
            ? `Password reset token: ${resetToken}\nReset URL: ${resetURL}`
            : 'Password reset instructions sent to your email';
        
        res.status(200).json({
            success: true,
            message,
            // Only include in development
            ...(process.env.NODE_ENV === 'development' && { resetToken, resetURL })
        });
        
    } catch (error) {
        console.error('Forgot password error:', error);
        
        // Clear reset token if error
        if (req.user) {
            req.user.passwordResetToken = undefined;
            req.user.passwordResetExpires = undefined;
            await req.user.save({ validateBeforeSave: false });
        }
        
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
};

// @desc    Reset password
// @route   PATCH /api/auth/reset-password/:token
// @access  Public
const resetPassword = async (req, res) => {
    try {
        const { token } = req.params;
        const { password, passwordConfirm } = req.body;
        
        // Validation
        if (!password || !passwordConfirm) {
            return res.status(400).json({
                success: false,
                error: 'Please provide password and confirmation'
            });
        }
        
        if (password !== passwordConfirm) {
            return res.status(400).json({
                success: false,
                error: 'Passwords do not match'
            });
        }
        
        // Hash the token to compare with stored hash
        const hashedToken = crypto
            .createHash('sha256')
            .update(token)
            .digest('hex');
        
        // Find user with valid reset token
        const user = await User.findOne({
            passwordResetToken: hashedToken,
            passwordResetExpires: { $gt: Date.now() }
        });
        
        if (!user) {
            return res.status(400).json({
                success: false,
                error: 'Token is invalid or has expired'
            });
        }
        
        // Update password
        user.password = password;
        user.passwordConfirm = passwordConfirm;
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save();
        
        // Send new token
        createSendToken(user, 200, res);
        
    } catch (error) {
        console.error('Reset password error:', error);
        
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                error: messages.join(', ')
            });
        }
        
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
};

// @desc    Add address
// @route   POST /api/auth/addresses
// @access  Private
const addAddress = async (req, res) => {
    try {
        const { type, street, city, state, zipCode, country, isDefault } = req.body;
        
        // Validation
        if (!street || !city || !state || !zipCode) {
            return res.status(400).json({
                success: false,
                error: 'Please provide complete address'
            });
        }
        
        const user = await User.findById(req.user.id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        
        // Create new address
        const newAddress = {
            type: type || 'home',
            street,
            city,
            state,
            zipCode,
            country: country || 'USA',
            isDefault: isDefault || false
        };
        
        // If this is set as default, remove default from others
        if (newAddress.isDefault) {
            user.addresses.forEach(addr => {
                addr.isDefault = false;
            });
        }
        
        // Add to user's addresses
        user.addresses.push(newAddress);
        await user.save();
        
        res.status(201).json({
            success: true,
            message: 'Address added successfully',
            data: {
                addresses: user.addresses
            }
        });
        
    } catch (error) {
        console.error('Add address error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
};

// @desc    Get user orders
// @route   GET /api/auth/orders
// @access  Private
const getUserOrders = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        
        // Find all orders for this user by email
        // Extremely robust search: check user ID and case-insensitive email
        const emailRegex = new RegExp(`^${user.email.trim()}$`, 'i');
        const orders = await Order.find({ 
            $or: [
                { user: user._id },
                { 'customer.email': user.email },
                { 'customer.email': emailRegex }
            ]
        })
            .sort({ createdAt: -1 })
            .select('-__v')
            .lean();
        
        // Format orders for frontend
        const formattedOrders = orders.map(order => ({
            _id: order._id,
            orderNumber: order.orderNumber,
            totalAmount: order.totalAmount,
            status: order.status,
            paymentStatus: order.paymentStatus,
            createdAt: order.createdAt,
            items: order.items.map(item => ({
                productId: item.productId,
                name: item.name,
                quantity: item.quantity,
                price: item.price,
                size: item.size,
                color: item.color,
                image: item.image
            })),
            shippingAddress: order.shippingAddress,
            trackingNumber: order.trackingNumber || null,
            estimatedDelivery: order.estimatedDelivery || null
        }));
        
        res.status(200).json({
            success: true,
            data: { orders: formattedOrders }
        });
        
    } catch (error) {
        console.error('Get user orders error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
};

// @desc    Add product to wishlist
// @route   POST /api/auth/wishlist/:productId
// @access  Private
const addToWishlist = async (req, res) => {
    try {
        const { productId } = req.params;
        const user = await User.findById(req.user.id);
        
        if (!user.wishlist.includes(productId)) {
            user.wishlist.push(productId);
            await user.save({ validateBeforeSave: false });
        }
        
        res.status(200).json({
            success: true,
            message: 'Added to wishlist',
            data: { wishlist: user.wishlist }
        });
    } catch (error) {
        console.error('Add to wishlist error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
};

// @desc    Remove product from wishlist
// @route   DELETE /api/auth/wishlist/:productId
// @access  Private
const removeFromWishlist = async (req, res) => {
    try {
        const { productId } = req.params;
        const user = await User.findById(req.user.id);
        
        user.wishlist = user.wishlist.filter(id => id.toString() !== productId);
        await user.save({ validateBeforeSave: false });
        
        res.status(200).json({
            success: true,
            message: 'Removed from wishlist',
            data: { wishlist: user.wishlist }
        });
    } catch (error) {
        console.error('Remove from wishlist error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
};

// @desc    Get user wishlist
// @route   GET /api/auth/wishlist
// @access  Private
const getWishlist = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).populate('wishlist', 'name price mainImage category rating reviewsCount');
        
        res.status(200).json({
            success: true,
            data: { wishlist: user.wishlist }
        });
    } catch (error) {
        console.error('Get wishlist error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
};

// @desc    Get shared wishlist
// @route   GET /api/wishlist/share/:userId
// @access  Public
const getSharedWishlist = async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User.findById(userId).populate('wishlist', 'name price mainImage category rating reviewsCount');
        
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        
        res.status(200).json({
            success: true,
            data: { 
                userName: user.name,
                wishlist: user.wishlist 
            }
        });
    } catch (error) {
        console.error('Get shared wishlist error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
};

module.exports = {
    register,
    login,
    logout,
    getMe,
    updateProfile,
    changePassword,
    forgotPassword,
    resetPassword,
    addAddress,
    getUserOrders,
    addToWishlist,
    removeFromWishlist,
    getWishlist,
    getSharedWishlist
};