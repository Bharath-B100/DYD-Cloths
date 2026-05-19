// controllers/reviewController.js

const Review = require('../models/Review');
const Product = require('../models/Product');
const Order = require('../models/Order');

// Get all approved reviews for a product
exports.getProductReviews = async (req, res) => {
    try {
        const { productId } = req.params;
        
        const reviews = await Review.find({ product: productId, isApproved: true })
            .populate('user', 'name avatar')
            .sort('-createdAt');
            
        res.status(200).json({ success: true, count: reviews.length, data: { reviews } });
    } catch (error) {
        console.error('Error fetching reviews:', error);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};

// Add a new review with images
exports.createReview = async (req, res) => {
    try {
        const { productId } = req.params;
        const { rating, comment, imageUrls } = req.body;
        
        // Check if product exists
        const product = await Product.findById(productId);
        if (!product) {
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
        
        // Check if user actually purchased the product
        // Robust verified purchase check: check user ID or email
        const userOrders = await Order.find({ 
            $or: [
                { user: req.user.id },
                { 'customer.email': req.user.email }
            ],
            'items.productId': productId,
            status: { $in: ['delivered', 'shipped', 'processing', 'confirmed'] } // Be more generous with "Verified" status
        });
        
        const isVerifiedPurchase = userOrders.length > 0;
        
        const review = await Review.create({
            product: productId,
            user: req.user.id,
            rating,
            comment,
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
        res.status(500).json({ success: false, error: error.message || 'Server Error' });
    }
};

// Mark review as helpful
exports.markHelpful = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        
        const review = await Review.findById(id);
        
        if (!review) {
            return res.status(404).json({ success: false, error: 'Review not found' });
        }
        
        // Check if user already marked as helpful
        if (review.helpfulUsers.includes(userId)) {
            return res.status(400).json({ success: false, error: 'You already marked this review as helpful' });
        }
        
        review.helpful += 1;
        review.helpfulUsers.push(userId);
        await review.save();
        
        res.status(200).json({
            success: true,
            data: { helpful: review.helpful }
        });
    } catch (error) {
        console.error('Mark helpful error:', error);
        res.status(500).json({ success: false, error: 'Server Error' });
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
        
        const review = await Review.findByIdAndUpdate(id, { isApproved }, { new: true, runValidators: true });
        
        if (!review) {
            return res.status(404).json({ success: false, error: 'Review not found' });
        }
        
        res.status(200).json({ success: true, data: { review } });
    } catch (error) {
        console.error('Error updating review:', error);
        res.status(500).json({ success: false, error: 'Server Error' });
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
        
        if (review.user.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Not authorized to delete this review' });
        }
        
        await review.deleteOne();
        
        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        console.error('Error deleting review:', error);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};