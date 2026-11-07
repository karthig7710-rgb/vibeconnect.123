import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { PUBLIC_FIELDS } from '../models/User.js';
import { Playlist } from '../models/Playlist.js';
import { Track } from '../models/Track.js';
import { HttpError, ah } from '../utils/errors.js';
import { detectAudio, parseRange, trackToSong } from '../utils/audio.js';
import { getBucket, putBuffer, removeFile } from '../utils/gridfs.js';

const router = Router();
router.use(requireAuth);

const MB = 1024 * 1024;
const MAX_PLAYLISTS = 30;
const MAX_TRACKS_PER_PLAYLIST = 100;
const OID = /^[a-f0-9]{24}$/i;
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Songs are held in memory just long enough to verify them and write them to GridFS.
const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxAudioMb * MB, files: 1, fields: 10 },
});
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many uploads. Try again in a while.' },
});

const visibilitySchema = z.enum(['private', 'friends', 'public']);
const createSchema = z.object({
  name: z.string().trim().min(1, 'Give your playlist a name.').max(60, 'Name is too long (max 60 characters).'),
  description: z.string().trim().max(200, 'Description is too long (max 200 characters).').optional().default(''),
  visibility: visibilitySchema.default('friends'),
});
const updateSchema = createSchema.partial();
const trackSchema = z.object({
  title: z.string().trim().max(150, 'Title is too long (max 150 characters).').optional().default(''),
  artist: z.string().trim().max(100, 'Artist is too long (max 100 characters).').optional().default(''),
  durationSec: z.coerce.number().min(1, 'Could not read the song length.').max(7200, 'Songs can be up to 2 hours long.'),
  rights: z.literal('true', { errorMap: () => ({ message: 'Please confirm you have the right to share this song.' }) }),
});

const parse = (schema, data) => {
  const r = schema.safeParse(data);
  if (!r.success) throw new HttpError(400, r.error.issues[0].message);
  return r.data;
};
const requireId = (id, what = 'Not found.') => {
  if (!OID.test(String(id))) throw new HttpError(404, what);
  return id;
};

const isFriendOf = (user, ownerId) => user.friends.some((f) => String(f) === String(ownerId));

// Who may open a playlist and stream its songs.
function canView(playlist, user) {
  if (String(playlist.owner) === String(user._id)) return true;
  if (playlist.visibility === 'public') return true;
  return playlist.visibility === 'friends' && isFriendOf(user, playlist.owner);
}

// Playlists the viewer is allowed to see (own + friends' + public).
const visibleFilter = (user) => ({
  $or: [
    { owner: user._id },
    { visibility: 'public' },
    { visibility: 'friends', owner: { $in: user.friends } },
  ],
});

async function loadOwnPlaylist(req) {
  const p = await Playlist.findOne({ _id: requireId(req.params.id, 'Playlist not found.'), owner: req.user._id });
  if (!p) throw new HttpError(404, 'Playlist not found.');
  return p;
}

const shapePlaylist = (p, me, stats = {}) => ({
  _id: String(p._id),
  name: p.name,
  description: p.description || '',
  visibility: p.visibility,
  owner: p.owner && p.owner.username ? { _id: String(p.owner._id), username: p.owner.username, avatar: p.owner.avatar || '' } : null,
  isMine: String(p.owner?._id || p.owner) === String(me),
  trackCount: stats.n || 0,
  durationMs: stats.ms || 0,
  updatedAt: p.updatedAt,
});

async function usageOf(userId) {
  const [row] = await Track.aggregate([{ $match: { owner: userId } }, { $group: { _id: null, bytes: { $sum: '$size' } } }]);
  return { usedBytes: row?.bytes || 0, quotaBytes: config.userQuotaMb * MB, maxFileBytes: config.maxAudioMb * MB };
}

// ---------- Playlists ----------

// GET /api/library/playlists?scope=mine|friends|public
router.get('/playlists', ah(async (req, res) => {
  const scope = ['mine', 'friends', 'public'].includes(req.query.scope) ? req.query.scope : 'mine';
  const me = req.user._id;
  const filter =
    scope === 'mine'
      ? { owner: me }
      : scope === 'friends'
        ? { owner: { $in: req.user.friends }, visibility: { $in: ['friends', 'public'] } }
        : { visibility: 'public', owner: { $ne: me } };

  const playlists = await Playlist.find(filter).sort({ updatedAt: -1 }).limit(100).populate('owner', PUBLIC_FIELDS).lean();
  const ids = playlists.map((p) => p._id);
  const rows = ids.length
    ? await Track.aggregate([{ $match: { playlist: { $in: ids } } }, { $group: { _id: '$playlist', n: { $sum: 1 }, ms: { $sum: '$durationMs' } } }])
    : [];
  const stats = new Map(rows.map((r) => [String(r._id), r]));

  res.json({
    playlists: playlists.map((p) => shapePlaylist(p, me, stats.get(String(p._id)))),
    ...(scope === 'mine' ? { usage: await usageOf(me) } : {}),
  });
}));

router.post('/playlists', ah(async (req, res) => {
  const data = parse(createSchema, req.body);
  if ((await Playlist.countDocuments({ owner: req.user._id })) >= MAX_PLAYLISTS) {
    throw new HttpError(409, `You can have up to ${MAX_PLAYLISTS} playlists.`);
  }
  const p = await Playlist.create({ ...data, owner: req.user._id });
  res.status(201).json({ playlist: shapePlaylist({ ...p.toObject(), owner: req.user }, req.user._id) });
}));

