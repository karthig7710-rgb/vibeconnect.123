// Records a voice message with the microphone (MediaRecorder).
export const MAX_VOICE_SECONDS = 120;

const TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
export const pickMime = () => (typeof MediaRecorder !== 'undefined' && TYPES.find((t) => MediaRecorder.isTypeSupported(t))) || '';

export function recorderError(e) {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return 'Voice messages need a secure (https) connection and a browser that can record.';
  if (e?.name === 'NotAllowedError') return 'Microphone is blocked. Click the icon at the right of the address bar, choose Allow, then try again.';
  if (e?.name === 'NotFoundError') return 'No microphone was found.';
  if (e?.name === 'NotReadableError') return 'Your microphone is being used by another app.';
  return 'Could not start recording.';
}

// Returns { stop(): Promise<{ blob, durationMs, mime }>, cancel() }.  onTick(seconds) runs every 250 ms.
export async function startRecording({ onTick, onLimit }) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  const mimeType = pickMime();
  const rec = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 32000 });
  const chunks = [];
  rec.ondataavailable = (e) => e.data?.size && chunks.push(e.data);
  const started = Date.now();
  let finished = false;
  const release = () => { clearInterval(timer); stream.getTracks().forEach((t) => t.stop()); };
  const timer = setInterval(() => {
    const s = (Date.now() - started) / 1000;
    onTick?.(s);
    if (s >= MAX_VOICE_SECONDS && !finished) onLimit?.();
  }, 250);
  rec.start(1000);

  return {
    stop: () => new Promise((resolve, reject) => {
      if (finished) return reject(new Error('already stopped'));
      finished = true;
      rec.onstop = () => {
        release();
        const durationMs = Math.min(Date.now() - started, MAX_VOICE_SECONDS * 1000);
        const type = rec.mimeType || mimeType || 'audio/webm';
        resolve({ blob: new Blob(chunks, { type }), durationMs, mime: type });
      };
      rec.onerror = () => { release(); reject(new Error('recording failed')); };
      if (rec.state !== 'inactive') rec.stop(); else rec.onstop();
    }),
    cancel: () => {
      finished = true;
      rec.ondataavailable = null;
      rec.onstop = null;
      try { if (rec.state !== 'inactive') rec.stop(); } catch { /* already stopped */ }
      release();
    },
  };
}
