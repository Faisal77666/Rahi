const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    const authorization = req.headers.authorization || '';
    const [scheme, token] = authorization.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ message: 'Authentication required. Send a Bearer token.' });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not configured. Add it to your .env file.');
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.userId);
    if (!user) {
      return res.status(401).json({ message: 'The account for this token no longer exists.' });
    }

    req.user = user;
    return next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Invalid or expired token.' });
    }

    return res.status(500).json({ message: error.message || 'Unable to authenticate request.' });
  }
};

const allowRoles = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'You are not allowed to perform this action.' });
  }

  return next();
};

module.exports = { protect, allowRoles };
