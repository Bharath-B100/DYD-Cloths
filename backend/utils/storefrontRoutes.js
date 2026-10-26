const routes = new Set([
    '/verify-email', '/', '/shop', '/login', '/register', '/forgot-password', '/profile', '/checkout',
    '/checkout/confirmation', '/studio', '/admin', '/track-order', '/shared-wishlist',
    '/faq', '/support', '/shipping-policy', '/returns-exchanges', '/privacy-policy', '/terms-of-service',
    '/index.html', '/shop.html', '/product.html', '/login.html', '/register.html', '/profile.html',
    '/checkout.html', '/studio.html', '/admin.html', '/order-confirmation.html', '/track-order.html',
    '/faq.html', '/support.html', '/shipping-policy.html', '/returns-exchanges.html',
    '/privacy-policy.html', '/terms-of-service.html', '/customize.html', '/oversized-tshirts.html',
    '/premium-cotton-tshirts.html', '/bulk-cotton-tshirts.html', '/shared-wishlist.html'
]);
const isStorefrontRoute = path => routes.has(path.replace(/\/$/, '') || '/') ||
    /^\/(product|reset-password|verify-email)\/[^/]+\/?$/.test(path);
module.exports = { isStorefrontRoute };
