const express = require('express');
const { getMyProfile, updateMyProfile } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.patch('/me', protect, updateMyProfile);
router.get('/me', protect, getMyProfile);

module.exports = router;
