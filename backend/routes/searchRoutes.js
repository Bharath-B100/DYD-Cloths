// routes/searchRoutes.js - Search routes

const express = require('express');
const router = express.Router();
const {
    searchProducts,
    getSuggestions
} = require('../controllers/searchController');

// Public routes
router.get('/', searchProducts);
router.get('/suggest', getSuggestions);

module.exports = router;