import { z } from 'zod';

const httpsUrl = z.string().url().max(600).refine((u) => u.startsWith('https://'), 'Must be https');

// Audio may only come from Jamendo (current provider) or Apple (older saved songs / chat cards).
const AUDIO_HOST = /(^|\.)(jamendo\.com|mzstatic\.com|apple\.com)$/i;
const audioUrl = httpsUrl.refine((u) => {
  try { return AUDIO_HOST.test(new URL(u).hostname); } catch { return false; }
}, 'Unsupported audio source');

// Songs uploaded to a VibeConnect playlist are streamed from this same server.
const libraryStream = z.string().regex(/^\/api\/library\/stream\/[a-f0-9]{24}$/, 'Unsupported audio source');

export const songInput = z.object({
  trackId: z.union([z.string(), z.number()]).transform(String),
  title: z.string().min(1).max(300),
  artist: z.string().max(300).default(''),
  album: z.string().max(300).default(''),
  artwork: z.union([httpsUrl, z.literal('')]).default(''),
  previewUrl: z.union([libraryStream, audioUrl]), // audio stream URL (name kept for older saved songs)
  trackUrl: z.union([httpsUrl, z.literal('')]).default(''),
  durationMs: z.number().int().min(0).max(36000000).default(0),
});

// Playable length in seconds. Older Apple songs only ever had a 30-second preview, whatever their listed length.
export function trackSeconds(t) {
  if (!t) return 30;
  if (/apple\.com|mzstatic\.com/i.test(t.previewUrl || '')) return 30;
  return t.durationMs > 0 ? t.durationMs / 1000 : 30;
}
