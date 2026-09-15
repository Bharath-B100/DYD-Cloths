// src/pages/Home.jsx - Storefront Landing Home Page
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../config/api';
import ProductCard from '../components/ProductCard';

const Home = () => {
    const { settings } = useAuth();
    const [featured, setFeatured] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [reload, setReload] = useState(0);
    const [bannerClosed, setBannerClosed] = useState(() => { try { return sessionStorage.getItem('promo_banner_closed') === 'true'; } catch { return false; } });
    const [contactMessage, setContactMessage] = useState('');

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setLoadError('');
        const fetchFeatured = async () => {
            try {
                const res = await API.get('/products?limit=6');
                if (cancelled) return;
                if (res.success && res.data) {
                    const products = res.data.products || res.data.data || res.data;
                    setFeatured(Array.isArray(products) ? products : []);
                }
            } catch (err) {
                if (!cancelled) setLoadError(err.message || 'Unable to load products.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        fetchFeatured();
        return () => { cancelled = true; };
    }, [reload]);

    useEffect(() => {
        const showBanner = settings?.promo_banner_show === 'true' && settings?.promo_banner_text && !bannerClosed;
        if (showBanner) {
            document.body.classList.add('has-promo-banner');
        } else {
            document.body.classList.remove('has-promo-banner');
        }
        return () => document.body.classList.remove('has-promo-banner');
    }, [settings, bannerClosed]);

    const handleCloseBanner = () => {
        try { sessionStorage.setItem('promo_banner_closed', 'true'); } catch { /* Dismiss for this visit when storage is unavailable. */ }
        setBannerClosed(true);
    };

    const openContactEmail = event => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const recipient = settings?.contact_email || 'ngtbharath@gmail.com';
        const body = `${form.get('message')}\n\nFrom: ${form.get('name')}\nReply to: ${form.get('email')}`;
        window.location.href = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(form.get('subject'))}&body=${encodeURIComponent(body)}`;
        setContactMessage('Your email app should open with this message. Send it there, or email us directly using the address alongside this form.');
    };

    return (
        <div className="home-page">
            {/* Promo Announcement Banner */}
            {settings?.promo_banner_show === 'true' && settings?.promo_banner_text && !bannerClosed && (
                <div id="promoAnnouncementBanner" className="promo-banner" style={{ backgroundColor: settings.promo_banner_color || 'var(--primary)', display: 'flex' }}>
                    <div className="promo-banner-content">
                        <i className="fas fa-bullhorn"></i>
                        <span>{settings.promo_banner_text}</span>
                    </div>
                    <button className="promo-banner-close" onClick={handleCloseBanner} aria-label="Dismiss announcement">&times;</button>
                </div>
            )}

            {/* Hero Section */}
            <section className="hero" id="home">
                <div className="hero-container">
                    <div className="hero-content">
                        <div className="breadcrumb">Home / Clothing / Custom T-shirts</div>
                        <div className="hero-badge"><i className="fas fa-bolt"></i> Custom printed apparel</div>
                        <h1 className="hero-title">
                            <span className="text-gradient">Design</span> Your<br />
                            <span className="text-gradient">Dream</span> Clothes
                        </h1>
                        <p className="hero-subtitle">
                            {settings?.hero_subtitle || (
                                <>Premium quality custom t-shirts, hoodies and accessories<br />designed by you, printed by us.</>
                            )}
                        </p>
                        
                        <div className="hero-stats">
                            <div className="stat">
                                <div className="stat-number">Your Art</div>
                                <div className="stat-label">Custom Printing</div>
                            </div>
                            <div className="stat">
                                <div className="stat-number">Your Fit</div>
                                <div className="stat-label">Choose Product Sizes</div>
                            </div>
                            <div className="stat">
                                <div className="stat-number">1+</div>
                                <div className="stat-label">Minimum Qty</div>
                            </div>
                        </div>
                        
                        <div className="hero-buttons">
                            <Link to="/shop" className="btn btn-primary btn-lg">
                                <i className="fas fa-shopping-bag"></i> Browse T-shirts
                            </Link>
                            <Link to="/studio" className="btn btn-outline btn-lg">
                                <i className="fas fa-pen"></i> Start Designing
                            </Link>
                        </div>
                    </div>
                    
                    <div className="hero-image">
                        <div className="image-container">
                            <img src={settings?.hero_image || 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800'} alt="Premium T-Shirt" className="hero-main-image" />
                            <div className="floating-badge badge-1">
                                <i className="fas fa-shipping-fast"></i>
                                <span>Fast Delivery</span>
                            </div>
                            <div className="floating-badge badge-2">
                                <i className="fas fa-award"></i>
                                <span>Premium Quality</span>
                            </div>
                            <div className="floating-badge badge-3">
                                <i className="fas fa-undo"></i>
                                <Link to="/returns">Returns Information</Link>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Quick Categories */}
            <section className="quick-shop-section">
                <div className="container">
                    <div className="quick-shop-grid">
                        <Link to="/shop?type=men" className="quick-shop-card">
                            <i className="fas fa-user"></i>
                            <span>Men's T-Shirts</span>
                        </Link>
                        <Link to="/shop?type=women" className="quick-shop-card">
                            <i className="fas fa-venus"></i>
                            <span>Women's T-Shirts</span>
                        </Link>
                        <Link to="/shop?type=kids" className="quick-shop-card">
                            <i className="fas fa-child"></i>
                            <span>Kids' T-Shirts</span>
                        </Link>
                        <Link to="/shop?type=performance" className="quick-shop-card">
                            <i className="fas fa-dumbbell"></i>
                            <span>Performance Tees</span>
                        </Link>
                        <Link to="/studio" className="quick-shop-card">
                            <i className="fas fa-palette"></i>
                            <span>Start Designing</span>
                        </Link>
                    </div>
                </div>
            </section>

            {/* Featured Products */}
            <section className="featured-section" id="products">
                <div className="container">
                    <div className="section-header">
                        <h2 className="section-title">Loved by <span className="text-gradient">Customers</span></h2>
                        <p className="section-subtitle">Popular T-shirt styles with reliable print quality, practical colours and flexible order quantities</p>
                    </div>
                    
                    {loading ? (
                        <div className="loading" style={{ textAlign: 'center', padding: '40px' }}>
                            <i className="fas fa-spinner fa-spin fa-2x"></i> Loading products...
                        </div>
                    ) : loadError ? <div role="alert" style={{ textAlign: 'center' }}><p>{loadError}</p><button className="btn btn-outline" onClick={() => setReload(value => value + 1)}>Try again</button></div> : (
                        <div className="product-grid">
                            {featured.map(prod => (
                                <ProductCard key={prod._id || prod.id} product={prod} />
                            ))}
                            {featured.length === 0 && (
                                <div className="empty-state" style={{ textAlign: 'center', gridColumn: '1/-1', padding: '40px' }}>
                                    <i className="fas fa-tshirt fa-3x" style={{ opacity: 0.3, marginBottom: '10px' }}></i>
                                    <p>No products available yet.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </section>

            {/* Catalog Section */}
            <section className="catalog-section">
                <div className="container">
                    <div className="section-header">
                        <h2 className="section-title">Explore More Custom <span className="text-gradient">T-Shirts</span></h2>
                        <p className="section-subtitle">Choose the format that fits your team, campaign or brand store.</p>
                    </div>
                    <div className="catalog-grid">
                        <Link to="/shop?catalog=oversized" className="catalog-card">
                            <img src="https://www.juneberry.co.in/cdn/shop/files/Artboard_14_8.jpg?v=1746253461" alt="Oversized T-Shirts" />
                            <div>
                                <h3>Oversized T-Shirts</h3>
                                <p>Relaxed fits for streetwear drops and creator merch.</p>
                            </div>
                        </Link>
                        <Link to="/shop?catalog=premium-cotton" className="catalog-card">
                            <img src="https://images.unsplash.com/photo-1503341504253-dff4815485f1?w=600&auto=format&fit=crop" alt="Premium Cotton T-Shirts" />
                            <div>
                                <h3>Premium Cotton T-Shirts</h3>
                                <p>Soft-touch cotton for teams, gifting and daily wear.</p>
                            </div>
                        </Link>
                        <Link to="/shop?catalog=bulk-cotton" className="catalog-card">
                            <img src="https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=600&auto=format&fit=crop" alt="Bulk Cotton T-Shirts" />
                            <div>
                                <h3>Bulk Cotton T-Shirts</h3>
                                <p>Simple, durable tees for events and promotions.</p>
                            </div>
                        </Link>
                    </div>
                </div>
            </section>

            {/* How It Works */}
            <section className="how-it-works" id="how-it-works">
                <div className="container">
                    <div className="section-header">
                        <h2 className="section-title">T-shirt Printing <span className="text-gradient">Made Easy</span></h2>
                        <p className="section-subtitle">Select a product, customise it and place your order without leaving the storefront.</p>
                    </div>
                    
                    <div className="steps-container">
                        <div className="step-card">
                            <div className="step-number">01</div>
                            <div className="step-icon">
                                <i className="fas fa-mouse-pointer"></i>
                            </div>
                            <h3>Select Your Style</h3>
                            <p>Pick cotton, polyester, oversized, regular or performance T-shirts.</p>
                        </div>
                        
                        <div className="step-card">
                            <div className="step-number">02</div>
                            <div className="step-icon">
                                <i className="fas fa-cogs"></i>
                            </div>
                            <h3>Add Your Design</h3>
                            <p>Add text, brand artwork or a campaign idea in the customizer.</p>
                        </div>
                        
                        <div className="step-card">
                            <div className="step-number">03</div>
                            <div className="step-icon">
                                <i className="fas fa-shipping-fast"></i>
                            </div>
                            <h3>Review & Order</h3>
                            <p>Preview details, choose quantity and checkout securely in INR.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="cta-section">
                <div className="container">
                    <div className="cta-content">
                        <h2>Ready to Create Your Custom T-Shirt?</h2>
                        <p>Choose your colours, add your artwork and preview your custom t-shirt.</p>
                        <div className="cta-buttons">
                            <Link to="/studio" className="btn btn-primary btn-lg">
                                <i className="fas fa-tshirt"></i> Start Designing
                            </Link>
                            <a href="#contact" className="btn btn-outline btn-lg">
                                <i className="fas fa-question-circle"></i> Need Help?
                            </a>
                        </div>
                    </div>
                </div>
            </section>

            {/* Contact Section */}
            <section className="contact-section" id="contact">
                <div className="container">
                    <div className="contact-container">
                        <div className="contact-info">
                            <h2>Get In <span className="text-gradient">Touch</span></h2>
                            <p>Have questions? We're here to help you create the perfect custom t-shirt.</p>
                            
                            <div className="contact-details">
                                <div className="contact-item">
                                    <div className="contact-icon">
                                        <i className="fas fa-map-marker-alt"></i>
                                    </div>
                                    <div>
                                        <h4>Our Location</h4>
                                        <p className="contact-address">{settings?.contact_address || 'Tirupur, coimbatore'}</p>
                                    </div>
                                </div>
                                
                                <div className="contact-item">
                                    <div className="contact-icon">
                                        <i className="fas fa-phone"></i>
                                    </div>
                                    <div>
                                        <h4>Phone Number</h4>
                                        <p className="contact-phone">{settings?.contact_phone || '+91 9943935576'}</p>
                                    </div>
                                </div>
                                
                                <div className="contact-item">
                                    <div className="contact-icon">
                                        <i className="fas fa-envelope"></i>
                                    </div>
                                    <div>
                                        <h4>Email Address</h4>
                                        <p className="contact-email">{settings?.contact_email || 'ngtbharath@gmail.com'}</p>
                                    </div>
                                </div>
                                
                                <div className="contact-item">
                                    <div className="contact-icon">
                                        <i className="fas fa-clock"></i>
                                    </div>
                                    <div>
                                        <h4>Working Hours</h4>
                                        <p>Mon - Fri: 9:00 - 18:00</p>
                                        <p>Saturday: 10:00 - 16:00</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div className="contact-form">
                            <form onSubmit={openContactEmail}>
                                <div className="form-group">
                                    <input type="text" name="name" aria-label="Your name" placeholder="Your Name" className="form-control" required maxLength={100} />
                                </div>
                                
                                <div className="form-group">
                                    <input type="email" name="email" aria-label="Your email" placeholder="Your Email" className="form-control" required maxLength={254} />
                                </div>
                                
                                <div className="form-group">
                                    <input type="text" name="subject" aria-label="Subject" placeholder="Subject" className="form-control" required maxLength={150} />
                                </div>
                                
                                <div className="form-group">
                                    <textarea name="message" aria-label="Your message" placeholder="Your Message" className="form-control" rows="5" required maxLength={2000}></textarea>
                                </div>
                                
                                <button type="submit" className="btn btn-primary btn-full">
                                    <i className="fas fa-envelope"></i> Open Email to Send
                                </button>
                                {contactMessage && <p role="status">{contactMessage}</p>}
                            </form>
                        </div>
                    </div>
                </div>
            </section>

            {/* FAQs Accordion */}
            <section className="faq-section">
                <div className="container">
                    <div className="section-header">
                        <h2 className="section-title">Frequently Asked <span className="text-gradient">Questions</span></h2>
                    </div>
                    <div className="faq-list">
                        <details>
                            <summary>What materials are available?</summary>
                            <p>Check the product details for fabric information. The design studio also offers fabric choices for custom T-shirts.</p>
                        </details>
                        <details>
                            <summary>Can I upload my logo or artwork?</summary>
                            <p>Yes. Use the design studio to add text or upload artwork and arrange it on the front or back of your T-shirt.</p>
                        </details>
                        <details>
                            <summary>Can I order only one T-shirt?</summary>
                            <p>Yes. The storefront supports low quantity ordering and also presents bulk order paths for larger needs.</p>
                        </details>
                        <details>
                            <summary>Are prices shown in INR?</summary>
                            <p>Yes. Product cards, cart totals and checkout totals are displayed in INR.</p>
                        </details>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default Home;
