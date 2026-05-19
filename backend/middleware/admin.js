// middleware/admin.js - Admin-specific middleware

const { protect, restrictTo } = require('./auth');

// @desc    Protect admin routes
// @access  Private/Admin only
const adminProtect = [protect, restrictTo('admin')];

// @desc    Check if user is admin (for frontend)
// @access  Public
const isAdmin = async (req, res, next) => {
    try {
        if (req.cookies.jwt) {
            const jwt = require('jsonwebtoken');
            const User = require('../models/User');
            
            const decoded = jwt.verify(req.cookies.jwt, process.env.JWT_SECRET);
            const user = await User.findById(decoded.id);
            
            if (user && user.role === 'admin') {
                res.locals.isAdmin = true;
            } else {
                res.locals.isAdmin = false;
            }
        } else {
            res.locals.isAdmin = false;
        }
        next();
    } catch (error) {
        res.locals.isAdmin = false;
        next();
    }
};

// @desc    Admin dashboard access check
// @access  Private
const adminDashboardAccess = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({
            success: false,
            error: 'Access denied. Admin privileges required.'
        });
    }
};

module.exports = {
    adminProtect,
    isAdmin,
    adminDashboardAccess
};