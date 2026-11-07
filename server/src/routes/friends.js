import { Router } from 'express';
import mongoose from 'mongoose';
import { User, PUBLIC_FIELDS } from '../models/User.js';
import { FriendRequest } from '../models/FriendRequest.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError, ah } from '../utils/errors.js';
import { isOnline } from '../utils/presence.js';

const router = Router();
router.use(requireAuth);

const validId = (id) => mongoose.isValidObjectId(id);
const emit = (req, userId, event, payload) => req.app.get('io').to(`user:${userId}`).emit(event, payload);

router.get('/', ah(async (req, res) => {
  const me = await User.findById(req.user._id).populate('friends', PUBLIC_FIELDS).lean();
  const friends = me.friends
    .map((f) => ({ ...f, online: isOnline(f._id) }))
    .sort((a, b) => a.username.localeCompare(b.username));
  res.json({ friends });
}));

router.get('/requests', ah(async (req, res) => {
  const [incoming, outgoing] = await Promise.all([
    FriendRequest.find({ to: req.user._id }).sort({ createdAt: -1 }).populate('from', PUBLIC_FIELDS).lean(),
    FriendRequest.find({ from: req.user._id }).sort({ createdAt: -1 }).populate('to', PUBLIC_FIELDS).lean(),
  ]);
  res.json({ incoming, outgoing });
}));

router.post('/request/:userId', ah(async (req, res) => {
  const { userId } = req.params;
  if (!validId(userId)) throw new HttpError(400, 'Invalid user.');
  if (userId === req.user.id) throw new HttpError(400, "You can't add yourself.");
  const target = await User.findById(userId).select('_id');
  if (!target) throw new HttpError(404, 'User not found.');
  if (req.user.friends.some((f) => String(f) === userId)) throw new HttpError(409, 'You are already friends.');
  const reverse = await FriendRequest.findOne({ from: userId, to: req.user._id });
  if (reverse) throw new HttpError(409, 'They already sent you a request — accept it in Friends.');
  let fr;
  try {
    fr = await FriendRequest.create({ from: req.user._id, to: userId });
  } catch (e) {
    if (e.code === 11000) throw new HttpError(409, 'Request already sent.');
    throw e;
  }
  const populated = await fr.populate('from', PUBLIC_FIELDS);
  emit(req, userId, 'friend:request', { request: populated });
  res.status(201).json({ request: fr });
}));

router.post('/requests/:id/accept', ah(async (req, res) => {
  if (!validId(req.params.id)) throw new HttpError(400, 'Invalid request.');
  const fr = await FriendRequest.findOne({ _id: req.params.id, to: req.user._id });
  if (!fr) throw new HttpError(404, 'Request not found.');
  await Promise.all([
    User.updateOne({ _id: fr.to }, { $addToSet: { friends: fr.from } }),
    User.updateOne({ _id: fr.from }, { $addToSet: { friends: fr.to } }),
    fr.deleteOne(),
  ]);
  emit(req, String(fr.from), 'friend:accepted', {});
  emit(req, String(fr.to), 'friend:accepted', {});
  res.json({ ok: true });
}));

// Decline (recipient) or cancel (sender)
router.delete('/requests/:id', ah(async (req, res) => {
  if (!validId(req.params.id)) throw new HttpError(400, 'Invalid request.');
  const fr = await FriendRequest.findOneAndDelete({
    _id: req.params.id,
    $or: [{ to: req.user._id }, { from: req.user._id }],
  });
  if (!fr) throw new HttpError(404, 'Request not found.');
  emit(req, String(fr.from), 'friend:request-updated', {});
  emit(req, String(fr.to), 'friend:request-updated', {});
  res.json({ ok: true });
}));

router.delete('/:id', ah(async (req, res) => {
  if (!validId(req.params.id)) throw new HttpError(400, 'Invalid user.');
  await Promise.all([
    User.updateOne({ _id: req.user._id }, { $pull: { friends: req.params.id } }),
    User.updateOne({ _id: req.params.id }, { $pull: { friends: req.user._id } }),
  ]);
  emit(req, req.params.id, 'friend:removed', { userId: req.user.id });
  emit(req, req.user.id, 'friend:removed', { userId: req.params.id });
  res.json({ ok: true });
}));

export default router;
