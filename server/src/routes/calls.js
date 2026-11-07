import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { turn } from '../config.js';

const router = Router();
router.use(requireAuth);

// GET /api/calls/config -> ICE servers for WebRTC. STUN always; TURN only if configured in .env.
router.get('/config', (_req, res) => {
  const iceServers = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
  if (turn.urls.length && turn.username && turn.credential) {
    iceServers.push({ urls: turn.urls, username: turn.username, credential: turn.credential });
  }
  res.json({ iceServers, relay: iceServers.length > 1 });
});

export default router;
