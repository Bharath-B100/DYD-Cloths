// controllers/authController.js - Handle authentication

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Order = require('../models/Order');
const Product = require('../models/Product');
const mongoose = require('mongoose');
const validator = require('validator');
const emailService = require('../services/email');
const normalizeEmail = value => typeof value === 'string' ? value.trim().toLowerCase() : '';

// ======================
// HELPER FUNCTIONS
// ======================

// Generate JWT Token
const generateToken = (user) => {
    return jwt.sign(
        { id: user._id, version: user.sessionVersion || 0 },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
};

// Create and send token response
const createSendToken = (user, statusCode, res) => {
    const token = generateToken(user);
    
    // Remove password from output
    user.password = undefined;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    
    // Cookie options
    const cookieOptions = {
        expires: new Date(
            Date.now() + (Number(process.env.JWT_COOKIE_EXPIRES_IN) || 7) * 24 * 60 * 60 * 1000
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
        const { name, password, passwordConfirm, phone } = req.body;
        const email = normalizeEmail(req.body.email);
        
        // Validation
        if (typeof name !== 'string' || !validator.isEmail(email) || typeof password !== 'string' || typeof passwordConfirm !== 'string') {
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
        const email = normalizeEmail(req.body.email);
        const { password } = req.body;
        
        // Check if email and password exist
        if (!validator.isEmail(email) || typeof password !== 'string' || !password) {
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
        if (updates.email !== undefined) {
            updates.email = normalizeEmail(updates.email);
            if (!validator.isEmail(updates.email)) return res.status(400).json({ success: false, error: 'Please provide a valid email' });
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
            updates.emailVerified = false;
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
        if (![currentPassword, newPassword, newPasswordConfirm].every(value => typeof value === 'string' && value)) {
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
    let user;
    try {
        const email = normalizeEmail(req.body.email);
        if (!validator.isEmail(email)) return res.status(400).json({ success: false, error: 'Please provide a valid email' });
        // Check before lookup so the response does not disclose account existence.
        if (!emailService.isConfigured()) {
            return res.status(503).json({ success: false, error: 'Password recovery is currently unavailable. Please contact support.' });
        }
        user = await User.findOne({ email, isActive: true });
        if (user) {
            const token = user.createPasswordResetToken();
            await user.save({ validateBeforeSave: false });
            await emailService.sendPasswordReset(email, token);
        }
        return res.status(200).json({ success: true, message: 'If an active account exists with this email, password reset instructions will arrive shortly.' });
    } catch (error) {
        if (user) {
            user.passwordResetToken = undefined;
            user.passwordResetExpires = undefined;
            await user.save({ validateBeforeSave: false }).catch(() => {});
        }
        console.error('Password recovery delivery failed:', error.message);
        return res.status(503).json({ success: false, error: 'Password recovery is temporarily unavailable. Please try again later.' });
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
        if (![password, passwordConfirm].every(value => typeof value === 'string' && value)) {
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
        
        if (!user || !user.isActive) {
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
        if (![street, city, state, zipCode].every(value => typeof value === 'string' && value.trim()) || (isDefault !== undefined && typeof isDefault !== 'boolean')) {
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
        if (user.addresses.length >= 20) return res.status(400).json({ success: false, error: 'You can save up to 20 addresses' });
        const newAddress = {
            type: type || 'home',
            street,
            city,
            state,
            zipCode,
            country: country || 'India',
            isDefault: isDefault === true || user.addresses.length === 0
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
const updateAddress = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const address = user?.addresses.id(req.params.addressId);
        if (!address) return res.status(404).json({ success: false, error: 'Address not found' });
        const fields = ['type', 'street', 'city', 'state', 'zipCode', 'country'];
        for (const field of fields) {
            if (req.body[field] !== undefined) {
                if (typeof req.body[field] !== 'string' || !req.body[field].trim()) return res.status(400).json({ success: false, error: 'Please provide a complete address' });
                address[field] = req.body[field].trim();
            }
        }
        if (req.body.isDefault !== undefined && typeof req.body.isDefault !== 'boolean') return res.status(400).json({ success: false, error: 'isDefault must be boolean' });
        if (req.body.isDefault === true) user.addresses.forEach(item => { item.isDefault = item === address; });
        if (!user.addresses.some(item => item.isDefault)) user.addresses[0].isDefault = true;
        await user.save();
        return res.json({ success: true, data: { addresses: user.addresses } });
    } catch (error) {
        return res.status(error.name === 'ValidationError' ? 400 : 500).json({ success: false, error: 'Could not update address' });
    }
};

const deleteAddress = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const address = user?.addresses.id(req.params.addressId);
        if (!address) return res.status(404).json({ success: false, error: 'Address not found' });
        address.deleteOne();
        if (user.addresses.length && !user.addresses.some(item => item.isDefault)) user.addresses[0].isDefault = true;
        await user.save();
        return res.json({ success: true, data: { addresses: user.addresses } });
    } catch {
        return res.status(500).json({ success: false, error: 'Could not delete address' });
    }
};

// @route   GET /api/auth/orders
// @access  Private
const getUserOrders = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        
        // Ownership is permanent and must not change when an account changes email.
        const orders = await Order.find({ user: user._id })
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
            paymentMethod: order.paymentMethod,
            refundRequired: order.refundRequired || false,
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
            trackingNumber: order.shippingAddress?.trackingNumber || null,
            trackingUrl: order.shippingAddress?.trackingUrl || null,
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
        if (!mongoose.isValidObjectId(productId) || !await Product.exists({ _id: productId, isActive: true })) {
            return res.status(404).json({ success: false, error: 'Product not found' });
        }
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

// @desc    Login/Register using Google ID Token verified via Firebase public certs
// @route   POST /api/auth/google-login
// @access  Public
const googleLogin = async (req, res) => {
    try {
        const { idToken } = req.body;
        if (typeof idToken !== 'string' || !idToken || idToken.length > 20000) {
            return res.status(400).json({ success: false, error: 'Token is required' });
        }

        let email, name, avatar;

        // Verify Firebase ID Token using correct Google public certificate endpoint
        try {
            const certsRes = await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com');
            if (!certsRes.ok) {
                throw new Error(`Failed to retrieve Firebase certificates (HTTP ${certsRes.status})`);
            }
            const publicKeys = await certsRes.json();

            const decoded = jwt.decode(idToken, { complete: true });
            if (!decoded || !decoded.header || !decoded.header.kid) {
                return res.status(400).json({ success: false, error: 'Invalid token format' });
            }

            const kid = decoded.header.kid;
            const cert = publicKeys[kid];
            if (!cert) {
                return res.status(400).json({ success: false, error: 'Token certificate not found. Please try signing in again.' });
            }

            const tokenInfo = jwt.verify(idToken, cert, {
                audience: 'tshirtbusiness-bac1a',
                issuer: 'https://securetoken.google.com/tshirtbusiness-bac1a',
                algorithms: ['RS256']
            });

            if (tokenInfo.email_verified !== true || tokenInfo.firebase?.sign_in_provider !== 'google.com') {
                return res.status(401).json({ success: false, error: 'A verified Google account is required' });
            }

            email = normalizeEmail(tokenInfo.email);
            name = tokenInfo.name || (email ? email.split('@')[0] : 'User');
            avatar = tokenInfo.picture || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
            console.log('[GoogleLogin] Token verified for:', email);

        } catch (jwtError) {
            console.error('[GoogleLogin] Token verification error:', jwtError.message);
            return res.status(400).json({ success: false, error: 'Token verification failed: ' + jwtError.message });
        }

        if (!email) {
            return res.status(400).json({ success: false, error: 'Email is required from Google auth' });
        }

        // Find or create user
        let user = await User.findOne({ email });

        if (!user) {
            const randomPassword = crypto.randomBytes(16).toString('hex');
            user = await User.create({
                name,
                email,
                password: randomPassword,
                passwordConfirm: randomPassword,
                avatar,
                emailVerified: true
            });
            console.log('[GoogleLogin] New user created:', email);
        } else {
            console.log('[GoogleLogin] Existing user logged in:', email);
        }

        if (!user.isActive) return res.status(401).json({ success: false, error: 'Your account has been deactivated' });
        user.lastLogin = Date.now();
        await user.save({ validateBeforeSave: false });

        createSendToken(user, 200, res);

    } catch (error) {
        console.error('[GoogleLogin] Unexpected error:', error);
        res.status(500).json({ success: false, error: 'Authentication failed. Please try again.' });
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
    updateAddress,
    deleteAddress,
    getUserOrders,
    addToWishlist,
    removeFromWishlist,
    getWishlist,
    getSharedWishlist,
    googleLogin
};
