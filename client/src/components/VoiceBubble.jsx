import { useEffect, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';
import { fmtDuration } from '../api.js';

const SPEEDS = [1, 1.5, 2];

// Plays one voice message. Only one plays at a time.
export default function VoiceBubble({ m, mine }) {
  const total = (m.voice?.durationMs || 0) / 1000;
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [failed, setFailed] = useState(false);
  const audioRef = useRef(null);

  const get = () => {
    if (!audioRef.current) {
      const a = new Audio();
      a.preload = 'none';
      a.src = `/api/messages/voice/${m._id}`;
      a.addEventListener('timeupdate', () => setPos(a.currentTime));
      a.addEventListener('play', () => setPlaying(true));
      a.addEventListener('pause', () => setPlaying(false));
      a.addEventListener('ended', () => { setPlaying(false); setPos(0); });
      a.addEventListener('error', () => { setPlaying(false); setFailed(true); });
      audioRef.current = a;
    }
    return audioRef.current;
  };

  useEffect(() => {
    const stopOthers = (e) => { if (e.detail !== m._id) audioRef.current?.pause(); };
    window.addEventListener('vc:voice-play', stopOthers);
    return () => {
      window.removeEventListener('vc:voice-play', stopOthers);
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, [m._id]);

  const toggle = () => {
    const a = get();
    if (a.paused) {
      setFailed(false);
      window.dispatchEvent(new CustomEvent('vc:voice-play', { detail: m._id }));
      a.playbackRate = speed;
      a.play().catch(() => setFailed(true));
    } else a.pause();
  };
  const seek = (e) => {
    const a = get();
    const t = Number(e.target.value);
    try { a.currentTime = t; } catch { /* not loaded yet */ }
    setPos(t);
  };
  const cycle = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };
  const shown = Math.min(pos, total);

  return (
    <div className="flex w-56 items-center gap-2.5 py-1 sm:w-64">
      <button onClick={toggle} aria-label={playing ? 'Pause voice message' : 'Play voice message'}
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-full transition active:scale-90 ${mine ? 'bg-white/25' : 'bg-vibe text-white'}`}>
        {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
      </button>
      <div className="min-w-0 flex-1">
        <input type="range" min={0} max={total || 1} step="0.1" value={shown} onChange={seek} aria-label="Voice message position"
          className={`h-1.5 w-full cursor-pointer appearance-none rounded-full ${mine ? 'accent-white' : 'accent-violet-400'}`}
          style={{ background: `linear-gradient(90deg, ${mine ? 'rgba(255,255,255,.95)' : 'rgb(var(--c-vibe))'} ${(shown / (total || 1)) * 100}%, ${mine ? 'rgba(255,255,255,.3)' : 'rgb(var(--c-edge))'} 0)` }} />
        <div className={`mt-1 flex justify-between text-[11px] tabular-nums ${mine ? 'text-white/80' : 'text-slate-400'}`}>
          <span>{failed ? 'Could not play' : fmtDuration(playing || pos ? shown : total)}</span>
          <button onClick={cycle} className="rounded-full px-1.5 font-semibold" aria-label="Playback speed">{speed}x</button>
        </div>
      </div>
    </div>
  );
}
