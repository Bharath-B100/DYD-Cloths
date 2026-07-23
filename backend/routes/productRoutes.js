// routes/productRoutes.js - Updated routes

const express = require('express');
const router = express.Router();
const {
    getProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
    getCategories
} = require('../controllers/productController');

const reviewRouter = require('./reviewRoutes');
const { adminProtect } = require('../middleware/admin');

// Re-route into other resource routers
router.use('/:productId/reviews', reviewRouter);

// Public routes
router.get('/', getProducts);
router.get('/categories', getCategories);
router.get('/:id', getProductById);

// Admin routes
router.post('/', adminProtect, createProduct);
router.put('/:id', adminProtect, updateProduct);
router.delete('/:id', adminProtect, deleteProduct);

module.exports = router;
