// routes/subscriptionRoutes.js - Newsletter routes

const express = require('express');
const router = express.Router();
const {
    subscribe,
    unsubscribe,
    getSubscribers
} = require('../controllers/subscriptionController');
const { adminProtect } = require('../middleware/admin');

// Public routes
router.post('/subscribe', subscribe);
router.post('/unsubscribe', unsubscribe);

// Admin routes
router.get('/subscribers', adminProtect, getSubscribers);

module.exports = router;
