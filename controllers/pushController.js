const PushSubscription = require('../models/PushSubscription');

const isValidSubscription = (subscription) =>
  subscription &&
  typeof subscription.endpoint === 'string' &&
  subscription.endpoint.length > 0 &&
  subscription.keys &&
  typeof subscription.keys.p256dh === 'string' &&
  typeof subscription.keys.auth === 'string';

exports.getVapidPublicKey = (req, res) => {
  if (!process.env.VAPID_PUBLIC_KEY) {
    return res.status(503).json({ message: 'Push notifications are not configured.' });
  }
  return res.status(200).json({ publicKey: process.env.VAPID_PUBLIC_KEY });
};

exports.subscribe = async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!isValidSubscription(subscription)) {
      return res.status(400).json({ message: 'A valid browser push subscription is required.' });
    }
    await PushSubscription.findOneAndUpdate(
      { endpoint: subscription.endpoint },
      { $set: { userId: req.user._id, endpoint: subscription.endpoint, subscription } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return res.status(201).json({ message: 'Push notifications enabled for this device.' });
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Unable to save push subscription.' });
  }
};

exports.unsubscribe = async (req, res) => {
  try {
    const endpoint = req.body?.endpoint || req.body?.subscription?.endpoint;
    if (!endpoint) return res.status(400).json({ message: 'Subscription endpoint is required.' });
    await PushSubscription.deleteOne({ userId: req.user._id, endpoint });
    return res.status(200).json({ message: 'Push notifications disabled for this device.' });
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Unable to remove push subscription.' });
  }
};
