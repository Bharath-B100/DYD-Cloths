/**
 * DYD-Clothes Product Detail Page
 * Manages product info, size selection, and reviews.
 */

document.addEventListener('DOMContentLoaded', () => {
    Product.init();
});

const Product = {
    data: null,
    selectedSize: null,

    init: async () => {
        const params = Utils.getQueryParams();
        const id = params.id || localStorage.getItem('currentProductId');
        
        if (!id) {
            window.location.href = 'shop.html';
            return;
        }
        
        // Save it for future reloads just in case
        localStorage.setItem('currentProductId', id);

        await Product.fetchData(id);
        Product.setupEventListeners();
        Product.setupReviewForm();
    },

    fetchData: async (id) => {
        try {
            const res = await API.get(`/products/${id}`);
            if (res.success) {
                // FIXED: Handle nested data structure
                Product.data = res.data.data?.product || res.data.data || res.data;
                Product.render();
                Product.fetchReviews(id);
            } else {
                throw new Error(res.error || 'Product not found');
            }
        } catch (error) {
            console.error('Fetch product error:', error);
            Utils.showToast('Product not found', 'error');
            setTimeout(() => window.location.href = 'shop.html', 1500);
        }
    },

    render: () => {
        const p = Product.data;
        if (!p) return;

        // Basic Info
        Utils.setHTML('productTitle', Utils.escapeHtml(p.name || 'Product'));
        Utils.setHTML('productPrice', Utils.formatINR(p.price || 0));
        Utils.setHTML('productDesc', Utils.escapeHtml(p.description || 'No description available'));
        Utils.setHTML('productCategory', Utils.escapeHtml(p.category || 'Uncategorized'));
        Utils.setHTML('bcProductName', Utils.escapeHtml(p.name || 'Product'));
        
        const img = document.getElementById('mainProductImage');
        if (img) img.src = p.mainImage || 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400';
        Product.renderGallery();
        Product.renderFeatures();

        // Stock Status
        const stockEl = document.getElementById('productStock');
        if (stockEl) {
            const stock = p.stock || 0;
            stockEl.textContent = stock > 0 ? `In Stock (${stock})` : 'Out of Stock';
            stockEl.className = stock > 0 ? 'status-in-stock' : 'status-out-of-stock';
        }

        // Sizes
        const sizeContainer = document.getElementById('sizeSelector');
        if (sizeContainer && p.sizes && p.sizes.length) {
            sizeContainer.innerHTML = p.sizes.map(size => `
                <button class="size-btn" data-size="${Utils.escapeHtml(size)}">${Utils.escapeHtml(size)}</button>
            `).join('');
            
            // Auto-select first size
            const firstSize = sizeContainer.querySelector('.size-btn');
            if (firstSize) {
                firstSize.classList.add('active');
                Product.selectedSize = firstSize.dataset.size;
            }
        }

        // Wishlist State
        const wishlistBtn = document.getElementById('wishlistBtn');
        if (wishlistBtn && AuthManager.user?.wishlist?.includes(p._id)) {
            wishlistBtn.classList.add('active');
            const icon = wishlistBtn.querySelector('i');
            if (icon) icon.className = 'fas fa-heart';
        }
    },

    renderGallery: () => {
        const p = Product.data;
        const thumbnailContainer = document.getElementById('productThumbnails');
        const mainImage = document.getElementById('mainProductImage');
        if (!thumbnailContainer || !mainImage || !p) return;

        const images = [
            { url: p.mainImage, altText: p.name },
            ...(p.images || [])
        ].map(img => typeof img === 'string' ? { url: img, altText: p.name } : img)
            .filter(img => img.url);

        thumbnailContainer.innerHTML = images.map((img, index) => `
            <button class="thumb-btn ${index === 0 ? 'active' : ''}" data-image="${img.url}">
                <img src="${img.url}" alt="${Utils.escapeHtml(img.altText || p.name)}">
            </button>
        `).join('');

        thumbnailContainer.querySelectorAll('.thumb-btn').forEach(button => {
            button.addEventListener('click', () => {
                thumbnailContainer.querySelectorAll('.thumb-btn').forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                mainImage.src = button.dataset.image;
            });
        });
    },

    renderFeatures: () => {
        const container = document.getElementById('productFeatures');
        const features = Product.data?.features || [];
        if (!container) return;

        if (!features.length) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = `
            <h3>Product Features</h3>
            <ul>
                ${features.map(feature => `<li><i class="fas fa-check"></i> ${Utils.escapeHtml(feature)}</li>`).join('')}
            </ul>
        `;
    },

    fetchReviews: async (id) => {
        const container = document.getElementById('reviewsContainer');
        if (!container) return;

        try {
            const res = await API.get(`/products/${id}/reviews`);
            const reviewsData = res.data?.reviews || res.data?.data || res.data || [];
            const reviews = Array.isArray(reviewsData) ? reviewsData : (reviewsData.reviews || []);

            if (reviews.length === 0) {
                container.innerHTML = '<p class="no-reviews">No reviews yet. Be the first to review!</p>';
                return;
            }

            container.innerHTML = reviews.map(r => `
                <div class="review-card">
                    <div class="review-header">
                        <div class="author-info">
                            <span class="author-name">${Utils.escapeHtml(r.user?.name || 'Anonymous')}</span>
                            ${r.isVerifiedPurchase ? '<span class="verified-badge"><i class="fas fa-check-circle"></i> Verified Purchase</span>' : ''}
                            <div class="review-stars">${Product.renderStars(r.rating || 0)}</div>
                        </div>
                        <span class="review-date">${Utils.formatDate(r.createdAt)}</span>
                    </div>
                    <p class="review-comment">${Utils.escapeHtml(r.comment || '')}</p>
                    ${r.images && r.images.length ? `
                        <div class="review-images">
                            ${r.images.map(img => `
                                <img src="${img.url}" alt="${Utils.escapeHtml(img.altText || 'Review image')}" class="review-image" onclick="window.open('${img.url}', '_blank')">
                            `).join('')}
                        </div>
                    ` : ''}
                    <div class="review-helpful">
                        <button class="helpful-btn" onclick="Product.markHelpful('${r._id}', this)" ${r.helpfulUsers?.includes(AuthManager.user?._id) ? 'disabled' : ''}>
                            <i class="far fa-thumbs-up"></i> Helpful (<span class="helpful-count">${r.helpful || 0}</span>)
                        </button>
                    </div>
                </div>
            `).join('');

            // Update summary
            Utils.setHTML('productReviewCount', `(${reviews.length} reviews)`);
            Utils.setHTML('totalReviewsCount', reviews.length);
            
            // Average rating
            const avgRating = reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length;
            Utils.setHTML('avgRatingHuge', avgRating.toFixed(1));
            document.getElementById('avgStarsSummary').innerHTML = Product.renderStars(avgRating);
        } catch (err) {
            console.error('Fetch reviews error:', err);
            container.innerHTML = '<p>Failed to load reviews.</p>';
        }
    },

    renderStars: (rating) => {
        let stars = '';
        for (let i = 1; i <= 5; i++) {
            stars += `<i class="${i <= rating ? 'fas' : 'far'} fa-star"></i>`;
        }
        return stars;
    },

    setupEventListeners: () => {
        // Size Selection
        const sizeSelector = document.getElementById('sizeSelector');
        if (sizeSelector) {
            sizeSelector.addEventListener('click', (e) => {
                if (e.target.classList.contains('size-btn')) {
                    document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
                    e.target.classList.add('active');
                    Product.selectedSize = e.target.dataset.size;
                }
            });
        }

        // Quantity
        const qtyInput = document.getElementById('qtyInput');
        const qtyPlus = document.getElementById('qtyPlus');
        const qtyMinus = document.getElementById('qtyMinus');
        
        if (qtyPlus) {
            qtyPlus.addEventListener('click', () => {
                if (qtyInput && Product.data && qtyInput.value < (Product.data.stock || 10)) {
                    qtyInput.value = parseInt(qtyInput.value) + 1;
                }
            });
        }
        
        if (qtyMinus) {
            qtyMinus.addEventListener('click', () => {
                if (qtyInput && qtyInput.value > 1) {
                    qtyInput.value = parseInt(qtyInput.value) - 1;
                }
            });
        }

        // Add to Cart
        const addToCartBtn = document.getElementById('addToCartBtn');
        if (addToCartBtn) {
            addToCartBtn.addEventListener('click', () => {
                if (!Product.data) return;
                
                const quantity = qtyInput ? parseInt(qtyInput.value) : 1;
                const success = CartManager.addItem({
                    id: Product.data._id,
                    name: Product.data.name,
                    price: Product.data.price,
                    image: Product.data.mainImage,
                    size: Product.selectedSize || 'M',
                    color: 'Default',
                    quantity: quantity,
                    maxStock: Product.data.stock || 999
                });

                if (success && typeof window.openCart === 'function') {
                    window.openCart();
                }
            });
        }

        // Wishlist
        const wishlistBtn = document.getElementById('wishlistBtn');
        if (wishlistBtn) {
            wishlistBtn.addEventListener('click', async (e) => {
                const btn = e.currentTarget;
                if (!AuthManager.isLoggedIn()) {
                    Utils.showToast('Please login to use wishlist', 'info');
                    return;
                }

                const isActive = btn.classList.contains('active');
                const icon = btn.querySelector('i');
                
                btn.classList.toggle('active');
                if (icon) icon.className = isActive ? 'far fa-heart' : 'fas fa-heart';

                try {
                    if (isActive) {
                        await API.delete(`/auth/wishlist/${Product.data._id}`);
                        Utils.showToast('Removed from wishlist', 'success');
                    } else {
                        await API.post(`/auth/wishlist/${Product.data._id}`);
                        Utils.showToast('Added to wishlist', 'success');
                    }
                } catch (err) {
                    // Revert on error
                    btn.classList.toggle('active');
                    if (icon) icon.className = isActive ? 'fas fa-heart' : 'far fa-heart';
                    Utils.showToast('Failed to update wishlist', 'error');
                }
            });
        }
        // Star input interaction
        const starInputs = document.querySelectorAll('.star-rating-input i');
        starInputs.forEach(star => {
            star.addEventListener('click', () => {
                const rating = parseInt(star.dataset.rating);
                document.getElementById('reviewRating').value = rating;
                Product.updateStarSelection(rating);
            });
            star.addEventListener('mouseover', () => {
                Product.updateStarSelection(parseInt(star.dataset.rating));
            });
            star.addEventListener('mouseout', () => {
                Product.updateStarSelection(parseInt(document.getElementById('reviewRating').value));
            });
        });
    },

    setupReviewForm: () => {
        const reviewForm = document.getElementById('reviewForm');
        const imageInput = document.getElementById('reviewImages');
        const previewContainer = document.getElementById('reviewImagePreview');
        let selectedImages = [];

        imageInput?.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            selectedImages = files;
            
            previewContainer.innerHTML = '';
            files.forEach((file, index) => {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const div = document.createElement('div');
                    div.className = 'preview-image';
                    div.innerHTML = `
                        <img src="${event.target.result}" alt="Preview">
                        <span class="remove-image" data-index="${index}">&times;</span>
                    `;
                    previewContainer.appendChild(div);
                    
                    div.querySelector('.remove-image').addEventListener('click', () => {
                        selectedImages.splice(index, 1);
                        const newFileList = new DataTransfer();
                        selectedImages.forEach(file => newFileList.items.add(file));
                        imageInput.files = newFileList.files;
                        div.remove();
                    });
                };
                reader.readAsDataURL(file);
            });
        });

        document.getElementById('writeReviewBtn')?.addEventListener('click', () => {
            if (!AuthManager.isLoggedIn()) {
                Utils.showToast('Please login to write a review', 'info');
                window.location.href = 'login.html';
                return;
            }
            reviewForm.classList.remove('hidden');
            document.querySelector('.write-review-box')?.classList.add('hidden');
        });

        document.getElementById('cancelReviewBtn')?.addEventListener('click', () => {
            reviewForm.classList.add('hidden');
            document.querySelector('.write-review-box')?.classList.remove('hidden');
            reviewForm.reset();
            selectedImages = [];
            previewContainer.innerHTML = '';
            document.getElementById('reviewRating').value = 0;
            Product.updateStarSelection(0);
        });

        reviewForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const rating = parseInt(document.getElementById('reviewRating').value);
            const comment = document.getElementById('reviewComment').value;
            
            if (rating === 0) {
                Utils.showToast('Please select a rating', 'error');
                return;
            }
            
            const submitBtn = reviewForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
            submitBtn.disabled = true;
            
            try {
                const formData = new FormData();
                formData.append('rating', rating);
                formData.append('comment', comment);
                
                // Add images
                const imageInput = document.getElementById('reviewImages');
                if (imageInput.files) {
                    Array.from(imageInput.files).forEach(file => {
                        formData.append('images', file);
                    });
                }
                
                const token = localStorage.getItem('token');
                const response = await fetch(`${API_BASE_URL}/products/${Product.data._id}/reviews`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });
                
                const result = await response.json();
                
                if (result.success) {
                    Utils.showToast('Review submitted successfully!', 'success');
                    reviewForm.classList.add('hidden');
                    document.querySelector('.write-review-box')?.classList.remove('hidden');
                    reviewForm.reset();
                    selectedImages = [];
                    previewContainer.innerHTML = '';
                    document.getElementById('reviewRating').value = 0;
                    Product.updateStarSelection(0);
                    Product.fetchReviews(Product.data._id);
                } else {
                    throw new Error(result.error || 'Submission failed');
                }
            } catch (error) {
                Utils.showToast(error.message, 'error');
            } finally {
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        });
    },

    updateStarSelection: (rating) => {
        const stars = document.querySelectorAll('.star-rating-input i');
        stars.forEach((star, index) => {
            if (index < rating) {
                star.className = 'fas fa-star';
            } else {
                star.className = 'far fa-star';
            }
        });
    },

    markHelpful: async (reviewId, btn) => {
        if (!AuthManager.isLoggedIn()) {
            Utils.showToast('Please login to mark reviews as helpful', 'info');
            return;
        }
        
        try {
            const res = await API.post(`/reviews/${reviewId}/helpful`);
            if (res.success) {
                const helpfulCount = btn.querySelector('.helpful-count');
                if (helpfulCount) {
                    helpfulCount.textContent = res.data.helpful;
                }
                btn.disabled = true;
                Utils.showToast('Thanks for your feedback!', 'success');
            }
        } catch (error) {
            Utils.showToast(error.message || 'Already marked as helpful', 'warning');
        }
    },
};

window.Product = Product;