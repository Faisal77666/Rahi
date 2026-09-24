const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { getVapidPublicKey, subscribe, unsubscribe } = require('../controllers/pushController');

const router = express.Router();

router.use(protect);
router.get('/vapid-public-key', getVapidPublicKey);
router.post('/subscribe', subscribe);
router.post('/unsubscribe', unsubscribe);

module.exports = router;
