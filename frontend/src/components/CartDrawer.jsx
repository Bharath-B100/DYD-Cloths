import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { formatINR } from '../utils/format';
import { cartItemKey } from '../utils/cart';
import '../styles/cart-drawer.css';

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400';

const CartDrawer = ({ isOpen, onClose }) => {
    const drawerRef = useRef(null);
    const navigate = useNavigate();
    const { isLoggedIn } = useAuth();
    const {
        cartItems,
        removeItem,
        updateQuantity,
        clearCart,
        getCartTotal,
        cartSyncLoading,
        cartSyncError,
        retryCartSync
    } = useCart();

    useEffect(() => {
        if (!isOpen) return undefined;

        const previouslyFocused = document.activeElement;
        const closeOnEscape = (event) => {
            if (event.key === 'Escape') onClose();
            if (event.key === 'Tab') {
                const buttons = drawerRef.current?.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled)');
                const first = buttons?.[0];
                const last = buttons?.[buttons.length - 1];
                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
            }
        };

        document.addEventListener('keydown', closeOnEscape);
        document.body.classList.add('cart-drawer-open');
        drawerRef.current?.querySelector('button')?.focus();
        return () => {
            document.removeEventListener('keydown', closeOnEscape);
            document.body.classList.remove('cart-drawer-open');
            previouslyFocused?.focus?.();
        };
    }, [isOpen, onClose]);

    const notify = (message, type = 'info') => {
        window.Utils?.showToast?.(message, type);
    };

    const proceedToCheckout = () => {
        if (cartItems.length === 0) {
            notify('Your cart is empty', 'warning');
            return;
        }

        onClose();
        if (!isLoggedIn) {
            navigate('/login', { state: { from: '/checkout' } });
            return;
        }
        navigate('/checkout');
    };

    return (
        <>
            <button
                type="button"
                className={`cart-drawer-overlay ${isOpen ? 'is-open' : ''}`}
                aria-label="Close cart"
                aria-hidden={!isOpen}
                tabIndex={isOpen ? 0 : -1}
                onClick={onClose}
            />
            <aside
                ref={drawerRef}
                className={`cart-drawer ${isOpen ? 'is-open' : ''}`}
                aria-hidden={!isOpen}
                aria-label="Shopping cart"
                role="dialog"
                aria-modal={isOpen ? true : undefined}
                inert={!isOpen}
            >
                <header className="cart-drawer-header">
                    <h2><i className="fas fa-shopping-cart" /> Your Cart</h2>
                    <button type="button" className="cart-drawer-close" onClick={onClose} aria-label="Close cart">&times;</button>
                </header>

                <div className="cart-drawer-items">
                    {cartSyncLoading && <p role="status">Loading your saved cart…</p>}
                    {cartSyncError && <p role="alert">{cartSyncError} <button type="button" className="btn btn-outline" onClick={retryCartSync}>Retry sync</button></p>}
                    {cartItems.length === 0 ? (
                        <div className="cart-drawer-empty">
                            <i className="fas fa-shopping-bag" />
                            <h3>Your cart is empty</h3>
                            <p>Add a product to begin your order.</p>
                            <button type="button" className="btn btn-primary" onClick={() => { onClose(); navigate('/shop'); }}>
                                Start shopping
                            </button>
                        </div>
                    ) : (
                        cartItems.map((item) => (
                            <article className="cart-drawer-item" key={cartItemKey(item)}>
                                <img
                                    src={item.image || FALLBACK_IMAGE}
                                    alt={item.name}
                                    onError={(event) => { if (event.currentTarget.src !== FALLBACK_IMAGE) event.currentTarget.src = FALLBACK_IMAGE; }}
                                />
                                <div className="cart-drawer-item-details">
                                    <div className="cart-drawer-item-heading">
                                        <h3>{item.name}</h3>
                                        <button
                                            type="button"
                                            className="cart-drawer-remove"
                                            aria-label={`Remove ${item.name} from cart`}
                                            onClick={() => removeItem(item.id, item.size, item.color, notify, cartItemKey(item))}
                                        >
                                            <i className="fas fa-trash-alt" />
                                        </button>
                                    </div>
                                    <p>Size: {item.size} · Color: {item.color}</p>
                                    <div className="cart-drawer-item-controls">
                                        <strong>{formatINR(item.price)}</strong>
                                        <div className="cart-drawer-quantity" aria-label={`Quantity for ${item.name}`}>
                                            <button type="button" onClick={() => updateQuantity(item.id, item.size, item.color, -1, notify, cartItemKey(item))} aria-label="Decrease quantity">−</button>
                                            <span>{item.quantity}</span>
                                            <button type="button" onClick={() => updateQuantity(item.id, item.size, item.color, 1, notify, cartItemKey(item))} aria-label="Increase quantity" disabled={cartItems.filter(value => value.id === item.id).reduce((total, value) => total + value.quantity, 0) >= item.maxStock}>+</button>
                                        </div>
                                    </div>
                                </div>
                            </article>
                        ))
                    )}
                </div>

                <footer className="cart-drawer-footer">
                    <div className="cart-drawer-total"><span>Subtotal</span><strong>{formatINR(getCartTotal())}</strong></div>
                    <p>Shipping and discounts calculated at checkout.</p>
                    <button type="button" className="btn btn-primary btn-full" onClick={proceedToCheckout} disabled={cartItems.length === 0 || cartSyncLoading}>
                        Proceed to checkout
                    </button>
                    {cartItems.length > 0 && (
                        <button type="button" className="btn btn-outline btn-full" onClick={() => clearCart(notify)}>
                            Clear cart
                        </button>
                    )}
                </footer>
            </aside>
        </>
    );
};

export default CartDrawer;
