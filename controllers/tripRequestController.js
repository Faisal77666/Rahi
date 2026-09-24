const TripRequest = require('../models/TripRequest');
const User = require('../models/User');
const { notifyUser } = require('../utils/realtime');

const isFutureDeparture = (date, time) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return false;
  const departure = new Date(`${date}T${time}:00+05:00`);
  return !Number.isNaN(departure.getTime()) && departure > new Date();
};

const canDriverRespond = (user) => user.role === 'driver' && user.verificationStatus === 'verified' && (!user.accountBlockedUntil || user.accountBlockedUntil <= new Date());

// Keep completed/past passenger requests out of the active dashboard without
// deleting operational records from MongoDB.
const expirePastTripRequests = async () => {
  const candidates = await TripRequest.find({ status: { $in: ['open', 'accepted'] } })
    .select('_id date time');
  const expiredIds = candidates
    .filter((tripRequest) => !isFutureDeparture(tripRequest.date.toISOString().slice(0, 10), tripRequest.time))
    .map((tripRequest) => tripRequest._id);
  if (expiredIds.length) {
    await TripRequest.updateMany({ _id: { $in: expiredIds } }, { $set: { status: 'expired' } });
  }
};

exports.createTripRequest = async (req, res) => {
  try {
    const { route, date, time, offeredPrice } = req.body;
    if (!route || !date || !time || offeredPrice === undefined) {
      return res.status(400).json({ message: 'Route, date, time, seats needed, and offered price are required.' });
    }
    if (!isFutureDeparture(date, time)) {
      return res.status(400).json({ message: 'Requested travel date and time must be in the future.' });
    }
    if (!Number.isFinite(Number(offeredPrice)) || Number(offeredPrice) < 0) {
      return res.status(400).json({ message: 'Enter a valid offered fare.' });
    }

    const tripRequest = await TripRequest.create({
      passengerId: req.user._id,
      route,
      date,
      time,
      rideType: 'private',
      seatsNeeded: 1,
      offeredPrice: Number(offeredPrice),
    });
    const eligibleDrivers = await User.find({
      role: 'driver',
      verificationStatus: 'verified',
      $or: [
        { accountBlockedUntil: { $exists: false } },
        { accountBlockedUntil: null },
        { accountBlockedUntil: { $lte: new Date() } },
      ],
    }).select('_id');
    eligibleDrivers.forEach((driver) => notifyUser(req, driver._id, 'new_request', {
      tripRequestId: tripRequest._id,
      title: 'New passenger trip request',
      body: `A passenger needs a ${route} ride at ${time} and offered PKR ${offeredPrice}.`,
      target: 'passenger-trips',
    }));
    return res.status(201).json({ tripRequest });
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Unable to create trip request.' });
  }
};

exports.listOpenTripRequests = async (req, res) => {
  try {
    await expirePastTripRequests();
    const filters = {
      $or: [
        { status: 'open' },
        { status: 'accepted', offers: { $elemMatch: { driverId: req.user._id, status: 'accepted' } } },
      ],
    };
    if (req.query.route) filters.route = req.query.route;
    const tripRequests = await TripRequest.find(filters)
      .populate('passengerId', 'name')
      .sort({ date: 1, time: 1 });
    const sanitizedRequests = tripRequests.map((tripRequest) => {
      const item = tripRequest.toObject();
      item.myOffer = item.offers.find((offer) => offer.driverId.toString() === req.user._id.toString()) || null;
      delete item.offers;
      return item;
    });
    return res.status(200).json({ tripRequests: sanitizedRequests });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Unable to list trip requests.' });
  }
};

exports.getMyTripRequests = async (req, res) => {
  try {
    await expirePastTripRequests();
    const tripRequests = await TripRequest.find({ passengerId: req.user._id, status: { $ne: 'expired' } })
      .populate('offers.driverId', 'name phone vehicleType vehicleInfo')
      .sort({ createdAt: -1 });
    const safeTripRequests = tripRequests.map((tripRequest) => {
      const item = tripRequest.toObject();
      item.offers.forEach((offer) => {
        if (item.status !== 'accepted' || offer.status !== 'accepted') {
          if (offer.driverId) delete offer.driverId.phone;
        }
      });
      return item;
    });
    return res.status(200).json({ tripRequests: safeTripRequests });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Unable to retrieve trip requests.' });
  }
};

exports.acceptTripOffer = async (req, res) => {
  try {
    const tripRequest = await TripRequest.findOne({ _id: req.params.id, passengerId: req.user._id })
      .populate('offers.driverId', 'name phone vehicleType vehicleInfo');
    if (!tripRequest || tripRequest.status !== 'open') {
      return res.status(404).json({ message: 'This trip request is no longer open.' });
    }
    const selectedOffer = tripRequest.offers.id(req.params.offerId);
    if (!selectedOffer || selectedOffer.status !== 'pending') {
      return res.status(400).json({ message: 'This driver offer is no longer available.' });
    }

    tripRequest.status = 'accepted';
    tripRequest.offers.forEach((offer) => { offer.status = offer._id.equals(selectedOffer._id) ? 'accepted' : 'rejected'; });
    await tripRequest.save();
    notifyUser(req, selectedOffer.driverId._id, 'request_accepted', {
      tripRequestId: tripRequest._id,
      title: 'Passenger selected your offer',
      body: 'Your trip offer was accepted. You can now contact the passenger.',
      target: 'passenger-trips',
    });

    return res.status(200).json({
      message: `Driver offer accepted at PKR ${selectedOffer.amount}. You can now contact each other.`,
      tripRequest,
      agreedFare: selectedOffer.amount,
      contactDetails: {
        passenger: { name: req.user.name, phone: req.user.phone },
        driver: { name: selectedOffer.driverId.name, phone: selectedOffer.driverId.phone },
      },
    });
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Unable to accept this driver offer.' });
  }
};

