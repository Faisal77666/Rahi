const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema(
  {
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true, min: 0 },
    type: { type: String, enum: ['accepted', 'countered'], required: true },
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
    at: { type: Date, default: Date.now },
  },
  { _id: true }
);

const tripRequestSchema = new mongoose.Schema(
  {
    passengerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    route: {
      type: String,
      required: true,
      enum: ['Lahore-Pattoki', 'Pattoki-Lahore'],
    },
    date: { type: Date, required: true },
    time: { type: String, required: true, trim: true },
    rideType: {
      type: String,
      enum: ['shared', 'private'],
      default: 'shared',
    },
    seatsNeeded: { type: Number, required: true, min: 1, default: 1 },
    offeredPrice: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['open', 'accepted', 'completed', 'cancelled', 'expired'],
      default: 'open',
    },
    offers: { type: [offerSchema], default: [] },
  },
  { timestamps: true }
);

tripRequestSchema.index({ route: 1, date: 1, time: 1, status: 1 });

module.exports = mongoose.model('TripRequest', tripRequestSchema);
