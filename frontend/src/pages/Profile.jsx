// src/pages/Profile.jsx - User Profile Dashboard, Orders History, and Wishlist
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { formatINR, formatDate } from '../utils/format';
import API from '../config/api';
import '../styles/profile.css';
import ConfirmDialog from '../components/ConfirmDialog';

const Profile = () => {
    const { user, updateProfile, refreshUser, logout, isLoggedIn, loading } = useAuth();
    const { wishlist, toggleWishlist } = useCart();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState('orders');
    const [orders, setOrders] = useState([]);
    const [loadingOrders, setLoadingOrders] = useState(true);
    const [name, setName] = useState(user?.name || '');
    const [updatingSettings, setUpdatingSettings] = useState(false);
    const [orderPendingCancel, setOrderPendingCancel] = useState(null);
    const [ordersError, setOrdersError] = useState('');
    const [cancellingOrder, setCancellingOrder] = useState(null);
    const [phone, setPhone] = useState(user?.phone || '');
    const [addresses, setAddresses] = useState(user?.addresses || []);
    const [addressForm, setAddressForm] = useState(null);
    const [savingAddress, setSavingAddress] = useState(false);
    const [addressError, setAddressError] = useState('');
    const [addressPendingDelete, setAddressPendingDelete] = useState(null);

    // Redirect guest users
    useEffect(() => {
        if (!loading && !isLoggedIn) {
            navigate('/login');
        }
    }, [isLoggedIn, loading, navigate]);

    // Update form when user details load
    useEffect(() => {
        if (user) {
            setName(user.name || '');
            setPhone(user.phone || '');
            setAddresses(user.addresses || []);
        }
    }, [user]);

    const fetchOrders = useCallback(async () => {
        setLoadingOrders(true);
        setOrdersError('');
        try {
            const res = await API.get('/auth/orders');
            const ordersData = res.data?.orders || res.data?.data || res.data || [];
            setOrders(Array.isArray(ordersData) ? ordersData : []);
        } catch (err) {
            console.error('Failed to load orders:', err);
            setOrdersError('Your orders could not be loaded. Please try again.');
        } finally {
            setLoadingOrders(false);
        }
    }, []);

    useEffect(() => {
        if (isLoggedIn && activeTab === 'orders') fetchOrders();
    }, [isLoggedIn, activeTab, fetchOrders]);

    const handleAddressSave = async (event) => {
        event?.preventDefault();
        if (savingAddress) return;
        setSavingAddress(true);
        setAddressError('');
        try {
            const payload = Object.fromEntries(Object.entries(addressForm).filter(([key]) => key !== '_id').map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]));
            const response = addressForm._id
                ? await API.put(`/auth/addresses/${addressForm._id}`, payload)
                : await API.post('/auth/addresses', payload);
            if (!response.success) throw new Error(response.error || 'Could not save address.');
            setAddresses(response.data.addresses);
            setAddressForm(null);
            await refreshUser();
            window.Utils?.showToast?.('Address saved.', 'success');
        } catch (error) {
            setAddressError(error.message || 'Could not save address.');
        } finally { setSavingAddress(false); }
    };

    const handleAddressDelete = async (addressId) => {
        setSavingAddress(true);
        setAddressError('');
        try {
            const response = await API.delete(`/auth/addresses/${addressId}`);
            if (!response.success) throw new Error(response.error || 'Could not remove address.');
            setAddresses(response.data.addresses);
            if (addressForm?._id === addressId) setAddressForm(null);
            await refreshUser();
        } catch (error) { setAddressError(error.message || 'Could not remove address.'); }
        finally { setSavingAddress(false); }
    };

    const handleSettingsSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) {
            if (window.Utils?.showToast) window.Utils.showToast('Name is required', 'error');
            return;
        }

        setUpdatingSettings(true);
        try {
            await updateProfile({ name: name.trim(), phone: phone.trim() });
            if (window.Utils?.showToast) window.Utils.showToast('Profile updated!', 'success');
        } catch (err) {
            if (window.Utils?.showToast) window.Utils.showToast(err.message || 'Update failed', 'error');
        } finally {
            setUpdatingSettings(false);
        }
    };

    const handleCancelOrder = async (orderId) => {
        if (cancellingOrder) return;
        setCancellingOrder(orderId);
        try {
            const res = await API.put(`/orders/${orderId}/cancel`);
            if (res.success) {
                if (window.Utils?.showToast) window.Utils.showToast('Order cancelled successfully', 'success');
                await fetchOrders();
            }
        } catch (err) {
            if (window.Utils?.showToast) window.Utils.showToast(err.message || 'Failed to cancel order', 'error');
        } finally { setCancellingOrder(null); }
    };

    const handleShareWishlist = async () => {
        if (!user) return;
        const shareUrl = `${window.location.origin}/shared-wishlist?u=${user._id || user.id}`;
        try {
            await navigator.clipboard.writeText(shareUrl);
            if (window.Utils?.showToast) window.Utils.showToast('Wishlist link copied to clipboard!', 'success');
        } catch {
            if (window.Utils?.showToast) window.Utils.showToast(`Share this link: ${shareUrl}`, 'info');
        }
    };

    const handleRemoveWishlist = async (productId) => {
        await toggleWishlist(productId, window.Utils?.showToast);
    };

    if (loading || !user) {
        return (
            <div className="loading-state" style={{ textAlign: 'center', padding: '100px' }}>
                <i className="fas fa-spinner fa-spin fa-3x"></i> Loading profile...
            </div>
        );
    }

    return (
        <div className="profile-page">
            <div className="profile-container">
                {/* Header section */}
                <div className="profile-header">
                    <div id="profileAvatar" className="profile-avatar">
                        {(user.name || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="profile-info">
                        <h1 id="profileName">{user.name}</h1>
                        <p id="profileEmail">{user.email}</p>
                    </div>
                </div>

                {/* Dashboard Tabs */}
                <div className="profile-tabs">
                    <button className={`tab-btn ${activeTab === 'orders' ? 'active' : ''}`} onClick={() => setActiveTab('orders')}>Orders</button>
                    <button className={`tab-btn ${activeTab === 'wishlist' ? 'active' : ''}`} onClick={() => setActiveTab('wishlist')}>Wishlist</button>
                    <button className={`tab-btn ${activeTab === 'addresses' ? 'active' : ''}`} onClick={() => setActiveTab('addresses')}>Addresses</button>
                    <button className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>Settings</button>
                    <button id="logoutBtn" className="tab-btn" onClick={logout}>Logout</button>
                </div>

                {/* Orders Tab */}
                {activeTab === 'orders' && (
                    <div id="ordersTab" className="tab-content active">
                        <div id="ordersList">
                            {loadingOrders ? (
                                <div className="admin-loading" style={{ textAlign: 'center', padding: '20px' }}>
                                    <i className="fas fa-spinner fa-spin"></i> Loading your orders...
                                </div>
                            ) : ordersError ? (
                                <div role="alert" className="empty-state"><p>{ordersError}</p><button className="btn btn-outline" onClick={fetchOrders}>Retry</button></div>
                            ) : orders.length === 0 ? (
                                <div className="empty-state" style={{ textAlign: 'center', padding: '40px' }}>
                                    <i className="fas fa-box-open fa-3x" style={{ opacity: 0.3, marginBottom: '10px' }}></i>
                                    <p>You haven't placed any orders yet.</p>
                                    <Link to="/shop" className="btn btn-primary mt-3">Shop Now</Link>
                                </div>
                            ) : (
                                orders.map(order => {
                                    const orderId = String(order._id || order.id || '');
                                    const orderNum = order.orderNumber || `#${orderId.slice(-8)}`;
                                    const status = order.status || 'pending';
                                    const items = order.items || [];
                                    
                                    return (
                                        <div key={orderId} className="order-card">
                                            <div className="order-header">
                                                <div className="order-meta">
                                                    <span className="order-number">Order {orderNum}</span>
                                                    <span className="order-date">{formatDate(order.createdAt)}</span>
                                                </div>
                                                <div className="order-status">
                                                    <span className={`status-badge status-${status}`}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
                                                </div>
                                            </div>
                                            <div className="order-content">
                                                <div className="order-items-preview">
                                                    {items.map((item, idx) => (
                                                        <img 
                                                            key={idx} 
                                                            src={item.image || 'https://via.placeholder.com/60'} 
                                                            alt={item.name} 
                                                            title={item.name}
                                                            onError={(e) => {
                                                                e.target.onerror = null;
                                                                e.target.src = 'https://via.placeholder.com/60';
                                                            }}
                                                        />
                                                    ))}
                                                </div>
                                                <div className="order-summary">
                                                    <p className="order-total">Total: {formatINR(order.totalAmount)}</p>
                                                    <p className="order-qty">{items.reduce((total, item) => total + (Number(item.quantity) || 0), 0)} items</p>
                                                </div>
                                                <div className="order-actions">
                                                    {/* Details Page Link */}
                                                    <button className="btn btn-outline btn-sm" onClick={() => navigate(`/checkout/confirmation?id=${orderId}`)}>
                                                        <i className="fas fa-eye"></i> View Details
                                                    </button>
                                                    {['pending', 'confirmed', 'processing'].includes(status) && (
                                                        <button className="btn btn-outline btn-sm" disabled={Boolean(cancellingOrder)} style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => setOrderPendingCancel(orderId)}>
                                                            <i className="fas fa-times"></i> Cancel
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}

                {/* Wishlist Tab */}
                {activeTab === 'wishlist' && (
                    <div id="wishlistTab" className="tab-content active">
                        <div>
                            <h3>My Wishlist</h3>
                            <button id="shareWishlistBtn" onClick={handleShareWishlist}><i className="fas fa-share-alt"></i> Share</button>
                        </div>
                        <div id="wishlistList">
                            {wishlist.map(p => (
                                <div key={p._id || p.id} className="product-card">
                                    <div className="product-image">
                                        <img 
                                            src={p.mainImage || 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400'} 
                                            alt={p.name} 
                                            onClick={() => navigate(`/product/${p._id || p.id}`)}
                                        />
                                        <button className="remove-wishlist" onClick={() => handleRemoveWishlist(p._id || p.id)}>
                                            <i className="fas fa-trash"></i>
                                        </button>
                                    </div>
                                    <div className="product-info" onClick={() => navigate(`/product/${p._id || p.id}`)}>
                                        <h3>{p.name}</h3>
                                        <p className="product-price">{formatINR(p.price)}</p>
                                    </div>
                                </div>
                            ))}

                            {wishlist.length === 0 && (
                                <div className="empty-state" style={{ textAlign: 'center', width: '100%', gridColumn: '1/-1', padding: '40px' }}>
                                    <i className="far fa-heart fa-3x" style={{ opacity: 0.3, marginBottom: '10px' }}></i>
                                    <p>Your wishlist is empty.</p>
                                    <Link to="/shop" className="btn btn-outline mt-2">Start Shopping</Link>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'addresses' && (
                    <div className="tab-content active">
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'center', marginBottom: '20px' }}>
                            <h3>Saved addresses</h3>
                            <button className="btn btn-primary" disabled={savingAddress} onClick={() => { setAddressError(''); setAddressForm({ type: 'home', street: '', city: '', state: '', zipCode: '', country: 'India', isDefault: addresses.length === 0 }); }}>Add address</button>
                        </div>
                        {addressError && <p role="alert" style={{ color: 'var(--danger)' }}>{addressError}</p>}
                        {addressForm && (
                            <form className="order-card" onSubmit={handleAddressSave}>
                                <h3>{addressForm._id ? 'Edit address' : 'New address'}</h3>
                                <div className="form-grid-2">
                                    <div className="form-group"><label htmlFor="address-type">Address type</label><select id="address-type" className="form-control" value={addressForm.type} onChange={e => setAddressForm({ ...addressForm, type: e.target.value })}>{['home', 'work', 'other'].map(type => <option key={type} value={type}>{type}</option>)}</select></div>
                                    {[['street', 'Street address'], ['city', 'City'], ['state', 'State'], ['zipCode', 'PIN / postal code'], ['country', 'Country']].map(([key, label]) => (
                                        <div className="form-group" key={key}><label htmlFor={`address-${key}`}>{label}</label><input id={`address-${key}`} className="form-control" value={addressForm[key] || ''} maxLength={key === 'street' ? 250 : 100} required onChange={e => setAddressForm({ ...addressForm, [key]: e.target.value })} /></div>
                                    ))}
                                </div>
                                <label style={{ display: 'block', marginBottom: '16px' }}><input type="checkbox" checked={addressForm.isDefault} onChange={e => setAddressForm({ ...addressForm, isDefault: e.target.checked })} /> Use as my default delivery address</label>
                                <div style={{ display: 'flex', gap: '10px' }}><button className="btn btn-primary" disabled={savingAddress}>{savingAddress ? 'Saving…' : 'Save address'}</button><button type="button" className="btn btn-outline" disabled={savingAddress} onClick={() => setAddressForm(null)}>Cancel</button></div>
                            </form>
                        )}
                        {addresses.map(address => (
                            <div className="order-card" key={address._id}>
                                <strong style={{ textTransform: 'capitalize' }}>{address.type} {address.isDefault && '· Default'}</strong>
                                <p>{address.street}<br />{address.city}, {address.state} {address.zipCode}<br />{address.country}</p>
                                <div style={{ display: 'flex', gap: '10px' }}><button className="btn btn-outline btn-sm" disabled={savingAddress} onClick={() => { setAddressError(''); setAddressForm({ ...address }); }}>Edit</button><button className="btn btn-outline btn-sm" disabled={savingAddress} onClick={() => setAddressPendingDelete(address._id)}>Remove</button></div>
                            </div>
                        ))}
                        {!addresses.length && !addressForm && <p>No saved addresses yet. Add one to reuse it at checkout.</p>}
                    </div>
                )}

                {/* Settings Tab */}
                {activeTab === 'settings' && (
                    <div id="settingsTab" className="tab-content active">
                        <div className="order-card">
                            <h3>Account Settings</h3>
                            <form onSubmit={handleSettingsSubmit}>
                                <div className="form-grid-2">
                                    <div className="form-group">
                                        <label>Full Name</label>
                                        <input 
                                            type="text" 
                                            className="form-control" 
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            minLength={2}
                                            maxLength={50}
                                            required 
                                        />
                                    </div>
                                    <div className="form-group"><label htmlFor="profile-phone">Phone number</label><input id="profile-phone" type="tel" autoComplete="tel" className="form-control" value={phone} onChange={e => setPhone(e.target.value)} maxLength={25} /></div>
                                    <div className="form-group">
                                        <label>Email Address</label>
                                        <input 
                                            type="email" 
                                            className="form-control" 
                                            value={user.email} 
                                            disabled 
                                        />
                                    </div>
                                </div>
                                <button type="submit" className="btn btn-primary" disabled={updatingSettings}>
                                    {updatingSettings ? 'Saving...' : 'Save Changes'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}
                {orderPendingCancel && <ConfirmDialog title="Cancel order?" message="This action cannot be undone." confirmLabel="Cancel order" onCancel={() => setOrderPendingCancel(null)} onConfirm={() => { handleCancelOrder(orderPendingCancel); setOrderPendingCancel(null); }} />}
                {addressPendingDelete && <ConfirmDialog title="Remove saved address?" message="This address will no longer be available at checkout." confirmLabel="Remove" onCancel={() => setAddressPendingDelete(null)} onConfirm={() => { handleAddressDelete(addressPendingDelete); setAddressPendingDelete(null); }} />}
            </div>
        </div>
    );
};

export default Profile;