exports.respondToTripRequest = async (req, res) => {
  try {
    if (!canDriverRespond(req.user)) {
      return res.status(403).json({ message: 'A verified, unblocked driver account is required to respond to passenger trips.' });
    }
    const { amount } = req.body;
    if (!Number.isFinite(Number(amount)) || Number(amount) < 0) {
      return res.status(400).json({ message: 'Enter a valid offer amount.' });
    }
    const tripRequest = await TripRequest.findById(req.params.id).populate('passengerId', 'name phone');
    if (!tripRequest || tripRequest.status !== 'open') {
      return res.status(404).json({ message: 'This passenger trip request is no longer open.' });
    }
    const requestDate = tripRequest.date.toISOString().slice(0, 10);
    if (!isFutureDeparture(requestDate, tripRequest.time)) {
      return res.status(400).json({ message: 'You cannot respond to a trip request in the past.' });
    }

    const offerAmount = Number(amount);
    const acceptsPassengerFare = offerAmount === tripRequest.offeredPrice;
    const offer = {
      driverId: req.user._id,
      amount: offerAmount,
      type: acceptsPassengerFare ? 'accepted' : 'countered',
      status: acceptsPassengerFare ? 'accepted' : 'pending',
      at: new Date(),
    };
    const otherDriverOffers = tripRequest.offers.filter((existingOffer) => !existingOffer.driverId.equals(req.user._id));

    if (acceptsPassengerFare) {
      // The status condition makes this atomic: only the first driver can lock the request.
      const lockedRequest = await TripRequest.findOneAndUpdate(
        { _id: tripRequest._id, status: 'open' },
        {
          $set: {
            status: 'accepted',
            offers: [
              ...otherDriverOffers.map((existingOffer) => ({ ...existingOffer.toObject(), status: 'rejected' })),
              offer,
            ],
          },
        },
        { new: true }
      );
      if (!lockedRequest) {
        return res.status(409).json({ message: 'Another driver has already accepted this passenger request.' });
      }
      notifyUser(req, tripRequest.passengerId._id, 'request_accepted', {
        tripRequestId: tripRequest._id,
        title: 'Driver accepted your fare',
        body: 'A driver accepted your trip request. You can now contact each other.',
        target: 'requests',
      });
      return res.status(200).json({
        message: `Fare accepted at PKR ${offerAmount}. Passenger phone: ${tripRequest.passengerId.phone}`,
        offer: lockedRequest.offers[lockedRequest.offers.length - 1],
        agreedFare: offerAmount,
        contactDetails: {
          passenger: { name: tripRequest.passengerId.name, phone: tripRequest.passengerId.phone },
        },
      });
    }

    tripRequest.offers = otherDriverOffers;
    tripRequest.offers.push(offer);
    await tripRequest.save();

    notifyUser(req, tripRequest.passengerId._id, 'price_countered', {
      tripRequestId: tripRequest._id,
      title: 'New driver counter-offer',
      body: `A driver offered PKR ${offerAmount} for your trip.`,
      target: 'requests',
    });

    return res.status(200).json({
      message: 'Counter-offer sent to the passenger.',
      offer: tripRequest.offers[tripRequest.offers.length - 1],
    });
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Unable to respond to this trip request.' });
  }
};

exports.completeTrip = async (req, res) => {
  try {
    const tripRequest = await TripRequest.findOne({
      _id: req.params.id,
      status: 'accepted',
      offers: { $elemMatch: { driverId: req.user._id, status: 'accepted' } },
    });
    if (!tripRequest) {
      return res.status(404).json({ message: 'Only the confirmed driver can complete an active trip.' });
    }

    tripRequest.status = 'completed';
    await tripRequest.save();
    const acceptedOffer = tripRequest.offers.find((offer) => offer.status === 'accepted');
    const requestedDistance = Number(req.body?.distanceMeters);
    const summary = {
      route: tripRequest.route,
      finalPrice: acceptedOffer.amount,
      distanceMeters: Number.isFinite(requestedDistance) && requestedDistance >= 0 && requestedDistance <= 2000000 ? requestedDistance : null,
      destinationName: typeof req.body?.destinationName === 'string' ? req.body.destinationName.trim().slice(0, 160) : '',
    };
    const participantIds = [tripRequest.passengerId.toString(), acceptedOffer.driverId.toString()];
    const io = req.app.get('io');
    participantIds.forEach((userId) => {
      io?.to(`user:${userId}`).emit('stop_sharing', { tripId: tripRequest._id.toString(), userId: req.user._id.toString() });
      io?.to(`user:${userId}`).emit('location_sharing_stopped', { tripId: tripRequest._id.toString(), userId: req.user._id.toString() });
      io?.to(`user:${userId}`).emit('trip_completed', { tripId: tripRequest._id.toString(), summary });
    });
    req.app.get('activeTripLocations')?.delete(tripRequest._id.toString());

    return res.status(200).json({ message: 'Trip marked as arrived and live location sharing stopped.', tripRequest, summary });
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Unable to complete this trip.' });
  }
};
