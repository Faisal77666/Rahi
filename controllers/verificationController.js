const Verification = require('../models/Verification');
const User = require('../models/User');
const mongoose = require('mongoose');

const isImageDataUrl = (value) => typeof value === 'string' && /^data:image\/(jpeg|jpg|png|webp);base64,/.test(value);
const MAX_IMAGE_LENGTH = 3_500_000;

const verificationBucket = () => new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
  bucketName: 'verificationUploads',
});

const dataUrlToFile = (dataUrl, label) => {
  const [header, payload] = dataUrl.split(',');
  const mimeType = header.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64$/)?.[1];
  return { buffer: Buffer.from(payload, 'base64'), mimeType, filename: `${label}-${Date.now()}.${mimeType.split('/')[1]}` };
};

const uploadImage = (bucket, image, label, driverId) => new Promise((resolve, reject) => {
  const file = dataUrlToFile(image, label);
  const stream = bucket.openUploadStream(file.filename, {
    contentType: file.mimeType,
    metadata: { driverId: driverId.toString(), documentType: label },
  });
  stream.on('error', reject);
  stream.on('finish', (uploaded) => resolve(uploaded?._id || stream.id));
  stream.end(file.buffer);
});

exports.getMyVerification = async (req, res) => {
  try {
    if (req.user.role !== 'driver') return res.status(403).json({ message: 'Only drivers have verification records.' });
    const verification = await Verification.findOne({ driverId: req.user._id }).select('status submittedAt updatedAt');
    return res.status(200).json({ status: req.user.verificationStatus, verification });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Unable to retrieve verification status.' });
  }
};

exports.submitVerification = async (req, res) => {
  try {
    if (req.user.role !== 'driver') return res.status(403).json({ message: 'Only drivers can submit verification.' });
    const { licenseImage, livePhoto } = req.body;
    if (!isImageDataUrl(licenseImage) || !isImageDataUrl(livePhoto)) {
      return res.status(400).json({ message: 'A license image and a live photo are required.' });
    }
    if (licenseImage.length > MAX_IMAGE_LENGTH || livePhoto.length > MAX_IMAGE_LENGTH) {
      return res.status(400).json({ message: 'Each image must be smaller than approximately 2.5 MB.' });
    }

    const bucket = verificationBucket();
    const existingVerification = await Verification.findOne({ driverId: req.user._id });
    const [licenseImageFileId, livePhotoFileId] = await Promise.all([
      uploadImage(bucket, licenseImage, 'license', req.user._id),
      uploadImage(bucket, livePhoto, 'live-photo', req.user._id),
    ]);

    const verification = await Verification.findOneAndUpdate(
      { driverId: req.user._id },
      { licenseImageFileId, livePhotoFileId, status: 'pending', submittedAt: new Date() },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    if (existingVerification?.licenseImageFileId) bucket.delete(existingVerification.licenseImageFileId).catch(() => {});
    if (existingVerification?.livePhotoFileId) bucket.delete(existingVerification.livePhotoFileId).catch(() => {});
    await User.findByIdAndUpdate(req.user._id, { verificationStatus: 'pending' });

    return res.status(201).json({ message: 'Verification submitted and under review.', verification: { status: verification.status, submittedAt: verification.submittedAt } });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Unable to submit verification.' });
  }
};
