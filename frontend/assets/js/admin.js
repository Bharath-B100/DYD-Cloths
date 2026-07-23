/**
 * DYD-Clothes Admin Dashboard
 * Handles inventory, orders, and customer management.
 */

document.addEventListener('DOMContentLoaded', () => {
    Admin.init();
});

const Admin = {
    activePage: 'dashboard',
    editingId: null,  // FIXED: Added missing property
    charts: {
        salesChart: null,
        categoryChart: null
    },

    init: async () => {
        if (AuthManager?.init) {
            await AuthManager.init();
        }

        // Security Check
        if (!AuthManager.isAdmin()) {
            window.location.href = 'login.html';
            return;
        }

        Admin.setupNavigation();
        Admin.setupNotifications();
        Admin.loadPage('dashboard');
        Admin.setupTheme();
        
        // UI Init
        const userNameEl = document.getElementById('userName');
        if (userNameEl) userNameEl.textContent = AuthManager.user?.name || 'Admin User';
        
        const userAvatar = document.getElementById('userAvatar');
        if (userAvatar && AuthManager.user) {
            userAvatar.textContent = AuthManager.user.name.charAt(0).toUpperCase();
        }

        Admin.syncBadges();
    },

    navigateToOrders: (searchQuery = '') => {
        document.querySelectorAll('.nav-link').forEach(l => {
            if (l.dataset.page === 'orders') l.classList.add('active');
            else l.classList.remove('active');
        });

        Admin.loadPage('orders').then(() => {
            if (searchQuery) {
                setTimeout(() => {
                    const searchInput = document.getElementById('orderSearchInput');
                    if (searchInput) {
                        searchInput.value = searchQuery;
                        searchInput.dispatchEvent(new Event('input'));
                    }
                }, 150);
            }
        });
    },

    syncBadges: async () => {
        try {
            const res = await API.get('/admin/dashboard');
            if (res.success) {
                const totalOrders = res.data?.overview?.totalOrders || 0;
                const badge = document.getElementById('orderBadge');
                
                // Update notifications
                Admin.updateNotifications(res.data);
                
                if (badge) {
                    badge.textContent = totalOrders;
                    badge.style.display = totalOrders > 0 ? 'inline-block' : 'none';
                }
            }
        } catch (err) {
            console.error('Error syncing badges:', err);
        }
    },

    /**
     * Page Routing Logic
     */
    loadPage: async (page) => {
        Admin.activePage = page;
        const container = document.getElementById('contentArea');
        const title = document.getElementById('pageTitle');
        
        if (!container) return;
        
        container.innerHTML = `<div class="admin-loading"><i class="fas fa-spinner fa-spin"></i> Loading ${page}...</div>`;
        if (title) title.textContent = page.charAt(0).toUpperCase() + page.slice(1);

        try {
            switch (page) {
                case 'dashboard': await Admin.renderDashboard(); break;
                case 'products': await Admin.renderProducts(); break;
                case 'orders': await Admin.renderOrders(); break;
                case 'customers': await Admin.renderCustomers(); break;
                case 'analytics': await Admin.renderAnalytics(); break;
                case 'settings': await Admin.renderSettings(); break;
                case 'pricing': await Admin.renderPricing(); break;
                case 'coupons': await Admin.renderCoupons(); break;
                default: container.innerHTML = '<h2>Page Under Construction</h2>';
            }
        } catch (error) {
            Utils.showToast(`Error loading ${page}`, 'error');
            container.innerHTML = `<div class="error-state">Failed to load ${page}.</div>`;
        }
    },

    /**
     * Dashboard Section
     */
    renderDashboard: async () => {
        const res = await API.get('/admin/dashboard');
        if (!res.success) return;

        const data = res.data || {};
        const { overview, recentOrders, lowStockProducts } = data;
        const container = document.getElementById('contentArea');
        
        // Update notifications
        Admin.updateNotifications(data);

        // Update badge
        const badge = document.getElementById('orderBadge');
        if (badge) {
            badge.textContent = overview.totalOrders || 0;
            badge.style.display = (overview.totalOrders || 0) > 0 ? 'inline-block' : 'none';
        }

        container.innerHTML = `
            <div class="stats-grid">
                ${Admin.createStatCard('Total Orders', overview.totalOrders || 0, 'fa-shopping-cart', '#6366f1')}
                ${Admin.createStatCard('Revenue', Utils.formatINR(overview.totalRevenue || 0), 'fa-rupee-sign', '#10b981')}
                ${Admin.createStatCard('Customers', overview.totalCustomers || 0, 'fa-users', '#f59e0b')}
                ${Admin.createStatCard('Products', overview.totalProducts || 0, 'fa-box', '#8b5cf6')}
            </div>

            <div class="dashboard-sections">
                <div class="section-card">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 10px;">
                        <h3 style="margin: 0; cursor: pointer;" onclick="Admin.navigateToOrders()" title="Click to view all orders">
                            <i class="fas fa-history"></i> Recent Orders
                        </h3>
                        <button class="btn btn-sm btn-primary" onclick="Admin.navigateToOrders()" style="display: inline-flex; align-items: center; gap: 6px; cursor: pointer;">
                            View All Orders <i class="fas fa-arrow-right"></i>
                        </button>
                    </div>
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Order #</th>
                                    <th>Customer</th>
                                    <th>Amount</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${recentOrders && recentOrders.length ? recentOrders.map(o => `
                                    <tr style="cursor: pointer;" onclick="Admin.navigateToOrders('${o.orderNumber || o._id?.slice(-6) || ''}')" title="Click to view order in Orders tab">
                                        <td><strong style="color: var(--primary);">#${o.orderNumber || o._id?.slice(-6) || 'N/A'}</strong></td>
                                        <td>${o.customer?.name || 'Guest'}</td>
                                        <td>${Utils.formatINR(o.totalAmount || 0)}</td>
                                        <td><span class="status-badge status-${o.status || 'pending'}">${o.status || 'pending'}</span></td>
                                    </tr>
                                `).join('') : '<tr><td colspan="4">No orders yet</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div class="section-card">
                    <h3><i class="fas fa-exclamation-triangle"></i> Low Stock Warning</h3>
                    <div class="low-stock-list">
                        ${lowStockProducts && lowStockProducts.length ? lowStockProducts.map(p => `
                            <div class="low-stock-item">
                                <img src="${p.mainImage || 'https://via.placeholder.com/40'}" alt="${p.name}">
                                <div class="item-info">
                                    <h4>${p.name}</h4>
                                    <p>Stock: <span class="text-danger">${p.stock}</span> left</p>
                                </div>
                            </div>
                        `).join('') : '<div class="empty-state">All products well stocked!</div>'}
                    </div>
                </div>
            </div>
        `;
    },

    createStatCard: (label, value, icon, color) => `
        <div class="stat-card">
            <div class="stat-icon" style="background: ${color}">
                <i class="fas ${icon}"></i>
            </div>
            <div class="stat-info">
                <p class="stat-label">${label}</p>
                <h3 class="stat-value">${value}</h3>
            </div>
        </div>
    `,

    /**
     * Products Section
     */
    renderProducts: async () => {
        const res = await API.get('/products');
        if (!res.success) return;

        const productsData = res.data?.products || res.data || [];
        const productsArray = Array.isArray(productsData) ? productsData : (productsData.data || []);
        const container = document.getElementById('contentArea');

        container.innerHTML = `
            <div class="page-header">
                <h2>Product Inventory</h2>
                <button class="btn btn-primary" onclick="Admin.openProductModal()">
                    <i class="fas fa-plus"></i> Add Product
                </button>
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Image</th>
                            <th>Name</th>
                            <th>Category</th>
                            <th>Price</th>
                            <th>Stock</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${productsArray.length ? productsArray.map(p => `
                            <tr>
                                <td><img src="${p.mainImage || 'https://via.placeholder.com/48'}" class="table-img" alt="${p.name}"></td>
                                <td><strong>${p.name}</strong></td>
                                <td><span class="category-badge">${p.category || 'Uncategorized'}</span></td>
                                <td>${Utils.formatINR(p.price || 0)}</td>
                                <td>${p.stock || 0}</td>
                                <td class="actions">
                                    <button class="action-btn edit" onclick="Admin.openProductModal('${p._id}')"><i class="fas fa-edit"></i></button>
                                    <button class="action-btn delete" onclick="Admin.deleteProduct('${p._id}')"><i class="fas fa-trash"></i></button>
                                </td>
                            </tr>
                        `).join('') : '<tr><td colspan="6" class="empty-state">No products found. Click "Add Product" to create one.</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;
    },

    /**
     * Product CRUD
     */
    openProductModal: async (productId = null) => {
        const modal = document.getElementById('productModal');
        const form = document.getElementById('productForm');
        const title = document.getElementById('productModalTitle');
        
        if (!modal || !form) return;

        form.reset();
        Admin.editingId = productId;
        title.textContent = productId ? 'Edit Product' : 'Add New Product';

        // Reset image previews
        const thumbPreview = document.getElementById('thumbnailPreview');
        const thumbPlaceholder = document.getElementById('thumbnailPlaceholder');
        const galleryGrid = document.getElementById('galleryPreviewGrid');
        if (thumbPreview) { thumbPreview.style.display = 'none'; thumbPreview.src = ''; }
        if (thumbPlaceholder) thumbPlaceholder.style.display = 'flex';
        if (galleryGrid) galleryGrid.innerHTML = '';

        // Wire thumbnail preview
        const fileInput = document.getElementById('productImageFile');
        if (fileInput) {
            fileInput.value = '';
            fileInput.onchange = () => {
                const file = fileInput.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = e => {
                        if (thumbPreview) { thumbPreview.src = e.target.result; thumbPreview.style.display = 'block'; }
                        if (thumbPlaceholder) thumbPlaceholder.style.display = 'none';
                    };
                    reader.readAsDataURL(file);
                }
            };
        }

        // Wire gallery preview
        const galleryInput = document.getElementById('productGalleryFiles');
        if (galleryInput) {
            galleryInput.value = '';
            galleryInput.onchange = () => {
                if (!galleryGrid) return;
                galleryGrid.innerHTML = '';
                Array.from(galleryInput.files).forEach(file => {
                    const reader = new FileReader();
                    reader.onload = e => {
                        const wrapper = document.createElement('div');
                        wrapper.className = 'gallery-preview-item';
                        wrapper.innerHTML = `<img src="${e.target.result}" alt="Gallery"><span class="gallery-preview-label">${file.name.slice(0,14)}...</span>`;
                        galleryGrid.appendChild(wrapper);
                    };
                    reader.readAsDataURL(file);
                });
                const placeholder = document.getElementById('galleryPlaceholder');
                if (placeholder) placeholder.style.display = 'none';
            };
        }

        if (productId) {
            try {
                const res = await API.get(`/products/${productId}`);
                const p = res.data?.product || res.data || {};
                
                // Fill form
                if (form.elements['productName']) form.elements['productName'].value = p.name || '';
                if (form.elements['productPrice']) form.elements['productPrice'].value = p.price || '';
                if (form.elements['productCategory']) form.elements['productCategory'].value = p.category || '';
                if (form.elements['productStock']) form.elements['productStock'].value = p.stock || 0;
                if (form.elements['productDescription']) form.elements['productDescription'].value = p.description || '';
                if (form.elements['productSizes']) form.elements['productSizes'].value = (p.sizes || []).join(', ');
                if (form.elements['productColors']) form.elements['productColors'].value = (p.colors || []).join(', ');
                document.querySelectorAll('input[name="productTypes"]').forEach(input => {
                    input.checked = (p.productTypes || []).includes(input.value);
                });
                document.querySelectorAll('input[name="catalogTypes"]').forEach(input => {
                    input.checked = (p.catalogTypes || []).includes(input.value);
                });
                
                if (form.elements['productMrp']) form.elements['productMrp'].value = p.mrp || '';
                if (form.elements['productDiscount']) form.elements['productDiscount'].value = p.discountPercent || 0;

                // Set image URL and show existing thumbnail preview
                const imageUrlInput = document.getElementById('productImageUrl');
                if (imageUrlInput && p.mainImage) {
                    imageUrlInput.value = p.mainImage;
                    if (thumbPreview) { thumbPreview.src = p.mainImage; thumbPreview.style.display = 'block'; }
                    if (thumbPlaceholder) thumbPlaceholder.style.display = 'none';
                }

                // Populate existing gallery thumbnails
                const imageUrlsInput = document.getElementById('productImageUrls');
                const existingImages = p.images?.map(img => img.url || img).filter(Boolean) || [];
                if (imageUrlsInput) imageUrlsInput.value = existingImages.join('\n');
                if (galleryGrid && existingImages.length) {
                    galleryGrid.innerHTML = existingImages.map(url => `
                        <div class="gallery-preview-item">
                            <img src="${url}" alt="Gallery image">
                            <span class="gallery-preview-label">Saved</span>
                        </div>
                    `).join('');
                }

                const featuresInput = document.getElementById('productFeatures');
                if (featuresInput && p.features) featuresInput.value = p.features.join('\n');
                
            } catch (err) {
                Utils.showToast('Error loading product data', 'error');
            }
        }

        modal.classList.add('active');
    },

    saveProduct: async (e) => {
        e.preventDefault();
        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        const fileInput = document.getElementById('productImageFile');
        const galleryInput = document.getElementById('productGalleryFiles');
        const imageUrlInput = document.getElementById('productImageUrl');
        const imageUrlsInput = document.getElementById('productImageUrls');
        const featuresInput = document.getElementById('productFeatures');
        
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        submitBtn.disabled = true;

        let totalImages = 0;
        if (fileInput?.files?.length) totalImages += 1;
        else if (imageUrlInput?.value) totalImages += 1;
        
        if (galleryInput?.files?.length) totalImages += galleryInput.files.length;
        if (imageUrlsInput?.value) totalImages += imageUrlsInput.value.split('\n').filter(u => u.trim()).length;

        if (!Admin.editingId && totalImages < 2) {
            Utils.showToast('Please add at least 2 images (1 thumbnail + at least 1 gallery image).', 'error');
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
            return;
        }

        try {
            const formData = new FormData();
            let inputPrice = parseFloat(form.elements['productPrice']?.value);
            const inputMrp = parseFloat(form.elements['productMrp']?.value);
            let inputDisc = parseFloat(form.elements['productDiscount']?.value) || 0;

            if (isNaN(inputPrice) && !isNaN(inputMrp) && inputMrp > 0) {
                inputPrice = Math.round(inputMrp * (1 - inputDisc / 100));
            }
            if (isNaN(inputPrice)) inputPrice = 0;

            if (!isNaN(inputMrp) && inputMrp > 0 && inputPrice > 0 && inputDisc === 0) {
                inputDisc = Math.max(0, Math.round((1 - inputPrice / inputMrp) * 100));
            }

            formData.append('name', form.elements['productName']?.value || '');
            formData.append('price', inputPrice);
            formData.append('mrp', (!isNaN(inputMrp) && inputMrp > 0) ? inputMrp : '');
            formData.append('discountPercent', inputDisc);
            formData.append('sellingPrice', inputPrice);
            formData.append('category', form.elements['productCategory']?.value || '');
            formData.append('stock', form.elements['productStock']?.value || 0);
            formData.append('description', form.elements['productDescription']?.value || '');
            formData.append('sizes', form.elements['productSizes']?.value || '');
            formData.append('colors', form.elements['productColors']?.value || '');
            formData.append('features', (featuresInput?.value || '').split(/\r?\n/).join(','));
            formData.append('productTypes', Array.from(document.querySelectorAll('input[name="productTypes"]:checked')).map(input => input.value).join(','));
            formData.append('catalogTypes', Array.from(document.querySelectorAll('input[name="catalogTypes"]:checked')).map(input => input.value).join(','));

            // Handle image: file > URL > keep existing
            if (fileInput && fileInput.files && fileInput.files[0]) {
                formData.append('thumbnail', fileInput.files[0]);
            } else if (imageUrlInput && imageUrlInput.value) {
                formData.append('mainImage', imageUrlInput.value);
            }
            if (galleryInput?.files?.length) {
                Array.from(galleryInput.files).forEach(file => formData.append('gallery', file));
            }
            if (imageUrlsInput?.value) {
                formData.append('imageUrls', imageUrlsInput.value);
            }

            const endpoint = Admin.editingId ? `/admin/products/${Admin.editingId}` : '/admin/products';
            const method = Admin.editingId ? 'PUT' : 'POST';

            // Use API.upload for file uploads
            let result;
            if ((fileInput && fileInput.files && fileInput.files[0]) || (galleryInput && galleryInput.files && galleryInput.files.length)) {
                result = Admin.editingId ? await API.uploadPut(endpoint, formData) : await API.upload(endpoint, formData);
            } else {
                // Convert FormData to JSON for non-file uploads
                const jsonData = {};
                formData.forEach((value, key) => { jsonData[key] = value; });
                result = await API.request(endpoint, {
                    method: method,
                    body: JSON.stringify(jsonData)
                });
            }
            
            if (result.success) {
                Utils.showToast(`Product ${Admin.editingId ? 'updated' : 'added'} successfully!`, 'success');
                document.getElementById('productModal').classList.remove('active');
                Admin.renderProducts();
            } else {
                throw new Error(result.message || result.error || 'Save failed');
            }
        } catch (error) {
            console.error('Save error:', error);
            Utils.showToast(error.message || 'Save failed', 'error');
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    },

    deleteProduct: async (id) => {
        if (!await Utils.confirmAction('Permanently delete this product?', { title: 'Delete product', confirmText: 'Delete', destructive: true })) return;
        try {
            await API.delete(`/admin/products/${id}`);
            Utils.showToast('Product deleted', 'success');
            Admin.renderProducts();
        } catch (err) {
            Utils.showToast('Delete failed', 'error');
        }
    },

    /**
     * Orders Section
     */
    renderOrders: async () => {
        const res = await API.get('/admin/orders');
        if (!res.success) return;

        const orders = res.data?.orders || (Array.isArray(res.data) ? res.data : []);
        Admin.orders = orders; // Save globally for details view
        const container = document.getElementById('contentArea');

        // Update badge
        const badge = document.getElementById('orderBadge');
        if (badge) {
            badge.textContent = orders.length;
            badge.style.display = orders.length > 0 ? 'inline-block' : 'none';
        }

        container.innerHTML = `
            <div class="page-header">
                <h2>Manage Orders</h2>
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Order ID</th>
                            <th>Customer</th>
                            <th>Amount</th>
                            <th>Status</th>
                            <th>Payment</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${orders.length ? orders.map(o => `
                            <tr>
                                <td><strong>#${o.orderNumber || o._id?.slice(-6) || 'N/A'}</strong></td>
                                <td>${o.customer?.name || 'Guest'}<br><small>${o.customer?.email || ''}</small></td>
                                <td>${Utils.formatINR(o.totalAmount || 0)}</td>
                                <td>
                                    <select class="status-select" onchange="Admin.updateOrderStatus('${o._id}', this.value)">
                                        ${['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'].map(s => 
                                            `<option value="${s}" ${o.status === s ? 'selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`
                                        ).join('')}
                                    </select>
                                </td>
                                <td>
                                    <select class="status-select status-${o.paymentStatus || 'pending'}" onchange="Admin.updatePaymentStatus('${o._id}', this.value)">
                                        ${['pending', 'paid', 'failed', 'refunded'].map(s => 
                                            `<option value="${s}" ${o.paymentStatus === s ? 'selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`
                                        ).join('')}
                                    </select>
                                </td>
                                <td class="actions">
                                    <button class="action-btn view" onclick="Admin.openOrderModal('${o._id}')" title="View Details">
                                        <i class="fas fa-eye"></i>
                                    </button>
                                    <button class="action-btn delete" onclick="Admin.deleteOrder('${o._id}')" title="Delete Order">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </td>
                            </tr>
                        `).join('') : '<tr><td colspan="6" class="empty-state">No orders found</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;
    },

    openOrderModal: (orderId) => {
        const order = Admin.orders?.find(o => o._id === orderId);
        if (!order) {
            Utils.showToast('Order not found', 'error');
            return;
        }

        const modal = document.getElementById('orderModal');
        const body = document.getElementById('orderModalBody');
        const modalContent = modal?.querySelector('.modal-content');
        
        if (!modal || !body) return;

        // Apply large sizing class to modal
        if (modalContent) modalContent.classList.add('order-modal-large');

        // Dynamic formatting
        const formattedDate = Utils.formatDate ? Utils.formatDate(order.createdAt) : new Date(order.createdAt).toLocaleDateString('en-IN');
        const itemsHtml = order.items.map(item => {
            const isCustom = item.productId?.startsWith('studio-') || (item.image && item.image.startsWith('data:image/'));
            const imageSrc = item.image || 'https://via.placeholder.com/70x70/eaeaea/999999?text=T-Shirt';
            
            return `
                <div class="order-item-row">
                    <div class="order-item-media">
                        <img src="${imageSrc}" alt="${item.name}">
                    </div>
                    <div class="order-item-content">
                        <h4 class="order-item-title">
                            ${item.name}
                            ${isCustom ? `<span class="custom-badge"><i class="fas fa-magic"></i> Custom Design</span>` : ''}
                        </h4>
                        <p class="order-item-meta">
                            <span>Size: <strong>${item.size || 'N/A'}</strong></span>
                            <span>Color/Fabric: <strong>${item.color || 'N/A'}</strong></span>
                            <span>Qty: <strong>${item.quantity || 1}</strong></span>
                        </p>
                        ${isCustom ? `
                            <div class="custom-preview-action">
                                <button class="custom-preview-btn" onclick="Admin.openDesignLightbox('${order._id}', ${order.items.indexOf(item)})">
                                    <i class="fas fa-search-plus"></i> View Design Options
                                </button>
                                ${(() => {
                                    if (item.customDesign && item.customDesign.decals) {
                                        const uploads = item.customDesign.decals.filter(d => d.textureSrc && !d.textureText);
                                        if (uploads.length > 0) {
                                            return `
                                            <div style="margin-top: 10px;">
                                                <small style="color: var(--text-muted); display: block; margin-bottom: 5px;">Uploaded Images (Click to download):</small>
                                                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                                                    ${uploads.map((u, i) => `
                                                        <img src="${u.textureSrc}" style="width: 60px; height: 60px; object-fit: contain; background: #fff; border-radius: 4px; border: 1px solid #ddd; cursor: pointer; transition: 0.2s;" onmouseover="this.style.opacity=0.8" onmouseout="this.style.opacity=1" onclick="Admin.downloadAssetFromOrder('${order._id}', ${order.items.indexOf(item)}, ${i})" title="Download Image ${i+1}">
                                                    `).join('')}
                                                </div>
                                            </div>
                                            `;
                                        }
                                    }
                                    return '';
                                })()}
                            </div>
                        ` : ''}
                    </div>
                    <div class="order-item-pricing">
                        <p class="order-item-price-unit">${Utils.formatINR(item.price)} each</p>
                        <p class="order-item-price-total">${Utils.formatINR(item.price * item.quantity)}</p>
                    </div>
                </div>
            `;
        }).join('');

        // summary
        const subtotal = order.subtotal || order.totalAmount;
        const discount = order.discountAmount || 0;
        const shipping = order.shippingFee || 0;
        const total = order.totalAmount;

        body.innerHTML = `
            <div class="order-detail-header">
                <div class="order-detail-header-left">
                    <h3>Order #${order.orderNumber || order._id?.slice(-6).toUpperCase()}</h3>
                    <span>Placed on ${formattedDate}</span>
                </div>
                <div class="order-detail-badges">
                    <span class="status-badge status-${order.status}">${order.status}</span>
                    <span class="status-badge status-${order.paymentStatus}">${order.paymentStatus}</span>
                </div>
            </div>

            <div class="order-grid-two">
                <div class="order-info-section">
                    <h4 class="order-section-title"><i class="fas fa-user"></i> Customer & Contact</h4>
                    <div class="order-detail-card">
                        <p><strong>Name:</strong> ${order.customer?.name || 'Guest'}</p>
                        <p><strong>Email:</strong> ${order.customer?.email || 'N/A'}</p>
                        <p><strong>Phone:</strong> ${order.customer?.phone || 'N/A'}</p>
                        <p><strong>Payment Method:</strong> ${order.paymentMethod || 'N/A'}</p>
                    </div>
                </div>

                <div class="order-info-section">
                    <h4 class="order-section-title"><i class="fas fa-truck"></i> Shipping Address</h4>
                    <div class="order-detail-card">
                        <p><strong>Street:</strong> ${order.shippingAddress?.street || 'N/A'}</p>
                        <p><strong>City:</strong> ${order.shippingAddress?.city || 'N/A'}</p>
                        <p><strong>State/ZIP:</strong> ${order.shippingAddress?.state || ''} ${order.shippingAddress?.zipCode || ''}</p>
                        <p><strong>Country:</strong> ${order.shippingAddress?.country || 'India'}</p>
                    </div>
                </div>
            </div>

            <div class="order-info-section" style="margin-top: 1rem;">
                <h4 class="order-section-title"><i class="fas fa-tshirt"></i> Products Ordered</h4>
                <div class="order-items-list">
                    ${itemsHtml}
                </div>
            </div>

            <div class="order-summary-card">
                <div class="summary-row">
                    <span>Subtotal:</span>
                    <span>${Utils.formatINR(subtotal)}</span>
                </div>
                ${discount > 0 ? `
                    <div class="summary-row" style="color: var(--success);">
                        <span>Discount:</span>
                        <span>-${Utils.formatINR(discount)}</span>
                    </div>
                ` : ''}
                <div class="summary-row">
                    <span>Shipping:</span>
                    <span>${shipping === 0 ? 'FREE' : Utils.formatINR(shipping)}</span>
                </div>
                <div class="summary-row total-row">
                    <span>Total Amount:</span>
                    <span>${Utils.formatINR(total)}</span>
                </div>
            </div>
        `;

        modal.classList.add('active');

        const closeBtn = document.getElementById('closeModalBtn');
        if (closeBtn) closeBtn.onclick = () => modal.classList.remove('active');

        // Also wire up the X button in the modal header
        const closeOrderModal = document.getElementById('closeOrderModal');
        if (closeOrderModal) closeOrderModal.onclick = () => modal.classList.remove('active');
        
        const printBtn = document.getElementById('printOrderBtn');
        if (printBtn) {
            printBtn.onclick = () => {
                const modalBody = document.getElementById('orderModalBody').innerHTML;
                const printWindow = window.open('', '', 'height=600,width=800');
                printWindow.document.write('<html><head><title>Print Order - DYD Clothes</title>');
                printWindow.document.write('<style>body { font-family: Arial, sans-serif; padding: 20px; } .order-item-row { display: flex; gap: 20px; border-bottom: 1px solid #ccc; padding: 15px 0; } img { max-width: 100px; border:1px solid #ddd; padding:5px; } .order-summary-card { margin-top: 20px; border-top: 2px solid #000; padding-top: 10px; font-weight:bold; } .summary-row { display: flex; justify-content: space-between; margin-bottom: 10px; } h4 { margin: 0 0 5px 0; } p { margin: 0; color: #555; }</style>');
                printWindow.document.write('</head><body>');
                printWindow.document.write(modalBody);
                printWindow.document.write('</body></html>');
                printWindow.document.close();
                printWindow.focus();
                setTimeout(() => {
                    printWindow.print();
                    printWindow.close();
                }, 500);
            };
        }
    },

    openDesignLightbox: (orderId, itemIndex) => {
        const order = Admin.orders?.find(o => o._id === orderId);
        if (!order) return;
        const item = order.items[itemIndex];
        if (!item) return;

        const lightbox = document.getElementById('designLightbox');
        const img = document.getElementById('lightboxImage');
        const titleEl = document.getElementById('lightboxTitle');
        const infoEl = document.getElementById('lightboxInfo');

        if (!lightbox || !img) return;

        const cd = item.customDesign;

        // Set initial 2D image (front screenshot or cart image)
        const frontImg = cd?.frontImage || item.image || '';
        const backImg = cd?.backImage || '';
        img.src = frontImg;
        img.style.cssText = 'max-width:100%; max-height:70vh; display:block; margin:0 auto; border-radius:8px;';
        if (titleEl) titleEl.textContent = item.name + ' – Design Preview';
        if (infoEl) infoEl.textContent = `Color: ${item.color} | Size: ${item.size}`;

        // Tab buttons & containers
        const btnFront = document.getElementById('btnViewFront');
        const btnBack = document.getElementById('btnViewBack');
        const btn3D = document.getElementById('btnView3D');
        const btnRaw = document.getElementById('btnViewRawImage');
        const btnDownload = document.getElementById('btnDownloadAssets');
        
        const view2D = document.getElementById('lightbox2DPreview');
        const view3D = document.getElementById('lightbox3DPreview');
        const viewRaw = document.getElementById('lightboxRawView');

        // Extract all raw artwork images from customDesign
        const rawArtworks = [];
        if (cd?.frontLayers && Array.isArray(cd.frontLayers)) {
            cd.frontLayers.forEach((l, i) => {
                if (l.rawSrc) rawArtworks.push({ src: l.rawSrc, name: l.name || `Front Layer ${i + 1}`, side: 'Front' });
            });
        }
        if (cd?.backLayers && Array.isArray(cd.backLayers)) {
            cd.backLayers.forEach((l, i) => {
                if (l.rawSrc) rawArtworks.push({ src: l.rawSrc, name: l.name || `Back Layer ${i + 1}`, side: 'Back' });
            });
        }
        if (rawArtworks.length === 0) {
            if (cd?.frontUpload) rawArtworks.push({ src: cd.frontUpload, name: 'Front Uploaded Image', side: 'Front' });
            if (cd?.backUpload) rawArtworks.push({ src: cd.backUpload, name: 'Back Uploaded Image', side: 'Back' });
        }
        if (rawArtworks.length === 0 && cd?.decals && Array.isArray(cd.decals)) {
            cd.decals.forEach((d, i) => {
                if (d.textureSrc && !d.textureText) {
                    rawArtworks.push({ src: d.textureSrc, name: `Uploaded Artwork ${i + 1}`, side: 'Front/Back' });
                }
            });
        }

        // Reset tab states
        [btnFront, btnBack, btn3D, btnRaw].forEach(b => b?.classList.remove('active'));
        btnFront?.classList.add('active');
        if (view2D) view2D.style.display = 'block';
        if (view3D) view3D.style.display = 'none';
        if (viewRaw) viewRaw.style.display = 'none';

        if (btnFront) btnFront.onclick = () => {
            img.src = cd?.frontImage || item.image || '';
            [btnFront, btnBack, btn3D, btnRaw].forEach(b => b?.classList.remove('active'));
            btnFront.classList.add('active');
            if (view2D) view2D.style.display = 'block';
            if (view3D) view3D.style.display = 'none';
            if (viewRaw) viewRaw.style.display = 'none';
        };

        if (btnBack) btnBack.onclick = () => {
            if (!backImg) { Utils.showToast('No back design for this order', 'info'); return; }
            img.src = backImg;
            [btnFront, btnBack, btn3D, btnRaw].forEach(b => b?.classList.remove('active'));
            btnBack.classList.add('active');
            if (view2D) view2D.style.display = 'block';
            if (view3D) view3D.style.display = 'none';
            if (viewRaw) viewRaw.style.display = 'none';
        };

        if (btnRaw) {
            if (rawArtworks.length > 0) {
                btnRaw.style.display = 'inline-flex';
                const rawGrid = document.getElementById('lightboxRawImageGrid');
                if (rawGrid) {
                    rawGrid.innerHTML = '';
                    rawArtworks.forEach((art, idx) => {
                        const div = document.createElement('div');
                        div.style.cssText = 'background: #222; border: 1px solid #444; border-radius: 8px; padding: 15px; min-width: 200px; max-width: 280px; text-align: center;';
                        div.innerHTML = `
                            <div style="background: repeating-conic-gradient(#333 0% 25%, #1a1a1a 0% 50%) 50% / 16px 16px; padding: 12px; border-radius: 6px; margin-bottom: 12px; display: flex; justify-content: center; align-items: center; min-height:160px;">
                                <img src="${art.src}" style="max-width: 100%; max-height: 160px; object-fit: contain;">
                            </div>
                            <p style="color: #fff; font-size: 13px; font-weight: 600; margin: 0 0 10px;">${art.side}: ${art.name}</p>
                            <div style="display: flex; gap: 8px; justify-content: center;">
                                <button class="btn btn-sm btn-primary" onclick="Admin.downloadAsset('${art.src}', '${art.side.toLowerCase()}-artwork-${idx + 1}.png')">
                                    <i class="fas fa-download"></i> Download
                                </button>
                                <a href="${art.src}" target="_blank" class="btn btn-sm btn-outline" style="color:#fff; border-color:#666;">
                                    <i class="fas fa-external-link-alt"></i> View
                                </a>
                            </div>
                        `;
                        rawGrid.appendChild(div);
                    });
                }

                btnRaw.onclick = () => {
                    [btnFront, btnBack, btn3D, btnRaw].forEach(b => b?.classList.remove('active'));
                    btnRaw.classList.add('active');
                    if (view2D) view2D.style.display = 'none';
                    if (view3D) view3D.style.display = 'none';
                    if (viewRaw) viewRaw.style.display = 'block';
                };
            } else {
                btnRaw.style.display = 'none';
            }
        }

        if (cd) {
            if (btn3D) {
                btn3D.style.display = 'inline-flex';
                btn3D.onclick = () => {
                    if (view2D) view2D.style.display = 'none';
                    if (view3D) view3D.style.display = 'block';
                    if (viewRaw) viewRaw.style.display = 'none';
                    [btnFront, btnBack, btn3D, btnRaw].forEach(b => b?.classList.remove('active'));
                    btn3D.classList.add('active');
                    Admin.render3DPreview(cd, view3D);
                };
            }
            if (btnDownload) {
                btnDownload.style.display = 'inline-flex';
                btnDownload.onclick = () => Admin.downloadAllAssets(order._id, itemIndex);
            }
        } else {
            if (btn3D) btn3D.style.display = 'none';
            if (btnDownload) btnDownload.style.display = 'none';
        }

        // Raw uploaded images section
        const assetsContainer = document.getElementById('lightboxExtractedAssets');
        const assetsGrid = document.getElementById('lightboxAssetsGrid');
        if (assetsContainer && assetsGrid) {
            const hasUploads = cd?.frontUpload || cd?.backUpload;
            if (hasUploads) {
                assetsContainer.style.display = 'block';
                assetsGrid.innerHTML = '';

                const makeCard = (src, label, side, idx) => {
                    if (!src) return '';
                    const div = document.createElement('div');
                    div.style.cssText = 'text-align:center; background:#fff; padding:10px; border-radius:8px; border:1px solid #ddd; min-width:110px;';
                    div.innerHTML = `
                        <img src="${src}" style="width:100px; height:100px; object-fit:contain; display:block; background:#f5f5f5; border-radius:4px; margin-bottom:8px;">
                        <p style="font-size:12px; margin:0 0 6px; font-weight:600;">${label}</p>
                        <button class="btn btn-sm btn-primary" onclick="Admin.downloadAssetFromSide('${order._id}', ${itemIndex}, '${side}')">
                            <i class="fas fa-download"></i> Download
                        </button>
                    `;
                    assetsGrid.appendChild(div);
                };

                makeCard(cd.frontUpload, 'Front Upload', 'front', 0);
                makeCard(cd.backUpload, 'Back Upload', 'back', 1);
            } else {
                assetsContainer.style.display = 'none';
            }
        }

        lightbox.classList.add('active');
        const closeBtn = document.getElementById('closeLightboxBtn');
        if (closeBtn) closeBtn.onclick = () => lightbox.classList.remove('active');
    },

    downloadAssets: (customDesign) => {
        if (!customDesign || !customDesign.decals) return;
        customDesign.decals.forEach((decal, index) => {
            if (decal.textureSrc) {
                Admin.downloadAsset(decal.textureSrc, `custom-design-asset-${index + 1}.png`);
            }
        });
    },

    downloadAssetFromSide: (orderId, itemIdx, side) => {
        const order = Admin.orders?.find(o => o._id === orderId);
        if (!order) return;
        const item = order.items[itemIdx];
        if (!item?.customDesign) return;
        const src = side === 'front' ? item.customDesign.frontUpload : item.customDesign.backUpload;
        if (src) Admin.downloadAsset(src, `design-${side}-${orderId.slice(-6)}.png`);
        else Utils.showToast(`No ${side} image uploaded for this order`, 'info');
    },

    downloadAllAssets: (orderId, itemIdx) => {
        const order = Admin.orders?.find(o => o._id === orderId);
        if (!order) return;
        const item = order.items[itemIdx];
        const cd = item?.customDesign;
        if (!cd) {
            if (item?.image) Admin.downloadAsset(item.image, `product-${orderId.slice(-6)}.png`);
            return;
        }

        const assetsToDownload = [];
        const shortId = orderId ? orderId.slice(-6) : 'order';

        // 1. Front Preview Screenshot
        if (cd.frontImage) {
            assetsToDownload.push({ src: cd.frontImage, filename: `front-3d-preview-${shortId}.png` });
        }
        // 2. Back Preview Screenshot
        if (cd.backImage) {
            assetsToDownload.push({ src: cd.backImage, filename: `back-3d-preview-${shortId}.png` });
        }

        // 3. Front Raw Layer Artworks
        if (cd.frontLayers && Array.isArray(cd.frontLayers)) {
            cd.frontLayers.forEach((l, i) => {
                if (l.rawSrc) {
                    assetsToDownload.push({ src: l.rawSrc, filename: `front-artwork-${i + 1}-${shortId}.png` });
                }
            });
        }

        // 4. Back Raw Layer Artworks
        if (cd.backLayers && Array.isArray(cd.backLayers)) {
            cd.backLayers.forEach((l, i) => {
                if (l.rawSrc) {
                    assetsToDownload.push({ src: l.rawSrc, filename: `back-artwork-${i + 1}-${shortId}.png` });
                }
            });
        }

        // 5. Direct Uploads Fallback
        if (assetsToDownload.length <= 2) {
            if (cd.frontUpload) assetsToDownload.push({ src: cd.frontUpload, filename: `front-upload-${shortId}.png` });
            if (cd.backUpload) assetsToDownload.push({ src: cd.backUpload, filename: `back-upload-${shortId}.png` });
        }

        // 6. Decals Fallback
        if (cd.decals && Array.isArray(cd.decals)) {
            cd.decals.filter(d => d.textureSrc && !d.textureText).forEach((d, i) => {
                assetsToDownload.push({ src: d.textureSrc, filename: `decal-${i + 1}-${shortId}.png` });
            });
        }

        if (assetsToDownload.length === 0) {
            Utils.showToast('No downloadable assets found for this design', 'info');
            return;
        }

        Utils.showToast(`Starting download of ${assetsToDownload.length} design files...`, 'info');

        // Trigger downloads with 300ms staggered delay
        assetsToDownload.forEach((asset, idx) => {
            setTimeout(() => {
                Admin.downloadAsset(asset.src, asset.filename);
            }, idx * 300);
        });
    },

    downloadAssetFromOrder: (orderId, itemIdx, decalIdx) => {
        const order = Admin.orders?.find(o => o._id === orderId);
        if (!order) return;
        const item = order.items[itemIdx];
        if (!item || !item.customDesign || !item.customDesign.decals) return;
        const uploads = item.customDesign.decals.filter(d => d.textureSrc && !d.textureText);
        const decal = uploads[decalIdx];
        if (decal && decal.textureSrc) {
            Admin.downloadAsset(decal.textureSrc, `customer-upload-${orderId}-${decalIdx+1}.png`);
        }
    },

    downloadAsset: (src, filename) => {
        if (!src) return;

        // Data URLs can be downloaded directly
        if (src.startsWith('data:')) {
            const a = document.createElement('a');
            a.href = src;
            a.download = filename || 'download.png';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            return;
        }

        // Remote URLs (HTTP/HTTPS) - fetch as Blob to bypass browser CORS download block
        fetch(src)
            .then(res => res.blob())
            .then(blob => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename || 'download.png';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            })
            .catch(err => {
                console.error('Download error, fallback to new tab:', err);
                window.open(src, '_blank');
            });
    },

    render3DPreview: (config, container) => {
        if (container.querySelector('canvas')) return;

        import('three').then(THREE => {
            import('three/addons/controls/OrbitControls.js').then(({ OrbitControls }) => {
                import('three/addons/loaders/GLTFLoader.js').then(({ GLTFLoader }) => {
                    
                    const scene = new THREE.Scene();
                    scene.background = new THREE.Color(0xf5f5f5);

                    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
                    camera.position.set(0, 0, 1.5);

                    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
                    renderer.setSize(container.clientWidth, container.clientHeight);
                    renderer.outputColorSpace = THREE.SRGBColorSpace;
                    renderer.toneMapping = THREE.ACESFilmicToneMapping;
                    container.appendChild(renderer.domElement);

                    const controls = new OrbitControls(camera, renderer.domElement);
                    controls.enableDamping = true;

                    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
                    const dl1 = new THREE.DirectionalLight(0xffffff, 0.8);
                    dl1.position.set(5, 5, 5);
                    scene.add(dl1);
                    const dl2 = new THREE.DirectionalLight(0xffffff, 0.4);
                    dl2.position.set(-5, 5, 5);
                    scene.add(dl2);

                    const modelContainer = new THREE.Group();
                    scene.add(modelContainer);
                    modelContainer.position.set(0, 0, 0);

                    // 2D Canvas Texture Setup
                    const canvas = document.createElement('canvas');
                    canvas.width = 2048;
                    canvas.height = 2048;
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = config.shirtColor || '#ffffff';
                    ctx.fillRect(0, 0, 2048, 2048);

                    const texture = new THREE.CanvasTexture(canvas);
                    texture.colorSpace = THREE.SRGBColorSpace;
                    texture.flipY = false;

                    const computeUVs = (geometry, worldMatrix, side) => {
                        const posAttr = geometry.getAttribute('position');
                        const normalAttr = geometry.getAttribute('normal');
                        const uvAttr = geometry.getAttribute('uv');
                        const index = geometry.getIndex();
                        
                        let minU = 1, minV = 1, maxU = 0, maxV = 0;
                        const count = index ? index.count : posAttr.count;
                        let found = 0;
                        
                        for (let i = 0; i < count; i += 3) {
                            const a = index ? index.getX(i) : i;
                            const b = index ? index.getX(i+1) : i+1;
                            const c = index ? index.getX(i+2) : i+2;
                            
                            const nA = new THREE.Vector3(normalAttr.getX(a), normalAttr.getY(a), normalAttr.getZ(a));
                            nA.transformDirection(worldMatrix);
                            
                            const isTarget = (side === 'front') ? (nA.z > 0.1) : (nA.z < -0.1);
                            if (isTarget) {
                                minU = Math.min(minU, uvAttr.getX(a), uvAttr.getX(b), uvAttr.getX(c));
                                maxU = Math.max(maxU, uvAttr.getX(a), uvAttr.getX(b), uvAttr.getX(c));
                                minV = Math.min(minV, uvAttr.getY(a), uvAttr.getY(b), uvAttr.getY(c));
                                maxV = Math.max(maxV, uvAttr.getY(a), uvAttr.getY(b), uvAttr.getY(c));
                                found++;
                            }
                        }
                        if (found === 0) return { u0: 0, v0: 0, u1: 1, v1: 1 };
                        return { 
                            u0: Math.max(0, minU - 0.05), 
                            v0: Math.max(0, minV - 0.05), 
                            u1: Math.min(1, maxU + 0.05), 
                            v1: Math.min(1, maxV + 0.05) 
                        };
                    };

                    const loadCleanImg = (src) => {
                        return new Promise((resolve, reject) => {
                            if (!src) return reject(new Error('No src'));
                            if (src.startsWith('data:') || src.startsWith('blob:')) {
                                const img = new Image();
                                img.onload = () => resolve(img);
                                img.onerror = reject;
                                img.src = src;
                                return;
                            }
                            const img = new Image();
                            img.crossOrigin = 'anonymous';
                            img.onload = () => resolve(img);
                            img.onerror = () => {
                                fetch(src).then(r => r.blob()).then(blob => {
                                    const bUrl = URL.createObjectURL(blob);
                                    const bImg = new Image();
                                    bImg.onload = () => resolve(bImg);
                                    bImg.onerror = reject;
                                    bImg.src = bUrl;
                                }).catch(reject);
                            };
                            img.src = src;
                        });
                    };

                    const loader = new GLTFLoader();
                    loader.load('assets/oversized_t-shirt.glb', (gltf) => {
                        const model = gltf.scene;
                        model.scale.set(1.5, 1.5, 1.5);
                        
                        // Center model
                        const box = new THREE.Box3().setFromObject(model);
                        const center = box.getCenter(new THREE.Vector3());
                        model.position.x += (model.position.x - center.x);
                        model.position.y += (model.position.y - center.y);
                        model.position.z += (model.position.z - center.z);

                        // Auto-adjust camera
                        const newBox = new THREE.Box3().setFromObject(model);
                        const size = newBox.getSize(new THREE.Vector3());
                        const maxDim = Math.max(size.x, size.y, size.z);
                        const fov = camera.fov * (Math.PI / 180);
                        let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
                        
                        camera.position.set(0, 0, cameraZ * 1.3);
                        controls.target.set(0, 0, 0);
                        controls.update();

                        let frontUVZone = null;
                        let backUVZone = null;

                        model.traverse((child) => {
                            if (child.isMesh) {
                                const name = child.name.toLowerCase();
                                if (name.includes('plane') || name.includes('ground') || name.includes('shadow') || name.includes('backdrop') || name.includes('studio') || name.includes('environment')) {
                                    child.visible = false;
                                    return;
                                }

                                child.updateMatrixWorld();
                                if (!frontUVZone) {
                                    frontUVZone = computeUVs(child.geometry, child.matrixWorld, 'front');
                                    backUVZone = computeUVs(child.geometry, child.matrixWorld, 'back');
                                }

                                child.material = new THREE.MeshStandardMaterial({
                                    map: texture,
                                    color: 0xffffff,
                                    roughness: 0.8,
                                    side: THREE.DoubleSide
                                });
                            }
                        });
                        modelContainer.add(model);

                        // Render layers onto 3D Canvas Texture
                        const drawLayers = async () => {
                            ctx.fillStyle = config.shirtColor || '#ffffff';
                            ctx.fillRect(0, 0, 2048, 2048);

                            const frontLayers = config.frontLayers || (config.frontUpload ? [{ rawSrc: config.frontUpload, x: 0.5, y: 0.5, scale: 0.8, rotation: 0 }] : []);
                            const backLayers = config.backLayers || (config.backUpload ? [{ rawSrc: config.backUpload, x: 0.5, y: 0.5, scale: 0.8, rotation: 0 }] : []);

                            const drawSide = async (layers, zone) => {
                                if (!layers.length || !zone) return;
                                const zW = (zone.u1 - zone.u0) * 2048;
                                const zH = (zone.v1 - zone.v0) * 2048;

                                for (const layer of layers) {
                                    const src = layer.rawSrc || layer.textureSrc || layer.img || layer.src;
                                    if (!src) continue;
                                    try {
                                        const img = await loadCleanImg(src);
                                        ctx.save();
                                        const cX = zone.u0 * 2048 + zW * (layer.x !== undefined ? layer.x : 0.5);
                                        const cY = zone.v0 * 2048 + zH * (layer.y !== undefined ? layer.y : 0.5);

                                        ctx.translate(cX, cY);
                                        ctx.rotate((layer.rotation || 0) * Math.PI / 180);

                                        const baseSize = zW * 0.5;
                                        const dw = baseSize * (layer.scale || 0.8);
                                        const dh = dw * (img.height / img.width);

                                        ctx.scale(1, -1);
                                        ctx.drawImage(img, -dw/2, -dh/2, dw, dh);
                                        ctx.restore();
                                    } catch (e) {
                                        console.error('Failed loading layer image for 3D admin preview:', e);
                                    }
                                }
                            };

                            await drawSide(frontLayers, frontUVZone);
                            await drawSide(backLayers, backUVZone);

                            texture.needsUpdate = true;
                        };

                        drawLayers();
                    });

                    renderer.setAnimationLoop(() => {
                        controls.update();
                        renderer.render(scene, camera);
                    });

                    const resizeObserver = new ResizeObserver(() => {
                        if(!container.clientWidth) return;
                        camera.aspect = container.clientWidth / container.clientHeight;
                        camera.updateProjectionMatrix();
                        renderer.setSize(container.clientWidth, container.clientHeight);
                    });
                    resizeObserver.observe(container);

                    document.getElementById('closeLightboxBtn').addEventListener('click', () => {
                        renderer.setAnimationLoop(null);
                        container.innerHTML = '';
                        resizeObserver.disconnect();
                    }, { once: true });
                });
            });
        });
    },

    updateOrderStatus: async (id, status) => {
        try {
            await API.put(`/admin/orders/${id}/status`, { status });
            Utils.showToast('Order status updated', 'success');
        } catch (err) {
            Utils.showToast('Update failed', 'error');
        }
    },

    updatePaymentStatus: async (id, paymentStatus) => {
        try {
            await API.put(`/admin/orders/${id}/payment-status`, { paymentStatus });
            Utils.showToast('Payment status updated', 'success');
            // Refresh dashboard to sync counts if needed
            Admin.syncBadges();
        } catch (err) {
            Utils.showToast('Update failed', 'error');
        }
    },


    /**
     * Customers Section
     */
    renderCustomers: async () => {
        const res = await API.get('/admin/customers');
        if (!res.success) return;

        const customers = res.data?.customers || (Array.isArray(res.data) ? res.data : []);
        const container = document.getElementById('contentArea');

        container.innerHTML = `
            <div class="page-header">
                <h2>Customer Management</h2>
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Phone</th>
                            <th>Role</th>
                            <th>Joined</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${customers.length ? customers.map(c => `
                            <tr>
                                <td><strong>${c.name || 'N/A'}</strong></td>
                                <td>${c.email || 'N/A'}</td>
                                <td>${c.phone || 'N/A'}</td>
                                <td><span class="role-badge role-${c.role || 'user'}">${c.role || 'user'}</span></td>
                                <td>${Utils.formatDate(c.createdAt)}</td>
                                <td><span class="status-badge ${c.isActive !== false ? 'status-active' : 'status-inactive'}">${c.isActive !== false ? 'Active' : 'Banned'}</span></td>
                                <td class="actions">
                                    ${c.role === 'admin' && c.email !== 'admin@tshirtco.com' ? 
                                      `<button class="action-btn" onclick="Admin.updateRole('${c._id}', 'customer')" title="Revoke Admin"><i class="fas fa-user-minus"></i></button>` : 
                                      (c.role !== 'admin' ? `<button class="action-btn" onclick="Admin.updateRole('${c._id}', 'admin')" title="Make Admin"><i class="fas fa-user-shield"></i></button>` : '')
                                    }
                                    ${c.email !== 'admin@tshirtco.com' ?
                                        `<button class="action-btn delete" onclick="Admin.deleteCustomer('${c._id}')" title="Delete User"><i class="fas fa-trash"></i></button>` : ''
                                    }
                                </td>
                            </tr>
                        `).join('') : '<tr><td colspan="6" class="empty-state">No customers found</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;
    },
    
    updateRole: async (id, role) => {
        if (role === 'admin' && !await Utils.confirmAction('Promote this user to administrator?', { title: 'Change user role', confirmText: 'Promote', destructive: true })) return;
        if (role === 'customer' && !await Utils.confirmAction('Revoke this user\'s administrator access?', { title: 'Change user role', confirmText: 'Revoke', destructive: true })) return;
        
        try {
            const res = await API.put(`/admin/customers/${id}/role`, { role });
            if (res.success) {
                Utils.showToast(res.message, 'success');
                Admin.renderCustomers();
                Admin.syncBadges();
            } else {
                Utils.showToast(res.error || 'Failed to update role', 'error');
            }
        } catch (error) {
            console.error('Role update error:', error);
            Utils.showToast('Error updating role', 'error');
        }
    },

    renderAnalytics: async () => {
        const [salesRes, productsRes, dashboardRes] = await Promise.all([
            API.get('/admin/analytics/sales?period=month'),
            API.get('/admin/analytics/products'),
            API.get('/admin/dashboard')
        ]);

        const sales = salesRes.data || {};
        const productAnalytics = productsRes.data || {};
        const dashboard = dashboardRes.data || {};
        const summary = sales.summary || {};
        const salesData = sales.salesData || [];
        const byCategory = productAnalytics.byCategory || [];
        const stockStatus = productAnalytics.stockStatus || [];
        const topSelling = productAnalytics.topSelling || dashboard.topSellingProducts || [];
        const container = document.getElementById('contentArea');

        container.innerHTML = `
            <div class="stats-grid">
                ${Admin.createStatCard('Revenue', Utils.formatINR(summary.totalRevenue || dashboard.overview?.totalRevenue || 0), 'fa-chart-line', '#10b981')}
                ${Admin.createStatCard('Orders', summary.totalOrders || dashboard.overview?.totalOrders || 0, 'fa-shopping-bag', '#6366f1')}
                ${Admin.createStatCard('Avg Order', Utils.formatINR(summary.avgOrderValue || 0), 'fa-receipt', '#f59e0b')}
                ${Admin.createStatCard('Products', dashboard.overview?.totalProducts || 0, 'fa-tshirt', '#8b5cf6')}
            </div>
            
            <div class="analytics-grid">
                <div class="section-card">
                    <h3><i class="fas fa-chart-line"></i> Sales Trend</h3>
                    <canvas id="salesChart" height="200"></canvas>
                </div>
                <div class="section-card">
                    <h3><i class="fas fa-chart-pie"></i> Sales by Category</h3>
                    <canvas id="categoryChart" height="200"></canvas>
                </div>
                <div class="section-card">
                    <h3><i class="fas fa-fire"></i> Top Selling Products</h3>
                    <div class="low-stock-list">
                        ${topSelling.length ? topSelling.map(product => `
                            <div class="low-stock-item">
                                <img src="${product.productImage || 'https://via.placeholder.com/40'}" alt="${product.productName || 'Product'}">
                                <div class="item-info">
                                    <h4>${product.productName || 'Product'}</h4>
                                    <p>${product.totalSold || 0} sold · ${Utils.formatINR(product.totalRevenue || 0)}</p>
                                </div>
                            </div>
                        `).join('') : '<div class="empty-state">No sales data yet</div>'}
                    </div>
                </div>
                <div class="section-card">
                    <h3><i class="fas fa-layer-group"></i> Products by Style</h3>
                    <div class="metric-list">
                        ${byCategory.length ? byCategory.map(item => `
                            <div class="metric-row"><span>${item._id || 'Uncategorized'}</span><strong>${item.count}</strong></div>
                        `).join('') : '<div class="empty-state">No products yet</div>'}
                    </div>
                </div>
                <div class="section-card">
                    <h3><i class="fas fa-boxes"></i> Stock Health</h3>
                    <div class="metric-list">
                        ${stockStatus.length ? stockStatus.map(item => `
                            <div class="metric-row"><span>${item._id}</span><strong>${item.count}</strong></div>
                        `).join('') : '<div class="empty-state">No stock data yet</div>'}
                    </div>
                </div>
                <div class="section-card">
                    <h3><i class="fas fa-calendar-alt"></i> Monthly Performance</h3>
                    <div class="bar-list">
                        ${salesData.length ? salesData.map(item => `
                            <div class="bar-row">
                                <span>${item._id}</span>
                                <div class="bar-track"><div class="bar-fill" style="width:${Math.min(100, ((item.totalSales || 0) / Math.max(...salesData.map(s => s.totalSales || 1))) * 100)}%"></div></div>
                                <strong>${Utils.formatINR(item.totalSales || 0)}</strong>
                            </div>
                        `).join('') : '<div class="empty-state">No sales data yet</div>'}
                    </div>
                </div>
            </div>
        `;
        
        // Render charts after DOM is updated
        setTimeout(() => {
            Admin.initCharts(salesData, byCategory);
        }, 100);
    },

    initCharts: (salesData, categoryData) => {
        // Sales Chart
        const salesCanvas = document.getElementById('salesChart');
        if (salesCanvas && salesData.length) {
            const ctx = salesCanvas.getContext('2d');
            if (Admin.charts.salesChart) Admin.charts.salesChart.destroy();
            
            Admin.charts.salesChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: salesData.map(item => item._id),
                    datasets: [{
                        label: 'Sales (₹)',
                        data: salesData.map(item => item.totalSales || 0),
                        borderColor: '#0f766e',
                        backgroundColor: 'rgba(15, 118, 110, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: { position: 'top' },
                        tooltip: {
                            callbacks: {
                                label: (context) => `₹${context.raw.toLocaleString('en-IN')}`
                            }
                        }
                    }
                }
            });
        }
        
        // Category Chart
        const categoryCanvas = document.getElementById('categoryChart');
        if (categoryCanvas && categoryData.length) {
            const ctx = categoryCanvas.getContext('2d');
            if (Admin.charts.categoryChart) Admin.charts.categoryChart.destroy();
            
            Admin.charts.categoryChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: categoryData.map(item => item._id || 'Uncategorized'),
                    datasets: [{
                        data: categoryData.map(item => item.count),
                        backgroundColor: ['#0f766e', '#6366f1', '#f59e0b', '#ef4444', '#10b981'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: { position: 'bottom' }
                    }
                }
            });
        }
    },

    /**
     * UI Helpers
     */
    setupNavigation: () => {
        document.querySelectorAll('.nav-link[data-page]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = link.dataset.page;
                
                document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
                link.classList.add('active');
                
                Admin.loadPage(page);
                
                // Mobile close sidebar
                if (window.innerWidth <= 1024) {
                    const sidebar = document.getElementById('sidebar');
                    if (sidebar) sidebar.classList.remove('active');
                }
            });
        });

        const menuToggle = document.getElementById('menuToggle');
        if (menuToggle) {
            menuToggle.addEventListener('click', () => {
                const sidebar = document.getElementById('sidebar');
                if (sidebar) sidebar.classList.toggle('active');
            });
        }

        // Modal Close
        const closeProductModal = document.getElementById('closeProductModal');
        if (closeProductModal) {
            closeProductModal.addEventListener('click', () => {
                document.getElementById('productModal').classList.remove('active');
            });
        }
        
        const cancelProductBtn = document.getElementById('cancelProductBtn');
        if (cancelProductBtn) {
            cancelProductBtn.addEventListener('click', () => {
                document.getElementById('productModal').classList.remove('active');
            });
        }

        // Order Modal Close
        const closeOrderModal = document.getElementById('closeOrderModal');
        if (closeOrderModal) {
            closeOrderModal.addEventListener('click', () => {
                document.getElementById('orderModal').classList.remove('active');
            });
        }

        const closeModalBtn = document.getElementById('closeModalBtn');
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', () => {
                document.getElementById('orderModal').classList.remove('active');
            });
        }

        // Design Lightbox Close
        const closeLightboxBtn = document.getElementById('closeLightboxBtn');
        if (closeLightboxBtn) {
            closeLightboxBtn.addEventListener('click', () => {
                document.getElementById('designLightbox').classList.remove('active');
            });
        }

        const designLightbox = document.getElementById('designLightbox');
        if (designLightbox) {
            designLightbox.addEventListener('click', (e) => {
                if (e.target === designLightbox) {
                    designLightbox.classList.remove('active');
                }
            });
        }
        
        const productForm = document.getElementById('productForm');
        if (productForm) {
            productForm.addEventListener('submit', Admin.saveProduct);
        }
        
        // Logout button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                AuthManager.logout();
            });
        }
    },

    setupTheme: () => {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
    }
};

