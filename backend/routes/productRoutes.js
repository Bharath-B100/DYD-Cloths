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

// Re-route into other resource routers
router.use('/:productId/reviews', reviewRouter);

// Public routes
router.get('/', getProducts);
router.get('/categories', getCategories);
router.get('/:id', getProductById);

// Admin routes (will add authentication middleware in Phase 5)
router.post('/', createProduct);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);

module.exports = router;