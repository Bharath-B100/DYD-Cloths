/**
 * DYD-Clothes Cart Manager
 * Handles cart logic with localStorage persistence and stock validation.
 */

const CART_STORAGE_KEY = 'dyd_cart';

const getStoredCart = () => {
    try {
        const storedCart = localStorage.getItem(CART_STORAGE_KEY);
        if (!storedCart) return [];
        const parsedCart = JSON.parse(storedCart);
        return Array.isArray(parsedCart) ? parsedCart : [];
    } catch (error) {
        console.warn('Clearing invalid saved cart:', error);
        localStorage.removeItem(CART_STORAGE_KEY);
        return [];
    }
};

const CartManager = {
    items: getStoredCart(),
    listeners: [],

    /**
     * Add item to cart
     */
    addItem: (product) => {
        // Validate product data
        if (!product || !product.id || !product.name) {
            console.error('Invalid product data', product);
            return false;
        }

        // Validate stock
        if (product.maxStock !== undefined && product.maxStock <= 0) {
            Utils.showToast('Sorry, this item is out of stock', 'error');
            return false;
        }

        // Check if already in cart with same size/color
        const existingIndex = CartManager.items.findIndex(item => 
            item.id === product.id && 
            item.size === product.size && 
            item.color === product.color
        );

        if (existingIndex > -1) {
            const newQty = CartManager.items[existingIndex].quantity + (product.quantity || 1);
            if (product.maxStock !== undefined && newQty > product.maxStock) {
                Utils.showToast(`Only ${product.maxStock} items available in stock`, 'warning');
                return false;
            }
            CartManager.items[existingIndex].quantity = newQty;
        } else {
            CartManager.items.push({
                id: product.id,
                name: product.name,
                price: product.price || 0,
                image: product.image || 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400',
                size: product.size || 'M',
                color: product.color || 'Default',
                quantity: product.quantity || 1,
                maxStock: product.maxStock || 999
            });
        }

        CartManager.save();
        CartManager.notify();
        Utils.showToast(`${product.name} added to cart!`, 'success');
        return true;
    },

    /**
     * Remove item from cart
     */
    removeItem: (id, size, color) => {
        const originalLength = CartManager.items.length;
        CartManager.items = CartManager.items.filter(item => 
            !(item.id === id && item.size === size && item.color === color)
        );
        
        if (originalLength !== CartManager.items.length) {
            CartManager.save();
            CartManager.notify();
            Utils.showToast('Item removed from cart', 'info');
        }
    },

    /**
     * Update item quantity
     */
    updateQuantity: (id, size, color, delta) => {
        const itemIndex = CartManager.items.findIndex(i => 
            i.id === id && i.size === size && i.color === color
        );

        if (itemIndex === -1) return;

        const item = CartManager.items[itemIndex];
        const newQty = item.quantity + delta;
        
        if (newQty < 1) {
            CartManager.removeItem(id, size, color);
            return;
        }
        
        if (item.maxStock !== undefined && newQty > item.maxStock) {
            Utils.showToast(`Maximum stock reached (${item.maxStock})`, 'warning');
            return;
        }

        item.quantity = newQty;
        CartManager.save();
        CartManager.notify();
    },

    /**
     * Get cart total amount
     */
    getTotal: () => {
        return CartManager.items.reduce((total, item) => total + (item.price * item.quantity), 0);
    },

    /**
     * Get total item count
     */
    getCount: () => {
        return CartManager.items.reduce((count, item) => count + item.quantity, 0);
    },

    /**
     * Get full cart items
     */
    getItems: () => {
        return [...CartManager.items];
    },

    /**
     * Clear the cart
     */
    clear: () => {
        CartManager.items = [];
        CartManager.save();
        CartManager.notify();
        Utils.showToast('Cart cleared', 'info');
    },

    /**
     * Save cart to localStorage and Sync with Server
     */
    save: () => {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(CartManager.items));
        // Silently sync with server if logged in
        CartManager.syncWithServer();
    },

    /**
     * Event system: Add listener for cart changes
     */
    subscribe: (callback) => {
        CartManager.listeners.push(callback);
    },

    /**
     * Notify all listeners of changes
     */
    notify: () => {
        CartManager.listeners.forEach(callback => callback(CartManager.items));
    },

    /**
     * Sync cart with server (for logged-in users)
     */
    syncWithServer: async () => {
        if (!window.AuthManager || !window.AuthManager.isLoggedIn()) return;
        
        try {
            const response = await API.post('/user/cart/sync', { 
                cart: CartManager.items 
            });
            if (response && response.success) {
                console.log('Cart synced with server');
            }
        } catch (error) {
            console.error('Cart sync failed:', error);
        }
    },

    /**
     * Fetch cart from server (called on login/init)
     */
    fetchFromServer: async () => {
        if (!window.AuthManager || !window.AuthManager.isLoggedIn()) return;
        
        try {
            const response = await API.get('/user/cart');
            if (response && response.success && response.data && response.data.cart) {
                const serverCart = response.data.cart;
                
                // Merge server cart with local cart (server takes precedence for matching IDs)
                const mergedMap = new Map();
                
                // Add local items first
                CartManager.items.forEach(item => {
                    const key = `${item.id}-${item.size}-${item.color}`;
                    mergedMap.set(key, item);
                });
                
                // Add/overwrite with server items
                serverCart.forEach(item => {
                    const key = `${item.id}-${item.size}-${item.color}`;
                    mergedMap.set(key, item);
                });
                
                CartManager.items = Array.from(mergedMap.values());
                
                // Save merged cart back to local storage (without triggering another sync)
                localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(CartManager.items));
                CartManager.notify();
                
                // If local had items not on server, sync them up
                if (CartManager.items.length > serverCart.length) {
                    CartManager.syncWithServer();
                }
            }
        } catch (error) {
            console.error('Failed to fetch cart from server:', error);
        }
    }
};

// Global export
window.CartManager = CartManager;
