import { useEffect, useState } from 'react';
import { Search, Heart, Music2, ListMusic } from 'lucide-react';
import { api, errMsg } from '../api.js';
import { useMusic } from '../context/MusicContext.jsx';
import TrackRow from './TrackRow.jsx';
import ShareSongModal from './ShareSongModal.jsx';
import RoomsPanel from './RoomsPanel.jsx';
import PlaylistsTab from './PlaylistsTab.jsx';
import { useRoom } from '../context/RoomContext.jsx';

export default function MusicPanel() {
  const { favorites } = useMusic();
  const [q, setQ] = useState('');
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('songs');
  const [share, setShare] = useState(null);
  const { room } = useRoom();
  const [mode, setMode] = useState(room ? 'together' : 'solo');

  useEffect(() => {
    const open = () => setMode('together');
    window.addEventListener('vc:open-room', open);
    return () => window.removeEventListener('vc:open-room', open);
  }, []);

  useEffect(() => {
    if (tab === 'playlists' || tab === 'favs') return undefined;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await api.get('/library/songs', { params: { q: q.trim() } });
        setTracks(r.data.tracks);
        setError('');
      } catch (e) {
        setError(errMsg(e));
      } finally {
        setLoading(false);
      }
    }, q.trim() ? 350 : 0);
    return () => clearTimeout(t);
  }, [q, tab]);

  const list = tab === 'songs' ? tracks : favorites;

  const modeSwitch = (
    <div className="seg mt-3">
      <button className={`seg-btn ${mode === 'solo' ? 'seg-btn-on' : ''}`} onClick={() => setMode('solo')}>Solo</button>
      <button className={`seg-btn ${mode === 'together' ? 'seg-btn-on' : ''}`} onClick={() => setMode('together')}>🎧 Listen Together{room ? ' •' : ''}</button>
    </div>
  );

  if (mode === 'together') {
    return (
      <div className="flex h-full flex-col">
        <div className="px-4 pt-4"><h2 className="text-xl font-extrabold">Music</h2>{modeSwitch}</div>
        <div className="min-h-0 flex-1"><RoomsPanel /></div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-4">
        <h2 className="text-xl font-extrabold">Music</h2>
        {modeSwitch}
        {tab === 'songs' && <div className="relative mt-3">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input className="input !pl-10" placeholder="Search songs shared with you" value={q} onChange={(e) => { setQ(e.target.value); setTab('songs'); }} />
        </div>}
        <div className="mt-3 flex gap-2">
          {[['songs', 'All songs', Music2], ['playlists', 'Playlists', ListMusic], ['favs', `Favourites (${favorites.length})`, Heart]].map(([k, label, Icon]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${tab === k ? 'bg-amber-vibe text-night' : 'bg-raised text-slate-300 hover:bg-edge'}`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      </div>
      <div className="scroll-y mt-3 flex-1 px-2 pb-28 md:pb-24">
        {tab === 'playlists' && <PlaylistsTab onShare={setShare} />}
        {tab === 'songs' && !q.trim() && !loading && !error && tracks.length === 0 && <Empty title="No songs yet" body="Open Playlists, make a playlist and upload your songs. Songs from your friends and public playlists show up here." />}
        {tab === 'songs' && loading && <p className="px-3 py-4 text-sm text-slate-400">Searching…</p>}
        {error && tab === 'songs' && <p className="px-3 py-4 text-sm text-rose-400">{error}</p>}
        {tab === 'songs' && q.trim() && !loading && !error && tracks.length === 0 && <Empty title="No songs found" body="Try a different spelling or another artist." />}
        {tab === 'favs' && favorites.length === 0 && <Empty title="No favourites yet" body="Tap the heart on any song to save it here." />}
        {tab !== 'playlists' && list.map((t) => <TrackRow key={t.trackId} t={t} queue={list} onShare={setShare} />)}
      </div>
      {share && <ShareSongModal song={share} onClose={() => setShare(null)} />}
    </div>
  );
}

function Empty({ title, body }) {
  return (
    <div className="mx-3 mt-8 rounded-2xl border border-dashed border-edge p-6 text-center">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-slate-400">{body}</p>
    </div>
  );
}
