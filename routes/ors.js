const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { getRoute, searchPlaces } = require('../controllers/orsController');

const router = express.Router();

router.use(protect);
router.get('/route', getRoute);
router.get('/search', searchPlaces);

module.exports = router;
