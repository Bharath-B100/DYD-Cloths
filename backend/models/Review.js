// models/Review.js - Review Schema for MongoDB

const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: [true, 'Review must belong to a product.']
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Review must belong to a user.']
    },
    rating: {
        type: Number,
        min: 1,
        max: 5,
        required: [true, 'Review must have a rating.']
    },
    comment: {
        type: String,
        required: [true, 'Review must have a comment.'],
        maxlength: [1000, 'Comment cannot exceed 1000 characters']
    },
    images: [{
        url: String,
        altText: String
    }],
    helpful: {
        type: Number,
        default: 0
    },
    helpfulUsers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    isVerifiedPurchase: {
        type: Boolean,
        default: false
    },
    isApproved: {
        type: Boolean,
        default: true // Set to false if you want admin to manually approve reviews before they show
    }
}, {
    timestamps: true
});

// Prevent user from submitting more than one review per product
reviewSchema.index({ product: 1, user: 1 }, { unique: true });

// Static method to calculate average rating and save it on the product
reviewSchema.statics.calcAverageRatings = async function(productId) {
    try {
        const stats = await this.aggregate([
            {
                $match: { product: productId, isApproved: true }
            },
            {
                $group: {
                    _id: '$product',
                    nRating: { $sum: 1 },
                    avgRating: { $avg: '$rating' }
                }
            }
        ]);
        
        console.log('Average ratings stats:', stats);

        if (stats.length > 0) {
            await mongoose.model('Product').findByIdAndUpdate(productId, {
                reviewsCount: stats[0].nRating,
                rating: stats[0].avgRating
            });
        } else {
            await mongoose.model('Product').findByIdAndUpdate(productId, {
                reviewsCount: 0,
                rating: 0
            });
        }
    } catch (err) {
        console.error('Error in calcAverageRatings:', err);
    }
};

// Call calcAverageRatings after saving a review
reviewSchema.post('save', function() {
    this.constructor.calcAverageRatings(this.product);
});

// Call calcAverageRatings before updating/deleting a review
// Note: findByIdAndUpdate/Delete are shorthands for findOneAnd...
reviewSchema.pre(/^findOneAnd/, async function() {
    // Store the review on the query object to access it in the post middleware
    this.r = await this.clone().findOne();
});

reviewSchema.post(/^findOneAnd/, async function() {
    // Call calcAverageRatings using the stored review
    if (this.r) {
        await this.r.constructor.calcAverageRatings(this.r.product);
    }
});

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;
