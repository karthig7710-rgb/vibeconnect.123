import { Play, Pause, SkipBack, SkipForward, Heart, Volume2 } from 'lucide-react';
import { useMusic, useMusicProgress } from '../context/MusicContext.jsx';
import { fmtDuration } from '../api.js';
import { useRoom } from '../context/RoomContext.jsx';
import Cover from './Cover.jsx';

export default function PlayerBar({ navHidden }) {
  const { room } = useRoom();
  const { progress, duration } = useMusicProgress();
  const { track, playing, volume, toggle, next, prev, seek, setVolume, isFav, toggleFavorite } = useMusic();
  if (!track || room) return null;
  const pct = duration ? (progress / duration) * 100 : 0;
  return (
    <div className={`fixed inset-x-0 ${navHidden ? 'bottom-0' : 'bottom-[calc(56px+env(safe-area-inset-bottom))]'} z-30 animate-rise border-t border-edge bg-panel md:bottom-0`}>
      <input
        type="range" min={0} max={duration || 0} step="0.1" value={progress}
        onChange={(e) => seek(Number(e.target.value))}
        aria-label="Seek"
        className="absolute -top-2 left-0 h-4 w-full cursor-pointer appearance-none bg-transparent accent-amber-400 [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:bg-edge [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:-mt-1 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber-vibe"
        style={{ background: `linear-gradient(90deg,rgb(var(--c-amber)) ${pct}%,transparent ${pct}%)`, height: 4, top: -2 }}
      />
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-3 py-2.5">
        <Cover src={track.artwork} className={`h-11 w-11 rounded-lg ${playing ? 'shadow-lg shadow-amber-vibe/20' : ''}`} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{track.title}</p>
          <p className="truncate text-xs text-slate-400">{track.artist} <span className="text-slate-600">• {fmtDuration(progress)} / {fmtDuration(duration || (track.durationMs ? track.durationMs / 1000 : 0))}</span></p>
        </div>
        <button className="icon-btn hidden sm:grid" onClick={() => toggleFavorite(track)} aria-label="Favourite">
          <Heart size={18} className={isFav(track.trackId) ? 'fill-vibe-pink text-vibe-pink' : ''} />
        </button>
        <button className="icon-btn" onClick={prev} aria-label="Previous"><SkipBack size={18} /></button>
        <button className="grid h-11 w-11 place-items-center rounded-full bg-amber-vibe text-night transition active:scale-90" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
        </button>
        <button className="icon-btn" onClick={next} aria-label="Next"><SkipForward size={18} /></button>
        <div className="hidden items-center gap-2 lg:flex">
          <Volume2 size={16} className="text-slate-400" />
          <input type="range" min={0} max={1} step="0.05" value={volume} onChange={(e) => setVolume(Number(e.target.value))} aria-label="Volume" className="w-24 accent-amber-400" />
        </div>
      </div>
    </div>
  );
}
