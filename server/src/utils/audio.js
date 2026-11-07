// Dependency-free helpers for uploaded songs.

// Identify the real audio format from the first bytes (never trust the file extension or the browser's MIME type).
export function detectAudio(b) {
  if (!b || b.length < 12) return null;
  const head = b.subarray(0, 4).toString('latin1');
  if (head === 'OggS') return { mime: 'audio/ogg', ext: 'ogg' };
  if (head === 'fLaC') return { mime: 'audio/flac', ext: 'flac' };
  if (head === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WAVE') return { mime: 'audio/wav', ext: 'wav' };
  if (b.subarray(4, 8).toString('latin1') === 'ftyp') return { mime: 'audio/mp4', ext: 'm4a' };
  if (b.subarray(0, 3).toString('latin1') === 'ID3') return { mime: 'audio/mpeg', ext: 'mp3' };
  if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) return { mime: 'audio/mpeg', ext: 'mp3' }; // MPEG frame sync
  return null;
}

// Voice notes are recorded by the browser: WebM/Opus (Chrome, Firefox, Android) or MP4/AAC (Safari/iPhone), sometimes OGG.
export function detectVoice(b) {
  if (b && b.length >= 12 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { mime: 'audio/webm', ext: 'webm' };
  return detectAudio(b);
}

// Parse a single HTTP Range header ("bytes=0-99", "bytes=100-", "bytes=-500").
// Returns null (serve the whole file), 'unsatisfiable' (416), or { start, end } (inclusive).
export function parseRange(header, size) {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(header).trim());
  if (!m || (m[1] === '' && m[2] === '')) return null;
  let start;
  let end;
  if (m[1] === '') {
    const n = Number(m[2]);
    if (n === 0) return 'unsatisfiable';
    start = Math.max(size - n, 0);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start >= size || start > end) return 'unsatisfiable';
  return { start, end };
}

// Shape an uploaded track like every other song in the app (chat cards, favourites, rooms, player).
// `previewUrl` is a same-origin path; the stream route checks who is allowed to listen.
export function trackToSong(t, { album = '', uploader = '' } = {}) {
  return {
    trackId: `up-${t._id}`,
    title: t.title,
    artist: t.artist || '',
    album,
    artwork: '',
    previewUrl: `/api/library/stream/${t._id}`,
    trackUrl: '',
    durationMs: t.durationMs,
    uploader,
  };
}