/* Settings Logic */
Admin.renderSettings = async () => {
    const container = document.getElementById('contentArea');
    const template = document.getElementById('settingsTemplate');
    if (!template) return;

    container.innerHTML = '';
    container.appendChild(template.content.cloneNode(true));

    try {
        const res = await API.get('/settings');
        if (!res.success) throw new Error(res.error);

        const settings = res.raw || [];
        Admin.populateSettings(settings, 'branding');

        // Tab switching
        const tabBtns = document.querySelectorAll('.s-tab-btn');
        tabBtns.forEach(btn => {
            btn.onclick = () => {
                tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                Admin.populateSettings(settings, btn.dataset.category);
            };
        });

        // Save logic
        const saveBtn = document.getElementById('saveAllSettings');
        if (saveBtn) {
            saveBtn.onclick = async () => {
                saveBtn.disabled = true;
                saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
                
                const inputs = document.querySelectorAll('.setting-input');
                const updates = Array.from(inputs).map(input => ({
                    key: input.dataset.key,
                    value: input.value
                }));

                try {
                    const saveRes = await API.post('/settings', updates);
                    if (saveRes.success) {
                        Utils.showToast('Settings saved successfully!', 'success');
                        // Update the local raw settings to reflect changes when switching tabs
                        res.raw = res.raw.map(s => {
                            const up = updates.find(u => u.key === s.key);
                            return up ? { ...s, value: up.value } : s;
                        });
                    } else {
                        Utils.showToast('Failed to save settings', 'error');
                    }
                } catch (err) {
                    Utils.showToast('Error saving settings', 'error');
                } finally {
                    saveBtn.disabled = false;
                    saveBtn.innerHTML = '<i class="fas fa-save"></i> Save All Changes';
                }
            };
        }
    } catch (error) {
        console.error('Error rendering settings:', error);
        Utils.showToast('Failed to load settings', 'error');
    }
};

