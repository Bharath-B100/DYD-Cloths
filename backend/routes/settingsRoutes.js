const express = require('express');
const router = express.Router();
const { getSettings, updateSettings, seedSettings } = require('../controllers/settingsController');
const { protect, restrictTo } = require('../middleware/auth');

router.get('/', getSettings);
router.post('/', protect, restrictTo('admin'), updateSettings);
router.post('/seed', protect, restrictTo('admin'), seedSettings);

module.exports = router;
