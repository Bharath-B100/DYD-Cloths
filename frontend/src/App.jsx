// src/App.jsx - Main Application Layout & Routing
import React, { lazy, Suspense, useState } from 'react';
import SplashScreen from './components/SplashScreen';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
const PasswordRecovery = lazy(() => import('./pages/PasswordRecovery'));
const Home = lazy(() => import('./pages/Home'));
const Shop = lazy(() => import('./pages/Shop'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Profile = lazy(() => import('./pages/Profile'));
const Checkout = lazy(() => import('./pages/Checkout'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const DesignStudio = lazy(() => import('./pages/DesignStudio'));
const OrderConfirmation = lazy(() => import('./pages/OrderConfirmation'));
const ContentPage = lazy(() => import('./pages/ContentPage'));
const TrackOrder = lazy(() => import('./pages/TrackOrder'));
const SharedWishlist = lazy(() => import('./pages/SharedWishlist'));
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ToastContainer from './components/ToastContainer';
import CartDrawer from './components/CartDrawer';

// A component that handles redirects for legacy HTML paths to modern clean paths
const LegacyRedirect = ({ target }) => {
    const { search } = useLocation();
    const separator = target.includes('?') ? '&' : '?';
    const destination = search ? `${target}${separator}${search.slice(1)}` : target;
    return <Navigate to={destination} replace />;
};

const LegacyProductRedirect = () => {
    const { search } = useLocation();
    const params = new URLSearchParams(search);
    const id = params.get('id') || params.get('productId');
    params.delete('id');
    params.delete('productId');
    return <Navigate to={{
        pathname: id ? `/product/${encodeURIComponent(id)}` : '/shop',
        search: params.toString() ? `?${params.toString()}` : ''
    }} replace />;
};

const LegacyCatalogRedirect = ({ catalog }) => {
    const { search } = useLocation();
    const params = new URLSearchParams(search);
    params.set('catalog', catalog);
    return <Navigate to={{ pathname: '/shop', search: `?${params.toString()}` }} replace />;
};

function RequireAuth({ children, admin = false }) {
    const { user, loading } = useAuth();
    const location = useLocation();
    if (loading) return <div className="container" role="status" style={{ padding: 80 }}>Checking your session…</div>;
    if (!user) return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
    if (admin && user.role !== 'admin') return <Navigate to="/profile" replace />;
    return children;
}
function AppContent() {
    const location = useLocation();
    const [cartOpen, setCartOpen] = React.useState(false);

    // Paths where navbar/footer should not be displayed
    const isAuthPage = ['/login', '/register', '/forgot-password', '/reset-password'].some(path => location.pathname.startsWith(path));
    const showNavbar = !location.pathname.startsWith('/admin') && !isAuthPage;
    const showFooter = !location.pathname.startsWith('/admin') && !location.pathname.startsWith('/studio') && !isAuthPage;

    return (
        <div className="app-container">
            <ToastContainer />
            {showNavbar && <Navbar onOpenCart={() => setCartOpen(true)} />}
            <main className="main-content">
                <Suspense fallback={<div className="container" role="status" style={{ padding: 80 }}>Loading page…</div>}><Routes>
                    {/* Core Pages */}
                    <Route path="/" element={<Home />} />
                    <Route path="/shop" element={<Shop />} />
                    <Route path="/product/:id" element={<ProductDetail />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} /><Route path="/forgot-password" element={<PasswordRecovery />} /><Route path="/reset-password/:token" element={<PasswordRecovery />} />
                    <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
                    <Route path="/checkout" element={<RequireAuth><Checkout /></RequireAuth>} />
                    <Route path="/checkout/confirmation" element={<OrderConfirmation />} />
                    <Route path="/studio" element={<RequireAuth><DesignStudio /></RequireAuth>} />
                    <Route path="/admin" element={<RequireAuth admin><AdminDashboard /></RequireAuth>} />
                    <Route path="/track-order" element={<TrackOrder />} />
                    <Route path="/shared-wishlist" element={<SharedWishlist />} />
                    <Route path="/faq" element={<ContentPage />} />
                    <Route path="/support" element={<ContentPage />} />
                    <Route path="/shipping-policy" element={<ContentPage />} />
                    <Route path="/returns-exchanges" element={<ContentPage />} />
                    <Route path="/privacy-policy" element={<ContentPage />} />
                    <Route path="/terms-of-service" element={<ContentPage />} />

                    {/* Legacy HTML Redirects */}
                    <Route path="/index.html" element={<LegacyRedirect target="/" />} />
                    <Route path="/shop.html" element={<LegacyRedirect target="/shop" />} />
                    <Route path="/product.html" element={<LegacyProductRedirect />} />
                    <Route path="/login.html" element={<LegacyRedirect target="/login" />} />
                    <Route path="/register.html" element={<LegacyRedirect target="/register" />} />
                    <Route path="/profile.html" element={<LegacyRedirect target="/profile" />} />
                    <Route path="/checkout.html" element={<LegacyRedirect target="/checkout" />} />
                    <Route path="/studio.html" element={<LegacyRedirect target="/studio" />} />
                    <Route path="/admin.html" element={<LegacyRedirect target="/admin" />} />
                    <Route path="/order-confirmation.html" element={<LegacyRedirect target="/checkout/confirmation" />} />
                    <Route path="/track-order.html" element={<LegacyRedirect target="/track-order" />} />
                    <Route path="/faq.html" element={<LegacyRedirect target="/faq" />} />
                    <Route path="/support.html" element={<LegacyRedirect target="/support" />} />
                    <Route path="/shipping-policy.html" element={<LegacyRedirect target="/shipping-policy" />} />
                    <Route path="/returns-exchanges.html" element={<LegacyRedirect target="/returns-exchanges" />} />
                    <Route path="/privacy-policy.html" element={<LegacyRedirect target="/privacy-policy" />} />
                    <Route path="/terms-of-service.html" element={<LegacyRedirect target="/terms-of-service" />} />
                    <Route path="/customize.html" element={<LegacyRedirect target="/studio" />} />
                    <Route path="/oversized-tshirts.html" element={<LegacyCatalogRedirect catalog="oversized" />} />
                    <Route path="/premium-cotton-tshirts.html" element={<LegacyCatalogRedirect catalog="premium-cotton" />} />
                    <Route path="/bulk-cotton-tshirts.html" element={<LegacyCatalogRedirect catalog="bulk-cotton" />} />
                    <Route path="/shared-wishlist.html" element={<SharedWishlist />} />

                    {/* Fallback */}
                    <Route path="*" element={<div className="container" style={{ padding: 80 }}><h1>Page not found</h1><p>The link may be outdated.</p><a className="btn btn-primary" href="/shop">Browse the shop</a></div>} />
                </Routes></Suspense>
            </main>
            {showFooter && <Footer />}
            <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />
        </div>
    );
}

function App() {
    const [splashDone, setSplashDone] = useState(false);

    return (
        <AuthProvider>
            <CartProvider>
                {!splashDone && (
                    <SplashScreen duration={2200} onDone={() => setSplashDone(true)} />
                )}
                <Router>
                    <AppContent />
                </Router>
            </CartProvider>
        </AuthProvider>
    );
}

export default App;
