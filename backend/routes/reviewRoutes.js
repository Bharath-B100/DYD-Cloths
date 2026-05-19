// routes/reviewRoutes.js

const express = require('express');
const router = express.Router({ mergeParams: true }); // Important to access productId from nested route

const {
    getProductReviews,
    createReview,
    getAllReviews,
    updateReviewStatus,
    deleteReview,
    markHelpful
} = require('../controllers/reviewController');

const { protect } = require('../middleware/auth');
const { adminProtect } = require('../middleware/admin');
const { upload } = require('../middleware/upload');

// Public routes
router.get('/', getProductReviews);

// Protected routes (Logged in users)
router.post('/', protect, upload.array('images', 5), createReview);
router.post('/:id/helpful', protect, markHelpful);
router.delete('/:id', protect, deleteReview);

// Admin only routes
// (These could also be mounted directly in adminRoutes, but we'll keep them here for cohesion and prefix them or mount them separately)

module.exports = router;
