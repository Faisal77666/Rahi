const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema(
  {
    tripRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'TripRequest', required: true, index: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, trim: true, maxlength: 1000 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