Admin.populateSettings = (settings, category) => {
    const section = document.getElementById('settingsSections');
    if (!section) return;

    const filtered = settings.filter(s => s.category === category);
    section.innerHTML = `<div class="settings-group">${filtered.map(s => Admin.renderSettingItem(s)).join('')}</div>`;
};

Admin.renderSettingItem = (setting) => {
    let inputHtml = '';
    if (setting.type === 'textarea') {
        inputHtml = `<textarea class="form-control setting-input" data-key="${setting.key}" rows="4">${setting.value}</textarea>`;
    } else if (setting.type === 'image') {
        inputHtml = `<div class="settings-input-wrapper">
            <input type="url" class="form-control setting-input" data-key="${setting.key}" value="${setting.value}" placeholder="Image URL">
            <img src="${setting.value}" class="image-preview-sm" onerror="this.src='https://via.placeholder.com/100'">
        </div>`;
    } else if (setting.type === 'color') {
        inputHtml = `<div class="settings-color-wrapper" style="display: flex; align-items: center; gap: 10px;">
            <input type="color" class="setting-input" data-key="${setting.key}" value="${setting.value}" style="width: 60px; height: 38px; border: 1px solid var(--border-color); border-radius: 4px; padding: 2px; cursor: pointer;" oninput="this.nextElementSibling.textContent = this.value">
            <span style="font-family: monospace; font-size: 0.9rem; color: var(--text-color);">${setting.value}</span>
        </div>`;
    } else if (setting.type === 'number') {
        inputHtml = `<input type="number" class="form-control setting-input" data-key="${setting.key}" value="${setting.value}">`;
    } else {
        inputHtml = `<input type="${setting.type === 'url' ? 'url' : 'text'}" class="form-control setting-input" data-key="${setting.key}" value="${setting.value}">`;
    }

    return `<div class="settings-item">
        <label>${setting.label}</label>
        ${inputHtml}
    </div>`;
};

