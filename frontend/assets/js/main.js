/**
 * DYD-Clothes Main Application
 * Global initialization and UI orchestration.
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Managers
    App.init();
});

const App = {
    init: () => {
        App.ensureNavbarControls();
        App.setupNavigation();
        App.loadSettings();
        App.setupDesignFilters();
        App.setupCartUI();
        App.setupFooter();
        App.loadFeaturedProducts();
        App.setupNewsletter();
        window.AuthManager?.updateNavbarUI?.();
        
        // Fetch cart from server if logged in
        if (window.CartManager) window.CartManager.fetchFromServer();
        
        // Sync cart count immediately
        App.updateCartBadge();
    },

    /**
     * Normalize navbar/cart markup across older pages.
     */
    ensureNavbarControls: () => {
        const navbar = document.querySelector('.navbar');
        const navContainer = navbar?.querySelector('.nav-container');
        const navLinks = navbar?.querySelector('.nav-links');
        if (!navbar || !navContainer) return;

        if (navLinks && !navLinks.id) {
            navLinks.id = 'navLinks';
        }

        if (navLinks && !navbar.querySelector('.menu-toggle')) {
            navLinks.insertAdjacentHTML('beforebegin', `
                <button class="menu-toggle" id="menuToggle" aria-label="Open navigation" type="button">
                    <i class="fas fa-bars"></i>
                </button>
            `);
        }

        let navRight = navbar.querySelector('.nav-right');
        if (!navRight) {
            navContainer.insertAdjacentHTML('beforeend', '<div class="nav-right"></div>');
            navRight = navbar.querySelector('.nav-right');
        }

        const isOrderConfirmation = window.location.pathname.includes('order-confirmation.html');

        if (!isOrderConfirmation) {
            if (navRight && !navRight.querySelector('.desktop-auth')) {
                const existingAuthLink = navRight.querySelector('.auth-link');
                if (existingAuthLink) {
                    const authWrapper = document.createElement('div');
                    authWrapper.className = 'auth-buttons desktop-auth';
                    existingAuthLink.insertAdjacentElement('beforebegin', authWrapper);
                    authWrapper.appendChild(existingAuthLink);
                } else {
                    navRight.insertAdjacentHTML('afterbegin', `
                        <div class="auth-buttons desktop-auth">
                            <a href="login.html" class="auth-link"><i class="fas fa-user"></i> Sign In</a>
                        </div>
                    `);
                }
            }

            if (navLinks && !navLinks.querySelector('.mobile-auth')) {
                navLinks.insertAdjacentHTML('beforeend', `
                    <div class="auth-buttons mobile-auth">
                        <a href="login.html" class="auth-link"><i class="fas fa-user"></i> Sign In</a>
                    </div>
                `);
            }
        } else {
            document.querySelectorAll('.desktop-auth, .mobile-auth, .auth-link').forEach(el => el.remove());
        }

        if (navRight && !navRight.querySelector('.cart-icon')) {
            navRight.insertAdjacentHTML('beforeend', `
                <button class="cart-icon" id="cartIcon" aria-label="Open cart" type="button">
                    <i class="fas fa-shopping-cart"></i>
                    <span class="cart-count">0</span>
                </button>
            `);
        }

        if (!document.querySelector('.cart-sidebar')) {
            document.body.insertAdjacentHTML('beforeend', `
                <div class="cart-sidebar">
                    <div class="cart-header">
                        <h3><i class="fas fa-shopping-cart"></i> Your Cart</h3>
                        <button class="close-cart" type="button" aria-label="Close cart">&times;</button>
                    </div>
                    <div class="cart-items"></div>
                    <div class="cart-footer">
                        <div class="cart-total">
                            <span>Total:</span>
                            <span class="total-amount">${Utils.formatINR(0)}</span>
                        </div>
                        <button class="btn btn-primary checkout-btn" type="button">Proceed to Checkout</button>
                        <button class="btn btn-outline clear-cart-btn" type="button">Clear Cart</button>
                    </div>
                </div>
                <div class="cart-overlay"></div>
            `);
        } else if (!document.querySelector('.cart-overlay')) {
            document.body.insertAdjacentHTML('beforeend', '<div class="cart-overlay"></div>');
        }
    },



    /**
     * Mobile Menu and Scroll Effects
     */
    setupNavigation: () => {
        const menuToggle = document.querySelector('.menu-toggle');
        const navLinks = document.getElementById('navLinks');
        const navbar = document.querySelector('.navbar');

        // Toggle menu
        menuToggle?.addEventListener('click', () => {
            navLinks?.classList.toggle('active');
            menuToggle.setAttribute('aria-expanded', navLinks?.classList.contains('active') ? 'true' : 'false');
            menuToggle.innerHTML = navLinks?.classList.contains('active') 
                ? '<i class="fas fa-times"></i>' 
                : '<i class="fas fa-bars"></i>';
        });

        // Close on link click
        navLinks?.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('active');
                menuToggle?.setAttribute('aria-expanded', 'false');
                if (menuToggle) menuToggle.innerHTML = '<i class="fas fa-bars"></i>';
            });
        });

        // Scroll effect
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                navbar?.classList.add('scrolled');
            } else {
                navbar?.classList.remove('scrolled');
            }
        });

        // Scroll Reveal Animation
        const revealCallback = (entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('revealed');
                    observer.unobserve(entry.target);
                }
            });
        };

        const revealObserver = new IntersectionObserver(revealCallback, {
            threshold: 0.15
        });

        document.querySelectorAll('section').forEach(section => {
            section.classList.add('reveal-on-scroll');
            revealObserver.observe(section);
        });
    },

    setupDesignFilters: () => {
        const buttons = document.querySelectorAll('.filter-btn[data-filter]');
        const cards = document.querySelectorAll('.design-card[data-category]');
        if (!buttons.length || !cards.length) return;

        buttons.forEach(button => {
            button.addEventListener('click', () => {
                const filter = button.dataset.filter;
                buttons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');

                cards.forEach(card => {
                    const visible = filter === 'all' || card.dataset.category === filter;
                    card.style.display = visible ? '' : 'none';
                });
            });
        });
    },

    /**
     * Cart Sidebar and Badge Management
     */
    setupCartUI: () => {
        const cartSidebar = document.querySelector('.cart-sidebar');
        const cartOverlay = document.querySelector('.cart-overlay');
        const closeCart = document.querySelector('.close-cart');

        const toggleCart = (isOpen) => {
            cartSidebar?.classList.toggle('active', isOpen);
            cartOverlay?.classList.toggle('active', isOpen);
            document.body.style.overflow = isOpen ? 'hidden' : '';
        };

        [closeCart, cartOverlay].forEach(el => {
            el?.addEventListener('click', () => toggleCart(false));
        });

        // FIXED: Add checkout button event listener
        // Use event delegation since cart footer is dynamically rendered
        document.body.addEventListener('click', (e) => {
            const cartButton = e.target.closest('.cart-icon');
            if (cartButton) {
                e.preventDefault();
                toggleCart(true);
                App.renderCart();
                return;
            }

            const checkoutBtn = e.target.closest('.checkout-btn');
            if (checkoutBtn) {
                e.preventDefault();
                if (CartManager.getCount() > 0) {
                    window.location.href = 'checkout.html';
                } else {
                    Utils.showToast('Your cart is empty', 'warning');
                }
            }
            
            const clearCartBtn = e.target.closest('.clear-cart-btn');
            if (clearCartBtn) {
                e.preventDefault();
                CartManager.clear();
            }
        });

        // Subscribe to cart changes
        CartManager.subscribe(() => {
            App.updateCartBadge();
            App.renderCart();
        });
        
        window.openCart = () => {
            toggleCart(true);
            App.renderCart();
        };
    },

    updateCartBadge: () => {
        const cartBadges = document.querySelectorAll('.cart-count');
        cartBadges.forEach(cartBadge => {
            const count = CartManager.getCount();
            cartBadge.textContent = count;
            cartBadge.style.display = count > 0 ? 'flex' : 'none';
        });
    },

    /**
     * Load dynamic site settings from API
     */
    loadSettings: async () => {
        try {
            const res = await API.get('/settings');
            if (res.success && res.data) {
                App.applySettings(res.data);
            }
        } catch (error) {
            console.error('Failed to load site settings:', error);
        }
    },

    /**
     * Apply settings to the DOM
     */
    applySettings: (settings) => {
        // Save to global window so other scripts (like checkout.js) can access
        window.SiteSettings = settings;

        // Dynamic Announcement Banner
        if (settings.promo_banner_show === 'true' && settings.promo_banner_text) {
            let banner = document.getElementById('promoAnnouncementBanner');
            if (!banner) {
                banner = document.createElement('div');
                banner.id = 'promoAnnouncementBanner';
                banner.className = 'promo-banner';
                document.body.insertAdjacentElement('afterbegin', banner);
            }
            banner.style.backgroundColor = settings.promo_banner_color || 'var(--primary)';
            banner.innerHTML = `
                <div class="promo-banner-content">
                    <i class="fas fa-bullhorn"></i>
                    <span>${settings.promo_banner_text}</span>
                </div>
                <button class="promo-banner-close" onclick="document.body.classList.remove('has-promo-banner'); this.parentElement.style.display='none'; sessionStorage.setItem('promo_banner_closed', 'true')">&times;</button>
            `;
            
            // Check if closed previously in this session
            if (sessionStorage.getItem('promo_banner_closed') !== 'true') {
                document.body.classList.add('has-promo-banner');
                banner.style.display = 'flex';
            } else {
                document.body.classList.remove('has-promo-banner');
                banner.style.display = 'none';
            }
        } else {
            const banner = document.getElementById('promoAnnouncementBanner');
            if (banner) banner.remove();
            document.body.classList.remove('has-promo-banner');
        }

        // Hero Section
        const heroTitleEl = document.getElementById('heroTitle');
        if (heroTitleEl && settings.hero_title) {
            let titleText = settings.hero_title;
            if (!titleText.includes('text-gradient')) {
                titleText = titleText
                    .replace(/\bDesign\b/gi, '<span class="text-gradient">Design</span>')
                    .replace(/\bDream\b/gi, '<span class="text-gradient">Dream</span>');
            } else if (!titleText.includes('Design</span>')) {
                titleText = titleText.replace(/\bDesign\b/gi, '<span class="text-gradient">Design</span>');
            }
            heroTitleEl.innerHTML = titleText;
        }
        Utils.setHTML('heroSubtitle', settings.hero_subtitle);
        const heroImg = document.getElementById('heroMainImage');
        if (heroImg && settings.hero_image) heroImg.src = settings.hero_image;

        // Branding
        const siteNames = document.querySelectorAll('.site-name');
        siteNames.forEach(el => {
            el.innerHTML = `D<span style="color: var(--primary)">Y</span>D-Clothes`;
        });
        
        const taglines = document.querySelectorAll('.site-tagline');
        taglines.forEach(el => {
            el.textContent = (settings.site_tagline && !settings.site_tagline.toLowerCase().includes('cloths')) ? settings.site_tagline : 'Design your Dream Clothes';
        });

        // Contact Info (Global)
        const phones = document.querySelectorAll('.contact-phone');
        phones.forEach(el => el.textContent = settings.contact_phone);

        const emails = document.querySelectorAll('.contact-email');
        emails.forEach(el => {
            el.textContent = settings.contact_email;
            if (el.tagName === 'A') el.href = `mailto:${settings.contact_email}`;
        });

        const addresses = document.querySelectorAll('.contact-address');
        addresses.forEach(el => el.textContent = settings.contact_address);

        // Social Links
        const waLink = document.getElementById('whatsappLink');
        if (waLink && settings.social_whatsapp) {
            waLink.href = `https://wa.me/${settings.social_whatsapp}`;
        }
    },

    renderCart: () => {
        const container = document.querySelector('.cart-items');
        const totalEl = document.querySelector('.total-amount');
        
        if (!container) return;

        const items = CartManager.items;
        
        if (items.length === 0) {
            container.innerHTML = `
                <div class="empty-cart">
                    <div class="empty-cart-icon-wrapper">
                        <i class="fas fa-shopping-bag"></i>
                    </div>
                    <h4>Your Cart is Empty</h4>
                    <p>Looks like you haven't added any custom tees or apparel to your cart yet!</p>
                    <a href="shop.html" class="btn btn-empty-shop"><i class="fas fa-magic"></i> Start Shopping</a>
                </div>
            `;
            if (totalEl) totalEl.textContent = Utils.formatINR(0);
            return;
        }

        container.innerHTML = items.map((item) => {
            const imgSrc = (item.image && item.image.length > 50) ? item.image : 
                           (item.customDesign && item.customDesign.frontImage && item.customDesign.frontImage.length > 50) ? item.customDesign.frontImage :
                           (item.customDesign && item.customDesign.backImage && item.customDesign.backImage.length > 50) ? item.customDesign.backImage :
                           'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400';
            return `
            <div class="cart-item">
                <img src="${imgSrc}" alt="${item.name}" class="cart-item-image" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400';">
                <div class="cart-item-details">
                    <h4 class="cart-item-title">${item.name}</h4>
                    <p class="cart-item-meta"><span class="cart-tag">Size: ${item.size}</span> <span class="cart-tag">Color: ${item.color}</span></p>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top: 6px;">
                        <p class="cart-item-price">${Utils.formatINR(item.price)}</p>
                        <div class="cart-item-actions">
                            <button class="quantity-btn" data-id="${item.id}" data-size="${item.size}" data-color="${item.color}" data-delta="-1">-</button>
                            <span style="font-weight:700; font-size:0.875rem; min-width:18px; text-align:center;">${item.quantity}</span>
                            <button class="quantity-btn" data-id="${item.id}" data-size="${item.size}" data-color="${item.color}" data-delta="1">+</button>
                            <button class="remove-item" data-id="${item.id}" data-size="${item.size}" data-color="${item.color}" title="Remove item">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        }).join('');

        if (totalEl) totalEl.textContent = Utils.formatINR(CartManager.getTotal());

        // Attach event listeners to dynamically created buttons
        container.querySelectorAll('.quantity-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                const size = btn.dataset.size;
                const color = btn.dataset.color;
                const delta = parseInt(btn.dataset.delta);
                CartManager.updateQuantity(id, size, color, delta);
            });
        });

        container.querySelectorAll('.remove-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                const size = btn.dataset.size;
                const color = btn.dataset.color;
                CartManager.removeItem(id, size, color);
            });
        });
    },

    setupFooter: () => {
        const yearEl = document.getElementById('current-year') || document.getElementById('copyright-year');
        if (yearEl) yearEl.textContent = new Date().getFullYear();
    },

    loadFeaturedProducts: async () => {
        const grid = document.getElementById('featuredProducts');
        if (!grid || !window.API) return;

        try {
            const response = await API.get('/products?limit=6');
            const products = response.data?.products || response.data?.data || response.data || [];
            const productList = Array.isArray(products) ? products : [];

            if (productList.length === 0) {
                grid.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-tshirt"></i>
                        <p>No products available yet.</p>
                    </div>
                `;
                return;
            }

            grid.innerHTML = productList.map(product => {
                const sellPrice = product.sellingPrice || product.price || 0;
                const mrp = product.mrp;
                const disc = product.discountPercent || 0;
                const hasDiscount = mrp && mrp > sellPrice && disc > 0;
                const priceHtml = hasDiscount
                    ? `<div class="price-block">
                            <span class="price-mrp">${Utils.formatINR(mrp)}</span>
                            <span class="price-sell">${Utils.formatINR(sellPrice)}</span>
                            <span class="discount-badge">${disc}% OFF</span>
                       </div>`
                    : `<div class="product-price">${Utils.formatINR(sellPrice)}</div>`;

                return `
                <div class="product-card">
                    <div class="product-image">
                        <img src="${product.mainImage || 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400'}"
                             alt="${product.name || 'Product'}"
                             onerror="this.src='https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400'">
                        <div class="product-overlay">
                            <a href="product.html?id=${product._id}" class="btn btn-primary">View Product</a>
                        </div>
                    </div>
                    <div class="product-info">
                        <span class="product-category">${product.category || 'T-shirt'}</span>
                        <h3 class="product-title">${product.name || 'Product'}</h3>
                        ${priceHtml}
                    </div>
                </div>`;
            }).join('');
        } catch (error) {
            console.error('Featured products error:', error);
            grid.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>Failed to load products.</p>
                </div>
            `;
        }
    },

    setupNewsletter: () => {
        const newsletterForm = document.getElementById('newsletterForm');
        if (!newsletterForm) return;
        
        newsletterForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const emailInput = document.getElementById('newsletterEmail');
            const messageDiv = document.getElementById('newsletterMessage');
            const email = emailInput.value.trim();
            
            if (!email) {
                messageDiv.textContent = 'Please enter your email';
                messageDiv.className = 'newsletter-message error';
                return;
            }
            
            const submitBtn = newsletterForm.querySelector('button[type="submit"]');
            const originalHTML = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            submitBtn.disabled = true;
            
            try {
                const response = await API.post('/subscribe', { email, source: 'footer' });
                if (response.success) {
                    messageDiv.textContent = response.message;
                    messageDiv.className = 'newsletter-message success';
                    emailInput.value = '';
                } else {
                    throw new Error(response.error);
                }
            } catch (error) {
                messageDiv.textContent = error.message || 'Subscription failed. Please try again.';
                messageDiv.className = 'newsletter-message error';
            } finally {
                submitBtn.innerHTML = originalHTML;
                submitBtn.disabled = false;
                
                setTimeout(() => {
                    messageDiv.textContent = '';
                    messageDiv.className = 'newsletter-message';
                }, 5000);
            }
        });
    }
};

// Global Exposure
window.App = App;
