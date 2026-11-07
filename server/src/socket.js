import { Server } from 'socket.io';
import { parse } from 'cookie';
import mongoose from 'mongoose';
import { config } from './config.js';
import { verifyToken } from './middleware/auth.js';
import { User } from './models/User.js';
import { addSocket, removeSocket } from './utils/presence.js';
import { registerGameHandlers, onUserOffline } from './games/manager.js';
import { registerRoomHandlers, onSocketDisconnect } from './rooms/manager.js';
import { registerCallHandlers, onCallSocketDisconnect } from './calls/manager.js';

export function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: config.clientUrl, credentials: true },
    maxHttpBufferSize: 1e5,
  });

  // Authenticate with the same httpOnly cookie used by the REST API
  io.use(async (socket, next) => {
    try {
      const token = parse(socket.handshake.headers.cookie || '')[config.cookieName];
      if (!token) throw new Error('no token');
      const { id } = verifyToken(token);
      const user = await User.findById(id).select('_id');
      if (!user) throw new Error('no user');
      socket.userId = String(user._id);
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  async function notifyFriends(userId, payload) {
    const u = await User.findById(userId).select('friends');
    if (!u) return;
    for (const f of u.friends) io.to(`user:${f}`).emit('presence', payload);
  }

  io.on('connection', async (socket) => {
    const uid = socket.userId;
    socket.join(`user:${uid}`);
    if (addSocket(uid, socket.id)) await notifyFriends(uid, { userId: uid, online: true });

    registerGameHandlers(io, socket);
    registerRoomHandlers(io, socket);
    registerCallHandlers(io, socket);

    socket.on('typing', async (data) => {
      const to = data?.to;
      if (!mongoose.isValidObjectId(to)) return;
      const ok = await User.exists({ _id: uid, friends: to });
      if (ok) io.to(`user:${to}`).emit('typing', { from: uid, isTyping: !!data.isTyping });
    });

    socket.on('disconnect', async () => {
      onSocketDisconnect(io, socket);
      onCallSocketDisconnect(io, socket);
      if (removeSocket(uid, socket.id)) {
        onUserOffline(io, uid);
        const lastSeen = new Date();
        await User.updateOne({ _id: uid }, { lastSeen });
        await notifyFriends(uid, { userId: uid, online: false, lastSeen });
      }
    });
  });

  return io;
}
