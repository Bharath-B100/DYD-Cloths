import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { formatINR } from '../utils/format';
import { FALLBACK_IMAGE, orderItems } from '../utils/cart';
import API from '../config/api';
import '../styles/checkout.css';

const Checkout = () => {
    const { user, settings, isLoggedIn, loading } = useAuth();
    const { cartItems: items, clearCart, cartSyncLoading, cartSyncError, retryCartSync } = useCart();
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [shippingForm, setShippingForm] = useState({ firstName: '', lastName: '', email: '', phone: '', address: '', city: '', state: '', zipCode: '' });
    const [selectedAddress, setSelectedAddress] = useState('');
    const [couponCode, setCouponCode] = useState('');
    const [couponApplied, setCouponApplied] = useState('');
    const [quote, setQuote] = useState(null);
    const [quoteLoading, setQuoteLoading] = useState(false);
    const [quoteError, setQuoteError] = useState('');
    const [quoteAttempt, setQuoteAttempt] = useState(0);
    const [orderError, setOrderError] = useState('');
    const [processing, setProcessing] = useState(false);
    const processingRef = useRef(false);
    const orderPlacedRef = useRef(false);
    const requestIdRef = useRef(null);
    const enableCod = settings?.enable_cod !== 'false' && settings?.enable_cod !== false;
    const addresses = (user?.addresses || []).filter(address => !address.country || address.country.toLowerCase() === 'india');
    const payloadItems = orderItems(items);
    const quoteKey = JSON.stringify({ items: payloadItems, couponCode: couponApplied || null });
    const quoteReady = !!quote && quote.requestKey === quoteKey && !quoteLoading && !quoteError;
    const currentUserId = user?._id || user?.id;

    useEffect(() => { requestIdRef.current = null; }, [quoteKey, shippingForm]);

    useEffect(() => {
        if (loading || cartSyncLoading || processingRef.current || orderPlacedRef.current) return;
        if (!isLoggedIn) navigate('/login', { replace: true, state: { from: '/checkout' } });
        else if (items.length === 0 && !cartSyncError) navigate('/shop', { replace: true });
    }, [isLoggedIn, loading, cartSyncLoading, cartSyncError, items.length, navigate]);

    useEffect(() => {
        if (!user) return;
        const name = (user.name || '').trim().split(/\s+/);
        const address = (user.addresses || []).find(value => value.isDefault && (!value.country || value.country.toLowerCase() === 'india'));
        setShippingForm({ firstName: name[0] || '', lastName: name.slice(1).join(' '), email: user.email || '', phone: user.phone || '', address: address?.street || '', city: address?.city || '', state: address?.state || '', zipCode: address?.zipCode || '' });
        setSelectedAddress(address?._id || '');
        // Account changes prefill once, without overwriting edits after a profile refresh.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUserId]);

    useEffect(() => {
        let cancelled = false;
        setQuote(null);
        setQuoteError('');
        if (loading || !isLoggedIn || cartSyncLoading || items.length === 0 || orderPlacedRef.current) { setQuoteLoading(false); return undefined; }
        setQuoteLoading(true);
        API.post('/orders/quote', JSON.parse(quoteKey)).then(res => {
            if (cancelled) return;
            if (!res.success || !Number.isFinite(res.data?.totalAmount)) throw new Error(res.error || 'Unable to calculate this order.');
            setQuote({ ...res.data, requestKey: quoteKey });
        }).catch(error => { if (!cancelled) setQuoteError(error.message || 'Unable to calculate this order.'); })
            .finally(() => { if (!cancelled) setQuoteLoading(false); });
        return () => { cancelled = true; };
    }, [quoteKey, quoteAttempt, isLoggedIn, loading, cartSyncLoading, items.length]);

    const chooseAddress = event => {
        setSelectedAddress(event.target.value);
        const address = addresses.find(value => value._id === event.target.value);
        setShippingForm(previous => ({ ...previous, address: address?.street || '', city: address?.city || '', state: address?.state || '', zipCode: address?.zipCode || '' }));
    };
    const handleFormChange = event => {
        const { name, value } = event.target;
        setShippingForm(previous => ({ ...previous, [name]: value }));
        if (['address', 'city', 'state', 'zipCode'].includes(name)) setSelectedAddress('');
    };
    const validateShipping = () => {
        const required = { firstName: 'first name', email: 'email', phone: 'phone number', address: 'street address', city: 'city', state: 'state', zipCode: 'PIN code' };
        for (const [field, label] of Object.entries(required)) {
            if (!shippingForm[field].trim()) { setOrderError(`Please enter your ${label}.`); return false; }
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(shippingForm.email.trim())) { setOrderError('Please enter a valid email address.'); return false; }
        const phone = shippingForm.phone.replace(/[\s()+-]/g, '');
        if (!/^\d{7,15}$/.test(phone)) { setOrderError('Please enter a valid phone number.'); return false; }
        if (!/^[1-9]\d{5}$/.test(shippingForm.zipCode.trim())) { setOrderError('Please enter a valid six-digit Indian PIN code.'); return false; }
        setOrderError('');
        return true;
    };
    const handlePlaceOrder = async () => {
        if (processingRef.current || !quoteReady) return;
        if (!validateShipping()) { setStep(1); return; }
        if (!enableCod) { setOrderError('Cash on Delivery is unavailable. Please contact support.'); setStep(2); return; }
        processingRef.current = true;
        setProcessing(true);
        setOrderError('');
        requestIdRef.current ||= crypto.randomUUID();
        try {
            const result = await API.post('/orders', {
                requestId: requestIdRef.current,
                customer: { name: `${shippingForm.firstName} ${shippingForm.lastName}`.trim(), email: shippingForm.email.trim(), phone: shippingForm.phone.trim() },
                items: payloadItems,
                shippingAddress: { street: shippingForm.address.trim(), city: shippingForm.city.trim(), state: shippingForm.state.trim(), zipCode: shippingForm.zipCode.trim(), country: 'India' },
                paymentMethod: 'cash_on_delivery',
                couponCode: couponApplied || null,
                totalAmount: quote.totalAmount
            });
            const order = result.data;
            if (!result.success || !order?._id) throw new Error(result.error || 'The server did not return an order confirmation.');
            orderPlacedRef.current = true;
            clearCart();
            navigate(`/checkout/confirmation?id=${encodeURIComponent(order._id)}`, { replace: true, state: { order } });
        } catch (error) {
            setOrderError(error.message || 'Unable to place the order. Your cart has been kept.');
            // Keep the request id on network errors so a retry cannot create a second order.
            if (error.status && error.status < 500) requestIdRef.current = null;
            setQuoteAttempt(value => value + 1);
        } finally {
            processingRef.current = false;
            setProcessing(false);
        }
    };
    const input = (name, label, type = 'text', required = true, autoComplete) => <div className="form-group" key={name}>
        <label htmlFor={`shipping-${name}`} className={required ? 'required' : ''}>{label}</label>
        <input id={`shipping-${name}`} type={type} name={name} className="form-control" value={shippingForm[name]} onChange={handleFormChange} required={required} autoComplete={autoComplete} maxLength={name === 'zipCode' ? 6 : name === 'address' ? 300 : 100} inputMode={name === 'zipCode' ? 'numeric' : undefined} />
    </div>;
    const summaryItems = quoteReady && Array.isArray(quote.items) ? quote.items : items;

    if (loading || cartSyncLoading) return <div className="loading-state" role="status" style={{ margin: '140px auto 80px', textAlign: 'center' }}>Loading your checkout…</div>;
    return <div className="checkout-page"><div className="checkout-container">
        <div className="checkout-form-container">
            <div className="checkout-steps">{['Shipping', 'Payment', 'Review'].map((label, index) => <div key={label} className={`step ${step === index + 1 ? 'active' : ''} ${step > index + 1 ? 'completed' : ''}`}><span className="step-number">{index + 1}</span><span className="step-label">{label}</span></div>)}</div>
            {cartSyncError && <p role="alert">{cartSyncError} <button type="button" className="btn btn-outline" onClick={retryCartSync} disabled={processing}>Retry sync</button></p>}
            {orderError && <p role="alert" className="coupon-message error">{orderError}</p>}
            {step === 1 && <section className="checkout-section">
                <h3><i className="fas fa-truck" /> Shipping Information</h3>
                {addresses.length > 0 && <div className="form-group"><label htmlFor="saved-address">Saved address</label><select id="saved-address" className="form-control" value={selectedAddress} onChange={chooseAddress}><option value="">Use a new address</option>{addresses.map(address => <option key={address._id} value={address._id}>{address.type}: {address.street}, {address.city}{address.isDefault ? ' (default)' : ''}</option>)}</select></div>}
                <form onSubmit={event => { event.preventDefault(); if (validateShipping()) setStep(2); }}>
                    <div className="form-grid-2">{input('firstName', 'First Name', 'text', true, 'given-name')}{input('lastName', 'Last Name (optional)', 'text', false, 'family-name')}</div>
                    {input('email', 'Email Address', 'email', true, 'email')}{input('phone', 'Phone Number', 'tel', true, 'tel')}
                    {input('address', 'Street Address', 'text', true, 'street-address')}
                    <div className="form-grid-2">{input('city', 'City', 'text', true, 'address-level2')}{input('state', 'State', 'text', true, 'address-level1')}</div>
                    {input('zipCode', 'PIN Code', 'text', true, 'postal-code')}
                    <p>Delivery within India.</p><button type="submit" className="btn btn-primary btn-full mt-4">Continue to Payment</button>
                </form>
            </section>}
            {step === 2 && <section className="checkout-section">
                <h3><i className="fas fa-credit-card" /> Payment Method</h3>
                <div className="coupon-section"><h3>Have a Coupon?</h3>
                    <form className="coupon-input-group" onSubmit={event => { event.preventDefault(); const code = couponCode.trim().toUpperCase(); if (code) { setCouponApplied(code); setQuoteAttempt(value => value + 1); } }}>
                        <input className="form-control" aria-label="Coupon code" value={couponCode} onChange={event => setCouponCode(event.target.value)} placeholder="Enter coupon code" disabled={!!couponApplied} maxLength={50} />
                        <button className="btn btn-outline" disabled={!!couponApplied || !couponCode.trim() || quoteLoading}>Apply</button>
                    </form>
                    {couponApplied && <p className="coupon-message"><span>{quoteLoading ? 'Checking coupon…' : quoteReady ? `${couponApplied}: You saved ${formatINR(quote.discountAmount)}` : `Coupon: ${couponApplied}`}</span> <button type="button" className="btn btn-outline" onClick={() => { setCouponApplied(''); setCouponCode(''); }}>Remove coupon</button></p>}
                </div>
                {enableCod ? <div className="payment-methods"><label className="payment-method selected"><input type="radio" name="paymentMethod" checked readOnly /> <strong>Cash on Delivery</strong><small>Pay when you receive your order</small></label></div> : <p role="alert" className="coupon-message error">Cash on Delivery is currently unavailable. Please <Link to="/support">contact support</Link>.</p>}
                <div className="button-group"><button className="btn btn-outline" onClick={() => setStep(1)}>Back</button><button className="btn btn-primary" disabled={!quoteReady || !enableCod} onClick={() => setStep(3)}>Review Order</button></div>
            </section>}
            {step === 3 && <section className="checkout-section">
                <h3><i className="fas fa-check-circle" /> Review Your Order</h3>
                <h4>Shipping Address</h4><p>{shippingForm.firstName} {shippingForm.lastName}<br />{shippingForm.address}<br />{shippingForm.city}, {shippingForm.state} {shippingForm.zipCode}<br />{shippingForm.email}<br />{shippingForm.phone}</p>
                <h4>Payment Method</h4><p>Cash on Delivery</p>
                <div className="button-group"><button className="btn btn-outline" onClick={() => setStep(2)} disabled={processing}>Back</button><button className="btn btn-primary" onClick={handlePlaceOrder} disabled={processing || !quoteReady || !enableCod || !items.length}>{processing ? 'Placing order…' : `Place Order — ${formatINR(quote?.totalAmount)}`}</button></div>
            </section>}
        </div>
        <div className="checkout-summary-container"><aside className="order-summary-sidebar">
            <div className="summary-header"><h3>Order Summary</h3></div>
            <div className="order-items">{summaryItems.map((item, index) => <div key={index} className="order-item"><img src={item.image || FALLBACK_IMAGE} alt={item.name} onError={event => { if (event.currentTarget.src !== FALLBACK_IMAGE) event.currentTarget.src = FALLBACK_IMAGE; }} /><div className="item-info"><h4 className="item-name">{item.name}</h4><span className="item-meta">Size: {item.size} | Color: {item.color} | Qty: {item.quantity}</span></div><span className="item-price">{formatINR(item.price * item.quantity)}</span></div>)}</div>
            {quoteLoading && <p role="status">Checking prices, stock and shipping…</p>}
            {quoteError && <div role="alert" className="coupon-message error"><p>{quoteError}</p><button className="btn btn-outline" onClick={() => setQuoteAttempt(value => value + 1)}>Recheck order</button>{couponApplied && <button className="btn btn-outline" onClick={() => setCouponApplied('')}>Remove coupon</button>}</div>}
            {quoteReady && <div className="order-totals"><div className="total-row"><span>Subtotal</span><span>{formatINR(quote.subtotal)}</span></div>{quote.discountAmount > 0 && <div className="total-row discount-row"><span>Discount ({quote.couponCode || couponApplied})</span><span>−{formatINR(quote.discountAmount)}</span></div>}<div className="total-row"><span>Shipping Fee</span><span>{quote.shippingFee === 0 ? 'FREE' : formatINR(quote.shippingFee)}</span></div>{quote.tax > 0 && <div className="total-row"><span>Tax</span><span>{formatINR(quote.tax)}</span></div>}<div className="total-row final"><span>Total</span><span>{formatINR(quote.totalAmount)}</span></div></div>}
            <p><Link to="/shop">Continue shopping</Link> · Use the cart button to edit quantities.</p>
        </aside></div>
    </div></div>;
};

export default Checkout;
