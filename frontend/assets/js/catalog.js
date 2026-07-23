document.addEventListener('DOMContentLoaded', () => CatalogPage.init());

const CatalogPage = {
    products: [],

    init: async () => {
        await CatalogPage.loadProducts();
    },

    loadProducts: async () => {
        const catalog = document.body.dataset.catalog;
        const grid = document.getElementById('catalogProducts');
        if (!catalog || !grid) return;

        grid.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i> Loading products...</div>';

        try {
            const response = await API.get(`/products?catalog=${encodeURIComponent(catalog)}&limit=100`);
            const rawProducts = response.data?.products || response.data?.data || response.data || [];
            CatalogPage.products = Array.isArray(rawProducts) ? rawProducts : [];
            CatalogPage.renderProducts();
        } catch (error) {
            console.error('Catalog products error:', error);
            grid.innerHTML = '<div class="error-state">Failed to load products. Please try again later.</div>';
        }
    },

    renderProducts: () => {
        const grid = document.getElementById('catalogProducts');
        const count = document.getElementById('catalogCount');
        if (!grid) return;
        if (count) count.textContent = CatalogPage.products.length;

        if (CatalogPage.products.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-box-open"></i>
                    <p>No products are assigned to this page yet.</p>
                    <a class="btn btn-primary" href="shop.html">Browse Shop</a>
                </div>
            `;
            return;
        }

        grid.innerHTML = CatalogPage.products.map(product => CatalogPage.createCard(product)).join('');
    },

    createCard: (product) => {
        const sellPrice = product.sellingPrice || product.price || 0;
        const mrp = product.mrp;
        const disc = product.discountPercent || 0;
        const hasDiscount = mrp && mrp > sellPrice && disc > 0;
        const priceHtml = hasDiscount
            ? `<div class="price-block">
                    <span class="price-mrp">${Utils.formatINR(mrp)}</span>
                    <span class="price-sell">${Utils.formatINR(sellPrice)}</span>
                    <span class="discount-badge">${disc}% OFF</span>
               </div>`
            : `<span class="product-price">${Utils.formatINR(sellPrice)}</span>`;

        return `
        <div class="product-card">
            <div class="product-image">
                <img src="${product.mainImage || 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400'}"
                     alt="${Utils.escapeHtml(product.name || 'Product')}"
                     onerror="this.src='https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400'">
                <div class="product-overlay">
                    <button class="btn-add" onclick="CatalogPage.addToCart('${product._id}')">
                        <i class="fas fa-cart-plus"></i> Add to Cart
                    </button>
                    <button class="btn-details" onclick="localStorage.setItem('currentProductId', '${product._id}'); window.location.href='product.html?id=${product._id}'">
                        <i class="fas fa-eye"></i> View Details
                    </button>
                </div>
            </div>
            <div class="product-info">
                <span class="product-category">${Utils.escapeHtml(product.category || 'T-shirt')}</span>
                <h3 class="product-title">${Utils.escapeHtml(product.name || 'Product')}</h3>
                <div class="product-footer">
                    ${priceHtml}
                    ${product.rating ? `<span class="product-rating"><i class="fas fa-star"></i> ${product.rating.toFixed(1)}</span>` : ''}
                </div>
            </div>
        </div>
        `;
    },

    addToCart: (productId) => {
        const product = CatalogPage.products.find(item => item._id === productId);
        if (!product) return;

        CartManager.addItem({
            id: product._id,
            name: product.name,
            price: product.sellingPrice || product.price,
            image: product.mainImage,
            size: 'M',
            color: product.colors?.[0] || 'Default',
            quantity: 1,
            maxStock: product.stock || 999
        });
    }
};

window.CatalogPage = CatalogPage;
