// routes/seoRoutes.js

const express = require('express');
const router = express.Router();
const { getSitemap, getRobotsTxt } = require('../controllers/seoController');

router.get('/sitemap.xml', getSitemap);
router.get('/robots.txt', getRobotsTxt);

module.exports = router;
