// controllers/subscriptionController.js - Newsletter subscription

const Subscription = require('../models/Subscription');
const validator = require('validator');

// @desc    Subscribe to newsletter
// @route   POST /api/subscribe
// @access  Public
const subscribe = async (req, res) => {
    try {
        const { name, source = 'footer' } = req.body;
        const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
        
        if (!validator.isEmail(email)) {
            return res.status(400).json({
                success: false,
                error: 'Email is required'
            });
        }
        
        // Check if already subscribed
        const existing = await Subscription.findOne({ email: email.toLowerCase() });
        
        if (existing) {
            if (existing.isActive) {
                return res.status(400).json({
                    success: false,
                    error: 'This email is already subscribed'
                });
            } else {
                // Reactivate subscription
                existing.isActive = true;
                existing.unsubscribedAt = null;
                await existing.save();
                
                return res.status(200).json({
                    success: true,
                    message: 'Welcome back! You have been resubscribed.'
                });
            }
        }
        
        // Create new subscription
        await Subscription.create({
            email: email.toLowerCase(),
            name: name || '',
            source
        });
        
        // Here you would send a welcome email
        // For now, just return success
        
        res.status(201).json({
            success: true,
            message: 'Thank you for subscribing. Your email has been added to our newsletter list.'
        });
        
    } catch (error) {
        console.error('Subscribe error:', error);
        
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                error: 'This email is already subscribed'
            });
        }
        
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
};

// @desc    Unsubscribe from newsletter
// @route   POST /api/unsubscribe
// @access  Public
const unsubscribe = async (req, res) => {
    try {
        const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
        
        if (!validator.isEmail(email)) {
            return res.status(400).json({
                success: false,
                error: 'Email is required'
            });
        }
        
        const subscription = await Subscription.findOne({ email: email.toLowerCase() });
        
        if (!subscription) {
            return res.status(200).json({
                success: true,
                message: 'You have been unsubscribed successfully'
            });
        }
        
        subscription.isActive = false;
        subscription.unsubscribedAt = Date.now();
        await subscription.save();
        
        res.status(200).json({
            success: true,
            message: 'You have been unsubscribed successfully'
        });
        
    } catch (error) {
        console.error('Unsubscribe error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
};

// Admin: Get all subscribers
const getSubscribers = async (req, res) => {
    try {
        const subscribers = await Subscription.find().sort({ subscribedAt: -1 });
        
        res.status(200).json({
            success: true,
            data: subscribers,
            count: subscribers.length
        });
        
    } catch (error) {
        console.error('Get subscribers error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
};

module.exports = {
    subscribe,
    unsubscribe,
    getSubscribers
};
