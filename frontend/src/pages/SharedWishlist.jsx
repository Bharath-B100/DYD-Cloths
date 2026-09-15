import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import API from '../config/api';
import ProductCard from '../components/ProductCard';

export default function SharedWishlist() {
    const [params] = useSearchParams();
    const userId = params.get('u');
    const [wishlist, setWishlist] = useState([]);
    const [message, setMessage] = useState('Loading wishlist…');

    useEffect(() => {
        let cancelled = false;
        setWishlist([]);
        setMessage('Loading wishlist…');
        if (!userId) { setMessage('This wishlist link is invalid.'); return; }
        API.get(`/auth/wishlist/share/${encodeURIComponent(userId)}`)
            .then(result => {
                if (cancelled) return;
                if (!result.success) throw new Error(result.error || 'Unable to load this wishlist.');
                const products = Array.isArray(result.data?.wishlist) ? result.data.wishlist.filter(product => product && product.isActive !== false) : [];
                setWishlist(products);
                setMessage(products.length ? '' : 'This wishlist is empty.');
            })
            .catch(error => { if (!cancelled) setMessage(error.message || 'Unable to load this wishlist.'); });
        return () => { cancelled = true; };
    }, [userId]);

    return <section className="container" style={{ maxWidth: 1200, margin: '48px auto 80px', padding: '0 20px' }}>
        <header className="page-header"><h1>Shared Wishlist</h1><p>Items saved by a DYD-Clothes customer.</p></header>
        {message ? <div className="order-card" style={{ padding: 28, marginTop: 24, textAlign: 'center' }}>{message}</div> : <div className="product-grid" style={{ marginTop: 28 }}>{wishlist.map(product => <ProductCard key={product._id || product.id} product={product} />)}</div>}
        <p style={{ textAlign: 'center', marginTop: 28 }}><Link to="/shop" className="btn btn-primary">Browse the collection</Link></p>
    </section>;
}
