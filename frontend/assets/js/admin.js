/**
 * DYD-Cloths Admin Dashboard
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
                    <h3><i class="fas fa-history"></i> Recent Orders</h3>
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
                                    <tr>
                                        <td>#${o.orderNumber || o._id?.slice(-6) || 'N/A'}</td>
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

        // Clear file input
        const fileInput = document.getElementById('productImageFile');
        if (fileInput) fileInput.value = '';

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
                
                // Set image URL if exists
                const imageUrlInput = document.getElementById('productImageUrl');
                if (imageUrlInput && p.mainImage) imageUrlInput.value = p.mainImage;
                const imageUrlsInput = document.getElementById('productImageUrls');
                if (imageUrlsInput && p.images) imageUrlsInput.value = p.images.map(img => img.url || img).filter(Boolean).join('\n');
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

        try {
            const formData = new FormData();
            formData.append('name', form.elements['productName']?.value || '');
            formData.append('price', form.elements['productPrice']?.value || 0);
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
        if (!confirm('Permanently delete this product?')) return;
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
        
        const printBtn = document.getElementById('btnPrintOrder');
        if (printBtn) {
            printBtn.onclick = () => {
                const modalBody = document.getElementById('orderModalBody').innerHTML;
                const printWindow = window.open('', '', 'height=600,width=800');
                printWindow.document.write('<html><head><title>Print Order - DYD Cloths</title>');
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

        img.src = item.image;
        if (titleEl) titleEl.textContent = item.name;
        if (infoEl) infoEl.textContent = `Fabric/Color: ${item.color} | Size: ${item.size}`;

        const btn3D = document.getElementById('btnView3D');
        const btn2D = document.getElementById('btnView2D');
        const btnDownload = document.getElementById('btnDownloadAssets');
        const view2D = document.getElementById('lightbox2DPreview');
        const view3D = document.getElementById('lightbox3DPreview');
        
        if(btn2D) btn2D.classList.add('active');
        if(btn3D) btn3D.classList.remove('active');
        if(view2D) view2D.style.display = 'block';
        if(view3D) view3D.style.display = 'none';

        if (item.customDesign) {
            if(btn3D) btn3D.style.display = 'inline-block';
            if(btnDownload) {
                btnDownload.style.display = 'inline-block';
                btnDownload.onclick = () => Admin.downloadAssets(item.customDesign);
            }
            if(btn3D) {
                btn3D.onclick = () => {
                    btn3D.classList.add('active');
                    btn2D.classList.remove('active');
                    view2D.style.display = 'none';
                    view3D.style.display = 'block';
                    Admin.render3DPreview(item.customDesign, view3D);
                };
            }
            if(btn2D) {
                btn2D.onclick = () => {
                    btn2D.classList.add('active');
                    btn3D.classList.remove('active');
                    view2D.style.display = 'block';
                    view3D.style.display = 'none';
                };
            }

            const assetsContainer = document.getElementById('lightboxExtractedAssets');
            const assetsGrid = document.getElementById('lightboxAssetsGrid');
            if (assetsContainer && assetsGrid) {
                const uploads = item.customDesign.decals ? item.customDesign.decals.filter(d => d.textureSrc && !d.textureText) : [];
                if (uploads.length > 0) {
                    assetsContainer.style.display = 'block';
                    assetsGrid.innerHTML = uploads.map((u, i) => `
                        <div style="text-align: center; background: #fff; padding: 10px; border-radius: 8px; border: 1px solid #ddd;">
                            <img src="${u.textureSrc}" style="width: 100px; height: 100px; object-fit: contain; margin-bottom: 8px; display: block; background: #f5f5f5; border-radius: 4px;">
                            <button class="btn btn-sm btn-primary" onclick="Admin.downloadAssetFromOrder('${order._id}', ${itemIndex}, ${i})">
                                <i class="fas fa-download"></i> Download
                            </button>
                        </div>
                    `).join('');
                } else {
                    assetsContainer.style.display = 'none';
                }
            }
        } else {
            if(btn3D) btn3D.style.display = 'none';
            if(btnDownload) btnDownload.style.display = 'none';
            const assetsContainer = document.getElementById('lightboxExtractedAssets');
            if(assetsContainer) assetsContainer.style.display = 'none';
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
        const a = document.createElement('a');
        a.href = src;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    },

    render3DPreview: (config, container) => {
        if (container.querySelector('canvas')) return;

        import('three').then(THREE => {
            import('three/addons/controls/OrbitControls.js').then(({ OrbitControls }) => {
                import('three/addons/loaders/GLTFLoader.js').then(({ GLTFLoader }) => {
                    import('three/addons/geometries/DecalGeometry.js').then(({ DecalGeometry }) => {
                        
                        const scene = new THREE.Scene();
                        scene.background = new THREE.Color(0xf5f5f5);

                        const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
                        camera.position.set(0, 0, 1.5);

                        const renderer = new THREE.WebGLRenderer({ antialias: true });
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
                            
                            camera.position.set(0, 0, cameraZ * 1.3); // 30% margin
                            controls.target.set(0, 0, 0);
                            controls.update();

                            let targetMesh = null;
                            
                            model.traverse((child) => {
                                if (child.isMesh) {
                                    const name = child.name.toLowerCase();
                                    if (name.includes('plane') || name.includes('ground') || name.includes('shadow') || name.includes('backdrop') || name.includes('studio') || name.includes('environment')) {
                                        child.visible = false;
                                        return;
                                    }

                                    if (!targetMesh) targetMesh = child;
                                    child.material = child.material.clone();
                                    if (config.shirtColor) {
                                        child.material.color.setHex(parseInt(config.shirtColor.replace('#', '0x')));
                                    }
                                    child.material.side = THREE.DoubleSide;
                                }
                            });
                            modelContainer.add(model);

                            if (targetMesh && config.decals) {
                                const texLoader = new THREE.TextureLoader();
                                config.decals.forEach(d => {
                                    if (d.textureSrc) {
                                        texLoader.load(d.textureSrc, (texture) => {
                                            texture.colorSpace = THREE.SRGBColorSpace;
                                            const mat = new THREE.MeshPhongMaterial({
                                                map: texture,
                                                transparent: true,
                                                depthTest: true,
                                                depthWrite: false,
                                                polygonOffset: true,
                                                polygonOffsetFactor: -10,
                                                polygonOffsetUnits: -10,
                                                wireframe: false
                                            });
                                            let target = targetMesh;
                                            if (d.targetMeshName) {
                                                model.traverse(child => {
                                                    if (child.isMesh && child.name === d.targetMeshName) target = child;
                                                });
                                            }
                                            const geom = new DecalGeometry(
                                                target,
                                                new THREE.Vector3().fromArray(d.position),
                                                new THREE.Euler().fromArray(d.orientation),
                                                new THREE.Vector3().fromArray(d.scale)
                                            );
                                            const mesh = new THREE.Mesh(geom, mat);
                                            scene.add(mesh);
                                        });
                                    }
                                });
                            }
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
                            </tr>
                        `).join('') : '<tr><td colspan="6" class="empty-state">No customers found</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;
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
