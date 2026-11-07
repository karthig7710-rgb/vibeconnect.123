import { Play, Pause, Heart, ExternalLink } from 'lucide-react';
import { useMusic } from '../context/MusicContext.jsx';
import Cover from './Cover.jsx';

export function Equalizer() {
  return (
    <span className="flex h-4 items-end gap-0.5" aria-hidden>
      {[0, 0.2, 0.4].map((d) => (
        <span key={d} className="w-1 animate-bars rounded-sm bg-amber-vibe" style={{ animationDelay: `${d}s`, height: '40%' }} />
      ))}
    </span>
  );
}

// Used in chat bubbles
export default function SongCard({ song, mine }) {
  const { track, playing, play, toggle, isFav, toggleFavorite } = useMusic();
  const current = track?.trackId === song.trackId;
  return (
    <div className={`w-64 max-w-full overflow-hidden rounded-2xl ${mine ? 'bg-black/25' : 'bg-night/60'}`}>
      <div className="flex items-center gap-3 p-2.5">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-raised">
          <Cover src={song.artwork} className={`h-full w-full ${current && playing ? 'scale-105' : ''} transition`} />
          <button
            onClick={() => (current ? toggle() : play(song, [song]))}
            className="absolute inset-0 grid place-items-center bg-black/40 text-white transition hover:bg-black/55"
            aria-label={current && playing ? 'Pause' : 'Play'}
          >
            {current && playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
          </button>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{song.title}</p>
          <p className="truncate text-xs text-slate-300/80">{song.artist}</p>
          <div className="mt-1 flex items-center gap-2 text-slate-300">
            {current && playing && <Equalizer />}
            <button onClick={() => toggleFavorite(song)} aria-label="Favourite" className="hover:text-white">
              <Heart size={14} className={isFav(song.trackId) ? 'fill-vibe-pink text-vibe-pink' : ''} />
            </button>
            {song.trackUrl && (
              <a href={song.trackUrl} target="_blank" rel="noopener noreferrer" aria-label="Open song page" title="Open song page" className="hover:text-white">
                <ExternalLink size={14} />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

