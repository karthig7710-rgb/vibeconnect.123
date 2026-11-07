import { Play, Pause, Heart, Share2, Trash2 } from 'lucide-react';
import { useMusic } from '../context/MusicContext.jsx';
import { Equalizer } from './SongCard.jsx';
import Cover from './Cover.jsx';
import { fmtDuration } from '../api.js';

export default function TrackRow({ t, queue, onShare, onPick, onRemove }) {
  const { track, playing, play, toggle, isFav, toggleFavorite } = useMusic();
  const current = track?.trackId === t.trackId;
  return (
    <div className={`group mb-1 flex animate-rise items-center gap-3 rounded-2xl p-2 transition ${current ? 'bg-raised' : 'hover:bg-raised/60'}`}>
      <button
        onClick={() => (onPick ? onPick(t) : current ? toggle() : play(t, queue))}
        className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-edge"
        aria-label={current && playing ? `Pause ${t.title}` : `Play ${t.title}`}
      >
        <Cover src={t.artwork} className="h-full w-full" />
        {!onPick && (
          <span className={`absolute inset-0 grid place-items-center bg-black/45 text-white ${current ? '' : 'opacity-0 group-hover:opacity-100'} transition`}>
            {current && playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
          </span>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-semibold ${current ? 'text-amber-vibe' : ''}`}>{t.title}</p>
        <p className="truncate text-xs text-slate-400">{t.artist}{t.album ? ` • ${t.album}` : ''}</p>
      </div>
      {current && playing && <Equalizer />}
      <span className="hidden text-xs text-slate-500 sm:block">{t.durationMs ? fmtDuration(t.durationMs / 1000) : ''}</span>
      {!onPick && (
        <>
          <button className="icon-btn !h-9 !w-9" onClick={() => toggleFavorite(t)} aria-label={isFav(t.trackId) ? 'Remove favourite' : 'Add favourite'}>
            <Heart size={17} className={isFav(t.trackId) ? 'fill-vibe-pink text-vibe-pink' : ''} />
          </button>
          <button className="icon-btn !h-9 !w-9" onClick={() => onShare(t)} aria-label="Share with a friend"><Share2 size={17} /></button>
          {onRemove && <button className="icon-btn !h-9 !w-9" onClick={() => onRemove(t)} aria-label="Delete song"><Trash2 size={17} /></button>}
        </>
      )}
    </div>
  );
}
