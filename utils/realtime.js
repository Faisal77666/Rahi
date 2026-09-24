const { sendPushToUser } = require('./push');

const emitToUser = (req, userId, event, payload) => {
  const io = req.app.get('io');
  if (io && userId) io.to(`user:${userId}`).emit(event, payload);
};

const notifyUser = (req, userId, event, payload) => {
  emitToUser(req, userId, event, payload);
  sendPushToUser(req, userId, payload).catch(() => {
    // Push notifications are optional and must never block the main ride action.
  });
};

module.exports = { emitToUser, notifyUser };
