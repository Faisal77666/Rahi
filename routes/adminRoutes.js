const express = require('express');
const { listVerifications, reviewVerification, streamImage } = require('../controllers/adminVerificationController');
const { protect, allowRoles } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect, allowRoles('admin'));
router.get('/verifications', listVerifications);
router.get('/verifications/:id/:type', streamImage);
router.patch('/verifications/:id', reviewVerification);

module.exports = router;
