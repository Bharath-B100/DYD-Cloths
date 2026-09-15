import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import API from '../config/api';
import { formatDate, formatINR } from '../utils/format';
import { useAuth } from '../context/AuthContext';

const stages = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];

export default function TrackOrder() {
    const { user } = useAuth();
    const [searchParams] = useSearchParams();
    const [orderNumber, setOrderNumber] = useState(() => (
        searchParams.get('order') || searchParams.get('orderNumber') || ''
    ));
    const [email, setEmail] = useState(user?.email || '');
    const [order, setOrder] = useState(null);
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    useEffect(() => { setOrderNumber(searchParams.get('order') || searchParams.get('orderNumber') || ''); setOrder(null); }, [searchParams]);
    const trackOrder = async (event) => {
        event.preventDefault();
        setMessage(''); setOrder(null);
        if (!orderNumber.trim() || !email.trim()) { setMessage('Enter both your order number and checkout email.'); return; }
        setLoading(true);
        try {
            const result = await API.get(`/orders/track?orderNumber=${encodeURIComponent(orderNumber.trim())}&email=${encodeURIComponent(email.trim())}`);
            const found = Array.isArray(result.data) ? result.data[0] : result.data;
            if (result.success && found) setOrder(found); else setMessage('Order not found. Check the details and try again.');
        } catch (error) { setMessage(error.message || 'Unable to track this order right now.'); }
        finally { setLoading(false); }
    };
    const activeStage = order ? stages.indexOf(order.status) : -1;
    const trackingUrl = /^https?:\/\//i.test(order?.trackingUrl || '') ? order.trackingUrl : null;
    return <section className="container" style={{ maxWidth: 900, margin: '140px auto 80px', padding: '0 20px' }}>
        <header className="page-header"><h1>Track Your Order</h1><p>Enter the order number and email used at checkout.</p></header>
        <form onSubmit={trackOrder} className="order-card" style={{ padding: 24, display: 'grid', gap: 14, marginTop: 24 }}>
            <input className="form-control" value={orderNumber} onChange={e => { setOrderNumber(e.target.value); setOrder(null); }} placeholder="Order number (for example, ORD-...)" aria-label="Order number" required maxLength={80} disabled={loading} />
            <input className="form-control" type="email" value={email} onChange={e => { setEmail(e.target.value); setOrder(null); }} placeholder="Checkout email" aria-label="Checkout email" required maxLength={254} disabled={loading} />
            <button className="btn btn-primary" disabled={loading}>{loading ? 'Checking…' : 'Track order'}</button>
            {message && <p role="alert" style={{ color: 'var(--error, #dc2626)', margin: 0 }}>{message}</p>}
        </form>
        {order && <article className="order-card" style={{ padding: 24, marginTop: 24 }}>
            <h2>Order {order.orderNumber}</h2>
            <p><strong>Current status:</strong> <span className={`status-badge status-${order.status}`}>{order.status}</span></p>
            {activeStage >= 0 && <div aria-label="Order progress" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, margin: '22px 0' }}>{stages.map((stage, index) => <span key={stage} aria-current={index === activeStage ? 'step' : undefined} className={`status-badge ${index <= activeStage ? 'status-confirmed' : ''}`} style={{ opacity: index <= activeStage ? 1 : .45 }}>{stage}</span>)}</div>}
            {order.status === 'cancelled' && <p>This order has been cancelled.</p>}
            <p><strong>Placed:</strong> {formatDate(order.createdAt)} &nbsp; <strong>Total:</strong> {formatINR(order.totalAmount)}</p>
            {order.trackingNumber && <p><strong>Tracking number:</strong> {order.trackingNumber}</p>}
            {trackingUrl && <p><a href={trackingUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline">Track with carrier</a></p>}
            {order.estimatedDelivery && !['cancelled', 'delivered'].includes(order.status) && <p><strong>Estimated delivery:</strong> {formatDate(order.estimatedDelivery)}</p>}
            <p><strong>Items:</strong> {order.itemCount ?? order.items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0}</p>
        </article>}
    </section>;
}
