// src/pages/ProductDetail.jsx - Detailed Product View, Reviews & Size Guide
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import API from '../config/api';
import { formatINR, formatDate } from '../utils/format';
import { productPrice } from '../utils/cart';
import '../styles/product.css';

const ProductDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { addItem, toggleWishlist, isInWishlist } = useCart();
    const { isLoggedIn, user } = useAuth();

    const [product, setProduct] = useState(null);
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [reload, setReload] = useState(0);
    const currentProductRef = useRef(id);
    
    // UI Interaction States
    const [activeImage, setActiveImage] = useState('');
    const [selectedSize, setSelectedSize] = useState('');
    const [selectedColor, setSelectedColor] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [isSizeGuideOpen, setIsSizeGuideOpen] = useState(false);
    const [lightboxOpen, setLightboxOpen] = useState(false);

    const allImages = React.useMemo(() => {
        if (!product) return [];
        const imgs = [
            product.mainImage,
            ...(product.images || []).map(img => typeof img === 'string' ? img : img?.url)
        ].filter(Boolean);
        return Array.from(new Set(imgs));
    }, [product]);

    const handleNextImage = (e) => {
        if (e) e.stopPropagation();
        const currentIndex = allImages.indexOf(activeImage);
        const nextIndex = (currentIndex + 1) % allImages.length;
        setActiveImage(allImages[nextIndex]);
    };

    const handlePrevImage = (e) => {
        if (e) e.stopPropagation();
        const currentIndex = allImages.indexOf(activeImage);
        const prevIndex = (currentIndex - 1 + allImages.length) % allImages.length;
        setActiveImage(allImages[prevIndex]);
    };
    
    // Size Guide Calculator States
    const [height, setHeight] = useState('');
    const [weight, setWeight] = useState('');
    const [fit, setFit] = useState('regular');
    const [recommendedSize, setRecommendedSize] = useState('');
    const [sizeReasoning, setSizeReasoning] = useState('');

    // Review Form States
    const [showReviewForm, setShowReviewForm] = useState(false);
    const [reviewRating, setReviewRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [reviewComment, setReviewComment] = useState('');
    const [reviewImages, setReviewImages] = useState([]);
    const [reviewImagePreviews, setReviewImagePreviews] = useState([]);
    const [submittingReview, setSubmittingReview] = useState(false);

    const fileInputRef = useRef(null);

    // Fetch Product Data & Reviews on Mount
    useEffect(() => {
        let cancelled = false;
        currentProductRef.current = id;
        setLoading(true);
        setError('');
        setReviews([]);
        setQuantity(1);
        setShowReviewForm(false);
        setSelectedSize('');
        setSelectedColor('');
        setLightboxOpen(false);
        const fetchProductData = async () => {
            try {
                const res = await API.get(`/products/${id}`);
                if (cancelled) return;
                if (res.success) {
                    const prod = res.data.data?.product || res.data.data || res.data;
                    setProduct(prod);
                    setActiveImage(prod.mainImage);
                    if (prod.sizes?.length) {
                        setSelectedSize(prod.sizes[0]);
                    }
                    setSelectedColor(prod.colors?.[0] || 'Default');
                    
                    // Fetch reviews
                    fetchReviews(prod._id || prod.id);
                } else {
                    throw new Error('Product not found');
                }
            } catch (err) {
                if (!cancelled) setError(err.message || 'Unable to load this product.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchProductData();
        return () => { cancelled = true; };
    }, [id, reload]);

    const fetchReviews = async (productId) => {
        try {
            const res = await API.get(`/products/${productId}/reviews`);
            if (String(productId) !== String(currentProductRef.current)) return;
            const reviewsData = res.data?.reviews || res.data?.data || res.data || [];
            setReviews(Array.isArray(reviewsData) ? reviewsData : (reviewsData.reviews || []));
        } catch (err) {
            console.error('Failed to load reviews:', err);
        }
    };

    const handleAddToCart = (buyNow = false) => {
        if (!product) return;
        const success = addItem({
            id: product._id || product.id,
            name: product.name,
            price: productPrice(product),
            image: product.mainImage,
            size: selectedSize || 'M',
            color: selectedColor || 'Default',
            quantity: quantity,
            maxStock: product.stock ?? 0
        }, window.Utils?.showToast);

        if (success && buyNow) {
            navigate(isLoggedIn ? '/checkout' : '/login?redirect=%2Fcheckout');
        }
    };

    const handleWishlistClick = async () => {
        if (!product) return;
        await toggleWishlist(product._id || product.id, window.Utils?.showToast);
    };

    const handleSizeRecommendation = (e) => {
        e.preventDefault();
        const h = parseFloat(height);
        const w = parseFloat(weight);

        if (!Number.isFinite(h) || !Number.isFinite(w) || h < 80 || h > 250 || w < 15 || w > 300) {
            if (window.Utils?.showToast) window.Utils.showToast('Please enter valid height (cm) and weight (kg)', 'error');
            return;
        }

        let recommended = 'M';
        if (w < 55 || (h < 165 && w < 60)) {
            recommended = 'S';
        } else if (w >= 55 && w <= 70) {
            recommended = 'M';
        } else if (w > 70 && w <= 82) {
            recommended = 'L';
        } else if (w > 82 && w <= 95) {
            recommended = 'XL';
        } else {
            recommended = 'XXL';
        }

        const sizesList = ['S', 'M', 'L', 'XL', 'XXL'];
        let idx = sizesList.indexOf(recommended);
        if (fit === 'loose' && idx < sizesList.length - 1) idx++;
        if (fit === 'tight' && idx > 0) idx--;
        recommended = sizesList[idx];

        setRecommendedSize(recommended);
        setSizeReasoning(`Approximate starting size for ${h}cm, ${w}kg with a ${fit} fit. Check the garment measurements before ordering.${product?.sizes?.includes(recommended) ? '' : ' This size is not offered for this product.'}`);

        if (product?.sizes?.includes(recommended)) {
            setSelectedSize(recommended);
            if (window.Utils?.showToast) window.Utils.showToast(`Selected recommended size ${recommended}`, 'success');
        }
    };

    const handleFileChange = (e) => {
        const files = Array.from(e.target.files || []);
        
        // Filter and check file size limit (2MB)
        const validFiles = [];
        let hasTooLargeFile = false;
        
        files.forEach(file => {
            if (file.size > 2 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || validFiles.length >= 5) {
                hasTooLargeFile = true;
            } else {
                validFiles.push(file);
            }
        });
        
        if (hasTooLargeFile) {
            if (window.Utils?.showToast) {
                window.Utils.showToast('Use up to 5 JPG, PNG or WebP images, at most 2MB each.', 'error');
            } else {
                setError('Use up to 5 JPG, PNG or WebP images, at most 2MB each.');
            }
        }
        
        setReviewImages(validFiles);
        
        if (validFiles.length === 0) {
            setReviewImagePreviews([]);
            return;
        }

        // Previews
        const previews = [];
        validFiles.forEach(file => {
            const reader = new FileReader();
            reader.onload = (event) => {
                previews.push(event.target.result);
                if (previews.length === validFiles.length) {
                    setReviewImagePreviews(previews);
                }
            };
            reader.readAsDataURL(file);
        });
    };

    const handleReviewSubmit = async (e) => {
        e.preventDefault();
        if (reviewRating === 0) {
            if (window.Utils?.showToast) window.Utils.showToast('Please select a rating', 'error');
            return;
        }

        setSubmittingReview(true);
        try {
            const formData = new FormData();
            formData.append('rating', reviewRating);
            formData.append('comment', reviewComment);
            
            reviewImages.forEach(file => {
                formData.append('images', file);
            });

            await API.upload(`/products/${product._id || product.id}/reviews`, formData);
            if (window.Utils?.showToast) window.Utils.showToast('Review submitted successfully!', 'success');
            
            // Reset form
            setShowReviewForm(false);
            setReviewRating(0);
            setReviewComment('');
            setReviewImages([]);
            setReviewImagePreviews([]);
            
            // Reload reviews
            fetchReviews(product._id || product.id);
        } catch (err) {
            if (window.Utils?.showToast) window.Utils.showToast(err.message || 'Submission failed', 'error');
        } finally {
            setSubmittingReview(false);
        }
    };

    const handleMarkHelpful = async (reviewId) => {
        if (!isLoggedIn) { navigate('/login', { state: { from: `/product/${id}` } }); return; }
        try {
            const res = await API.post(`/reviews/${reviewId}/helpful`);
            if (res.success) {
                if (window.Utils?.showToast) window.Utils.showToast('Thanks for your feedback!', 'success');
                fetchReviews(product._id || product.id);
            }
        } catch (err) {
            if (window.Utils?.showToast) window.Utils.showToast(err.message || 'Already marked as helpful', 'warning');
        }
    };

    const renderReviewStars = (rating) => {
        let stars = [];
        for (let i = 1; i <= 5; i++) {
            stars.push(<i key={i} className={`${i <= rating ? 'fas' : 'far'} fa-star`}></i>);
        }
        return stars;
    };

    if (loading) {
        return (
            <div className="loading-state" style={{ textAlign: 'center', padding: '100px' }}>
                <i className="fas fa-spinner fa-spin fa-3x"></i> Loading details...
            </div>
        );
    }

    if (error || !product) return <div className="container" role="alert" style={{ margin: '140px auto 80px', textAlign: 'center' }}><h1>Unable to load product</h1><p>{error}</p><button className="btn btn-primary" onClick={() => setReload(value => value + 1)}>Try again</button> <Link to="/shop" className="btn btn-outline">Browse collection</Link></div>;

    const sellPrice = productPrice(product);
    const mrp = product.mrp;
    const hasDiscount = mrp > sellPrice;
    const disc = hasDiscount ? Math.round((mrp - sellPrice) / mrp * 100) : 0;
    const stock = Math.max(0, Math.floor(Number(product.stock) || 0));
    const isWishlisted = isInWishlist(product._id || product.id);

    // Compute average reviews
    const avgRating = reviews.length > 0 
        ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length 
        : 0;

    return (
        <div className="product-detail-page" style={{ position: 'relative' }}>
            <div className="container product-container" style={{ position: 'relative' }}>
                {/* Cross/Close option to go back to shop page */}
                <button 
                    onClick={() => navigate('/shop')} 
                    style={{
                        position: 'absolute',
                        top: '15px',
                        right: '15px',
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        color: '#fff',
                        borderRadius: '50%',
                        width: '42px',
                        height: '42px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        zIndex: 99
                    }}
                    title="Close and Return to Shop"
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                        e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                        e.currentTarget.style.color = '#ef4444';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                        e.currentTarget.style.color = '#fff';
                    }}
                >
                    <i className="fas fa-times" style={{ fontSize: '1.2rem' }}></i>
                </button>

                {/* Breadcrumb */}
                <div className="breadcrumb">
                    <Link to="/">Home</Link> / <Link to="/shop">Shop</Link> / <span>{product.name}</span>
                </div>

                <div className="product-main-grid">
                    {/* Gallery */}
                    <div className="product-gallery">
                        <div className="product-gallery-viewport" style={{ position: 'relative', cursor: 'zoom-in' }} onClick={() => setLightboxOpen(true)}>
                            <img src={activeImage || 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600'} alt={product.name} className="main-image" style={{ width: '100%', height: 'auto', borderRadius: '12px' }} />
                            
                            {/* Zoom prompt icon */}
                            <div style={{ position: 'absolute', bottom: '15px', right: '15px', background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '6px 12px', borderRadius: '20px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px', pointerEvents: 'none' }}>
                                <i className="fas fa-expand-arrows-alt"></i> Click to enlarge
                            </div>

                            {/* Left/Right Navigation Arrows if multiple images */}
                            {allImages.length > 1 && (
                                <>
                                    <button 
                                        onClick={handlePrevImage}
                                        style={{
                                            position: 'absolute',
                                            left: '15px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            background: '#fbbf24',
                                            color: '#000',
                                            border: 'none',
                                            borderRadius: '50%',
                                            width: '52px',
                                            height: '52px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            cursor: 'pointer',
                                            zIndex: 10,
                                            boxShadow: '0 4px 14px rgba(245, 158, 11, 0.4)',
                                            transition: 'all 0.2s'
                                        }}
                                        title="Previous Image"
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = '#f59e0b';
                                            e.currentTarget.style.transform = 'translateY(-50%) scale(1.05)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = '#fbbf24';
                                            e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
                                        }}
                                    >
                                        <i className="fas fa-chevron-left" style={{ fontSize: '1.2rem' }}></i>
                                    </button>
                                    <button 
                                        onClick={handleNextImage}
                                        style={{
                                            position: 'absolute',
                                            right: '15px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            background: '#fbbf24',
                                            color: '#000',
                                            border: 'none',
                                            borderRadius: '50%',
                                            width: '52px',
                                            height: '52px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            cursor: 'pointer',
                                            zIndex: 10,
                                            boxShadow: '0 4px 14px rgba(245, 158, 11, 0.4)',
                                            transition: 'all 0.2s'
                                        }}
                                        title="Next Image"
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = '#f59e0b';
                                            e.currentTarget.style.transform = 'translateY(-50%) scale(1.05)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = '#fbbf24';
                                            e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
                                        }}
                                    >
                                        <i className="fas fa-chevron-right" style={{ fontSize: '1.2rem' }}></i>
                                    </button>
                                </>
                            )}
                        </div>
                        <div className="product-thumbnails">
                            {allImages.map((url, idx) => (
                                <button 
                                    key={idx} 
                                    className={`thumb-btn ${activeImage === url ? 'active' : ''}`}
                                    onClick={() => setActiveImage(url)}
                                >
                                    <img src={url} alt={product.name} />
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Details Info */}
                    <div className="product-details">
                        <h1>{product.name}</h1>
                        <div className="product-rating-summary">
                            <div className="stars">
                                {renderReviewStars(avgRating)}
                            </div>
                            <span>({reviews.length} reviews)</span>
                        </div>

                        <div className="product-price">
                            {hasDiscount ? (
                                <>
                                    <span className="price-mrp">
                                        {formatINR(mrp)}
                                    </span>
                                    <span className="price-sell">
                                        {formatINR(sellPrice)}
                                    </span>
                                    <span className="discount-badge">
                                        {disc}% OFF
                                    </span>
                                </>
                            ) : (
                                formatINR(sellPrice)
                            )}
                        </div>

                        <p className="product-description">{product.description || 'No description available.'}</p>

                        {/* Features */}
                        {product.features?.length > 0 && (
                            <div className="product-features">
                                <h3>Product Features</h3>
                                <ul>
                                    {product.features.map((feature, idx) => (
                                        <li key={idx}><i className="fas fa-check"></i> {feature}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Size Selection */}
                        <div className="product-options">
                            {product.sizes?.length > 0 && (
                                <div className="option-group">
                                    <div className="option-header">
                                        <label>Size</label>
                                        <button className="size-guide-btn" onClick={() => setIsSizeGuideOpen(true)}>
                                            <i className="fas fa-ruler-combined"></i> Size Guide
                                        </button>
                                    </div>
                                    <div className="size-selector">
                                        {product.sizes.map(size => (
                                            <button 
                                                key={size}
                                                className={`size-btn ${selectedSize === size ? 'active' : ''}`}
                                                onClick={() => setSelectedSize(size)}
                                            >
                                                {size}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Quantity Selector */}
                            {product.colors?.length > 0 && <div className="option-group"><label htmlFor="product-color">Color</label><select id="product-color" className="form-control" value={selectedColor} onChange={event => setSelectedColor(event.target.value)}>{product.colors.map(color => <option key={color} value={color}>{color}</option>)}</select></div>}
                            <div className="option-group">
                                <label>Quantity</label>
                                <div className="quantity-selector">
                                    <button className="qty-btn" onClick={() => setQuantity(prev => Math.max(1, prev - 1))} disabled={quantity <= 1 || stock === 0} aria-label="Decrease quantity">-</button>
                                    <input 
                                        type="number" 
                                        value={quantity} 
                                        onChange={(e) => setQuantity(Math.max(1, Math.min(stock, parseInt(e.target.value) || 1)))}
                                        min="1" 
                                        max={stock}
                                        disabled={stock === 0}
                                        aria-label="Quantity"
                                    />
                                    <button className="qty-btn" onClick={() => setQuantity(prev => Math.min(stock, prev + 1))} disabled={quantity >= stock} aria-label="Increase quantity">+</button>
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="product-actions">
                            <button className="add-to-cart-large" onClick={() => handleAddToCart()} disabled={stock === 0}>
                                <i className="fas fa-cart-plus"></i> {stock > 0 ? 'Add to Cart' : 'Out of Stock'}
                            </button>
                            <button className="btn btn-outline" onClick={() => handleAddToCart(true)} disabled={stock === 0}>Buy Now</button>
                            <button className={`wishlist-btn-large ${isWishlisted ? 'active' : ''}`} onClick={handleWishlistClick} title="Save to Wishlist">
                                <i className={`${isWishlisted ? 'fas' : 'far'} fa-heart`}></i>
                            </button>
                        </div>

                        <div className="product-meta mt-4">
                            <p><strong>Category:</strong> <span>{product.category || 'Uncategorized'}</span></p>
                            <p><strong>Availability:</strong> <span className={product.stock > 0 ? 'status-in-stock' : 'status-out-of-stock'}>{product.stock > 0 ? `In Stock (${product.stock})` : 'Out of Stock'}</span></p>
                        </div>
                    </div>
                </div>

                {/* Reviews List */}
                <div className="reviews-section mt-5">
                    <div className="section-header">
                        <h2>Customer Reviews</h2>
                    </div>

                    <div className="reviews-grid">
                        <div className="reviews-summary">
                            <div className="rating-huge">{avgRating.toFixed(1)}</div>
                            <div className="stars mb-2">
                                {renderReviewStars(avgRating)}
                            </div>
                            <p>Based on {reviews.length} reviews</p>

                            {reviews.length > 0 && (
                                <div className="write-review-box mt-4">
                                    <h4>Share your thoughts</h4>
                                    <p>If you've used this product, share your thoughts with other customers</p>
                                    <button 
                                        className="btn btn-outline mt-2" 
                                        onClick={() => {
                                            if (!isLoggedIn) {
                                                if (window.Utils?.showToast) window.Utils.showToast('Please login to write a review', 'info');
                                                navigate('/login');
                                                return;
                                            }
                                            setShowReviewForm(true);
                                        }}
                                    >
                                        Write a Review
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="reviews-list">
                            {showReviewForm && (
                                <form className="review-form" onSubmit={handleReviewSubmit}>
                                    <h4>Write a Review</h4>
                                    <div className="form-group">
                                        <label>Rating</label>
                                        <div className="star-rating-input">
                                            {[1, 2, 3, 4, 5].map(star => (
                                                <i 
                                                    key={star} 
                                                    className={`${(hoverRating || reviewRating) >= star ? 'fas' : 'far'} fa-star`}
                                                    onClick={() => setReviewRating(star)}
                                                    onMouseEnter={() => setHoverRating(star)}
                                                    onMouseLeave={() => setHoverRating(0)}
                                                    style={{ cursor: 'pointer' }}
                                                ></i>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label>Comment</label>
                                        <textarea 
                                            value={reviewComment}
                                            onChange={(e) => setReviewComment(e.target.value)}
                                            className="form-control" 
                                            rows="4" 
                                            required 
                                            placeholder="What did you like or dislike?"
                                        ></textarea>
                                    </div>
                                    <div className="form-group">
                                        <label>Upload Images (Optional)</label>
                                        <input 
                                            type="file" 
                                            ref={fileInputRef}
                                            onChange={handleFileChange}
                                            className="form-control" 
                                            accept="image/*" 
                                            multiple 
                                        />
                                        <small className="text-muted">Upload up to 5 images of your product (Max size: 2MB per image)</small>
                                        <div className="image-preview">
                                            {reviewImagePreviews.map((src, index) => (
                                                <div key={index} className="preview-image">
                                                    <img src={src} alt="Preview" />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="form-actions" style={{ display: 'flex', gap: '10px' }}>
                                        <button type="submit" className="btn btn-primary" disabled={submittingReview}>
                                            {submittingReview ? 'Submitting...' : 'Submit Review'}
                                        </button>
                                        <button type="button" className="btn btn-outline" onClick={() => setShowReviewForm(false)}>
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            )}

                            <div id="reviewsContainer">
                                {reviews.map(r => (
                                    <div key={r._id || r.id} className="review-card">
                                        <div className="review-header">
                                            <div className="author-info">
                                                <span className="author-name">{r.user?.name || 'Anonymous'}</span>
                                                {r.isVerifiedPurchase && <span className="verified-badge"><i className="fas fa-check-circle"></i> Verified Purchase</span>}
                                                <div className="review-stars">{renderReviewStars(r.rating || 0)}</div>
                                            </div>
                                            <span className="review-date">{formatDate(r.createdAt)}</span>
                                        </div>
                                        <p className="review-comment">{r.comment || ''}</p>
                                        {r.images?.length > 0 && (
                                            <div className="review-images">
                                                {r.images.map((img, idx) => (
                                                    <img key={idx} src={img.url} alt="Review attachment" className="review-image" onClick={() => window.open(img.url, '_blank')} />
                                                ))}
                                            </div>
                                        )}
                                        <div className="review-helpful">
                                            <button 
                                                className="helpful-btn" 
                                                onClick={(e) => handleMarkHelpful(r._id || r.id, e)} 
                                                disabled={r.helpfulUsers?.includes(user?._id || user?.id)}
                                            >
                                                <i className="far fa-thumbs-up"></i> Helpful (<span className="helpful-count">{r.helpful || 0}</span>)
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                {reviews.length === 0 && (
                                    <div className="empty-reviews-card">
                                        <div className="empty-reviews-icon">
                                            <i className="far fa-comment-alt"></i>
                                        </div>
                                        <h4>No Reviews Yet</h4>
                                        <p>Be the first customer to share your experience with this item!</p>
                                        <button className="btn btn-empty-review" onClick={() => {
                                            if (!isLoggedIn) {
                                                if (window.Utils?.showToast) window.Utils.showToast('Please login to write a review', 'info');
                                                navigate('/login');
                                                return;
                                            }
                                            setShowReviewForm(true);
                                        }}>
                                            <i className="fas fa-edit"></i> Write the First Review
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Size Guide Calculator Modal */}
            {isSizeGuideOpen && (
                <>
                    <div className="modal active" id="sizeGuideModal" style={{ display: 'flex' }}>
                        <div className="modal-content">
                            <button className="close-modal" onClick={() => setIsSizeGuideOpen(false)}>
                                <i className="fas fa-times"></i>
                            </button>
                            <h2>Interactive Size Guide</h2>
                            <p>Estimate a starting size from your height and weight. This guide is approximate; garment measurements give a more reliable fit.</p>
                            
                            <form className="size-guide-form" onSubmit={handleSizeRecommendation}>
                                <div className="form-group">
                                    <label>Height (cm)</label>
                                    <input 
                                        type="number" 
                                        className="form-control" 
                                        placeholder="e.g. 175" 
                                        value={height}
                                        onChange={(e) => setHeight(e.target.value)}
                                        required 
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Weight (kg)</label>
                                    <input 
                                        type="number" 
                                        className="form-control" 
                                        placeholder="e.g. 70" 
                                        value={weight}
                                        onChange={(e) => setWeight(e.target.value)}
                                        required 
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Fit Preference</label>
                                    <select 
                                        className="form-control" 
                                        value={fit}
                                        onChange={(e) => setFit(e.target.value)}
                                    >
                                        <option value="tight">Tight</option>
                                        <option value="regular">Regular</option>
                                        <option value="loose">Loose (Oversized)</option>
                                    </select>
                                </div>
                                <button type="submit" className="btn btn-primary btn-full mt-3">Recommend Size</button>
                                
                                {recommendedSize && (
                                    <div className="size-result" id="sizeResult" style={{ display: 'block' }}>
                                        <h4>Recommended Size:</h4>
                                        <div className="recommended-badge">{recommendedSize}</div>
                                        <p className="text-center mt-2">{sizeReasoning}</p>
                                    </div>
                                )}
                            </form>
                        </div>
                    </div>
                    <div className="modal-backdrop" onClick={() => setIsSizeGuideOpen(false)} style={{ display: 'block' }}></div>
                </>
            )}

            {/* Lightbox / Fullscreen Image Viewer Modal */}
            {lightboxOpen && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    background: 'rgba(0, 0, 0, 0.92)',
                    zIndex: 10000,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px'
                }} onClick={() => setLightboxOpen(false)}>
                    <button onClick={() => setLightboxOpen(false)} style={{
                        position: 'absolute',
                        top: '25px',
                        right: '30px',
                        background: 'rgba(255,255,255,0.1)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '50%',
                        width: '45px',
                        height: '45px',
                        fontSize: '1.2rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 10001
                    }} title="Close">
                        <i className="fas fa-times"></i>
                    </button>

                    {allImages.length > 1 && (
                        <>
                            <button onClick={handlePrevImage} style={{
                                position: 'absolute',
                                left: '30px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'rgba(255,255,255,0.15)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '50%',
                                width: '55px',
                                height: '55px',
                                fontSize: '1.4rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                zIndex: 10001
                            }} title="Previous Image">
                                <i className="fas fa-chevron-left"></i>
                            </button>
                            <button onClick={handleNextImage} style={{
                                position: 'absolute',
                                right: '30px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'rgba(255,255,255,0.15)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '50%',
                                width: '55px',
                                height: '55px',
                                fontSize: '1.4rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                zIndex: 10001
                            }} title="Next Image">
                                <i className="fas fa-chevron-right"></i>
                            </button>
                        </>
                    )}

                    <div style={{ maxWidth: '90vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <img 
                            src={activeImage} 
                            alt={product.name} 
                            style={{ 
                                maxWidth: '100%', 
                                maxHeight: '80vh', 
                                objectFit: 'contain', 
                                borderRadius: '8px', 
                                boxShadow: '0 10px 40px rgba(0,0,0,0.8)' 
                            }} 
                        />
                        <div style={{ color: '#aaa', marginTop: '15px', fontSize: '0.9rem' }}>
                            {product.name} — {allImages.indexOf(activeImage) + 1} of {allImages.length}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductDetail;
