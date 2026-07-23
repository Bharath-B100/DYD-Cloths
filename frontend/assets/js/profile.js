/**
 * DYD-Clothes Profile Page Logic
 * Handles user orders, wishlist, and settings.
 */

document.addEventListener('DOMContentLoaded', () => {
    Profile.init();
});

const Profile = {
    init: () => {
        if (!AuthManager.isLoggedIn()) {
            window.location.href = 'login.html';
            return;
        }

        Profile.renderHeader();
        Profile.setupTabs();
        Profile.loadOrders();
        Profile.loadWishlist();
        Profile.setupSettings();
        
        // Setup share wishlist button
        const shareBtn = document.getElementById('shareWishlistBtn');
        if (shareBtn) {
            shareBtn.addEventListener('click', () => Profile.shareWishlist());
        }
        
        // Listen for logout
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => AuthManager.logout());
        }
    },

    renderHeader: () => {
        const user = AuthManager.user;
        if (!user) return;
        
        Utils.setHTML('profileName', user.name);
        Utils.setHTML('profileEmail', user.email);
        
        const avatar = document.getElementById('profileAvatar');
        if (avatar) avatar.textContent = user.name.charAt(0).toUpperCase();
    },

    setupTabs: () => {
        document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                
                // Toggle Buttons
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Toggle Content
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                const tabContent = document.getElementById(`${tab}Tab`);
                if (tabContent) tabContent.classList.add('active');
            });
        });
    },

    loadOrders: async () => {
        const container = document.getElementById('ordersList');
        if (!container) return;

        try {
            console.log('Fetching user orders...');
            const res = await API.get('/auth/orders');
            console.log('User orders response:', res);

            // Extract orders array safely
            const ordersData = res.data?.orders || res.data?.data || res.data || [];
            const orders = Array.isArray(ordersData) ? ordersData : (typeof ordersData === 'object' && ordersData.orders ? ordersData.orders : []);

            if (!orders || orders.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-box-open"></i>
                        <p>You haven't placed any orders yet.</p>
                        <a href="shop.html" class="btn btn-primary mt-3">Shop Now</a>
                    </div>
                `;
                return;
            }

            container.innerHTML = orders.map(o => {
                if (!o) return '';
                const orderId = o._id ? o._id.toString() : '';
                const orderNum = o.orderNumber || (orderId ? `#${orderId.slice(-8)}` : 'N/A');
                const items = o.items || [];
                const status = o.status || 'pending';
                
                return `
                <div class="order-card">
                    <div class="order-header">
                        <div class="order-meta">
                            <span class="order-number">Order ${orderNum}</span>
                            <span class="order-date">${Utils.formatDate(o.createdAt || new Date())}</span>
                        </div>
                        <div class="order-status">
                            <span class="status-badge status-${status}">${status.charAt(0).toUpperCase() + status.slice(1)}</span>
                        </div>
                    </div>
                    <div class="order-content">
                        <div class="order-items-preview">
                            ${items.length > 0 ? items.map(i => `
                                <img src="${i.image || 'assets/images/placeholder.jpg'}" 
                                     alt="${Utils.escapeHtml(i.name || 'Item')}" 
                                     title="${Utils.escapeHtml(i.name || 'Item')}"
                                     onerror="this.src='https://via.placeholder.com/60'">
                            `).join('') : '<p class="text-muted">No items found</p>'}
                        </div>
                        <div class="order-summary">
                            <p class="order-total">Total: ${Utils.formatINR(o.totalAmount || 0)}</p>
                            <p class="order-qty">${items.length} ${items.length === 1 ? 'item' : 'items'}</p>
                        </div>
                        <div class="order-actions">
                            <button class="btn btn-outline btn-sm" onclick="window.location.href='order-confirmation.html?id=${orderId}'">
                                <i class="fas fa-eye"></i> View Details
                            </button>
                            <button class="btn btn-outline btn-sm" onclick="Profile.trackOrder('${o.orderNumber || ''}')">
                                <i class="fas fa-truck"></i> Track
                            </button>
                            ${['pending', 'confirmed', 'processing'].includes(status) ? `
                            <button class="btn btn-outline btn-sm" style="color: var(--danger); border-color: var(--danger);" onclick="Profile.cancelOrder('${orderId}')">
                                <i class="fas fa-times"></i> Cancel
                            </button>` : ''}
                        </div>
                    </div>
                </div>
            `}).join('');
        } catch (error) {
            console.error('Load orders error:', error);
            container.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>Failed to load orders: ${error.message || 'Unknown error'}</p>
                    <button class="btn btn-outline btn-sm mt-2" onclick="Profile.loadOrders()">
                        <i class="fas fa-sync"></i> Retry
                    </button>
                </div>
            `;
        }
    },

    loadWishlist: async () => {
        const container = document.getElementById('wishlistList');
        if (!container) return;

        try {
            const res = await API.get('/auth/wishlist');
            // Extract wishlist array safely
            const wishlistData = res.data?.wishlist || res.data?.data || res.data || [];
            const items = Array.isArray(wishlistData) ? wishlistData : (wishlistData.wishlist || []);
            AuthManager.setWishlist(items);

            if (items.length === 0) {
                container.innerHTML = '<div class="empty-state"><i class="far fa-heart"></i><p>Your wishlist is empty.</p><a href="shop.html" class="btn btn-outline mt-2">Start Shopping</a></div>';
                return;
            }

            container.innerHTML = items.map(p => `
                <div class="product-card">
                    <div class="product-image">
                        <img src="${p.mainImage}" alt="${p.name}" onclick="window.location.href='product.html?id=${p._id}'">
                        <button class="remove-wishlist" onclick="Profile.toggleWishlist('${p._id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                    <div class="product-info">
                        <h3 onclick="window.location.href='product.html?id=${p._id}'">${p.name}</h3>
                        <p class="product-price">${Utils.formatINR(p.price)}</p>
                    </div>
                </div>
            `).join('');
        } catch (err) {
            console.error('Load wishlist error:', err);
            container.innerHTML = '<p>Failed to load wishlist.</p>';
        }
    },

    toggleWishlist: async (id) => {
        try {
            const response = await API.delete(`/auth/wishlist/${id}`);
            AuthManager.setWishlist(response.data?.wishlist || []);
            Utils.showToast('Removed from wishlist', 'success');
            Profile.loadWishlist();
        } catch (err) {
            Utils.showToast('Failed to update wishlist', 'error');
        }
    },

    shareWishlist: () => {
        const user = AuthManager.user;
        if (!user) return;
        
        const shareUrl = `${window.location.origin}/shared-wishlist.html?u=${user._id}`;
        navigator.clipboard.writeText(shareUrl).then(() => {
            Utils.showToast('Wishlist link copied to clipboard!', 'success');
        }).catch(() => {
            Utils.showToast(`Share this link: ${shareUrl}`, 'info');
        });
    },

    trackOrder: (orderNum) => {
        if (!orderNum) {
            Utils.showToast('Order number missing', 'error');
            return;
        }
        window.location.href = `track-order.html?orderNumber=${orderNum}`;
    },

    cancelOrder: async (orderId) => {
        if (!await Utils.confirmAction('Cancel this order? This action cannot be undone.', { title: 'Cancel order', confirmText: 'Cancel order', destructive: true })) return;
        try {
            const res = await API.put(`/orders/${orderId}/cancel`);
            if (res.success) {
                Utils.showToast('Order cancelled successfully', 'success');
                Profile.loadOrders(); // Refresh list
            } else {
                throw new Error(res.error || 'Failed to cancel order');
            }
        } catch (error) {
            Utils.showToast(error.message, 'error');
        }
    },

    setupSettings: () => {
        const form = document.getElementById('settingsForm');
        if (!form) return;

        const user = AuthManager.user;
        if (user) {
            const nameInput = document.getElementById('settingsName');
            const emailInput = document.getElementById('settingsEmail');
            if (nameInput) nameInput.value = user.name;
            if (emailInput) emailInput.value = user.email;
        }

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nameInput = document.getElementById('settingsName');
            const name = nameInput?.value;
            
            if (!name) {
                Utils.showToast('Name is required', 'error');
                return;
            }
            
            try {
                const res = await API.put('/auth/update-profile', { name });
                if (res.success) {
                    Utils.showToast('Profile updated!', 'success');
                    AuthManager.user.name = name;
                    localStorage.setItem('user', JSON.stringify(AuthManager.user));
                    Profile.renderHeader();
                } else {
                    throw new Error(res.error || 'Update failed');
                }
            } catch (err) {
                Utils.showToast(err.message, 'error');
            }
        });
    }
};

window.Profile = Profile;
