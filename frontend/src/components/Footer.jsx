// src/components/Footer.jsx - Shared Storefront Footer
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../config/api';
import '../styles/main.css';


const Footer = () => {
    const { settings } = useAuth();
    const location = useLocation();
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [msgType, setMsgType] = useState('');

    const handleSubscribe = async (e) => {
        e.preventDefault();
        if (!email.trim()) return;

        setMessage('Subscribing...');
        setMsgType('info');

        try {
            const response = await API.post('/subscribe', { email: email.trim(), source: 'footer' });
            if (!response.success) {
                throw new Error(response.error || response.message || 'Subscription failed. Please try again.');
            }
            setMessage(response.message || 'Thank you for subscribing!');
            setMsgType('success');
            setEmail('');
        } catch (error) {
            setMessage(error.message || 'Subscription failed. Please try again.');
            setMsgType('error');
        }
    };

    const currentYear = new Date().getFullYear();
    const isHomePage = location.pathname === '/';

    return (
        <footer className="footer">
            <div className="container">
                {isHomePage && (
                    <div className="footer-grid">
                    {/* Logo & Socials */}
                    <div className="footer-col">
                        <Link to="/" className="logo" style={{ textDecoration: 'none', color: 'inherit' }}>
                            <img src="/images/LOGO_DYD.png" className="logo-icon" alt="DYD Logo" style={{ height: '40px', width: 'auto', borderRadius: '4px', objectFit: 'contain' }} />
                            <span className="site-name">D<span style={{ color: 'var(--primary)' }}>Y</span>D-Clothes</span>
                            <small className="site-tagline" style={{ fontSize: '0.6em', opacity: 0.7, display: 'block', marginTop: '-5px' }}>Design your Dream Clothes</small>
                        </Link>
                        <p className="footer-description">Creating custom t-shirts that tell your story. Premium quality, fast delivery, and 100% satisfaction guaranteed.</p>
                        <div className="social-links">
                            {settings?.social_whatsapp && (
                                <a href={`https://wa.me/${settings.social_whatsapp}`} className="social-link" target="_blank" rel="noopener noreferrer">
                                    <i className="fab fa-whatsapp"></i>
                                </a>
                            )}
                            {/^https?:\/\//i.test(settings?.social_instagram || '') && <a href={settings.social_instagram} className="social-link" aria-label="Instagram" target="_blank" rel="noopener noreferrer">
                                <i className="fab fa-instagram"></i>
                            </a>}
                        </div>
                    </div>
                    
                    {/* Quick Links */}
                    <div className="footer-col">
                        <h3 className="footer-heading">Quick Links</h3>
                        <ul className="footer-links">
                            <li><Link to="/">Home</Link></li>
                            <li><Link to="/shop">Shop</Link></li>
                            <li><Link to="/studio">Design Studio</Link></li>
                        </ul>
                    </div>
                    
                    {/* Support Links */}
                    <div className="footer-col">
                        <h3 className="footer-heading"><Link to="/support">Support</Link></h3>
                        <ul className="footer-links">
                            <li><Link to="/faq">FAQ</Link></li>
                            <li><Link to="/shipping-policy">Shipping Policy</Link></li>
                            <li><Link to="/returns-exchanges">Returns & Exchanges</Link></li>
                            <li><Link to="/privacy-policy">Privacy Policy</Link></li>
                            <li><Link to="/terms-of-service">Terms of Service</Link></li>
                        </ul>
                    </div>
                    
                    {/* Newsletter */}
                    <div className="footer-col">
                        <h3 className="footer-heading">Newsletter</h3>
                        <p>Subscribe to get special offers and design inspiration</p>
                        <form className="newsletter-form" onSubmit={handleSubscribe}>
                            <div className="input-group">
                                <input 
                                    type="email" 
                                    placeholder="Your email" 
                                    className="form-control" 
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required 
                                />
                                <button type="submit" className="btn btn-primary">
                                    <i className="fas fa-paper-plane"></i>
                                </button>
                            </div>
                            {message && (
                                <div className={`newsletter-message ${msgType}`} style={{ marginTop: '8px', fontSize: '0.85rem' }}>
                                    {message}
                                </div>
                            )}
                        </form>
                        <p className="newsletter-note">We respect your privacy. <Link to="/privacy-policy">Unsubscribe at any time.</Link></p>
                    </div>
                </div>
                )}
                
                {/* Footer Bottom */}
                <div className="footer-bottom">
                    <p>&copy; {currentYear} <span className="site-name">D<span style={{ color: 'var(--primary)' }}>Y</span>D-Clothes</span> - Design your Dream Clothes. All rights reserved.</p>
                    <div><Link to="/support">Support</Link> · <Link to="/track-order">Track order</Link> · <Link to="/privacy-policy">Privacy</Link></div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
