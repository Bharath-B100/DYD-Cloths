/**
 * DYD-Clothes Shop Page
 * Handles product listing, searching, filtering, and sorting.
 */

document.addEventListener('DOMContentLoaded', () => {
    Shop.init();
});

const Shop = {
    allProducts: [],
    filteredProducts: [],

    init: async () => {
        Shop.setupEventListeners();
        await Shop.fetchProducts();
        Shop.handleInitialUrlState();
    },

    /**
     * Fetch all products from API
     */
    fetchProducts: async () => {
        const grid = document.getElementById('shopProducts');
        if (grid) grid.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i> Loading products...</div>';

        try {
            const response = await API.get('/products');
            if (response.success) {
                // FIXED: Handle nested data structure
                Shop.allProducts = response.data?.products || response.data?.data || response.data;
                if (!Array.isArray(Shop.allProducts)) {
                    Shop.allProducts = [];
                }
                Shop.filteredProducts = [...Shop.allProducts];
                Shop.renderProducts();
            } else {
                throw new Error(response.error || 'Failed to load products');
            }
        } catch (error) {
            console.error('Fetch products error:', error);
            Utils.showToast('Failed to load products', 'error');
            if (grid) grid.innerHTML = '<div class="error-state">Failed to load products. Please try again later.</div>';
        }
    },

    /**
     * Render product grid
     */
    renderProducts: (products = Shop.filteredProducts) => {
        const grid = document.getElementById('shopProducts');
        const count = document.getElementById('productCount');
        
        if (!grid) return;
        if (count) count.textContent = products.length;

        if (products.length === 0) {
            grid.innerHTML = `
                <div class="no-results">
                    <i class="fas fa-search"></i>
                    <p>No products found matching your criteria.</p>
                    <button onclick="Shop.resetFilters()" class="btn btn-outline">Clear All Filters</button>
                </div>
            `;
            return;
        }

        grid.innerHTML = products.map(product => Shop.createProductCard(product)).join('');
    },

    createProductCard: (product) => {
        const inWishlist = AuthManager.user?.wishlist?.includes(product._id);
        
        return `
            <div class="product-card">
                <div class="product-image">
                    <img src="${product.mainImage}" alt="${product.name}" 
                         onerror="this.src='https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400'"
                         onclick="localStorage.setItem('currentProductId', '${product._id}'); window.location.href='product.html?id=${product._id}'">
                    <button class="wishlist-btn ${inWishlist ? 'active' : ''}" 
                            onclick="Shop.toggleWishlist('${product._id}', this)">
                        <i class="${inWishlist ? 'fas' : 'far'} fa-heart"></i>
                    </button>
                    <div class="product-overlay">
                        <button class="btn-add" onclick="Shop.quickAddToCart('${product._id}')">
                            <i class="fas fa-cart-plus"></i> Add to Cart
                        </button>
                        <button class="btn-details" onclick="localStorage.setItem('currentProductId', '${product._id}'); window.location.href='product.html?id=${product._id}'">
                            <i class="fas fa-eye"></i> View Details
                        </button>
                    </div>
                </div>
                <div class="product-info">
                    <span class="product-category">${product.category || 'Uncategorized'}</span>
                    <h3 class="product-title" onclick="localStorage.setItem('currentProductId', '${product._id}'); window.location.href='product.html?id=${product._id}'">${Utils.escapeHtml(product.name || 'Product')}</h3>
                    <div class="product-footer">
                        <span class="product-price">${Utils.formatINR(product.price)}</span>
                        ${product.rating ? `
                            <div class="product-rating">
                                <i class="fas fa-star"></i>
                                <span>${product.rating.toFixed(1)}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Filter and Sort Logic
     */
    applyFilters: () => {
        const query = document.getElementById('searchInput')?.value.toLowerCase();
        const categories = Array.from(document.querySelectorAll('input[name="category"]:checked')).map(c => c.value);
        const productTypes = Array.from(document.querySelectorAll('input[name="productType"]:checked')).map(c => c.value);
        const priceRange = document.querySelector('input[name="price"]:checked')?.value;
        const priceSort = document.getElementById('sortSelect')?.value;

        let filtered = Shop.allProducts.filter(p => {
            const matchesSearch = !query || (p.name && p.name.toLowerCase().includes(query)) || (p.category && p.category.toLowerCase().includes(query));
            const matchesCategory = categories.length === 0 || (p.category && categories.includes(p.category.toLowerCase()));
            const matchesType = productTypes.length === 0 || (p.productTypes || []).some(type => productTypes.includes(type));
            
            // FIXED: Price filter for INR values
            let matchesPrice = true;
            const price = p.price || 0;
            
            if (priceRange === 'under-20') {
                matchesPrice = price < 1700;
            } else if (priceRange === '20-30') {
                matchesPrice = price >= 1700 && price <= 2500;
            } else if (priceRange === 'over-30') {
                matchesPrice = price > 2500;
            }
            
            return matchesSearch && matchesCategory && matchesType && matchesPrice;
        });

        // Sorting
        if (priceSort === 'low') filtered.sort((a, b) => (a.price || 0) - (b.price || 0));
        else if (priceSort === 'high') filtered.sort((a, b) => (b.price || 0) - (a.price || 0));
        else if (priceSort === 'new') filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        else if (priceSort === 'popular') filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));

        Shop.filteredProducts = filtered;
        Shop.renderProducts();
    },

    resetFilters: () => {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.value = '';
        document.querySelectorAll('input[name="category"]').forEach(c => c.checked = false);
        document.querySelectorAll('input[name="productType"]').forEach(c => c.checked = false);
        document.querySelectorAll('input[name="price"]').forEach(c => {
            if (c.value === 'all') c.checked = true;
            else c.checked = false;
        });
        const sortSelect = document.getElementById('sortSelect');
        if (sortSelect) sortSelect.value = 'new';
        Shop.filteredProducts = [...Shop.allProducts];
        Shop.renderProducts();
    },

    /**
     * Actions
     */
    quickAddToCart: (productId) => {
        const product = Shop.allProducts.find(p => p._id === productId);
        if (!product) return;

        const added = CartManager.addItem({
            id: product._id,
            name: product.name,
            price: product.price,
            image: product.mainImage,
            size: 'M',
            color: product.colors && product.colors[0] ? product.colors[0] : 'Default',
            quantity: 1,
            maxStock: product.stock || 999
        });
        
        if (added && typeof window.openCart === 'function') {
            window.openCart();
        }
    },

    toggleWishlist: async (productId, btn) => {
        if (!AuthManager.isLoggedIn()) {
            Utils.showToast('Please login to use wishlist', 'info');
            setTimeout(() => window.location.href = 'login.html', 1000);
            return;
        }

        const icon = btn.querySelector('i');
        const isActive = btn.classList.contains('active');

        try {
            // Optimistic UI
            btn.classList.toggle('active');
            icon.className = isActive ? 'far fa-heart' : 'fas fa-heart';

            if (isActive) {
                await API.delete(`/auth/wishlist/${productId}`);
                Utils.showToast('Removed from wishlist', 'success');
            } else {
                await API.post(`/auth/wishlist/${productId}`);
                Utils.showToast('Added to wishlist', 'success');
            }
        } catch (error) {
            // Revert on error
            btn.classList.toggle('active');
            icon.className = isActive ? 'fas fa-heart' : 'far fa-heart';
            Utils.showToast('Failed to update wishlist', 'error');
        }
    },

    setupEventListeners: () => {
        const applyBtn = document.getElementById('applyFilters');
        const searchInput = document.getElementById('searchInput');
        const sortSelect = document.getElementById('sortSelect');

        if (applyBtn) applyBtn.addEventListener('click', () => Shop.applyFilters());
        if (searchInput) searchInput.addEventListener('input', Utils.debounce(() => Shop.applyFilters(), 300));
        if (sortSelect) sortSelect.addEventListener('change', () => Shop.applyFilters());
    },

    handleInitialUrlState: () => {
        const params = Utils.getQueryParams();
        if (params.search) {
            const searchInput = document.getElementById('searchInput');
            if (searchInput) searchInput.value = params.search;
            Shop.applyFilters();
        }
        if (params.category) {
            const checkbox = document.querySelector(`input[value="${params.category.toLowerCase()}"]`);
            if (checkbox) checkbox.checked = true;
            Shop.applyFilters();
        }
        if (params.type) {
            const checkbox = document.querySelector(`input[name="productType"][value="${params.type.toLowerCase()}"]`);
            if (checkbox) checkbox.checked = true;
            Shop.applyFilters();
        }
    }
};

window.Shop = Shop;
