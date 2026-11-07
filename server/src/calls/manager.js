import crypto from 'crypto';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { effectiveTemplates } from '../utils/plans.js';
import { HttpError } from '../utils/errors.js';
import { wrap } from '../utils/guard.js';
import { isOnline } from '../utils/presence.js';

// 1-to-1 WebRTC calls. The server only carries the signalling (offer/answer/ICE) between two friends;
// audio and video travel directly between the browsers.
const RING_MS = 35_000;
const calls = new Map(); // callId -> call
const byUser = new Map(); // userId -> callId (a user can be in one call at a time)

const other = (c, uid) => (c.caller === uid ? c.callee : c.caller);
const mine = (c, uid) => c.caller === uid || c.callee === uid;
const socketOf = (c, uid) => (c.caller === uid ? c.callerSocket : c.calleeSocket);

function finish(io, c, reason, exceptUid) {
  if (!calls.has(c.id)) return;
  clearTimeout(c.timer);
  calls.delete(c.id);
  if (byUser.get(c.caller) === c.id) byUser.delete(c.caller);
  if (byUser.get(c.callee) === c.id) byUser.delete(c.callee);
  for (const uid of [c.caller, c.callee]) {
    if (uid !== exceptUid) io.to(`user:${uid}`).emit('call:ended', { id: c.id, reason });
  }
}

// When a user's socket drops, end the call that socket was in (or ringing for the user).
export function onCallSocketDisconnect(io, socket) {
  const id = byUser.get(socket.userId);
  const c = id && calls.get(id);
  if (!c) return;
  const uid = socket.userId;
  const active = c.state === 'active';
  if (socketOf(c, uid) === socket.id || (c.state === 'ringing' && c.caller === uid)) {
    finish(io, c, active ? 'dropped' : 'cancelled', uid);
  }
}

export function registerCallHandlers(io, socket) {
  const uid = socket.userId;

  const getCall = (id) => {
    const c = calls.get(id);
    if (!c || !mine(c, uid)) throw new HttpError(404, 'This call has ended.');
    return c;
  };

  socket.on('call:invite', wrap(socket, async ({ to, video }, reply) => {
    if (!mongoose.isValidObjectId(to) || to === uid) throw new HttpError(400, 'Invalid friend.');
    if (byUser.has(uid)) throw new HttpError(409, 'You are already in a call.');
    if (!(await User.exists({ _id: uid, friends: to }))) throw new HttpError(403, 'You can only call friends.');
    if (!isOnline(to)) throw new HttpError(409, 'Your friend is offline right now.');
    if (byUser.has(to)) throw new HttpError(409, 'Your friend is on another call.');

    const [me, them] = await Promise.all([User.findById(uid), User.findById(to).select('username')]);
    if (!me || !them) throw new HttpError(404, 'User not found.');
    const c = {
      id: crypto.randomBytes(8).toString('hex'), caller: uid, callee: to, video: !!video, state: 'ringing',
      callerSocket: socket.id, calleeSocket: null, timer: null, startedAt: Date.now(),
    };
    calls.set(c.id, c);
    byUser.set(uid, c.id);
    byUser.set(to, c.id);
    c.timer = setTimeout(() => finish(io, c, 'missed'), RING_MS);

    const from = { _id: uid, username: me.username, avatar: me.avatar, profileTemplate: effectiveTemplates(me).profile };
    io.to(`user:${to}`).emit('call:incoming', { id: c.id, video: c.video, from });
    reply({ ok: true, id: c.id });
  }));

  socket.on('call:accept', wrap(socket, async ({ id }, reply) => {
    const c = getCall(id);
    if (c.callee !== uid || c.state !== 'ringing') throw new HttpError(409, 'This call can no longer be answered.');
    clearTimeout(c.timer);
    c.state = 'active';
    c.calleeSocket = socket.id;
    c.startedAt = Date.now();
    // other devices of the callee stop ringing
    socket.to(`user:${uid}`).emit('call:handled', { id: c.id });
    io.to(c.callerSocket).emit('call:accepted', { id: c.id });
    reply({ ok: true });
  }));

  socket.on('call:reject', wrap(socket, async ({ id }, reply) => {
    const c = getCall(id);
    if (c.callee !== uid || c.state !== 'ringing') throw new HttpError(409, 'This call can no longer be declined.');
    finish(io, c, 'declined');
    reply({ ok: true });
  }));

  socket.on('call:end', wrap(socket, async ({ id }, reply) => {
    const c = calls.get(id);
    if (c && mine(c, uid)) finish(io, c, c.state === 'active' ? 'ended' : 'cancelled', uid);
    reply({ ok: true });
  }));

  // WebRTC offer / answer / ICE candidates, passed straight to the other person's socket
  socket.on('call:signal', wrap(socket, async ({ id, data }, reply) => {
    const c = getCall(id);
    if (c.state !== 'active') throw new HttpError(409, 'Call is not connected yet.');
    if (!data || typeof data !== 'object' || !['offer', 'answer', 'candidate'].includes(data.kind)) throw new HttpError(400, 'Bad signal.');
    if (JSON.stringify(data).length > 20_000) throw new HttpError(400, 'Signal too large.');
    io.to(socketOf(c, other(c, uid))).emit('call:signal', { id, data });
    reply({ ok: true });
  }));

  // Mute / camera state, only to show icons on the other side
  socket.on('call:media', wrap(socket, async ({ id, muted, camOff }, reply) => {
    const c = getCall(id);
    io.to(`user:${other(c, uid)}`).emit('call:media', { id, muted: !!muted, camOff: !!camOff });
    reply({ ok: true });
  }));
}

export const _test = { calls, byUser };
