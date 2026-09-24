const express = require('express');
const { acceptTripOffer, completeTrip, createTripRequest, getMyTripRequests, listOpenTripRequests, respondToTripRequest } = require('../controllers/tripRequestController');
const { protect, allowRoles } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);
router.post('/', allowRoles('passenger'), createTripRequest);
router.get('/mine', allowRoles('passenger'), getMyTripRequests);
router.patch('/:id/offers/:offerId/accept', allowRoles('passenger'), acceptTripOffer);
router.get('/', allowRoles('driver'), listOpenTripRequests);
router.post('/:id/offer', allowRoles('driver'), respondToTripRequest);
router.patch('/:id/complete', allowRoles('driver'), completeTrip);

module.exports = router;
