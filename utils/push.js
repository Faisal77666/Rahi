const PushSubscription = require('../models/PushSubscription');
const { webpush, configured } = require('../config/webPush');

const sendPushToUser = async (req, userId, payload) => {
  if (!configured || !userId) return;
  if (req.app.get('isUserFocused')?.(userId.toString())) return;

  const subscriptions = await PushSubscription.find({ userId }).lean();
  await Promise.all(subscriptions.map(async ({ _id, subscription }) => {
    try {
      await webpush.sendNotification(subscription, JSON.stringify({
        title: payload.title || 'Rahi update',
        body: payload.body || 'You have a new ride update.',
        url: payload.target ? `/#${payload.target}` : '/#requests',
        tag: `${payload.target || 'ride'}-${payload.requestId || payload.tripRequestId || Date.now()}`,
      }));
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 410) {
        await PushSubscription.deleteOne({ _id });
      }
    }
  }));
};

module.exports = { sendPushToUser };
