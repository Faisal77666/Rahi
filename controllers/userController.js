const User = require('../models/User');

const profileResponse = (user) => ({
  id: user._id,
  name: user.name,
  phone: user.phone,
  cnic: user.cnic,
  role: user.role,
  vehicleType: user.vehicleType,
  verificationStatus: user.verificationStatus,
  vehicleInfo: user.vehicleInfo,
});

exports.getMyProfile = async (req, res) => {
  return res.status(200).json({ user: profileResponse(req.user) });
};

exports.updateMyProfile = async (req, res) => {
  try {
    const { vehicleType } = req.body;

    if (req.user.role !== 'driver') {
      return res.status(403).json({ message: 'Only drivers can select a vehicle type.' });
    }
    if (!['car', 'motorcycle'].includes(vehicleType)) {
      return res.status(400).json({ message: 'vehicleType must be car or motorcycle.' });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { vehicleType },
      { new: true, runValidators: true }
    );

    return res.status(200).json({ user: profileResponse(user) });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Unable to update profile.' });
  }
};