router.patch('/playlists/:id', ah(async (req, res) => {
  const p = await loadOwnPlaylist(req);
  const data = parse(updateSchema, req.body);
  Object.assign(p, data);
  await p.save();
  res.json({ playlist: shapePlaylist({ ...p.toObject(), owner: req.user }, req.user._id) });
}));

router.delete('/playlists/:id', ah(async (req, res) => {
  const p = await loadOwnPlaylist(req);
  const tracks = await Track.find({ playlist: p._id }).select('fileId').lean();
  await Promise.all(tracks.map((t) => removeFile(t.fileId)));
  await Track.deleteMany({ playlist: p._id });
  await p.deleteOne();
  res.json({ ok: true });
}));

// A playlist and its songs. Not visible to you? It reports 404 so private lists are never revealed.
router.get('/playlists/:id', ah(async (req, res) => {
  const p = await Playlist.findById(requireId(req.params.id, 'Playlist not found.')).populate('owner', PUBLIC_FIELDS).lean();
  if (!p || !canView(p, req.user)) throw new HttpError(404, 'Playlist not found.');
  const tracks = await Track.find({ playlist: p._id }).sort({ createdAt: 1 }).lean();
  const uploader = p.owner?.username || '';
  const mine = String(p.owner._id) === String(req.user._id);
  res.json({
    playlist: shapePlaylist(p, req.user._id, { n: tracks.length, ms: tracks.reduce((a, t) => a + t.durationMs, 0) }),
    songs: tracks.map((t) => ({ ...trackToSong(t, { album: p.name, uploader }), id: String(t._id) })),
    ...(mine ? { usage: await usageOf(req.user._id) } : {}),
  });
}));

// ---------- Songs ----------

router.post('/playlists/:id/tracks', uploadLimiter, audioUpload.single('audio'), ah(async (req, res) => {
  const playlist = await loadOwnPlaylist(req);
  const body = parse(trackSchema, req.body);
  if (!req.file) throw new HttpError(400, 'Choose a song to upload.');

  const kind = detectAudio(req.file.buffer);
  if (!kind) throw new HttpError(400, 'That file is not a supported audio file (MP3, M4A, OGG, WAV or FLAC).');

  if ((await Track.countDocuments({ playlist: playlist._id })) >= MAX_TRACKS_PER_PLAYLIST) {
    throw new HttpError(409, `A playlist can hold up to ${MAX_TRACKS_PER_PLAYLIST} songs.`);
  }
  const usage = await usageOf(req.user._id);
  if (usage.usedBytes + req.file.size > usage.quotaBytes) {
    throw new HttpError(413, `Your library is full (${config.userQuotaMb} MB). Delete some songs first.`);
  }

  const fileId = await putBuffer(req.file.buffer, `${req.user.id}.${kind.ext}`, kind.mime);
  let track;
  try {
    track = await Track.create({
      owner: req.user._id,
      playlist: playlist._id,
      title: body.title || 'Untitled song',
      artist: body.artist,
      fileId,
      mime: kind.mime,
      size: req.file.size,
      durationMs: Math.round(body.durationSec * 1000),
    });
  } catch (e) {
    await removeFile(fileId); // don't leave an orphaned file behind
    throw e;
  }
  await Playlist.updateOne({ _id: playlist._id }, { $currentDate: { updatedAt: true } });
  res.status(201).json({ song: { ...trackToSong(track, { album: playlist.name, uploader: req.user.username }), id: String(track._id) } });
}));

router.delete('/tracks/:id', ah(async (req, res) => {
  const t = await Track.findOne({ _id: requireId(req.params.id, 'Song not found.'), owner: req.user._id });
  if (!t) throw new HttpError(404, 'Song not found.');
  await removeFile(t.fileId);
  await t.deleteOne();
  res.json({ ok: true });
}));

// GET /api/library/songs?q=  -> songs from every playlist you can listen to (newest first)
router.get('/songs', ah(async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 60);
  const playlists = await Playlist.find(visibleFilter(req.user)).select('_id name').limit(500).lean();
  const names = new Map(playlists.map((p) => [String(p._id), p.name]));
  const filter = { playlist: { $in: playlists.map((p) => p._id) } };
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ title: rx }, { artist: rx }];
  }
  const tracks = await Track.find(filter).sort({ createdAt: -1 }).limit(50).populate('owner', 'username').lean();
  res.json({
    tracks: tracks.map((t) => trackToSong(t, { album: names.get(String(t.playlist)) || '', uploader: t.owner?.username || '' })),
  });
}));

// GET /api/library/stream/:id  -> the audio, with Range support so seeking works (also needed by iPhone/Android)
router.get('/stream/:id', ah(async (req, res) => {
  const track = await Track.findById(requireId(req.params.id, 'Song not found.')).lean();
  const playlist = track && (await Playlist.findById(track.playlist).select('owner visibility').lean());
  if (!track || !playlist || !canView(playlist, req.user)) throw new HttpError(404, 'Song not found.');

  const size = track.size;
  const range = parseRange(req.headers.range, size);
  if (range === 'unsatisfiable') {
    res.status(416).set('Content-Range', `bytes */${size}`).end();
    return;
  }

  let start = 0;
  let end = size - 1;
  const headers = { 'Content-Type': track.mime, 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=300' };
  if (range) {
    ({ start, end } = range);
    res.status(206);
    headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
  }
  headers['Content-Length'] = String(end - start + 1);
  res.set(headers);

  const stream = getBucket().openDownloadStream(track.fileId, { start, end: end + 1 }); // end is exclusive here
  stream.on('error', () => (res.headersSent ? res.destroy() : res.status(404).end()));
  res.on('close', () => stream.destroy());
  stream.pipe(res);
}));

export default router;
