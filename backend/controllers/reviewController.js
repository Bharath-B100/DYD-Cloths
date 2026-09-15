// controllers/reviewController.js

const Review = require('../models/Review');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { isProductId, fail } = require('../services/checkout');

const reviewError = (res, error) => res.status(error.statusCode || (error.code === 11000 || ['ValidationError', 'CastError'].includes(error.name) ? 400 : 500))
    .json({ success: false, error: error.code === 11000 ? 'You have already reviewed this product' :
        error.statusCode || ['ValidationError', 'CastError'].includes(error.name) ? error.message : 'Could not complete review request' });

// Get all approved reviews for a product
exports.getProductReviews = async (req, res) => {
    try {
        const { productId } = req.params;
        if (!isProductId(productId)) throw fail('A valid product ID is required.');
        
        const reviews = await Review.find({ product: productId, isApproved: true })
            .populate('user', 'name avatar')
            .sort('-createdAt').limit(100);
            
        res.status(200).json({ success: true, count: reviews.length, data: { reviews } });
    } catch (error) {
        console.error('Error fetching reviews:', error);
        return reviewError(res, error);
    }
};

// Add a new review with images
exports.createReview = async (req, res) => {
    try {
        const { productId } = req.params;
        const { rating, comment, imageUrls } = req.body;
        if (!isProductId(productId)) throw fail('A valid product ID is required.');
        if (!Number.isInteger(Number(rating)) || Number(rating) < 1 || Number(rating) > 5) throw fail('Rating must be a whole number from 1 to 5.');
        if (typeof comment !== 'string' || !comment.trim() || comment.trim().length > 1000) throw fail('Review comment must contain between 1 and 1000 characters.');
        if (imageUrls !== undefined && (!Array.isArray(imageUrls) || imageUrls.some(url => typeof url !== 'string' || !/^https?:\/\//i.test(url)))) throw fail('Review image URLs must use HTTP or HTTPS.');
        if ((imageUrls?.length || 0) + (req.files?.length || 0) > 5) throw fail('A review can have at most five images.');
        
        // Check if product exists
        const product = await Product.findById(productId);
        if (!product || !product.isActive) {
            return res.status(404).json({ success: false, error: 'Product not found' });
        }
        
        // Check if user already submitted a review
        const existingReview = await Review.findOne({ product: productId, user: req.user.id });
        if (existingReview) {
            return res.status(400).json({ success: false, error: 'You have already reviewed this product' });
        }
        
        // Handle images
        let images = [];
        if (imageUrls && Array.isArray(imageUrls)) {
            images = imageUrls.map(url => ({ url, altText: product.name }));
        }
        
        // Handle file uploads if any
        if (req.files && req.files.length) {
            const uploadedImages = req.files.map(file => ({
                url: file.path,
                altText: product.name
            }));
            images = [...images, ...uploadedImages];
        }
        
        // Only a fulfilled order owned by this account earns the verified badge.
        const userOrder = await Order.exists({
            user: req.user.id,
            'items.productId': productId,
            status: 'delivered'
        });
        const isVerifiedPurchase = Boolean(userOrder);
        
        const review = await Review.create({
            product: productId,
            user: req.user.id,
            rating,
            comment: comment.trim(),
            images,
            isVerifiedPurchase,
            isApproved: true
        });
        
        // Populate user data
        await review.populate('user', 'name avatar');
        
        res.status(201).json({
            success: true,
            data: { review }
        });
    } catch (error) {
        console.error('Error creating review detailed:', error);
        return reviewError(res, error);
    }
};

// Mark review as helpful
exports.markHelpful = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        if (!isProductId(id)) throw fail('A valid review ID is required.');
        const review = await Review.findOneAndUpdate({ _id: id, isApproved: true, helpfulUsers: { $ne: userId } },
            { $inc: { helpful: 1 }, $addToSet: { helpfulUsers: userId } }, { new: true });
        
        if (!review) {
            return res.status(400).json({ success: false, error: 'Review is unavailable or you have already marked it helpful' });
        }
        
        res.status(200).json({
            success: true,
            data: { helpful: review.helpful }
        });
    } catch (error) {
        console.error('Mark helpful error:', error);
        return reviewError(res, error);
    }
};

// Admin: Get all reviews (including unapproved)
exports.getAllReviews = async (req, res) => {
    try {
        const reviews = await Review.find().populate('user', 'name').populate('product', 'name').sort('-createdAt');
        res.status(200).json({ success: true, count: reviews.length, data: { reviews } });
    } catch (error) {
        console.error('Error fetching all reviews:', error);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};

// Admin: Update review status (approve/reject)
exports.updateReviewStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { isApproved } = req.body;
        if (typeof isApproved !== 'boolean') throw fail('Approval status must be true or false.');
        
        const review = await Review.findByIdAndUpdate(id, { isApproved }, { new: true, runValidators: true });
        
        if (!review) {
            return res.status(404).json({ success: false, error: 'Review not found' });
        }
        
        res.status(200).json({ success: true, data: { review } });
    } catch (error) {
        console.error('Error updating review:', error);
        return reviewError(res, error);
    }
};

// Delete a review (Admin or Author)
exports.deleteReview = async (req, res) => {
    try {
        const { id } = req.params;
        
        const review = await Review.findById(id);
        
        if (!review) {
            return res.status(404).json({ success: false, error: 'Review not found' });
        }
        
        if (review.user.toString() !== String(req.user.id) && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Not authorized to delete this review' });
        }
        
        await review.deleteOne();
        
        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        console.error('Error deleting review:', error);
        return reviewError(res, error);
    }
};
