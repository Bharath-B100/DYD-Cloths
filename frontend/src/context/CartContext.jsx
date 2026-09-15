import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import API from '../config/api';
import { addCartItem, cartItemKey, mergeCarts, normalizeCart } from '../utils/cart';

const CartContext = createContext(null);
const readCart = key => {
    try { return normalizeCart(JSON.parse(localStorage.getItem(key) || '[]')); }
    catch { return []; }
};
const saveCart = (key, items) => {
    try { localStorage.setItem(key, JSON.stringify(items)); }
    catch (error) { console.warn('Cart storage unavailable:', error); }
};

export const CartProvider = ({ children }) => {
    const { isLoggedIn, user } = useAuth();
    const accountId = isLoggedIn ? String(user?._id || user?.id || '') : '';
    const storageKey = accountId ? `dyd_cart_${accountId}` : 'dyd_cart';
    const [cartItems, setCartItems] = useState(() => readCart(storageKey));
    const [cartOwner, setCartOwner] = useState(storageKey);
    const [wishlist, setWishlist] = useState([]);
    const [cartSyncReady, setCartSyncReady] = useState(false);
    const [cartSyncLoading, setCartSyncLoading] = useState(!!accountId);
    const [cartSyncError, setCartSyncError] = useState('');
    const [hydrateAttempt, setHydrateAttempt] = useState(0);
    const cartItemsRef = useRef(cartItems);
    const ownerRef = useRef(storageKey);
    const generationRef = useRef(0);
    const syncQueue = useRef(Promise.resolve());
    const wishlistPending = useRef(new Set());

    const replaceCart = useCallback(items => {
        cartItemsRef.current = items;
        setCartItems(items);
    }, []);

    const fetchWishlistFromServer = useCallback(async () => {
        const generation = generationRef.current;
        try {
            const res = await API.get('/auth/wishlist');
            if (generation === generationRef.current && res.success) setWishlist(Array.isArray(res.data?.wishlist) ? res.data.wishlist.filter(Boolean) : []);
        } catch (error) { console.warn('Failed to fetch wishlist:', error); }
    }, []);

    useEffect(() => {
        const generation = ++generationRef.current;
        const previousOwner = ownerRef.current;
        // Only a guest cart can move into an account; switching accounts cannot leak saved carts.
        const local = previousOwner === storageKey ? cartItemsRef.current
            : mergeCarts(previousOwner === 'dyd_cart' && accountId ? cartItemsRef.current : [], readCart(storageKey));
        ownerRef.current = storageKey;
        setCartOwner(storageKey);
        replaceCart(local);
        setCartSyncReady(false);
        setCartSyncLoading(!!accountId);
        setCartSyncError('');
        setWishlist([]);
        if (!accountId) return undefined;
        saveCart('dyd_cart', []);
        API.get('/user/cart').then(res => {
            if (generation !== generationRef.current) return;
            if (!res.success || !Array.isArray(res.data?.cart)) throw new Error('The saved cart response was invalid.');
            replaceCart(mergeCarts(cartItemsRef.current, res.data.cart));
            setCartSyncReady(true);
        }).catch(error => {
            if (generation === generationRef.current) setCartSyncError(error.message || 'Unable to load your saved cart.');
        }).finally(() => {
            if (generation === generationRef.current) setCartSyncLoading(false);
        });
        fetchWishlistFromServer();
        return () => { generationRef.current++; };
    }, [accountId, storageKey, hydrateAttempt, replaceCart, fetchWishlistFromServer]);

    useEffect(() => {
        if (cartOwner !== storageKey) return;
        saveCart(storageKey, cartItems);
        if (!accountId || !cartSyncReady) return;
        const generation = generationRef.current;
        // Serialize requests so an earlier quantity update cannot restore a cart cleared after ordering.
        syncQueue.current = syncQueue.current.catch(() => {}).then(async () => {
            if (generation !== generationRef.current) return;
            try {
                await API.post('/user/cart/sync', { cart: cartItems });
                if (generation === generationRef.current) setCartSyncError('');
            } catch (error) {
                if (generation === generationRef.current) setCartSyncError('Your cart is saved on this device. Account sync failed; retry when connected.');
                console.warn('Cart sync failed:', error);
            }
        });
    }, [cartItems, cartOwner, storageKey, accountId, cartSyncReady]);

    const addItem = useCallback((product, showToast) => {
        const result = addCartItem(cartItemsRef.current, product);
        if (result.error) { showToast?.(result.error, 'warning'); return false; }
        replaceCart(result.items);
        showToast?.(`${product.name} added to cart!`, 'success');
        return true;
    }, [replaceCart]);

    const removeItem = useCallback((id, size, color, showToast, lineKey) => {
        replaceCart(cartItemsRef.current.filter(item => lineKey ? cartItemKey(item) !== lineKey : !(item.id === String(id) && item.size === size && item.color === color)));
        showToast?.('Item removed from cart', 'info');
    }, [replaceCart]);

    const updateQuantity = useCallback((id, size, color, delta, showToast, lineKey) => {
        const current = cartItemsRef.current;
        const item = current.find(value => lineKey ? cartItemKey(value) === lineKey : value.id === String(id) && value.size === size && value.color === color);
        if (!item || !Number.isInteger(delta)) return;
        const quantity = item.quantity + delta;
        if (quantity < 1) { removeItem(id, size, color, showToast, lineKey); return; }
        const total = current.filter(value => value.id === item.id).reduce((sum, value) => sum + value.quantity, 0) + delta;
        if (total > item.maxStock || quantity > 999) { showToast?.(`Maximum stock reached (${item.maxStock})`, 'warning'); return; }
        replaceCart(current.map(value => value === item ? { ...value, quantity } : value));
    }, [replaceCart, removeItem]);

    const clearCart = useCallback(showToast => { replaceCart([]); showToast?.('Cart cleared', 'info'); }, [replaceCart]);
    const isInWishlist = productId => wishlist.some(item => String(item._id || item.id || item) === String(productId));
    const toggleWishlist = async (productId, showToast) => {
        if (!accountId) { showToast?.('Please login to use wishlist', 'info'); return false; }
        if (wishlistPending.current.has(productId)) return false;
        wishlistPending.current.add(productId);
        try {
            const existing = isInWishlist(productId);
            const res = existing ? await API.delete(`/auth/wishlist/${productId}`) : await API.post(`/auth/wishlist/${productId}`);
            if (!res.success) throw new Error('Failed to update wishlist');
            await fetchWishlistFromServer();
            showToast?.(existing ? 'Removed from wishlist' : 'Added to wishlist', 'success');
            return true;
        } catch (error) { showToast?.(error.message || 'Failed to update wishlist', 'error'); return false; }
        finally { wishlistPending.current.delete(productId); }
    };

    return <CartContext.Provider value={{
        cartItems, wishlist, addItem, removeItem, updateQuantity, clearCart, toggleWishlist, isInWishlist,
        getCartTotal: () => cartItems.reduce((total, item) => total + item.price * item.quantity, 0),
        getCartCount: () => cartItems.reduce((total, item) => total + item.quantity, 0),
        fetchWishlistFromServer, cartSyncReady, cartSyncLoading, cartSyncError,
        retryCartSync: () => setHydrateAttempt(value => value + 1)
    }}>{children}</CartContext.Provider>;
};

export const useCart = () => useContext(CartContext);
