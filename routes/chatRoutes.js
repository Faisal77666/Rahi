const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { getMessages, sendMessage } = require('../controllers/chatController');
const router = express.Router();
router.use(protect);
router.get('/:tripRequestId/messages', getMessages);
router.post('/:tripRequestId/messages', sendMessage);
module.exports = router;
