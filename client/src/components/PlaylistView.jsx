import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Play, Upload, Settings } from 'lucide-react';
import { api, errMsg } from '../api.js';
import { useMusic } from '../context/MusicContext.jsx';
import TrackRow from './TrackRow.jsx';
import UploadModal from './UploadModal.jsx';
import PlaylistFormModal from './PlaylistFormModal.jsx';
import { VIS, totalLabel } from './playlistMeta.js';

export default function PlaylistView({ id, onBack, onShare }) {
  const { play } = useMusic();
  const [data, setData] = useState(null); // { playlist, songs, usage? }
  const [error, setError] = useState('');
  const [upload, setUpload] = useState(false);
  const [settings, setSettings] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.get(`/library/playlists/${id}`);
      setData(r.data);
      setError('');
    } catch (e) {
      setError(errMsg(e));
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const removeSong = async (song) => {
    if (!window.confirm(`Delete “${song.title}” from this playlist?`)) return;
    try {
      await api.delete(`/library/tracks/${song.id}`);
      load();
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const back = (
    <button className="mb-3 flex items-center gap-1.5 text-sm text-slate-400 hover:text-white" onClick={onBack}><ArrowLeft size={16} /> Playlists</button>
  );
  if (error && !data) return <div className="px-4">{back}<p className="text-sm text-rose-400">{error}</p></div>;
  if (!data) return <div className="px-4">{back}<p className="text-sm text-slate-400">Loading…</p></div>;

  const { playlist: p, songs, usage } = data;
  const { Icon, label } = VIS[p.visibility];

  return (
    <div className="px-4 pb-6">
      {back}
      <h3 className="text-xl font-extrabold">{p.name}</h3>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
        {!p.isMine && p.owner && <span>by @{p.owner.username}</span>}
        <span className="flex items-center gap-1"><Icon size={12} /> {label}</span>
        <span>{totalLabel(p.trackCount, p.durationMs)}</span>
      </p>
      {p.description && <p className="mt-2 text-sm text-slate-300">{p.description}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        <button className="btn-primary" disabled={!songs.length} onClick={() => play(songs[0], songs)}><Play size={16} fill="currentColor" /> Play all</button>
        {p.isMine && <button className="btn-ghost" onClick={() => setUpload(true)}><Upload size={16} /> Upload songs</button>}
        {p.isMine && <button className="btn-ghost" onClick={() => setSettings(true)} aria-label="Playlist settings"><Settings size={16} /></button>}
      </div>
      {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}

      <div className="mt-4">
        {songs.length === 0 && (
          <div className="rounded-2xl border border-dashed border-edge p-6 text-center">
            <p className="font-semibold">No songs here yet</p>
            <p className="mt-1 text-sm text-slate-400">{p.isMine ? 'Tap “Upload songs” to add the songs you have.' : 'The owner has not added any songs.'}</p>
          </div>
        )}
        {songs.map((s) => <TrackRow key={s.trackId} t={s} queue={songs} onShare={onShare} onRemove={p.isMine ? removeSong : undefined} />)}
      </div>

      {upload && <UploadModal playlistId={p._id} usage={usage} onClose={() => setUpload(false)} onUploaded={load} />}
      {settings && (
        <PlaylistFormModal playlist={p} onClose={() => setSettings(false)} onSaved={() => { setSettings(false); load(); }} onDeleted={onBack} />
      )}
    </div>
  );
}
