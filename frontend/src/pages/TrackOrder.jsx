import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import API from '../config/api';
import { formatDate, formatINR } from '../utils/format';
import { useAuth } from '../context/AuthContext';

const stages = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];

export default function TrackOrder() {
    const { user } = useAuth();
    const [searchParams] = useSearchParams();

    const getInitialOrder = () => {
        const fromQuery = searchParams.get('order') || searchParams.get('orderNumber');
        if (fromQuery) return fromQuery;
        try {
            return sessionStorage.getItem('latestOrderNumber') || '';
        } catch {
            return '';
        }
    };

    const getInitialEmail = () => {
        const fromQuery = searchParams.get('email');
        if (fromQuery) return fromQuery;
        if (user?.email) return user.email;
        try {
            return sessionStorage.getItem('latestOrderEmail') || '';
        } catch {
            return '';
        }
    };

    const [orderNumber, setOrderNumber] = useState(getInitialOrder);
    const [email, setEmail] = useState(getInitialEmail);
    const [order, setOrder] = useState(null);
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const queryOrder = searchParams.get('order') || searchParams.get('orderNumber');
        const queryEmail = searchParams.get('email');

        if (queryOrder) {
            setOrderNumber(queryOrder);
        }
        if (queryEmail) {
            setEmail(queryEmail);
        } else if (user?.email) {
            setEmail(prev => prev || user.email);
        }
        setOrder(null);
    }, [searchParams, user]);

    useEffect(() => {
        if (orderNumber) return;

        try {
            const savedOrder = sessionStorage.getItem('latestOrderNumber');
            const savedEmail = sessionStorage.getItem('latestOrderEmail');
            if (savedOrder) {
                setOrderNumber(savedOrder);
                if (savedEmail) setEmail(prev => prev || savedEmail);
                return;
            }
        } catch {}

        if (user) {
            let active = true;
            API.get('/auth/orders')
                .then(res => {
                    if (!active) return;
                    const ordersData = res.data?.orders || res.data?.data || res.data || [];
                    const list = Array.isArray(ordersData) ? ordersData : [];
                    if (list.length > 0 && list[0].orderNumber) {
                        setOrderNumber(prev => prev || list[0].orderNumber);
                        setEmail(prev => prev || user.email || '');
                    }
                })
                .catch(() => {});
            return () => { active = false; };
        }
    }, [user, orderNumber]);
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
            {order.status === 'cancelled' && <p style={{ color: '#ef4444' }}>This order has been cancelled.{order.cancelReason && <span> Reason: {order.cancelReason}</span>}</p>}
            <p><strong>Placed:</strong> {formatDate(order.createdAt)} &nbsp; <strong>Total:</strong> {formatINR(order.totalAmount)}</p>
            {order.trackingNumber && <p><strong>Tracking number:</strong> {order.trackingNumber}</p>}
            {trackingUrl && <p><a href={trackingUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline">Track with carrier</a></p>}
            {order.estimatedDelivery && !['cancelled', 'delivered'].includes(order.status) && <p><strong>Estimated delivery:</strong> {formatDate(order.estimatedDelivery)}</p>}
            <p><strong>Items:</strong> {order.itemCount ?? order.items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0}</p>
        </article>}
    </section>;
}
