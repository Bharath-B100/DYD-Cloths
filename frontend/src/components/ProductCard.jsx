import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { formatINR } from '../utils/format';
import { FALLBACK_IMAGE, productPrice } from '../utils/cart';
import '../styles/shop.css';

const ProductCard = ({ product }) => {
    const { toggleWishlist, isInWishlist } = useCart();
    const [saving, setSaving] = useState(false);
    const productId = product._id || product.id;
    const sellPrice = productPrice(product);
    const mrp = Number(product.mrp);
    const hasDiscount = mrp > sellPrice;
    const discount = hasDiscount ? Math.round((mrp - sellPrice) / mrp * 100) : 0;
    const inWishlist = isInWishlist(productId);
    const handleWishlistToggle = async () => {
        setSaving(true);
        try { await toggleWishlist(productId, window.Utils?.showToast); }
        finally { setSaving(false); }
    };
    return <article className="product-card">
        <div className="product-image" style={{ position: 'relative' }}>
            <Link to={`/product/${productId}`} aria-label={`View ${product.name}`}>
                <img src={product.mainImage || FALLBACK_IMAGE} alt={product.name || 'Product'} loading="lazy"
                    onError={event => { if (event.currentTarget.src !== FALLBACK_IMAGE) event.currentTarget.src = FALLBACK_IMAGE; }} />
            </Link>
            <button type="button" className={`wishlist-btn ${inWishlist ? 'active' : ''}`} onClick={handleWishlistToggle}
                disabled={saving} aria-label={`${inWishlist ? 'Remove from' : 'Add to'} wishlist`} aria-pressed={inWishlist}>
                <i className={`${inWishlist ? 'fas' : 'far'} fa-heart`} />
            </button>
        </div>
        <div className="product-info">
            <span className="product-category">{product.category || 'T-shirt'}</span>
            <h3 className="product-title"><Link to={`/product/${productId}`} style={{ color: 'inherit', textDecoration: 'none' }}>{product.name || 'Product'}</Link></h3>
            <div className="product-footer">
                {hasDiscount ? <div className="price-block">
                    <span className="price-mrp">{formatINR(mrp)}</span><span className="price-sell">{formatINR(sellPrice)}</span>
                    <span className="discount-badge">{discount}% OFF</span>
                </div> : <span className="product-price">{formatINR(sellPrice)}</span>}
                {Number(product.rating) > 0 && <div className="product-rating"><i className="fas fa-star" /><span>{Number(product.rating).toFixed(1)}</span></div>}
            </div>
            {Number(product.stock) <= 0 && <p className="status-out-of-stock">Out of stock</p>}
        </div>
    </article>;
};

export default ProductCard;
