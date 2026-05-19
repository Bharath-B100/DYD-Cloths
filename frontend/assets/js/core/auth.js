/**
 * DYD-Cloths Authentication Manager
 * Manages user sessions, registration, and role-based access.
 */

const getStoredUser = () => {
    try {
        const storedUser = localStorage.getItem('user');
        if (!storedUser || storedUser === 'undefined' || storedUser === 'null') {
            localStorage.removeItem('user');
            return null;
        }

        return JSON.parse(storedUser);
    } catch (error) {
        console.warn('Clearing invalid saved user session:', error);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        return null;
    }
};

const AuthManager = {
    user: getStoredUser(),
    token: localStorage.getItem('token') || null,

    /**
     * Login user
     */
    login: async (email, password) => {
        try {
            const result = await API.post('/auth/login', { email, password });
            const user = result.data?.user || result.user;
            
            if (result.success && result.token && user) {
                AuthManager.setSession(result.token, user);
                AuthManager.updateNavbarUI();
                Utils.showToast(`Welcome back, ${user.name}!`, 'success');
                AuthManager.redirectByRole(user);
                return { success: true };
            }

            throw new Error('Login response was missing user details');
        } catch (error) {
            Utils.showToast(error.message, 'error');
            return { success: false, error: error.message };
        }
    },

    /**
     * Register user
     */
    register: async (userData) => {
        try {
            const result = await API.post('/auth/register', userData);
            const user = result.data?.user || result.user;
            
            if (result.success && result.token && user) {
                AuthManager.setSession(result.token, user);
                AuthManager.updateNavbarUI();
                Utils.showToast(`Welcome, ${user.name}!`, 'success');
                setTimeout(() => AuthManager.redirectByRole(user), 800);
                return { success: true };
            }

            throw new Error('Registration response was missing user details');
        } catch (error) {
            Utils.showToast(error.message, 'error');
            return { success: false, error: error.message };
        }
    },

    /**
     * Logout user
     */
    logout: async () => {
        try {
            await API.get('/auth/logout');
        } catch (error) {
            console.error('Logout API error:', error);
        }
        
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        AuthManager.user = null;
        AuthManager.token = null;
        AuthManager.updateNavbarUI();
        Utils.showToast('Logged out successfully', 'info');
        setTimeout(() => window.location.href = 'index.html', 1000);
    },

    /**
     * Set session data
     */
    setSession: (token, user) => {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        AuthManager.token = token;
        AuthManager.user = user;
    },

    /**
     * Check if user is logged in
     */
    isLoggedIn: () => {
        return !!AuthManager.token && !!AuthManager.user;
    },

    /**
     * Check if user is admin
     */
    isAdmin: () => {
        return AuthManager.user?.role === 'admin';
    },

    /**
     * Redirect based on user role
     */
    redirectByRole: (user) => {
        const currentUser = user || AuthManager.user;
        if (!currentUser) return;

        if (currentUser.role === 'admin') {
            window.location.href = 'admin.html';
        } else if (window.location.pathname.includes('login.html') || window.location.pathname.includes('register.html')) {
            window.location.href = 'index.html';
        }
    },

    /**
     * Update navbar UI based on auth state
     */
    updateNavbarUI: () => {
        if (window.location.pathname.includes('order-confirmation.html')) {
            document.querySelectorAll('.desktop-auth, .mobile-auth, .auth-link').forEach(el => el.remove());
            return;
        }

        // Update desktop/mobile auth buttons. Some pages have older navbar markup,
        // so create the wrappers if main.js has not normalized them yet.
        let desktopAuth = document.querySelector('.desktop-auth');
        let mobileAuth = document.querySelector('.mobile-auth');
        const navRight = document.querySelector('.navbar .nav-right');
        const navLinks = document.querySelector('.navbar .nav-links');

        if (!desktopAuth && navRight) {
            navRight.insertAdjacentHTML('afterbegin', '<div class="auth-buttons desktop-auth"></div>');
            desktopAuth = document.querySelector('.desktop-auth');
        }

        if (!mobileAuth && navLinks) {
            navLinks.insertAdjacentHTML('beforeend', '<div class="auth-buttons mobile-auth"></div>');
            mobileAuth = document.querySelector('.mobile-auth');
        }
        
        if (!desktopAuth && !mobileAuth) return;

        if (AuthManager.isLoggedIn()) {
            const userName = AuthManager.user.name || AuthManager.user.email || 'Account';
            const dashboardLink = AuthManager.isAdmin() ? 'admin.html' : 'profile.html';
            const dashboardIcon = AuthManager.isAdmin() ? 'fa-user-shield' : 'fa-user';
            
            const authHTML = `
                <div class="user-dropdown">
                    <span class="user-greeting" title="${Utils.escapeHtml(userName)}"><i class="fas ${dashboardIcon}"></i> ${Utils.escapeHtml(userName)}</span>
                    <a href="${dashboardLink}" class="auth-link profile-link">Dashboard</a>
                    <button class="auth-link logout-link navbar-logout-btn" type="button"><i class="fas fa-sign-out-alt"></i> Logout</button>
                </div>
            `;
            
            if (desktopAuth) desktopAuth.innerHTML = authHTML;
            if (mobileAuth) mobileAuth.innerHTML = authHTML;
            
            // Attach logout event
            document.querySelectorAll('.navbar-logout-btn').forEach(logoutBtn => {
                logoutBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    AuthManager.logout();
                });
            });
        } else {
            const loginHTML = `<a href="login.html" class="auth-link"><i class="fas fa-user"></i> Sign In</a>`;
            if (desktopAuth) desktopAuth.innerHTML = loginHTML;
            if (mobileAuth) mobileAuth.innerHTML = loginHTML;
        }
    },

    /**
     * Initialize Auth state on page load
     */
    init: async () => {
        // Try to validate token if exists
        const token = localStorage.getItem('token');
        if (token) {
            try {
                const result = await API.get('/auth/me');
                if (result.success) {
                    AuthManager.user = result.data.user;
                    AuthManager.token = token;
                    localStorage.setItem('user', JSON.stringify(AuthManager.user));
                } else {
                    // Token invalid
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    AuthManager.user = null;
                    AuthManager.token = null;
                }
            } catch (error) {
                console.error('Auth validation error:', error);
            }
        }
        
        // Update navbar UI
        AuthManager.updateNavbarUI();
        
        // Protect admin routes
        if (window.location.pathname.includes('admin.html') && !AuthManager.isAdmin()) {
            window.location.href = 'login.html';
        }
        
        // Redirect logged-in users away from auth pages
        if (AuthManager.isLoggedIn() && 
            (window.location.pathname.includes('login.html') || window.location.pathname.includes('register.html'))) {
            AuthManager.redirectByRole();
        }
    },

    /**
     * Bind login/register forms when present
     */
    bindAuthForms: () => {
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');

        loginForm?.addEventListener('submit', async (event) => {
            event.preventDefault();
            event.stopPropagation();
            const submitButton = loginForm.querySelector('button[type="submit"]');
            const email = document.getElementById('email')?.value.trim();
            const password = document.getElementById('password')?.value;

            if (!email || !password) {
                Utils.showToast('Please enter your email and password', 'error');
                return;
            }

            if (submitButton) submitButton.disabled = true;
            await AuthManager.login(email, password);
            if (submitButton) submitButton.disabled = false;
        });

        registerForm?.addEventListener('submit', async (event) => {
            event.preventDefault();
            event.stopPropagation();
            const submitButton = registerForm.querySelector('button[type="submit"]');
            const password = document.getElementById('password')?.value;
            const passwordConfirm = document.getElementById('passwordConfirm')?.value;

            if (password !== passwordConfirm) {
                Utils.showToast('Passwords do not match', 'error');
                return;
            }

            const userData = {
                name: document.getElementById('name')?.value.trim(),
                email: document.getElementById('email')?.value.trim(),
                phone: document.getElementById('phone')?.value.trim(),
                password,
                passwordConfirm
            };

            if (!userData.name || !userData.email || !userData.password || !userData.passwordConfirm) {
                Utils.showToast('Please complete all required fields', 'error');
                return;
            }

            if (submitButton) submitButton.disabled = true;
            const result = await AuthManager.register(userData);
            if (!result.success && submitButton) submitButton.disabled = false;
        });
    }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    AuthManager.bindAuthForms();
    AuthManager.init();
});

window.AuthManager = AuthManager;
