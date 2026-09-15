// src/components/Navbar.jsx - Shared Storefront Navigation Header
import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import API from '../config/api';
import '../styles/main.css';


const Navbar = ({ onOpenCart }) => {
    const { user, logout, isLoggedIn, isAdmin } = useAuth();
    const { getCartCount } = useCart();
    const navigate = useNavigate();
    const location = useLocation();

    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    
    const searchRef = useRef(null);

    // Close suggestions on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (searchRef.current && !searchRef.current.contains(event.target)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Close mobile menu on page transition
    useEffect(() => {
        setMobileMenuOpen(false);
        setShowSuggestions(false);
    }, [location.pathname, location.search]);

    // Fetch search suggestions
    useEffect(() => {
        let cancelled = false;
        if (searchQuery.trim().length < 2) {
            setSuggestions([]);
            return;
        }

        const delayDebounceFn = setTimeout(async () => {
            try {
                const res = await API.get(`/products?search=${encodeURIComponent(searchQuery)}&limit=5`);
                if (!cancelled && res.success && res.data) {
                    setSuggestions(Array.isArray(res.data) ? res.data : res.data.products || []);
                }
            } catch {
                if (!cancelled) setSuggestions([]);
            }
        }, 300);

        return () => { cancelled = true; clearTimeout(delayDebounceFn); };
    }, [searchQuery]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            navigate(`/shop?search=${encodeURIComponent(searchQuery.trim())}`);
            setShowSuggestions(false);
        }
    };

    const handleSuggestionClick = (productId) => {
        navigate(`/product/${productId}`);
        setSearchQuery('');
        setShowSuggestions(false);
    };

    return (
        <nav className="navbar">
            <div className="nav-container">
                {/* Logo */}
                <Link to="/" className="logo">
                    <img src="/images/LOGO_DYD.png" className="logo-icon" alt="DYD Logo" style={{ height: '40px', width: 'auto', borderRadius: '4px', objectFit: 'contain' }} />
                    <span className="site-name">D<span style={{ color: 'var(--primary)' }}>Y</span>D-Clothes</span>
                    <small className="site-tagline" style={{ fontSize: '0.6em', opacity: 0.7, display: 'block', marginTop: '-5px' }}>Design your Dream Clothes</small>
                </Link>

                {/* Search Bar */}
                <div className="search-wrapper" ref={searchRef} style={{ flex: 1, maxWidth: '450px', margin: '0 2rem', position: 'relative' }}>
                    <form className="site-search" onSubmit={handleSearchSubmit} style={{ width: '100%', position: 'relative' }}>
                        <i className="fas fa-search" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#666' }}></i>
                        <input 
                            type="search" 
                            placeholder="Search T-shirts, polos, caps and bags..." 
                            aria-label="Search products"
                            value={searchQuery}
                            onChange={(e) => {
                                const val = e.target.value;
                                setSearchQuery(val);
                                
                                setShowSuggestions(true);
                            }}
                            onFocus={() => setShowSuggestions(true)}
                            onKeyDown={event => { if (event.key === 'Escape') setShowSuggestions(false); }}
                            autoComplete="off"
                            style={{ 
                                width: '100%', 
                                padding: '10px 16px 10px 45px', 
                                borderRadius: '50px', 
                                border: 'none', 
                                background: '#1a1a1a', 
                                color: '#fff',
                                outline: 'none',
                                fontSize: '0.9rem'
                            }}
                        />
                    </form>
                    {showSuggestions && suggestions.length > 0 && searchQuery.trim().length >= 2 && (
                        <ul aria-label="Suggested products" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000, listStyle: 'none', margin: '8px 0 0', padding: 8, background: 'var(--bg-card, #1a1a1a)', border: '1px solid var(--border-color, #333)', borderRadius: 12 }}>
                            {suggestions.map(product => <li key={product._id || product.id}><button type="button" onClick={() => handleSuggestionClick(product._id || product.id)} style={{ width: '100%', textAlign: 'left', padding: 12, background: 'transparent', border: 0, color: 'inherit', cursor: 'pointer' }}>{product.name}</button></li>)}
                        </ul>
                    )}
                </div>

                {/* Mobile Menu Toggle */}
                <button className="menu-toggle" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Toggle navigation" aria-expanded={mobileMenuOpen}>
                    <i className={`fas ${mobileMenuOpen ? 'fa-times' : 'fa-bars'}`}></i>
                </button>

                {/* Desktop Navigation & Actions */}
                <div className={`nav-actions ${mobileMenuOpen ? 'active' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    
                    {/* Home Link (Pill shaped with gold-yellow text and background if active) */}
                    <Link to="/" style={{ 
                        background: location.pathname === '/' ? 'rgba(245, 158, 11, 0.12)' : 'transparent',
                        border: location.pathname === '/' ? '1px solid rgba(245, 158, 11, 0.2)' : '1px solid transparent',
                        color: location.pathname === '/' ? '#fbbf24' : '#aaa',
                        padding: '8px 22px',
                        borderRadius: '50px',
                        fontWeight: location.pathname === '/' ? '700' : '600',
                        fontSize: '0.9rem',
                        textDecoration: 'none',
                        transition: 'all 0.2s',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                    onMouseEnter={(e) => {
                        if (location.pathname !== '/') {
                            e.currentTarget.style.color = '#fff';
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (location.pathname !== '/') {
                            e.currentTarget.style.color = '#aaa';
                        }
                    }}
                    >Home</Link>
                    
                    {/* Shop Link (Pill shaped with gold-yellow text and background if active) */}
                    <Link to="/shop" style={{ 
                        background: location.pathname === '/shop' ? 'rgba(245, 158, 11, 0.12)' : 'transparent',
                        border: location.pathname === '/shop' ? '1px solid rgba(245, 158, 11, 0.2)' : '1px solid transparent',
                        color: location.pathname === '/shop' ? '#fbbf24' : '#aaa',
                        padding: '8px 22px',
                        borderRadius: '50px',
                        fontWeight: location.pathname === '/shop' ? '700' : '600',
                        fontSize: '0.9rem',
                        textDecoration: 'none',
                        transition: 'all 0.2s',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                    onMouseEnter={(e) => {
                        if (location.pathname !== '/shop') {
                            e.currentTarget.style.color = '#fff';
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (location.pathname !== '/shop') {
                            e.currentTarget.style.color = '#aaa';
                        }
                    }}
                    >Shop</Link>
                    
                    {/* Design Studio Link (Pill with yellow border and pencil icon) */}
                    <Link to="/studio" style={{ 
                        background: 'rgba(245, 158, 11, 0.05)',
                        border: '1px solid #fbbf24',
                        color: '#fbbf24',
                        padding: '8px 22px',
                        borderRadius: '50px',
                        fontWeight: '700',
                        fontSize: '0.9rem',
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.2s'
                    }}>
                        <i className="fas fa-pencil-alt" style={{ color: '#fbbf24' }}></i> Design Studio
                    </Link>

                    {/* Auth & Admin */}
                    {isLoggedIn && isAdmin() && (
                        <Link to="/admin" style={{ 
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            color: '#fff',
                            padding: '8px 22px',
                            borderRadius: '50px',
                            fontWeight: '600',
                            fontSize: '0.9rem',
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'all 0.2s'
                        }}>
                            <i className="fas fa-user-shield" style={{ color: '#fff' }}></i> Admin
                        </Link>
                    )}

                    {isLoggedIn && !isAdmin() && (
                        <Link to="/profile" style={{ 
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            color: '#fff',
                            padding: '8px 22px',
                            borderRadius: '50px',
                            fontWeight: '600',
                            fontSize: '0.9rem',
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'all 0.2s'
                        }}>
                            <i className="fas fa-user-circle" style={{ color: '#fff' }}></i> {user?.name?.split(' ')[0] || 'Profile'}
                        </Link>
                    )}

                    {isLoggedIn && (
                        /* Logout (Circular button with red border/background) */
                        <button onClick={logout} title="Logout" style={{ 
                            background: 'rgba(220, 38, 38, 0.1)',
                            border: '1px solid rgba(220, 38, 38, 0.3)',
                            color: '#ef4444',
                            width: '38px',
                            height: '38px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            outline: 'none'
                        }}>
                            <i className="fas fa-sign-out-alt"></i>
                        </button>
                    )}

                    {!isLoggedIn && (
                        <Link to="/login" style={{ 
                            color: '#aaa', 
                            fontWeight: '600', 
                            padding: '8px 16px',
                            fontSize: '0.9rem',
                            textDecoration: 'none',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.color = '#fff'}
                        onMouseLeave={(e) => e.target.style.color = '#aaa'}
                        >Sign In</Link>
                    )}

                    {/* Cart Icon (Circular button with light white border/background) */}
                    <button type="button" className="cart-icon" onClick={onOpenCart} aria-label="Open cart" style={{ 
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        color: '#fff',
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        position: 'relative',
                        transition: 'all 0.2s'
                    }}>
                        <i className="fas fa-shopping-cart" style={{ color: '#fff' }}></i>
                        <span className="cart-count" style={{ 
                            position: 'absolute',
                            top: '-5px',
                            right: '-5px',
                            background: '#ef4444',
                            color: '#fff',
                            fontSize: '0.7rem',
                            fontWeight: 'bold',
                            width: '18px',
                            height: '18px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '50%'
                        }}>{getCartCount()}</span>
                    </button>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
