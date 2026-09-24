const express = require('express');
const { getMyVerification, submitVerification } = require('../controllers/verificationController');
const { protect, allowRoles } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect, allowRoles('driver'));
router.get('/me', getMyVerification);
router.post('/submit', submitVerification);

module.exports = router;
