require('dotenv').config();

const cors = require('cors');
const express = require('express');
const http = require('http');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const connectDatabase = require('./config/db');
const User = require('./models/User');
const TripRequest = require('./models/TripRequest');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const verificationRoutes = require('./routes/verificationRoutes');
const adminRoutes = require('./routes/adminRoutes');
const tripRequestRoutes = require('./routes/tripRequestRoutes');
const pushRoutes = require('./routes/pushRoutes');
const chatRoutes = require('./routes/chatRoutes');
const orsRoutes = require('./routes/ors');

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: true, credentials: true },
});
// Ephemeral latest locations let a participant who opens chat slightly later
// receive the other participant's current point without waiting for the next GPS tick.
const activeTripLocations = new Map();

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token || !process.env.JWT_SECRET) return next(new Error('Authentication required.'));
    const { userId } = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(userId).select('_id');
    if (!user) return next(new Error('Account not found.'));
    socket.userId = user._id.toString();
    return next();
  } catch (error) {
    return next(new Error('Invalid or expired socket token.'));
  }
});

io.on('connection', (socket) => {
  socket.data.focused = true;
  socket.data.lastLocationAt = 0;
  socket.join(`user:${socket.userId}`);
  socket.on('presence:update', ({ focused }) => {
    socket.data.focused = Boolean(focused);
  });

  const confirmedTripForUser = async (tripId) => {
    if (!mongoose.isValidObjectId(tripId)) return null;
    const trip = await TripRequest.findOne({ _id: tripId, status: 'accepted' })
      .select('passengerId offers');
    if (!trip) return null;
    const acceptedOffer = trip.offers.find((offer) => offer.status === 'accepted');
    if (!acceptedOffer) return null;
    const isPassenger = trip.passengerId.toString() === socket.userId;
    const isDriver = acceptedOffer.driverId.toString() === socket.userId;
    if (!isPassenger && !isDriver) return null;
    return { trip, recipientId: isPassenger ? acceptedOffer.driverId.toString() : trip.passengerId.toString() };
  };

  socket.on('update_location', async ({ lat, lng, tripId } = {}) => {
    const latitude = Number(lat);
    const longitude = Number(lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      console.warn('[Rahi location] Rejected invalid location update.', { userId: socket.userId, tripId, lat, lng });
      socket.emit('location_error', { tripId, message: 'A valid latitude and longitude are required.' });
      return;
    }
    // Geolocation can emit frequently; one relay per second is sufficient for a smooth map.
    if (Date.now() - socket.data.lastLocationAt < 1000) return;
    try {
      const confirmedTrip = await confirmedTripForUser(tripId);
      if (!confirmedTrip) {
        console.warn('[Rahi location] Rejected location update for an unconfirmed trip.', { userId: socket.userId, tripId });
        socket.emit('location_error', { tripId, message: 'Live location is available only for your confirmed trip.' });
        return;
      }
      socket.data.lastLocationAt = Date.now();
      const tripId = confirmedTrip.trip._id.toString();
      const locations = activeTripLocations.get(tripId) || new Map();
      const updatedAt = new Date().toISOString();
      const otherLocation = locations.get(confirmedTrip.recipientId);
      locations.set(socket.userId, { lat: latitude, lng: longitude, updatedAt });
      activeTripLocations.set(tripId, locations);
      console.log('[Rahi location] Relaying live location.', { tripId: confirmedTrip.trip._id.toString(), fromUserId: socket.userId, toUserId: confirmedTrip.recipientId, lat: latitude, lng: longitude });
      io.to(`user:${confirmedTrip.recipientId}`).emit('location_updated', {
        tripId,
        userId: socket.userId,
        lat: latitude,
        lng: longitude,
        updatedAt,
      });
      if (otherLocation) {
        console.log('[Rahi location] Replaying the other participant location.', { tripId, toUserId: socket.userId, fromUserId: confirmedTrip.recipientId });
        socket.emit('location_updated', { tripId, userId: confirmedTrip.recipientId, ...otherLocation });
      }
    } catch (error) {
      socket.emit('location_error', { tripId, message: 'Unable to share live location right now.' });
    }
  });

  socket.on('stop_sharing', async ({ tripId } = {}) => {
    try {
      const confirmedTrip = await confirmedTripForUser(tripId);
      if (!confirmedTrip) {
        socket.emit('location_error', { tripId, message: 'You cannot stop sharing for this trip.' });
        return;
      }
      io.to(`user:${confirmedTrip.recipientId}`).emit('location_sharing_stopped', {
        tripId: confirmedTrip.trip._id.toString(),
        userId: socket.userId,
      });
      activeTripLocations.delete(confirmedTrip.trip._id.toString());
    } catch (error) {
      socket.emit('location_error', { tripId, message: 'Unable to stop location sharing right now.' });
    }
  });
});

app.set('io', io);
app.set('activeTripLocations', activeTripLocations);
app.set('isUserFocused', (userId) =>
  [...io.sockets.sockets.values()].some(
    (socket) => socket.userId === userId && socket.data.focused
  )
);
app.use(cors());
app.use(express.json({ limit: '8mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/trip-requests', tripRequestRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api', orsRoutes);

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'drivo-api' });
});

const port = process.env.PORT || 5000;
const host = process.env.HOST || '0.0.0.0';

connectDatabase()
  .then(() => httpServer.listen(port, host, () => console.log(`Drivo API listening on http://${host}:${port}`)))
  .catch((error) => {
    console.error('Unable to start the API:', error.message);
    process.exit(1);
  });
