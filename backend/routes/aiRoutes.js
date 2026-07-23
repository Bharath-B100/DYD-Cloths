const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { protect } = require('../middleware/auth');

router.use(protect);

// AI Generate Design Route
router.post('/generate', aiController.generateDesign);

// AI Remove Background Route
router.post('/remove-bg', aiController.removeBackground);

module.exports = router;
