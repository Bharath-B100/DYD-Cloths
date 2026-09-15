// server.js - Updated with MongoDB connection


const express = require('express');
const cors = require('cors');
const https = require('https');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const cookieParser = require('cookie-parser');
require('dotenv').config();

// Database connection
const connectDB = require('./config/db');

// Import routes
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const adminRoutes = require('./routes/adminRoutes');
const seoRoutes = require('./routes/seoRoutes');
const userRoutes = require('./routes/userRoutes');
const searchRoutes = require('./routes/searchRoutes');
const couponRoutes = require('./routes/couponRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const aiRoutes = require('./routes/aiRoutes');
// Create Express app
const app = express();

// Middleware
const configuredOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
const localDevelopmentOrigins = [
    'http://localhost:5000',
    'http://127.0.0.1:5000',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
    'http://127.0.0.1:4173',
    'https://dyd-cloths.onrender.com'
];
const allowedOrigins = process.env.NODE_ENV === 'production'
    ? [...configuredOrigins, 'https://dyd-cloths.onrender.com']
    : [...new Set([...configuredOrigins, ...localDevelopmentOrigins])];

app.disable('x-powered-by');
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY));
// The storefront currently uses trusted font/icon/image CDNs. Keep Helmet's
// protective headers enabled without shipping a restrictive CSP that would
// break those existing assets; introduce a nonce-based CSP during CDN cleanup.
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: false
}));
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        const error = Object.assign(new Error('Origin is not allowed'), { status: 403 });
        return callback(error);
    },
    credentials: true
}));


app.use(cookieParser());

// Readiness endpoint for the Vite proxy, hosting platform, and deployment
// checks. A running HTTP server is not considered ready until MongoDB is too.
app.get('/api/health', (req, res) => {
    const database = connectDB.getStatus();
    const statusCode = database.connected ? 200 : 503;

    res.status(statusCode).json({
        success: database.connected,
        status: database.connected ? 'ready' : 'degraded',
        database
    });
});

app.use('/api', (req, res, next) => {
    if (process.env.NODE_ENV !== 'test' && !connectDB.getStatus().connected) {
        return res.status(503).json({ success: false, error: 'The store database is unavailable. Please try again shortly.' });
    }
    next();
});

// Proxy Firebase Auth & Config requests to bypass third-party cookie blocking
const proxyFirebase = (req, res) => {
    const targetUrl = `https://tshirtbusiness-bac1a.firebaseapp.com${req.originalUrl}`;
    const connector = https.request(targetUrl, {
        method: req.method,
        headers: {
            ...req.headers,
            host: 'tshirtbusiness-bac1a.firebaseapp.com', // rewrite host
            cookie: '',
            authorization: ''
        }
    }, (connectorResponse) => {
        res.writeHead(connectorResponse.statusCode, connectorResponse.headers);
        connectorResponse.pipe(res);
    });
    
    req.pipe(connector);
    
    connector.on('error', (err) => {
        console.error('Firebase Auth Proxy Error:', err);
        res.status(500).send('Authentication proxy error');
    });
};

app.all('/__/auth/*', proxyFirebase);
app.all('/__/firebase/*', proxyFirebase);

// Studio designs include front/back previews and original artwork as data URLs.
app.use(['/api/orders', '/api/user/cart', '/api/ai/remove-bg'], express.json({ limit: '20mb' }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: true }));

// Use the same configured origin policy for assets and API responses.
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path.replace(/(reset-password\/).+/, '$1[redacted]')}`);
    next();
});

// Routes
app.get('/api', (req, res) => {
    res.json({ 
        message: '🎽 T-Shirt Business API',
        status: 'active',
        version: '4.0.0',
        database: connectDB.getStatus().state,
        authentication: 'JWT Enabled',
        admin: 'Admin Panel Available',
        endpoints: {
            auth: {
                register: 'POST /api/auth/register',
                login: 'POST /api/auth/login',
                logout: 'GET /api/auth/logout (protected)',
                getMe: 'GET /api/auth/me (protected)',
                forgotPassword: 'POST /api/auth/forgot-password',
                resetPassword: 'PATCH /api/auth/reset-password/:token'
            },
            admin: {
                dashboard: 'GET /api/admin/dashboard (admin)',
                orders: 'GET /api/admin/orders (admin)',
                products: 'POST /api/admin/products (admin)',
                customers: 'GET /api/admin/customers (admin)',
                analytics: 'GET /api/admin/analytics/sales (admin)'
            },
            products: {
                getAll: 'GET /api/products',
                getSingle: 'GET /api/products/:id',
                categories: 'GET /api/products/categories',
                create: 'POST /api/products (admin)',
                update: 'PUT /api/products/:id (admin)',
                delete: 'DELETE /api/products/:id (admin)'
            },
            orders: {
                create: 'POST /api/orders',
                track: 'GET /api/orders/track?orderNumber=ORD-...',
                getAll: 'GET /api/orders (admin)',
                getSingle: 'GET /api/orders/:id (admin)',
                updateStatus: 'PUT /api/orders/:id/status (admin)'
            }
        }
    });
});

// API Routes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { success: false, error: 'Too many authentication attempts. Please try again later.' }
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);
app.use('/api/auth/google-login', authLimiter);
app.use('/api/subscribe', authLimiter);
app.use('/api/ai', rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false }));

// Add user routes
app.use('/api/user', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api', subscriptionRoutes);
app.use('/api/ai', aiRoutes);

// SEO Routes (mounted at root)
app.use('/', seoRoutes);

// Catch-all route to serve React's index.html for client-side routing
app.get('*', (req, res, next) => {
    // If request is for an API endpoint or OAuth helpers, let it pass to 404 handler
    if (req.path.startsWith('/api') || req.path.startsWith('/__')) {
        return next();
    }
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// Error handling middleware
app.use((req, res, next) => {
    const error = new Error(`Not Found - ${req.originalUrl}`);
    error.status = 404;
    next(error);
});

app.use((error, req, res, next) => {
    const statusCode = error.status || 500;
    res.status(statusCode).json({
        success: false,
        error: {
            message: error.message,
            statusCode: statusCode,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }
    });
});

// Start only after the initial database attempt has completed. If MongoDB is
// unavailable, keep the HTTP server available for diagnostics and report 503
// from /api/health instead of silently presenting a healthy-looking API.
const PORT = process.env.PORT || 5000;
const startServer = async () => {
    require('./scripts/ensureFrontend');
    const connection = await connectDB();
    if (!connection) {
        console.warn('⚠️ Starting in degraded mode; MongoDB-backed endpoints will remain unavailable until the connection is restored.');
    }

    app.listen(PORT, () => {
        console.log(`\n=========================================`);
        console.log(`🚀 Server running in ${process.env.NODE_ENV} mode`);
        console.log(`📡 Port: ${PORT}`);
        console.log(`🌐 URL: http://localhost:${PORT}`);
        console.log(`🗄️  Database: ${connection ? 'MongoDB connected' : 'unavailable (see /api/health)'}`);
        console.log(`=========================================\n`);
    });
};

if (require.main === module) startServer();
module.exports = { app, startServer };
