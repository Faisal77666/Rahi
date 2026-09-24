const mongoose = require('mongoose');

const verificationSchema = new mongoose.Schema(
  {
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    licenseImageFileId: { type: mongoose.Schema.Types.ObjectId, required: true },
    livePhotoFileId: { type: mongoose.Schema.Types.ObjectId, required: true },
    status: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Verification', verificationSchema);
