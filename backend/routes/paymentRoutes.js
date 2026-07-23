const express = require('express');
const router = express.Router();
const { createPaymentOrder, verifyPayment, getPaymentKey } = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');

// Keep payment operations authenticated even while online payments are disabled in the UI.
router.get('/key', protect, getPaymentKey);
router.post('/create-order', protect, createPaymentOrder);
router.post('/verify', protect, verifyPayment);

module.exports = router;
