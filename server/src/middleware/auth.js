import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { User } from '../models/User.js';
import { HttpError, ah } from '../utils/errors.js';

export const signToken = (id) => jwt.sign({ id }, config.jwtSecret, { expiresIn: '7d' });

export const setAuthCookie = (res, token) =>
  res.cookie(config.cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });

export const clearAuthCookie = (res) =>
  res.clearCookie(config.cookieName, { httpOnly: true, sameSite: 'lax', secure: config.isProd, path: '/' });

export const verifyToken = (token) => jwt.verify(token, config.jwtSecret);

export const requireAuth = ah(async (req, _res, next) => {
  const token = req.cookies?.[config.cookieName];
  if (!token) throw new HttpError(401, 'Please log in.');
  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw new HttpError(401, 'Session expired. Please log in again.');
  }
  const user = await User.findById(payload.id).select('-password');
  if (!user) throw new HttpError(401, 'Account not found.');
  req.user = user;
  next();
});