window.Admin = Admin;

/* Notifications Logic */
Admin.setupNotifications = () => {
    const btn = document.getElementById('notificationBtn');
    const dropdown = document.getElementById('notificationDropdown');
    const list = document.getElementById('notificationList');
    const count = document.getElementById('notificationCount');
    const markRead = document.getElementById('markAllRead');

    if (!btn || !dropdown) return;

    // Toggle dropdown
    btn.onclick = (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('active');
    };

    document.addEventListener('click', () => dropdown.classList.remove('active'));
    dropdown.onclick = (e) => e.stopPropagation();

    // Mark all read
    if (markRead) {
        markRead.onclick = () => {
            count.textContent = '0';
            count.style.display = 'none';
            list.innerHTML = '<div class="empty-notifications">No new notifications</div>';
        };
    }
};

Admin.updateNotifications = (data) => {
    const list = document.getElementById('notificationList');
    const count = document.getElementById('notificationCount');
    if (!list || !count) return;

    const notifications = [];

    // 1. Check low stock
    if (data.lowStockProducts && data.lowStockProducts.length) {
        data.lowStockProducts.slice(0, 5).forEach(p => {
            notifications.push({
                type: 'low-stock',
                icon: 'fa-exclamation-triangle',
                title: 'Low Stock Warning',
                message: `${p.name} is low on stock (${p.stock} left)`,
                time: 'Just now'
            });
        });
    }

    // 2. Check recent orders
    if (data.recentOrders && data.recentOrders.length) {
        data.recentOrders.slice(0, 3).forEach(o => {
            notifications.push({
                type: 'new-order',
                icon: 'fa-shopping-bag',
                title: 'New Order',
                message: `Order #${o.orderNumber} received from ${o.customer?.name}`,
                time: Utils.formatDate ? Utils.formatDate(o.createdAt) : 'Recently'
            });
        });
    }

    if (notifications.length > 0) {
        count.textContent = notifications.length;
        count.style.display = 'flex';
        list.innerHTML = notifications.map(n => `
            <div class="notification-item ${n.type}">
                <div class="notification-icon">
                    <i class="fas ${n.icon}"></i>
                </div>
                <div class="notification-content">
                    <p><strong>${n.title}</strong></p>
                    <p>${n.message}</p>
                    <span class="notification-time">${n.time}</span>
                </div>
            </div>
        `).join('');
    } else {
        count.style.display = 'none';
        list.innerHTML = '<div class="empty-notifications">No new notifications</div>';
    }
};

