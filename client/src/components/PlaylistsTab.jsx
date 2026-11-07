import { useCallback, useEffect, useState } from 'react';
import { Plus, ListMusic, ChevronRight } from 'lucide-react';
import { api, errMsg } from '../api.js';
import PlaylistView from './PlaylistView.jsx';
import PlaylistFormModal from './PlaylistFormModal.jsx';
import { VIS, fmtMB, totalLabel } from './playlistMeta.js';

const SCOPES = [['mine', 'My playlists'], ['friends', 'Friends'], ['public', 'Everyone']];
const EMPTY = {
  mine: ['No playlists yet', 'Create a playlist, then upload the songs you have.'],
  friends: ['Nothing from your friends yet', 'Playlists your friends share with friends or everyone show up here.'],
  public: ['No public playlists yet', 'Playlists that people share with everyone show up here.'],
};

export default function PlaylistsTab({ onShare }) {
  const [scope, setScope] = useState('mine');
  const [data, setData] = useState({ playlists: [], usage: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/library/playlists', { params: { scope } });
      setData({ playlists: r.data.playlists, usage: r.data.usage || null });
      setError('');
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [scope]);
  useEffect(() => { load(); }, [load]);

  if (openId) return <PlaylistView id={openId} onBack={() => { setOpenId(null); load(); }} onShare={onShare} />;

  const { playlists, usage } = data;
  return (
    <div className="px-3">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {SCOPES.map(([k, label]) => (
          <button key={k} onClick={() => setScope(k)} className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${scope === k ? 'bg-vibe text-white' : 'bg-raised text-slate-300 hover:bg-edge'}`}>{label}</button>
        ))}
      </div>

      {scope === 'mine' && (
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500">{usage ? `${fmtMB(usage.usedBytes)} of ${fmtMB(usage.quotaBytes)} used` : ''}</p>
          <button className="btn-primary !py-2" onClick={() => setCreating(true)}><Plus size={16} /> New playlist</button>
        </div>
      )}

      {loading && <p className="px-1 py-4 text-sm text-slate-400">Loading…</p>}
      {error && <p className="px-1 py-4 text-sm text-rose-400">{error}</p>}
      {!loading && !error && playlists.length === 0 && (
        <div className="mt-6 rounded-2xl border border-dashed border-edge p-6 text-center">
          <p className="font-semibold">{EMPTY[scope][0]}</p>
          <p className="mt-1 text-sm text-slate-400">{EMPTY[scope][1]}</p>
        </div>
      )}

      <div className="mt-3">
        {playlists.map((p) => {
          const { Icon } = VIS[p.visibility];
          return (
            <button key={p._id} onClick={() => setOpenId(p._id)} className="mb-1.5 flex w-full animate-rise items-center gap-3 rounded-2xl p-2 text-left transition hover:bg-raised/60">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-vibe to-vibe-pink text-white"><ListMusic size={20} /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{p.name}</span>
                <span className="flex items-center gap-1.5 truncate text-xs text-slate-400">
                  {!p.isMine && p.owner ? `@${p.owner.username} · ` : ''}{totalLabel(p.trackCount, p.durationMs)}
                  <Icon size={11} className="shrink-0" />
                </span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-slate-500" />
            </button>
          );
        })}
      </div>

      {creating && <PlaylistFormModal playlist={null} onClose={() => setCreating(false)} onSaved={(p) => { setCreating(false); setOpenId(p._id); }} />}
    </div>
  );
}
