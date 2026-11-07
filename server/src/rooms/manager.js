import crypto from 'crypto';
import mongoose from 'mongoose';
import { z } from 'zod';
import { User, PUBLIC_FIELDS } from '../models/User.js';
import { songInput, trackSeconds } from '../utils/song.js';
import { HttpError } from '../utils/errors.js';
import { wrap } from '../utils/guard.js';

// Listen Together rooms. In-memory (live playback state); the music itself is streamed by each
// listener straight from the audio file, so the server only tracks position and timing.
const rooms = new Map();
const EMPTY_MS = 5 * 60 * 1000;

// Length in seconds of the song currently selected in the room.
const len = (r) => trackSeconds(r.queue[r.index]);
const pos = (r) => (r.playing ? Math.min(r.position + (Date.now() - r.updatedAt) / 1000, len(r)) : r.position);

const view = (r) => ({
  id: r.id, name: r.name, hostId: r.hostId, host: r.host, controls: r.controls,
  queue: r.queue, index: r.index, playing: r.playing, position: r.position, updatedAt: r.updatedAt,
  serverNow: Date.now(), members: [...r.members.values()], invited: [...r.invited],
});
const summary = (r, uid) => ({
  id: r.id, name: r.name, host: r.host, controls: r.controls, isHost: r.hostId === uid,
  memberCount: r.members.size, joined: r.members.has(uid), nowPlaying: r.queue[r.index]?.title || null,
});

export const listRoomsFor = (uid) =>
  [...rooms.values()].filter((r) => r.hostId === uid || r.invited.has(uid)).map((r) => summary(r, uid));

const emitRoom = (io, r) => io.to(`room:${r.id}`).emit('room:update', view(r));

function schedule(io, r) {
  clearTimeout(r.timer);
  if (r.playing && r.index >= 0) {
    const ms = Math.max((len(r) - pos(r)) * 1000 + 400, 0);
    r.timer = setTimeout(() => advance(io, r, r.index), ms);
  }
}

function advance(io, r, fromIndex) {
  if (!rooms.has(r.id) || r.index !== fromIndex) return;
  if (fromIndex + 1 < r.queue.length) { r.index++; r.position = 0; r.playing = true; }
  else { r.playing = false; r.position = 0; }
  r.updatedAt = Date.now();
  schedule(io, r);
  emitRoom(io, r);
}

function destroy(io, r, reason) {
  clearTimeout(r.timer);
  clearTimeout(r.emptyTimer);
  io.to(`room:${r.id}`).emit('room:closed', { id: r.id, reason });
  for (const uid of r.invited) io.to(`user:${uid}`).emit('room:closed', { id: r.id, reason });
  io.in(`room:${r.id}`).socketsLeave(`room:${r.id}`);
  rooms.delete(r.id);
}

function leaveSocket(io, socket, r, transferHost) {
  socket.leave(`room:${r.id}`);
  socket.data.rooms?.delete(r.id);
  const set = r.sockets.get(socket.userId);
  if (set) {
    set.delete(socket.id);
    if (set.size === 0) { r.sockets.delete(socket.userId); r.members.delete(socket.userId); }
  }
  if (r.members.size === 0) {
    clearTimeout(r.emptyTimer);
    r.emptyTimer = setTimeout(() => r.members.size === 0 && destroy(io, r, 'empty'), EMPTY_MS);
  } else {
    if (transferHost && !r.members.has(r.hostId)) {
      const [nid, nu] = r.members.entries().next().value;
      r.hostId = nid; r.host = nu;
      r.invited.delete(nid);
    }
    emitRoom(io, r);
  }
}

async function publicUser(uid) {
  const u = await User.findById(uid).select(PUBLIC_FIELDS).lean();
  return { ...u, _id: String(u._id) };
}

export function onSocketDisconnect(io, socket) {
  for (const id of [...(socket.data.rooms || [])]) {
    const r = rooms.get(id);
    if (r) leaveSocket(io, socket, r, false);
  }
}

