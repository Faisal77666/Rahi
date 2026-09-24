const jwt = require('jsonwebtoken');
const User = require('../models/User');

const createToken = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured. Add it to your .env file.');
  }

  return jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });
};

const userResponse = (user) => ({
  id: user._id,
  name: user.name,
  phone: user.phone,
  cnic: user.cnic,
  role: user.role,
  vehicleType: user.vehicleType,
  verificationStatus: user.verificationStatus,
  vehicleInfo: user.vehicleInfo,
});

exports.register = async (req, res) => {
  try {
    const { name, phone, cnic, role, password, vehicleInfo } = req.body;

    if (!name || !phone || !cnic || !role || !password) {
      return res.status(400).json({ message: 'Name, phone, CNIC, role, and password are required.' });
    }

    if (!['driver', 'passenger'].includes(role)) {
      return res.status(400).json({ message: 'Role must be driver or passenger.' });
    }
    if (!/^03\d{9}$/.test(phone)) {
      return res.status(400).json({ message: 'Phone number must be an 11-digit Pakistani mobile number, e.g. 03001234567.' });
    }
    if (!/^\d{5}-\d{7}-\d$/.test(cnic)) {
      return res.status(400).json({ message: 'CNIC must use the format 12345-1234567-1.' });
    }

    if (role === 'driver' && (!vehicleInfo?.make || !vehicleInfo?.model || !vehicleInfo?.registrationNumber)) {
      return res.status(400).json({ message: 'Complete vehicle information is required for drivers.' });
    }

    const existingUser = await User.findOne({ $or: [{ phone }, { cnic }] });
    if (existingUser) {
      return res.status(409).json({ message: 'A user with this phone number or CNIC already exists.' });
    }

    const user = await User.create({ name, phone, cnic, role, password, vehicleInfo });
    const token = createToken(user);

    return res.status(201).json({ token, user: userResponse(user) });
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Unable to register user.' });
  }
};

exports.login = async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ message: 'Phone and password are required.' });
    }
    if (!/^03\d{9}$/.test(phone)) {
      return res.status(400).json({ message: 'Enter an 11-digit Pakistani mobile number, e.g. 03001234567.' });
    }

    const user = await User.findOne({ phone }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid phone number or password.' });
    }

    const token = createToken(user);
    return res.status(200).json({ token, user: userResponse(user) });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Unable to log in.' });
  }
};
