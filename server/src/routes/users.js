import { Router } from 'express';
import { User, PUBLIC_FIELDS } from '../models/User.js';
import { FriendRequest } from '../models/FriendRequest.js';
import { requireAuth } from '../middleware/auth.js';
import { ah } from '../utils/errors.js';
import { isOnline } from '../utils/presence.js';

const router = Router();
router.use(requireAuth);

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// GET /api/users/search?q=ann  -> users + relationship to the current user
router.get('/search', ah(async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 20);
  if (q.length < 2) return res.json({ users: [] });
  const users = await User.find({ _id: { $ne: req.user._id }, username: new RegExp(escapeRegex(q.toLowerCase())) })
    .select(PUBLIC_FIELDS)
    .limit(20)
    .lean();
  const ids = users.map((u) => u._id);
  const reqs = await FriendRequest.find({
    $or: [{ from: req.user._id, to: { $in: ids } }, { to: req.user._id, from: { $in: ids } }],
  }).lean();
  const friendSet = new Set(req.user.friends.map(String));
  const result = users.map((u) => {
    let status = 'none';
    let requestId = null;
    if (friendSet.has(String(u._id))) status = 'friend';
    else {
      const r = reqs.find((x) => String(x.from) === String(u._id) || String(x.to) === String(u._id));
      if (r) {
        status = String(r.from) === String(req.user._id) ? 'sent' : 'received';
        requestId = r._id;
      }
    }
    return { ...u, status, requestId, online: isOnline(u._id) };
  });
  res.json({ users: result });
}));

export default router;
