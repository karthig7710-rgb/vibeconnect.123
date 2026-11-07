import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User } from '../models/User.js';
import { requireAuth, signToken, setAuthCookie, clearAuthCookie } from '../middleware/auth.js';
import { upload, saveImage } from '../utils/upload.js';
import { HttpError, ah } from '../utils/errors.js';
import { THEME_IDS } from '../utils/themes.js';

const router = Router();

const signupSchema = z.object({
  username: z.string().trim().min(3, 'Username must be 3–20 characters').max(20).regex(/^[a-zA-Z0-9_]+$/, 'Username can only use letters, numbers and _'),
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(72),
});
const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Enter your email or username'),
  password: z.string().min(1, 'Enter your password'),
});

function parse(schema, data) {
  const r = schema.safeParse(data);
  if (!r.success) throw new HttpError(400, r.error.issues[0].message);
  return r.data;
}

router.post('/signup', upload.single('avatar'), ah(async (req, res) => {
  const { username, email, password } = parse(signupSchema, req.body);
  const exists = await User.findOne({ $or: [{ username: username.toLowerCase() }, { email: email.toLowerCase() }] });
  if (exists) throw new HttpError(409, 'That username or email is already taken.');
  const avatar = req.file ? await saveImage(req.file, 'avatars') : '';
  const user = await User.create({ username, email, avatar, password: await bcrypt.hash(password, 12) });
  setAuthCookie(res, signToken(user.id));
  res.status(201).json({ user });
}));

router.post('/login', ah(async (req, res) => {
  const { identifier, password } = parse(loginSchema, req.body);
  const id = identifier.toLowerCase();
  const user = await User.findOne({ $or: [{ email: id }, { username: id }] });
  const ok = user && (await bcrypt.compare(password, user.password));
  if (!ok) throw new HttpError(401, 'Incorrect email/username or password.');
  setAuthCookie(res, signToken(user.id));
  res.json({ user });
}));

router.post('/logout', (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));

router.put('/me', requireAuth, upload.single('avatar'), ah(async (req, res) => {
  const { bio, theme } = parse(
    z.object({ bio: z.string().max(160).optional(), theme: z.enum(THEME_IDS, { errorMap: () => ({ message: 'Unknown theme.' }) }).optional() }),
    req.body
  );
  if (bio !== undefined) req.user.bio = bio.trim();
  if (theme !== undefined) req.user.theme = theme;
  if (req.file) req.user.avatar = await saveImage(req.file, 'avatars');
  await req.user.save();
  res.json({ user: req.user });
}));

export default router;
