import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { HttpError, ah } from '../utils/errors.js';
import { songInput } from '../utils/song.js';

const router = Router();
router.use(requireAuth);

router.get('/favorites', (req, res) => res.json({ favorites: req.user.favorites }));

router.post('/favorites', ah(async (req, res) => {
  const parsed = songInput.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, 'Invalid song.');
  const song = parsed.data;
  if (!req.user.favorites.some((f) => f.trackId === song.trackId)) {
    req.user.favorites.unshift(song);
    await req.user.save();
  }
  res.status(201).json({ favorites: req.user.favorites });
}));

router.delete('/favorites/:trackId', ah(async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { $pull: { favorites: { trackId: req.params.trackId } } });
  const fresh = await User.findById(req.user._id).select('favorites');
  res.json({ favorites: fresh.favorites });
}));

export default router;
