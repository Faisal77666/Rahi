const mongoose = require('mongoose');
const Verification = require('../models/Verification');
const User = require('../models/User');

const verificationBucket = () => new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'verificationUploads' });

exports.listVerifications = async (req, res) => {
  try {
    const filter = req.query.status ? { status: req.query.status } : {};
    const verifications = await Verification.find(filter)
      .populate('driverId', 'name phone cnic vehicleType vehicleInfo')
      .select('driverId status submittedAt updatedAt')
      .sort({ submittedAt: -1 });
    return res.status(200).json({ verifications });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Unable to list verification submissions.' });
  }
};

exports.streamImage = async (req, res) => {
  try {
    const { id, type } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id) || !['license', 'live-photo'].includes(type)) {
      return res.status(400).json({ message: 'Invalid verification image request.' });
    }
    const verification = await Verification.findById(id);
    if (!verification) return res.status(404).json({ message: 'Verification not found.' });
    const fileId = type === 'license' ? verification.licenseImageFileId : verification.livePhotoFileId;
    const bucket = verificationBucket();
    const file = await bucket.find({ _id: fileId }).next();
    if (!file) return res.status(404).json({ message: 'Verification image not found.' });
    res.set('Content-Type', file.contentType || 'image/jpeg');
    return bucket.openDownloadStream(fileId).pipe(res);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Unable to load verification image.' });
  }
};

exports.reviewVerification = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['verified', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Status must be verified or rejected.' });
    }
    const existingVerification = await Verification.findById(req.params.id);
    if (!existingVerification) return res.status(404).json({ message: 'Verification not found.' });

    let verification;
    if (status === 'verified') {
      const bucket = verificationBucket();
      const fileIds = [existingVerification.licenseImageFileId, existingVerification.livePhotoFileId].filter(Boolean);
      await Promise.all(fileIds.map((fileId) => bucket.delete(fileId)));
      verification = await Verification.findByIdAndUpdate(
        req.params.id,
        { $set: { status }, $unset: { licenseImageFileId: 1, livePhotoFileId: 1 } },
        { new: true }
      );
    } else {
      verification = await Verification.findByIdAndUpdate(req.params.id, { status }, { new: true });
    }

    await User.findByIdAndUpdate(existingVerification.driverId, { verificationStatus: status });
    return res.status(200).json({
      message: status === 'verified' ? 'Driver verified and verification images deleted.' : 'Driver verification rejected.',
      verification,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Unable to review verification.' });
  }
};
