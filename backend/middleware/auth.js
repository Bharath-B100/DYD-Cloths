// middleware/auth.js - Authentication and authorization middleware

const jwt = require('jsonwebtoken');
const User = require('../models/User');

// @desc    Protect routes - verify JWT
// @access  Private
const protect = async (req, res, next) => {
    try {
        let token;
        
        // 1. Check for token in headers
        if (
            req.headers.authorization &&
            req.headers.authorization.startsWith('Bearer')
        ) {
            token = req.headers.authorization.split(' ')[1];
        }
        // 2. Check for token in cookies
        else if (req.cookies && req.cookies.jwt) {
            token = req.cookies.jwt;
        }
        
        // 3. Check if token exists
        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'You are not logged in. Please log in to access this resource.'
            });
        }
        
        // 4. Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // 5. Check if user still exists
        const currentUser = await User.findById(decoded.id);
        if (!currentUser) {
            return res.status(401).json({
                success: false,
                error: 'The user belonging to this token no longer exists.'
            });
        }
        
        // 6. Check if user changed password after token was issued
        if (currentUser.changedPasswordAfter(decoded.iat)) {
            return res.status(401).json({
                success: false,
                error: 'User recently changed password. Please log in again.'
            });
        }
        
        // 7. Check if account is active
        if (!currentUser.isActive) {
            return res.status(401).json({
                success: false,
                error: 'Your account has been deactivated.'
            });
        }
        
        // 8. Grant access - attach user to request
        req.user = currentUser;
        next();
        
    } catch (error) {
        console.error('Authentication error:', error);
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                error: 'Invalid token. Please log in again.'
            });
        }
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                error: 'Your token has expired. Please log in again.'
            });
        }
        
        res.status(500).json({
            success: false,
            error: 'Authentication failed'
        });
    }
};

// @desc    Restrict to certain roles
// @access  Private
const restrictTo = (...roles) => {
    return (req, res, next) => {
        // roles is an array ['admin', 'moderator']
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: 'You do not have permission to perform this action.'
            });
        }
        next();
    };
};

// @desc    Check if user is logged in (for frontend)
// @access  Public
const isLoggedIn = async (req, res, next) => {
    try {
        if (req.cookies.jwt) {
            // 1. Verify token
            const decoded = jwt.verify(req.cookies.jwt, process.env.JWT_SECRET);
            
            // 2. Check if user still exists
            const currentUser = await User.findById(decoded.id);
            if (!currentUser) {
                return next();
            }
            
            // 3. Check if user changed password after token was issued
            if (currentUser.changedPasswordAfter(decoded.iat)) {
                return next();
            }
            
            // 4. Attach user to request
            res.locals.user = currentUser;
        }
        next();
    } catch (error) {
        next();
    }
};

module.exports = {
    protect,
    restrictTo,
    isLoggedIn
};