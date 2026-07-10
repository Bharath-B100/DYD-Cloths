// routes/adminRoutes.js - Admin routes

const express = require('express');
const router = express.Router();
const {
    // Dashboard
    getDashboardStats,
    
    // Orders
    getAllOrders,
    updateOrderStatus,
    updatePaymentStatus,
    deleteOrder,
    
    // Products
    createProduct,
    updateProduct,
    deleteProduct,
    bulkUpdateStock,
    
    // Customers
    getAllCustomers,
    getCustomerDetails,
    updateCustomerStatus,
    deleteCustomer,
    
    // Analytics
    getSalesAnalytics,
    getProductAnalytics,
    exportData,
    updateUserRole
} = require('../controllers/adminController');

const {
    getAllReviews,
    updateReviewStatus,
    deleteReview
} = require('../controllers/reviewController');

const { adminProtect } = require('../middleware/admin');
const { upload } = require('../middleware/upload');

// Apply admin protection to all routes
router.use(adminProtect);

// ======================
// DASHBOARD
// ======================
router.get('/dashboard', getDashboardStats);

// ======================
// ORDER MANAGEMENT
// ======================
router.get('/orders', getAllOrders);
router.put('/orders/:id/status', updateOrderStatus);
router.put('/orders/:id/payment-status', updatePaymentStatus);
router.delete('/orders/:id', deleteOrder);

// ======================
// PRODUCT MANAGEMENT
// ======================
const productUpload = upload.fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'gallery', maxCount: 8 },
    { name: 'image', maxCount: 1 }
]);

router.post('/products', productUpload, createProduct);
router.put('/products/bulk/stock', bulkUpdateStock);
router.put('/products/:id', productUpload, updateProduct);
router.delete('/products/:id', deleteProduct);

// ======================
// CUSTOMER MANAGEMENT
// ======================
router.get('/customers', getAllCustomers);
router.get('/customers/:id', getCustomerDetails);
router.put('/customers/:id/status', updateCustomerStatus);
router.put('/customers/:id/role', updateUserRole);
router.delete('/customers/:id', deleteCustomer);

// ======================
// REVIEW MANAGEMENT
// ======================
router.get('/reviews', getAllReviews);
router.put('/reviews/:id/status', updateReviewStatus);
router.delete('/reviews/:id', deleteReview);

// ======================
// ANALYTICS & REPORTS
// ======================
router.get('/analytics/sales', getSalesAnalytics);
router.get('/analytics/products', getProductAnalytics);
router.get('/export/:type', exportData);

module.exports = router;
