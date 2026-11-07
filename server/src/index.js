import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import express from 'express';
import mongoose from 'mongoose';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { config } from './config.js';
import { initSocket } from './socket.js';
import { UPLOAD_ROOT } from './utils/upload.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import friendRoutes from './routes/friends.js';
import messageRoutes from './routes/messages.js';
import musicRoutes from './routes/music.js';
import roomRoutes from './routes/rooms.js';
import libraryRoutes from './routes/library.js';
import planRoutes from './routes/plan.js';
import callRoutes from './routes/calls.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);
const io = initSocket(server);
app.set('io', io);
app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // jsdelivr + wasm: the face-filter tracker is loaded from there the first time someone picks a filter
        scriptSrc: ["'self'", "'wasm-unsafe-eval'", 'https://cdn.jsdelivr.net'],
        workerSrc: ["'self'", 'blob:'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:', 'https://*.jamendo.com', 'https://*.mzstatic.com'],
        mediaSrc: ["'self'", 'blob:', 'https://*.jamendo.com', 'https://*.mzstatic.com', 'https://*.itunes.apple.com'],
        connectSrc: ["'self'", 'ws:', 'wss:', 'https://cdn.jsdelivr.net', 'https://storage.googleapis.com'],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
// Camera and microphone are needed for calls (this site only)
app.use((_req, res, next) => { res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), autoplay=(self)'); next(); });
app.use(cors({ origin: config.clientUrl, credentials: true }));
// Compress text responses (HTML, JS, CSS, JSON). Optional: if the package is not installed yet, the app still runs.
try {
  const { default: compression } = await import('compression');
  app.use(compression());
} catch {
  console.warn('Tip: run `npm run install:all` to enable response compression.');
}
app.use(express.json({ limit: '50kb' }));
app.use(cookieParser());

app.use('/api', rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }));
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, message: { error: 'Too many attempts. Try again in a few minutes.' } });
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/signup', authLimiter);

app.use('/uploads', express.static(UPLOAD_ROOT, { maxAge: '7d', index: false, dotfiles: 'deny' }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/music', musicRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/library', libraryRoutes);
app.use('/api/plan', planRoutes);
app.use('/api/calls', callRoutes);
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// Serve the built React app in production
const dist = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist, {
    index: false,
    setHeaders(res, file) {
      // built files have hashed names, so they can be cached for a year; the page itself must stay fresh
      if (file.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      else if (file.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
    },
  }));
  app.get('*', (_req, res) => { res.setHeader('Cache-Control', 'no-cache'); res.sendFile(path.join(dist, 'index.html')); });
}

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  if (err instanceof multer.MulterError) {
    const tooBig = req.originalUrl.startsWith('/api/library') ? `Song is too large (max ${config.maxAudioMb} MB).` : /\/voice(\/|$)/.test(req.originalUrl) ? 'Voice message is too large.' : 'Image is too large (max 5 MB).';
    const msg = err.code === 'LIMIT_FILE_SIZE' ? tooBig : 'Upload failed.';
    return res.status(400).json({ error: msg });
  }
  if (err.name === 'CastError') return res.status(400).json({ error: 'Invalid request.' });
  if (err.status) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our side.' });
});

mongoose
  .connect(config.mongoUri)
  .then(() => {
    server.listen(config.port, () => console.log(`VibeConnect API + sockets on http://localhost:${config.port}`));
  })
  .catch((e) => {
    console.error('MongoDB connection failed:', e.message);
    process.exit(1);
  });
