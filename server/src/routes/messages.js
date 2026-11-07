import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Message } from '../models/Message.js';
import { requireAuth } from '../middleware/auth.js';
import { upload, saveImage } from '../utils/upload.js';
import { HttpError, ah } from '../utils/errors.js';
import { songInput } from '../utils/song.js';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { detectVoice, parseRange } from '../utils/audio.js';
import { getBucket, putBuffer, removeFile } from '../utils/gridfs.js';

const MAX_VOICE_MS = 125_000; // the app records up to 2 minutes
const voiceUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024, files: 1, fields: 5 } });
const voiceLimiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many voice messages. Try again in a few minutes.' } });

// lean() results skip the model's toJSON, so hide the storage id of voice messages by hand
const safe = (m) => (m.voice ? { ...m, voice: { durationMs: m.voice.durationMs, mime: m.voice.mime } } : m);

const router = Router();
router.use(requireAuth);

const emit = (req, userId, event, payload) => req.app.get('io').to(`user:${userId}`).emit(event, payload);

function assertFriend(req, friendId) {
  if (!mongoose.isValidObjectId(friendId)) throw new HttpError(400, 'Invalid user.');
  if (!req.user.friends.some((f) => String(f) === friendId)) throw new HttpError(403, 'You can only message friends.');
}

// Last message + unread count per conversation
router.get('/conversations', ah(async (req, res) => {
  const me = req.user._id;
  const rows = await Message.aggregate([
    { $match: { $or: [{ from: me }, { to: me }] } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: { $cond: [{ $eq: ['$from', me] }, '$to', '$from'] },
        last: { $first: '$$ROOT' },
        unread: { $sum: { $cond: [{ $and: [{ $eq: ['$to', me] }, { $eq: ['$read', false] }] }, 1, 0] } },
      },
    },
  ]);
  res.json({ conversations: rows.map((r) => ({ friendId: r._id, last: safe(r.last), unread: r.unread })) });
}));

// GET /api/messages/voice/:id -> the audio of a voice message (Range supported). Only the two people in the chat may listen.
router.get('/voice/:id', ah(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(404, 'Not found.');
  const msg = await Message.findOne({ _id: req.params.id, type: 'voice', $or: [{ from: req.user._id }, { to: req.user._id }] }).lean();
  if (!msg?.voice) throw new HttpError(404, 'Not found.');
  const { size, mime, fileId } = msg.voice;
  const range = parseRange(req.headers.range, size);
  if (range === 'unsatisfiable') return res.status(416).set('Content-Range', `bytes */${size}`).end();
  let start = 0, end = size - 1;
  const headers = { 'Content-Type': mime, 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=3600' };
  if (range) { ({ start, end } = range); res.status(206); headers['Content-Range'] = `bytes ${start}-${end}/${size}`; }
  headers['Content-Length'] = String(end - start + 1);
  res.set(headers);
  const stream = getBucket().openDownloadStream(fileId, { start, end: end + 1 });
  stream.on('error', () => (res.headersSent ? res.destroy() : res.status(404).end()));
  res.on('close', () => stream.destroy());
  stream.pipe(res);
}));

router.get('/:friendId', ah(async (req, res) => {
  const { friendId } = req.params;
  assertFriend(req, friendId);
  const limit = Math.min(Number(req.query.limit) || 40, 100);
  const query = {
    $or: [
      { from: req.user._id, to: friendId },
      { from: friendId, to: req.user._id },
    ],
  };
  if (req.query.before) {
    const d = new Date(String(req.query.before));
    if (!isNaN(d)) query.createdAt = { $lt: d };
  }
  const msgs = await Message.find(query).sort({ createdAt: -1 }).limit(limit).lean();
  res.json({ messages: msgs.reverse().map(safe), hasMore: msgs.length === limit });
}));

// POST /api/messages/:friendId/voice  (multipart: audio + durationMs)
router.post('/:friendId/voice', voiceLimiter, voiceUpload.single('audio'), ah(async (req, res) => {
  const { friendId } = req.params;
  assertFriend(req, friendId);
  if (!req.file) throw new HttpError(400, 'No voice message received.');
  const kind = detectVoice(req.file.buffer);
  if (!kind) throw new HttpError(400, 'That is not a supported audio recording.');
  const ms = Math.round(Number(req.body.durationMs));
  if (!Number.isFinite(ms) || ms < 300) throw new HttpError(400, 'The voice message is too short.');
  const fileId = await putBuffer(req.file.buffer, `voice-${req.user.id}.${kind.ext}`, kind.mime);
  let msg;
  try {
    msg = await Message.create({ from: req.user._id, to: friendId, type: 'voice', voice: { fileId, mime: kind.mime, size: req.file.size, durationMs: Math.min(ms, MAX_VOICE_MS) } });
  } catch (e) {
    await removeFile(fileId);
    throw e;
  }
  emit(req, friendId, 'message:new', msg.toJSON());
  emit(req, req.user.id, 'message:new', msg.toJSON());
  res.status(201).json({ message: msg });
}));

router.post('/:friendId', upload.single('image'), ah(async (req, res) => {
  const { friendId } = req.params;
  assertFriend(req, friendId);
  const doc = { from: req.user._id, to: friendId };
  const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
  if (text.length > 2000) throw new HttpError(400, 'Message is too long (max 2000 characters).');

  if (req.file) {
    doc.type = 'image';
    doc.image = await saveImage(req.file, 'chat');
    doc.text = text;
  } else if (req.body.song) {
    let raw;
    try {
      raw = typeof req.body.song === 'string' ? JSON.parse(req.body.song) : req.body.song;
    } catch {
      throw new HttpError(400, 'Invalid song.');
    }
    const parsed = songInput.safeParse(raw);
    if (!parsed.success) throw new HttpError(400, 'Invalid song.');
    doc.type = 'song';
    doc.song = parsed.data;
    doc.text = text;
  } else {
    if (!text) throw new HttpError(400, 'Message cannot be empty.');
    doc.type = 'text';
    doc.text = text;
  }

  const msg = await Message.create(doc);
  emit(req, friendId, 'message:new', msg.toJSON());
  emit(req, req.user.id, 'message:new', msg.toJSON()); // other tabs/devices of the sender
  res.status(201).json({ message: msg });
}));

// Edit your own text message. Only the sender can edit, and only while the two of you are still friends.
router.patch('/:id', ah(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new HttpError(400, 'Invalid message.');
  const parsed = z.object({ text: z.string().trim().min(1, 'Message cannot be empty.').max(2000, 'Message is too long (max 2000 characters).') }).safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0].message);

  const msg = await Message.findOne({ _id: id, from: req.user._id });
  if (!msg) throw new HttpError(404, 'Message not found.');
  if (msg.type !== 'text') throw new HttpError(400, 'Only text messages can be edited.');
  assertFriend(req, String(msg.to));

  if (msg.text !== parsed.data.text) {
    msg.text = parsed.data.text;
    msg.editedAt = new Date();
    await msg.save();
    emit(req, msg.to, 'message:edited', msg.toJSON());
    emit(req, req.user.id, 'message:edited', msg.toJSON()); // sender's other tabs/devices
  }
  res.json({ message: msg });
}));

router.post('/:friendId/read', ah(async (req, res) => {
  const { friendId } = req.params;
  assertFriend(req, friendId);
  const r = await Message.updateMany({ from: friendId, to: req.user._id, read: false }, { read: true });
  if (r.modifiedCount) emit(req, friendId, 'messages:read', { by: req.user.id });
  emit(req, req.user.id, 'messages:read-self', { friendId });
  res.json({ ok: true });
}));

export default router;
