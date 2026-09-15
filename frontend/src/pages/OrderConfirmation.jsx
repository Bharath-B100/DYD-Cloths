// src/pages/OrderConfirmation.jsx - Post-purchase Success Confirmation Screen
import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import API from '../config/api';
import { formatINR, formatDate } from '../utils/format';

const OrderConfirmation = () => {
    const [searchParams] = useSearchParams();
    const orderId = searchParams.get('id');
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [reload, setReload] = useState(0);

    useEffect(() => {
        let cancelled = false;
        setOrder(null);
        setError('');
        setLoading(true);
        if (!orderId) {
            setLoading(false);
            return;
        }

        const fetchOrder = async () => {
            try {
                const res = await API.get(`/orders/${orderId}`);
                if (!cancelled && res.success && res.data) {
                    setOrder(res.data);
                }
            } catch (err) {
                if (!cancelled) setError(err.message || 'Unable to retrieve this order.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchOrder();
        return () => { cancelled = true; };
    }, [orderId, reload]);

    if (loading) {
        return (
            <div className="loading-state" style={{ textAlign: 'center', padding: '100px' }}>
                <i className="fas fa-spinner fa-spin fa-3x"></i> Loading confirmation...
            </div>
        );
    }

    if (!orderId || !order) {
        return (
            <div className="container" style={{ maxWidth: '800px', margin: '140px auto 80px', textAlign: 'center' }}>
                <div className="confirmation-icon" style={{ backgroundColor: '#ef4444', width: '100px', height: '100px', borderRadius: '50%', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem', margin: '0 auto 2rem' }}>
                    <i className="fas fa-exclamation-circle"></i>
                </div>
                <h1>Order details unavailable</h1>
                <p role="alert">{error || 'This link does not include an order ID.'} Check your account orders before placing another order.</p>
                <div style={{ marginTop: '2rem' }}>
                    <Link to="/profile?tab=orders" className="btn btn-primary">View My Orders</Link>
                    {orderId && <button className="btn btn-outline" onClick={() => setReload(value => value + 1)}>Try again</button>}
                </div>
            </div>
        );
    }

    return (
        <div className="container" style={{ maxWidth: '800px', margin: '140px auto 80px', textAlign: 'center', padding: '0 20px' }}>
            <div className="confirmation-icon" style={{ backgroundColor: '#10b981', width: '100px', height: '100px', borderRadius: '50%', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem', margin: '0 auto 2rem', animation: 'bounce 0.6s ease' }}>
                <i className="fas fa-check"></i>
            </div>
            
            <h1>{order.status === 'cancelled' ? 'Order Cancelled' : 'Order Received!'}</h1>
            <p style={{ color: 'var(--text-muted)' }}>{order.status === 'cancelled' ? 'This order has been cancelled. See your account for payment and refund details.' : 'Thank you for your purchase. Keep your order number to track its progress.'}</p>
            
            <div className="order-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px', margin: '32px 0', textAlign: 'left' }}>
                <h3 style={{ margin: '0 0 16px 0' }}>Order #{order.orderNumber || order._id?.slice(-8)}</h3>
                
                <div className="order-info-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginTop: '16px' }}>
                    <div className="order-info-item" style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '10px' }}>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '4px' }}>Order Date</label>
                        <span style={{ fontSize: '1rem', fontWeight: '700' }}>{formatDate(order.createdAt)}</span>
                    </div>
                    <div className="order-info-item" style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '10px' }}>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '4px' }}>Total Amount</label>
                        <span style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--primary)' }}>{formatINR(order.totalAmount)}</span>
                    </div>
                    <div className="order-info-item" style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '10px' }}>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '4px' }}>Payment Method</label>
                        <span style={{ fontSize: '1rem', fontWeight: '700' }}>{order.paymentMethod?.replaceAll('_', ' ').toUpperCase() || 'N/A'}</span>
                    </div>
                    <div className="order-info-item" style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '10px' }}>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '4px' }}>Order Status</label>
                        <span className={`status-badge status-${order.status}`} style={{ display: 'inline-block', marginTop: '4px' }}>{order.status}</span>
                    </div>
                </div>

                <div style={{ marginTop: 20, display: 'grid', gap: 8 }}>
                    <span>Subtotal: {formatINR(order.subtotal)}</span>
                    {order.discountAmount > 0 && <span>Discount{order.couponCode ? ` (${order.couponCode})` : ''}: −{formatINR(order.discountAmount)}</span>}
                    <span>Shipping: {order.shippingFee === 0 ? 'FREE' : formatINR(order.shippingFee)}</span>
                    {order.tax > 0 && <span>Tax: {formatINR(order.tax)}</span>}
                    <strong>Total: {formatINR(order.totalAmount)}</strong>
                </div>

                <h4 style={{ marginTop: '24px', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>Items Ordered</h4>
                <div className="items-list">
                    {order.items?.map((item, idx) => (
                        <div key={idx} className="confirmation-item" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
                            <img src={item.image} alt={item.name} style={{ width: '60px', height: '60px', borderRadius: '8px', objectFit: 'cover' }} />
                            <div className="item-details" style={{ flexGrow: 1 }}>
                                <div className="item-name" style={{ fontWeight: '700' }}>{item.name}</div>
                                <div className="item-meta" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Size: {item.size} | Color: {item.color} | Qty: {item.quantity}</div>
                            </div>
                            <div className="item-price" style={{ fontWeight: '700' }}>{formatINR(item.price * item.quantity)}</div>
                        </div>
                    ))}
                </div>

                <h4 style={{ marginTop: '24px', marginBottom: '8px' }}>Shipping Address</h4>
                <p style={{ margin: 0, lineHeight: '1.6' }}>
                    {order.shippingAddress?.street}<br />
                    {order.shippingAddress?.city}, {order.shippingAddress?.state} {order.shippingAddress?.zipCode}<br />
                    {order.shippingAddress?.country}
                </p>

                <div className="order-info-item" style={{ marginTop: '16px', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '10px' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '4px' }}>Customer Email</label>
                    <span style={{ fontSize: '1rem', fontWeight: '700' }}>{order.customer?.email}</span>
                </div>
            </div>

            <div className="button-group" style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '24px' }}>
                <Link to="/shop" className="btn btn-primary">
                    <i className="fas fa-shopping-bag"></i> Continue Shopping
                </Link>
                <Link to="/profile?tab=orders" className="btn btn-outline">
                    <i className="fas fa-list"></i> View My Orders
                </Link>
                {order.orderNumber && <Link to={`/track-order?order=${encodeURIComponent(order.orderNumber)}`} className="btn btn-outline">Track Order</Link>}
            </div>
        </div>
    );
};

export default OrderConfirmation;
