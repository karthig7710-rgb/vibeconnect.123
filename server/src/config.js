import 'dotenv/config';

const required = ['MONGO_URI', 'JWT_SECRET'];
for (const k of required) {
  if (!process.env[k]) {
    console.error(`Missing environment variable: ${k}. Copy .env.example to .env and fill it in.`);
    process.exit(1);
  }
}
if (process.env.JWT_SECRET.length < 24) {
  console.error('JWT_SECRET must be at least 24 characters.');
  process.exit(1);
}

export const config = {
  port: Number(process.env.PORT) || 5000,
  isProd: process.env.NODE_ENV === 'production',
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  cookieName: 'vc_token',
  maxAudioMb: Number(process.env.MAX_AUDIO_MB) || 15, // largest single uploaded song
  userQuotaMb: Number(process.env.USER_AUDIO_QUOTA_MB) || 100, // total songs per user
};

// Premium has no payment provider yet: the app owner switches it on per user (comma-separated usernames).
export const premiumUsernames = (process.env.PREMIUM_USERNAMES || '')
  .split(',')
  .map((x) => x.trim().toLowerCase())
  .filter(Boolean);

// Optional TURN relay so calls also work on strict mobile/corporate networks.
export const turn = {
  urls: (process.env.TURN_URLS || '').split(',').map((x) => x.trim()).filter(Boolean),
  username: process.env.TURN_USERNAME || '',
  credential: process.env.TURN_CREDENTIAL || '',
};
