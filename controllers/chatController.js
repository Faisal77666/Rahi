const ChatMessage = require('../models/ChatMessage');
const TripRequest = require('../models/TripRequest');

const authorisedTrip = async (tripRequestId, userId) => {
  const trip = await TripRequest.findById(tripRequestId);
  if (!trip || trip.status !== 'accepted') return null;
  const acceptedOffer = trip.offers.find((offer) => offer.status === 'accepted');
  if (!acceptedOffer) return null;
  const allowed = trip.passengerId.equals(userId) || acceptedOffer.driverId.equals(userId);
  return allowed ? trip : null;
};

exports.getMessages = async (req, res) => {
  try {
    const trip = await authorisedTrip(req.params.tripRequestId, req.user._id);
    if (!trip) return res.status(403).json({ message: 'Chat is available only to the confirmed driver and passenger.' });
    const messages = await ChatMessage.find({ tripRequestId: trip._id }).populate('senderId', 'name').sort({ createdAt: 1 });
    return res.status(200).json({ messages });
  } catch (error) { return res.status(400).json({ message: error.message || 'Unable to load chat.' }); }
};

exports.sendMessage = async (req, res) => {
  try {
    const body = req.body?.body?.trim();
    if (!body) return res.status(400).json({ message: 'Message cannot be empty.' });
    const trip = await authorisedTrip(req.params.tripRequestId, req.user._id);
    if (!trip) return res.status(403).json({ message: 'Chat is available only to the confirmed driver and passenger.' });
    const message = await ChatMessage.create({ tripRequestId: trip._id, senderId: req.user._id, body });
    const populated = await message.populate('senderId', 'name');
    const acceptedOffer = trip.offers.find((offer) => offer.status === 'accepted');
    const io = req.app.get('io');
    [trip.passengerId, acceptedOffer.driverId].forEach((userId) => io?.to(`user:${userId}`).emit('chat_message', { tripRequestId: trip._id.toString(), message: populated }));
    return res.status(201).json({ message: populated });
  } catch (error) { return res.status(400).json({ message: error.message || 'Unable to send message.' }); }
};