export function registerRoomHandlers(io, socket) {
  const uid = socket.userId;
  socket.data.rooms = new Set();

  // Clock sync: client estimates its offset from the server clock
  socket.on('time', (cb) => typeof cb === 'function' && cb(Date.now()));

  const getRoom = (id) => {
    const r = rooms.get(id);
    if (!r) throw new HttpError(404, 'This room no longer exists.');
    return r;
  };
  const getMemberRoom = (id) => {
    const r = getRoom(id);
    if (!r.members.has(uid)) throw new HttpError(403, 'Join the room first.');
    return r;
  };
  const join = (r) => {
    socket.join(`room:${r.id}`);
    socket.data.rooms.add(r.id);
    (r.sockets.get(uid) || r.sockets.set(uid, new Set()).get(uid)).add(socket.id);
  };

  socket.on('room:create', wrap(socket, async (data, reply) => {
    const p = z.object({ name: z.string().trim().min(1).max(40), controls: z.enum(['everyone', 'host']).default('everyone') }).safeParse(data);
    if (!p.success) throw new HttpError(400, 'Give your room a name (up to 40 characters).');
    if ([...rooms.values()].filter((r) => r.hostId === uid).length >= 3) throw new HttpError(409, 'You can host up to 3 rooms at a time.');
    const host = await publicUser(uid);
    const r = {
      id: crypto.randomBytes(6).toString('hex'), name: p.data.name, controls: p.data.controls, hostId: uid, host,
      token: crypto.randomBytes(8).toString('hex'),
      queue: [], index: -1, playing: false, position: 0, updatedAt: Date.now(),
      members: new Map([[uid, host]]), invited: new Set(), sockets: new Map(), timer: null, emptyTimer: null,
    };
    rooms.set(r.id, r);
    join(r);
    reply({ ok: true, room: view(r) });
  }));

  socket.on('room:invite', wrap(socket, async ({ id, to }, reply) => {
    const r = getRoom(id);
    if (r.hostId !== uid) throw new HttpError(403, 'Only the host can invite friends.');
    if (!mongoose.isValidObjectId(to) || to === uid) throw new HttpError(400, 'Invalid friend.');
    if (!(await User.exists({ _id: uid, friends: to }))) throw new HttpError(403, 'You can only invite friends.');
    r.invited.add(to);
    io.to(`user:${to}`).emit('room:invited', { room: summary(r, to), from: r.host });
    emitRoom(io, r);
    reply({ ok: true });
  }));

  // The host's shareable link: /?room=<id>&k=<token>. Only the host's friends may join through it.
  socket.on('room:link', wrap(socket, async ({ id, reset }, reply) => {
    const r = getRoom(id);
    if (r.hostId !== uid) throw new HttpError(403, 'Only the host can share the invite link.');
    if (reset) r.token = crypto.randomBytes(8).toString('hex');
    reply({ ok: true, token: r.token });
  }));

  socket.on('room:join', wrap(socket, async ({ id, token }, reply) => {
    const r = rooms.get(id);
    let allowed = !!r && (r.hostId === uid || r.invited.has(uid));
    if (r && !allowed && typeof token === 'string' && token.length === r.token.length
        && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(r.token))
        && (await User.exists({ _id: uid, friends: r.hostId }))) {
      r.invited.add(uid); // joined through the link, so reconnects keep working
      allowed = true;
    }
    if (!allowed) throw new HttpError(404, 'Room not found, or the invite link is not valid for you.');
    if (!r.members.has(uid)) r.members.set(uid, await publicUser(uid));
    join(r);
    clearTimeout(r.emptyTimer);
    emitRoom(io, r);
    reply({ ok: true, room: view(r) });
  }));

  socket.on('room:leave', wrap(socket, async ({ id }, reply) => {
    const r = rooms.get(id);
    if (r) leaveSocket(io, socket, r, true);
    reply({ ok: true });
  }));

  socket.on('room:close', wrap(socket, async ({ id }, reply) => {
    const r = getRoom(id);
    if (r.hostId !== uid) throw new HttpError(403, 'Only the host can close the room.');
    destroy(io, r, 'closed');
    reply({ ok: true });
  }));

  socket.on('room:ended', wrap(socket, async ({ id, index }, reply) => {
    const r = rooms.get(id);
    if (r && r.members.has(uid) && r.index === index && r.playing && pos(r) >= Math.max(len(r) - 10, 0)) advance(io, r, index);
    reply({ ok: true });
  }));

  socket.on('room:control', wrap(socket, async (data, reply) => {
    const r = getMemberRoom(data.id);
    if (r.controls === 'host' && r.hostId !== uid) throw new HttpError(403, 'Only the host controls playback in this room.');
    const now = Date.now();
    const start = (i) => { r.index = i; r.position = 0; r.playing = true; r.updatedAt = now; };
    switch (data.action) {
      case 'play':
        if (r.index < 0) throw new HttpError(400, 'Add a song first.');
        if (!r.playing) {
          if (r.position >= len(r) - 0.5) r.position = 0;
          r.playing = true; r.updatedAt = now;
        }
        break;
      case 'pause':
        if (r.playing) { r.position = pos(r); r.playing = false; r.updatedAt = now; }
        break;
      case 'seek': {
        const p = Number(data.position);
        if (!Number.isFinite(p) || r.index < 0) throw new HttpError(400, 'Invalid position.');
        r.position = Math.max(0, Math.min(p, Math.max(len(r) - 0.5, 0)));
        r.updatedAt = now;
        break;
      }
      case 'next':
        if (r.index + 1 >= r.queue.length) throw new HttpError(400, 'That is the last song in the queue.');
        start(r.index + 1);
        break;
      case 'prev':
        if (r.index < 0) throw new HttpError(400, 'Nothing is playing.');
        start(pos(r) > 3 || r.index === 0 ? r.index : r.index - 1);
        break;
      case 'select': {
        const i = Number(data.index);
        if (!Number.isInteger(i) || i < 0 || i >= r.queue.length) throw new HttpError(400, 'Invalid song.');
        start(i);
        break;
      }
      case 'add': {
        const s = songInput.safeParse(data.track);
        if (!s.success) throw new HttpError(400, 'Invalid song.');
        if (r.queue.length >= 50) throw new HttpError(409, 'The queue is full (50 songs).');
        r.queue.push(s.data);
        if (r.index < 0) start(0);
        break;
      }
      case 'remove': {
        const i = Number(data.index);
        if (!Number.isInteger(i) || i < 0 || i >= r.queue.length) throw new HttpError(400, 'Invalid song.');
        r.queue.splice(i, 1);
        if (r.queue.length === 0) { r.index = -1; r.playing = false; r.position = 0; r.updatedAt = now; }
        else if (i < r.index) r.index--;
        else if (i === r.index) { r.index = Math.min(r.index, r.queue.length - 1); r.position = 0; r.updatedAt = now; }
        break;
      }
      default:
        throw new HttpError(400, 'Unknown action.');
    }
    schedule(io, r);
    emitRoom(io, r);
    reply({ ok: true });
  }));
}
