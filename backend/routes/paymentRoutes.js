const express = require('express');
const router = express.Router();
const { createPaymentOrder, verifyPayment, getPaymentKey } = require('../controllers/paymentController');

router.get('/key', getPaymentKey);
router.post('/create-order', createPaymentOrder);
router.post('/verify', verifyPayment);

module.exports = router;