Admin.deleteOrder = async (orderId) => {
    if (!await Utils.confirmAction('Permanently delete this order?', { title: 'Delete order', confirmText: 'Delete', destructive: true })) return;
    try {
        const res = await API.delete(`/admin/orders/${orderId}`);
        if (res.success) {
            Utils.showToast('Order deleted successfully', 'success');
            Admin.renderOrders();
            Admin.syncBadges();
        } else {
            throw new Error(res.error || 'Failed to delete order');
        }
    } catch (err) {
        Utils.showToast(err.message, 'error');
    }
};

Admin.deleteCustomer = async (customerId) => {
    if (!await Utils.confirmAction('Permanently delete this customer?', { title: 'Delete customer', confirmText: 'Delete', destructive: true })) return;
    try {
        const res = await API.delete(`/admin/customers/${customerId}`);
        if (res.success) {
            Utils.showToast('Customer deleted successfully', 'success');
            Admin.renderCustomers();
            Admin.syncBadges();
        } else {
            throw new Error(res.error || 'Failed to delete customer');
        }
    } catch (err) {
        Utils.showToast(err.message, 'error');
    }
};

/* =============================================
   PRICING MANAGEMENT
   ============================================= */
Admin.renderPricing = async () => {
    const container = document.getElementById('contentArea');
    if (!container) return;

    // Fetch settings and products in parallel
    const [settingsRes, productsRes] = await Promise.all([
        API.get('/settings'),
        API.get('/products')
    ]);

    const settings = settingsRes.success ? (settingsRes.data || {}) : {};
    const products = productsRes.success
        ? (productsRes.data?.products || productsRes.data?.data || productsRes.data || [])
        : [];

    const studioFields = [
        { key: 'price_fabric_cotton',    label: '100% Cotton Base Price',    default: 299 },
        { key: 'price_fabric_polycotton',label: 'Poly Cotton Base Price',     default: 349 },
        { key: 'price_fabric_dryfit',    label: 'Dry Fit / Sports Base Price',default: 379 },
        { key: 'price_fabric_premium',   label: 'Premium Cotton Base Price',  default: 449 },
        { key: 'price_fabric_organic',   label: 'Organic Cotton Base Price',  default: 499 },
        { key: 'price_print_per_side',   label: 'Print Cost per Image Side',  default: 150 },
        { key: 'price_text_per_unit',    label: 'Text Cost per Text Element', default: 50  },
    ];

    container.innerHTML = `
    <div class="pricing-page">
      <div class="page-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:28px;">
        <div>
          <h2 style="margin:0;font-size:1.6rem;"><i class="fas fa-tags" style="color:var(--primary);margin-right:10px;"></i>Pricing Management</h2>
          <p style="color:var(--text-muted);margin:4px 0 0;">Control studio costs and product discounts. Changes reflect instantly in the store.</p>
        </div>
        <button class="btn btn-primary" id="saveAllPricing" style="gap:8px;">
          <i class="fas fa-save"></i> Save All Changes
        </button>
      </div>

      <div class="pricing-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:start;">

        <!-- Studio Pricing Card -->
        <div class="admin-card" style="padding:24px;">
          <h3 style="margin:0 0 6px;font-size:1.1rem;"><i class="fas fa-palette" style="color:var(--primary);margin-right:8px;"></i>Studio Design Pricing</h3>
          <p style="color:var(--text-muted);font-size:0.82rem;margin:0 0 20px;">Base prices and add-on costs shown in the Design Studio price calculator.</p>
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="border-bottom:1px solid var(--border-color);">
                <th style="text-align:left;padding:8px 0;font-size:0.8rem;color:var(--text-muted);font-weight:500;">Item</th>
                <th style="text-align:right;padding:8px 0;font-size:0.8rem;color:var(--text-muted);font-weight:500;">Price (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${studioFields.map(f => `
              <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                <td style="padding:12px 0;font-size:0.88rem;">${f.label}</td>
                <td style="padding:12px 0;text-align:right;">
                  <input type="number" class="form-control studio-price-input" min="0" step="1"
                    data-key="${f.key}"
                    value="${settings[f.key] ?? f.default}"
                    style="width:90px;text-align:right;display:inline-block;padding:6px 10px;">
                </td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>

        <!-- Product Pricing Card -->
        <div class="admin-card" style="padding:24px;">
          <h3 style="margin:0 0 6px;font-size:1.1rem;"><i class="fas fa-percent" style="color:#f59e0b;margin-right:8px;"></i>Product Discount Pricing</h3>
          <p style="color:var(--text-muted);font-size:0.82rem;margin:0 0 20px;">Set MRP, discount %, and selling price. Changes reflect instantly in store.</p>
          <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;min-width:440px;">
            <thead>
              <tr style="border-bottom:1px solid var(--border-color);">
                <th style="text-align:left;padding:8px 4px;font-size:0.78rem;color:var(--text-muted);font-weight:500;">Product</th>
                <th style="text-align:right;padding:8px 4px;font-size:0.78rem;color:var(--text-muted);font-weight:500;">MRP (₹)</th>
                <th style="text-align:right;padding:8px 4px;font-size:0.78rem;color:var(--text-muted);font-weight:500;">Discount %</th>
                <th style="text-align:right;padding:8px 4px;font-size:0.78rem;color:var(--text-muted);font-weight:500;">Sell Price (₹)</th>
              </tr>
            </thead>
            <tbody id="productPricingRows">
              ${products.map(p => {
                  const mrp = p.mrp || '';
                  const disc = p.discountPercent || 0;
                  const sell = p.sellingPrice || p.price || '';
                  return `
              <tr style="border-bottom:1px solid rgba(255,255,255,0.05);" data-product-id="${p._id}">
                <td style="padding:10px 4px;font-size:0.82rem;max-width:140px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${Utils.escapeHtml(p.name)}">${Utils.escapeHtml(p.name)}</td>
                <td style="padding:10px 4px;text-align:right;">
                  <input type="number" class="form-control prod-mrp" min="0" step="1"
                    value="${mrp}" placeholder="—"
                    style="width:80px;text-align:right;display:inline-block;padding:5px 8px;font-size:0.82rem;">
                </td>
                <td style="padding:10px 4px;text-align:right;">
                  <input type="number" class="form-control prod-disc" min="0" max="100" step="1"
                    value="${disc}" placeholder="0"
                    style="width:65px;text-align:right;display:inline-block;padding:5px 8px;font-size:0.82rem;">
                </td>
                <td style="padding:10px 4px;text-align:right;">
                  <input type="number" class="form-control prod-sell" min="0" step="1"
                    value="${sell}" placeholder="Price"
                    style="width:85px;text-align:right;display:inline-block;padding:5px 8px;font-size:0.82rem;font-weight:600;color:var(--primary);">
                </td>
              </tr>`;
              }).join('')}
            </tbody>
          </table>
          </div>
          ${products.length === 0 ? '<p style="color:var(--text-muted);text-align:center;padding:20px 0;">No products found. Add products first.</p>' : ''}
        </div>
      </div>
    </div>`;

    // Live bidirectional calculation: MRP, Disc %, and Sell Price
    container.querySelectorAll('tr[data-product-id]').forEach(row => {
        const mrpInput = row.querySelector('.prod-mrp');
        const discInput = row.querySelector('.prod-disc');
        const sellInput = row.querySelector('.prod-sell');

        const prod = products.find(p => p._id === row.dataset.productId);
        if (prod) row.dataset.basePrice = prod.price;

        const updateFromDiscount = () => {
            const mrp = parseFloat(mrpInput.value);
            const disc = parseFloat(discInput.value) || 0;
            if (!isNaN(mrp) && mrp > 0) {
                const sell = Math.round(mrp * (1 - disc / 100));
                sellInput.value = sell;
            }
        };

        const updateFromSellPrice = () => {
            const mrp = parseFloat(mrpInput.value);
            const sell = parseFloat(sellInput.value);
            if (!isNaN(mrp) && mrp > 0 && !isNaN(sell) && sell >= 0) {
                const disc = Math.max(0, Math.round((1 - sell / mrp) * 100));
                discInput.value = disc;
            }
        };

        mrpInput.addEventListener('input', updateFromDiscount);
        discInput.addEventListener('input', updateFromDiscount);
        sellInput.addEventListener('input', updateFromSellPrice);
    });

    // Save All
    document.getElementById('saveAllPricing').addEventListener('click', async () => {
        const btn = document.getElementById('saveAllPricing');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

        try {
            // 1) Save studio pricing settings
            const studioUpdates = Array.from(container.querySelectorAll('.studio-price-input')).map(input => ({
                key: input.dataset.key,
                value: parseFloat(input.value) || 0
            }));
            await API.post('/settings', studioUpdates);

            // 2) Save product pricing in a single bulk request
            const productRows = container.querySelectorAll('tr[data-product-id]');
            const productUpdates = [];
            productRows.forEach(row => {
                const id = row.dataset.productId;
                const mrpVal = parseFloat(row.querySelector('.prod-mrp').value);
                const discVal = parseFloat(row.querySelector('.prod-disc').value) || 0;
                const sellVal = parseFloat(row.querySelector('.prod-sell').value);
                
                const finalMrp = !isNaN(mrpVal) && mrpVal > 0 ? mrpVal : null;
                const finalSell = !isNaN(sellVal) && sellVal >= 0 ? sellVal : (finalMrp || parseFloat(row.dataset.basePrice) || 0);

                productUpdates.push({
                    productId: id,
                    mrp: finalMrp,
                    discountPercent: discVal,
                    sellingPrice: finalSell,
                    price: finalSell
                });
            });

            if (productUpdates.length > 0) {
                await API.put('/admin/products/bulk/pricing', { updates: productUpdates });
            }

            Utils.showToast('All pricing saved successfully!', 'success');
            await Admin.renderPricing();
        } catch (err) {
            console.error('Save pricing error:', err);
            Utils.showToast('Failed to save pricing: ' + err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-save"></i> Save All Changes';
        }
    });
};

// =====================
// COUPONS SECTION
// =====================
Admin.renderCoupons = async () => {
        const container = document.getElementById('contentArea');
        container.innerHTML = `<div class="admin-loading"><i class="fas fa-spinner fa-spin"></i> Loading coupons...</div>`;

        let coupons = [];
        try {
            const res = await API.get('/coupons');
            if (res.success) coupons = res.data || [];
        } catch (e) {
            container.innerHTML = `<div class="error-state">Failed to load coupons: ${e.message}</div>`;
            return;
        }

        const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
        const isExpired = (d) => d && new Date(d) < new Date();

        container.innerHTML = `
        <div style="padding: 1.5rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
                <h2 style="margin:0; font-size:1.3rem;">🎟️ Coupon Management</h2>
                <button class="btn btn-primary" id="addCouponBtn" style="display:flex;align-items:center;gap:6px;">
                    <i class="fas fa-plus"></i> Add New Coupon
                </button>
            </div>

            <!-- Create Coupon Form -->
            <div id="couponFormBox" style="display:none; background:var(--bg-card); border:1px solid var(--border-color); border-radius:12px; padding:1.5rem; margin-bottom:1.5rem;">
                <h3 style="margin:0 0 1rem;">Create New Coupon</h3>
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:1rem;">
                    <div>
                        <label style="display:block;margin-bottom:4px;font-size:0.85rem;opacity:0.7;">Code *</label>
                        <input type="text" id="cpCode" placeholder="e.g. SAVE20" class="form-control" style="width:100%;text-transform:uppercase;">
                    </div>
                    <div>
                        <label style="display:block;margin-bottom:4px;font-size:0.85rem;opacity:0.7;">Type *</label>
                        <select id="cpType" class="form-control" style="width:100%;">
                            <option value="percentage">Percentage (%)</option>
                            <option value="fixed">Fixed Amount (₹)</option>
                        </select>
                    </div>
                    <div>
                        <label style="display:block;margin-bottom:4px;font-size:0.85rem;opacity:0.7;">Discount Value *</label>
                        <input type="number" id="cpValue" placeholder="e.g. 50" class="form-control" style="width:100%;" min="1">
                    </div>
                    <div>
                        <label style="display:block;margin-bottom:4px;font-size:0.85rem;opacity:0.7;">Min Order (₹)</label>
                        <input type="number" id="cpMinOrder" placeholder="e.g. 199" class="form-control" style="width:100%;" min="0" value="0">
                    </div>
                    <div>
                        <label style="display:block;margin-bottom:4px;font-size:0.85rem;opacity:0.7;">Max Discount (₹)</label>
                        <input type="number" id="cpMaxDiscount" placeholder="Leave blank = no limit" class="form-control" style="width:100%;" min="0">
                    </div>
                    <div>
                        <label style="display:block;margin-bottom:4px;font-size:0.85rem;opacity:0.7;">Usage Limit</label>
                        <input type="number" id="cpUsageLimit" placeholder="Leave blank = unlimited" class="form-control" style="width:100%;" min="1">
                    </div>
                    <div>
                        <label style="display:block;margin-bottom:4px;font-size:0.85rem;opacity:0.7;">Start Date *</label>
                        <input type="date" id="cpStartDate" class="form-control" style="width:100%;" value="${new Date().toISOString().slice(0,10)}">
                    </div>
                    <div>
                        <label style="display:block;margin-bottom:4px;font-size:0.85rem;opacity:0.7;">Expiry Date *</label>
                        <input type="date" id="cpEndDate" class="form-control" style="width:100%;">
                    </div>
                    <div style="grid-column:1/-1;">
                        <label style="display:block;margin-bottom:4px;font-size:0.85rem;opacity:0.7;">Description</label>
                        <input type="text" id="cpDescription" placeholder="e.g. Summer Sale - 50% off" class="form-control" style="width:100%;">
                    </div>
                </div>
                <div style="display:flex;gap:1rem;margin-top:1rem;">
                    <button class="btn btn-primary" id="saveCouponBtn"><i class="fas fa-save"></i> Save Coupon</button>
                    <button class="btn btn-outline" id="cancelCouponBtn">Cancel</button>
                </div>
            </div>

            <!-- Coupon Table -->
            <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:12px; overflow:hidden;">
                ${coupons.length === 0 ? `
                <div style="text-align:center;padding:3rem;opacity:0.5;">
                    <i class="fas fa-ticket-alt" style="font-size:2.5rem;display:block;margin-bottom:0.75rem;"></i>
                    <p>No coupons yet. Create your first coupon!</p>
                </div>` : `
                <div style="overflow-x:auto;">
                <table style="width:100%;border-collapse:collapse;">
                    <thead>
                        <tr style="border-bottom:1px solid var(--border-color);text-align:left;">
                            <th style="padding:1rem;font-size:0.8rem;opacity:0.6;font-weight:600;text-transform:uppercase;">Code</th>
                            <th style="padding:1rem;font-size:0.8rem;opacity:0.6;font-weight:600;text-transform:uppercase;">Discount</th>
                            <th style="padding:1rem;font-size:0.8rem;opacity:0.6;font-weight:600;text-transform:uppercase;">Min Order</th>
                            <th style="padding:1rem;font-size:0.8rem;opacity:0.6;font-weight:600;text-transform:uppercase;">Usage</th>
                            <th style="padding:1rem;font-size:0.8rem;opacity:0.6;font-weight:600;text-transform:uppercase;">Expires</th>
                            <th style="padding:1rem;font-size:0.8rem;opacity:0.6;font-weight:600;text-transform:uppercase;">Status</th>
                            <th style="padding:1rem;font-size:0.8rem;opacity:0.6;font-weight:600;text-transform:uppercase;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${coupons.map(c => `
                        <tr style="border-bottom:1px solid var(--border-color);" data-coupon-id="${c._id}">
                            <td style="padding:1rem;">
                                <span style="font-family:monospace;font-size:1rem;font-weight:700;color:var(--primary);">${c.code}</span>
                                ${c.description ? `<div style="font-size:0.78rem;opacity:0.55;margin-top:2px;">${c.description}</div>` : ''}
                            </td>
                            <td style="padding:1rem;font-weight:600;">
                                ${c.discountType === 'percentage' ? `${c.discountValue}%` : `₹${c.discountValue}`}
                                ${c.maximumDiscountAmount ? `<div style="font-size:0.75rem;opacity:0.55;">Max ₹${c.maximumDiscountAmount}</div>` : ''}
                            </td>
                            <td style="padding:1rem;">₹${c.minimumOrderAmount || 0}</td>
                            <td style="padding:1rem;">${c.usedCount || 0}${c.usageLimit ? ` / ${c.usageLimit}` : ' / ∞'}</td>
                            <td style="padding:1rem;">
                                <span style="color:${isExpired(c.endDate) ? 'var(--danger)' : 'inherit'}">${formatDate(c.endDate)}</span>
                            </td>
                            <td style="padding:1rem;">
                                <span style="padding:3px 10px;border-radius:20px;font-size:0.78rem;font-weight:600;
                                    background:${c.isActive && !isExpired(c.endDate) ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'};
                                    color:${c.isActive && !isExpired(c.endDate) ? '#22c55e' : '#ef4444'};">
                                    ${c.isActive && !isExpired(c.endDate) ? 'Active' : isExpired(c.endDate) ? 'Expired' : 'Inactive'}
                                </span>
                            </td>
                            <td style="padding:1rem;">
                                <button class="btn btn-outline" style="padding:4px 10px;font-size:0.8rem;" onclick="Admin.toggleCoupon('${c._id}', ${c.isActive})">
                                    <i class="fas fa-${c.isActive ? 'pause' : 'play'}"></i> ${c.isActive ? 'Disable' : 'Enable'}
                                </button>
                                <button class="btn" style="padding:4px 10px;font-size:0.8rem;background:rgba(239,68,68,0.15);color:#ef4444;border:1px solid rgba(239,68,68,0.3);margin-left:4px;" onclick="Admin.deleteCoupon('${c._id}', '${c.code}')">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </td>
                        </tr>`).join('')}
                    </tbody>
                </table>
                </div>`}
            </div>
        </div>`;

        // Event listeners
        document.getElementById('addCouponBtn')?.addEventListener('click', () => {
            const box = document.getElementById('couponFormBox');
            box.style.display = box.style.display === 'none' ? 'block' : 'none';
        });

        document.getElementById('cancelCouponBtn')?.addEventListener('click', () => {
            document.getElementById('couponFormBox').style.display = 'none';
        });

        document.getElementById('cpCode')?.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase();
        });

        document.getElementById('saveCouponBtn')?.addEventListener('click', async () => {
            const code = document.getElementById('cpCode').value.trim().toUpperCase();
            const discountType = document.getElementById('cpType').value;
            const discountValue = parseFloat(document.getElementById('cpValue').value);
            const minimumOrderAmount = parseFloat(document.getElementById('cpMinOrder').value) || 0;
            const maximumDiscountAmount = parseFloat(document.getElementById('cpMaxDiscount').value) || null;
            const usageLimit = parseInt(document.getElementById('cpUsageLimit').value) || null;
            const startDate = document.getElementById('cpStartDate').value;
            const endDate = document.getElementById('cpEndDate').value;
            const description = document.getElementById('cpDescription').value.trim();

            if (!code || !discountValue || !endDate) {
                Utils.showToast('Please fill in Code, Discount Value and Expiry Date', 'error');
                return;
            }

            try {
                const btn = document.getElementById('saveCouponBtn');
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

                await API.post('/coupons', {
                    code, discountType, discountValue, minimumOrderAmount,
                    maximumDiscountAmount, usageLimit, startDate, endDate, description,
                    isActive: true
                });

                Utils.showToast(`Coupon ${code} created!`, 'success');
                await Admin.renderCoupons();
            } catch (err) {
                Utils.showToast('Failed to create coupon: ' + err.message, 'error');
                document.getElementById('saveCouponBtn').disabled = false;
                document.getElementById('saveCouponBtn').innerHTML = '<i class="fas fa-save"></i> Save Coupon';
            }
        });
};

Admin.toggleCoupon = async (id, currentStatus) => {
    try {
        await API.request(`/coupons/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ isActive: !currentStatus })
        });
        Utils.showToast(`Coupon ${currentStatus ? 'disabled' : 'enabled'}`, 'success');
        await Admin.renderCoupons();
    } catch (err) {
        Utils.showToast('Failed to update coupon: ' + err.message, 'error');
    }
};

Admin.deleteCoupon = async (id, code) => {
    if (!confirm(`Delete coupon "${code}"? This cannot be undone.`)) return;
    try {
        await API.request(`/coupons/${id}`, { method: 'DELETE' });
        Utils.showToast(`Coupon ${code} deleted`, 'success');
        await Admin.renderCoupons();
    } catch (err) {
        Utils.showToast('Failed to delete coupon: ' + err.message, 'error');
    }
};


