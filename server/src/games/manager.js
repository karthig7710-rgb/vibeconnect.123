import crypto from 'crypto';
import mongoose from 'mongoose';
import { User, PUBLIC_FIELDS } from '../models/User.js';
import { GameResult } from '../models/GameResult.js';
import { isOnline } from '../utils/presence.js';
import { HttpError } from '../utils/errors.js';
import { wrap } from '../utils/guard.js';
import * as ttt from './tictactoe.js';
import * as c4 from './connect4.js';
import * as rps from './rps.js';

const ENGINES = { ttt, c4, rps };
const INVITE_MS = 2 * 60 * 1000;
const DISCONNECT_MS = 60 * 1000;
const KEEP_MS = 10 * 60 * 1000;

// In-memory: games are short-lived. Finished results are stored in MongoDB (used for the head-to-head series score).
const games = new Map();
const seat = (g, uid) => g.players.indexOf(uid);

function view(g, uid) {
  const me = seat(g, uid);
  return {
    id: g.id, type: g.type, status: g.status, me, players: g.users,
    state: g.state ? ENGINES[g.type].view(g.state, me) : null,
    winner: g.winner, reason: g.reason, h2h: g.h2h, createdAt: g.createdAt,
  };
}
const emitGame = (io, g) => g.players.forEach((uid) => io.to(`user:${uid}`).emit('game:update', view(g, uid)));

function removeGame(io, g, reason) {
  clearTimeout(g.timer);
  clearTimeout(g.cleanup);
  games.delete(g.id);
  g.players.forEach((uid) => io.to(`user:${uid}`).emit('game:ended', { id: g.id, reason }));
}

async function loadH2H(g) {
  const rows = await GameResult.find({ players: { $all: g.players } }).select('winner draw').limit(2000).lean();
  const wins = [0, 0];
  let draws = 0;
  for (const r of rows) {
    if (r.draw) draws++;
    else {
      const i = g.players.indexOf(String(r.winner));
      if (i >= 0) wins[i]++;
    }
  }
  return { wins, draws };
}

async function finish(io, g, winner, reason) {
  if (g.status !== 'active') return;
  g.status = 'finished';
  g.winner = winner;
  g.reason = reason;
  clearTimeout(g.timer);
  const draw = winner === 'draw';
  try {
    await GameResult.create({ type: g.type, players: g.players, winner: draw ? null : g.players[winner], draw, reason });
    g.h2h = await loadH2H(g);
  } catch (e) {
    console.error('Failed to record game result', e);
  }
  emitGame(io, g);
  g.cleanup = setTimeout(() => games.delete(g.id), KEEP_MS);
}

export function onUserOffline(io, uid) {
  // Give a 60s grace period (page refresh, bad signal), then forfeit active games.
  for (const g of games.values()) {
    if (g.status === 'active' && g.players.includes(uid)) {
      setTimeout(() => {
        if (g.status === 'active' && !isOnline(uid)) finish(io, g, 1 - seat(g, uid), 'forfeit');
      }, DISCONNECT_MS);
    }
  }
}

export function registerGameHandlers(io, socket) {
  const uid = socket.userId;

  socket.on('game:invite', wrap(socket, async ({ to, type }, reply) => {
    if (!ENGINES[type]) throw new HttpError(400, 'Unknown game.');
    if (!mongoose.isValidObjectId(to) || to === uid) throw new HttpError(400, 'Invalid friend.');
    if (!(await User.exists({ _id: uid, friends: to }))) throw new HttpError(403, 'You can only invite friends.');
    if (!isOnline(to)) throw new HttpError(409, 'Your friend is offline right now.');
    let mine = 0;
    for (const g of games.values()) {
      if (g.status === 'finished' || !g.players.includes(uid)) continue;
      mine++;
      if (g.players.includes(to)) throw new HttpError(409, 'You already have a game with this friend.');
    }
    if (mine >= 5) throw new HttpError(409, 'Finish one of your current games first.');

    const users = await User.find({ _id: { $in: [uid, to] } }).select(PUBLIC_FIELDS).lean();
    const by = Object.fromEntries(users.map((u) => [String(u._id), { ...u, _id: String(u._id) }]));
    const g = {
      id: crypto.randomBytes(8).toString('hex'), type, players: [uid, to], users: [by[uid], by[to]],
      status: 'invited', state: null, winner: null, reason: '', h2h: { wins: [0, 0], draws: 0 }, createdAt: Date.now(),
    };
    g.timer = setTimeout(() => g.status === 'invited' && removeGame(io, g, 'expired'), INVITE_MS);
    games.set(g.id, g);
    emitGame(io, g);
    reply({ ok: true, id: g.id });
  }));

  socket.on('game:respond', wrap(socket, async ({ id, accept }, reply) => {
    const g = games.get(id);
    if (!g || g.status !== 'invited' || g.players[1] !== uid) throw new HttpError(404, 'That invite is no longer available.');
    if (!accept) { removeGame(io, g, 'declined'); return reply({ ok: true }); }
    clearTimeout(g.timer);
    g.status = 'active';
    g.state = ENGINES[g.type].init();
    if (g.state.turn !== undefined) g.state.turn = Math.random() < 0.5 ? 0 : 1;
    g.h2h = await loadH2H(g);
    emitGame(io, g);
    reply({ ok: true });
  }));

  socket.on('game:move', wrap(socket, async ({ id, move }, reply) => {
    const g = games.get(id);
    if (!g || g.status !== 'active') throw new HttpError(404, 'This game is not active.');
    const idx = seat(g, uid);
    if (idx < 0) throw new HttpError(403, 'You are not in this game.');
    const r = ENGINES[g.type].move(g.state, idx, move);
    if (r.error) throw new HttpError(400, r.error);
    if (r.winner !== undefined) await finish(io, g, r.winner, 'normal');
    else emitGame(io, g);
    reply({ ok: true });
  }));

  socket.on('game:leave', wrap(socket, async ({ id }, reply) => {
    const g = games.get(id);
    if (!g) return reply({ ok: true });
    const idx = seat(g, uid);
    if (idx < 0) throw new HttpError(403, 'You are not in this game.');
    if (g.status === 'invited') removeGame(io, g, idx === 0 ? 'cancelled' : 'declined');
    else if (g.status === 'active') await finish(io, g, 1 - idx, 'forfeit');
    reply({ ok: true });
  }));

  socket.on('game:sync', wrap(socket, async (_d, reply) => {
    reply({ games: [...games.values()].filter((g) => g.players.includes(uid) && g.status !== 'finished').map((g) => view(g, uid)) });
  }));
}
