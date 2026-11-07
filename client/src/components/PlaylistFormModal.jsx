import { useState } from 'react';
import Modal from './Modal.jsx';
import { api, errMsg } from '../api.js';
import { VIS } from './playlistMeta.js';

// Create a playlist (playlist = null) or edit / delete an existing one.
export default function PlaylistFormModal({ playlist, onClose, onSaved, onDeleted }) {
  const [name, setName] = useState(playlist?.name || '');
  const [description, setDescription] = useState(playlist?.description || '');
  const [visibility, setVisibility] = useState(playlist?.visibility || 'friends');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = { name, description, visibility };
      const r = playlist ? await api.patch(`/library/playlists/${playlist._id}`, body) : await api.post('/library/playlists', body);
      onSaved(r.data.playlist);
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete “${playlist.name}” and all its songs? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await api.delete(`/library/playlists/${playlist._id}`);
      onDeleted();
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  };

  return (
    <Modal title={playlist ? 'Playlist settings' : 'New playlist'} onClose={onClose}>
      <form onSubmit={save}>
        <label className="block text-xs font-semibold text-slate-400">Name</label>
        <input autoFocus className="input mt-1" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Road trip songs" />
        <label className="mt-4 block text-xs font-semibold text-slate-400">Description (optional)</label>
        <input className="input mt-1" maxLength={200} value={description} onChange={(e) => setDescription(e.target.value)} />

        <p className="mt-4 text-xs font-semibold text-slate-400">Who can listen?</p>
        <div className="mt-2 space-y-2" role="radiogroup" aria-label="Who can listen">
          {Object.entries(VIS).map(([k, { label, hint, Icon }]) => (
            <button key={k} type="button" role="radio" aria-checked={visibility === k} onClick={() => setVisibility(k)}
              className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${visibility === k ? 'border-vibe bg-raised' : 'border-edge hover:border-slate-500'}`}>
              <Icon size={18} className={visibility === k ? 'text-vibe-soft' : 'text-slate-400'} />
              <span><span className="block text-sm font-semibold">{label}</span><span className="text-xs text-slate-400">{hint}</span></span>
            </button>
          ))}
        </div>

        {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}
        <button className="btn-primary mt-4 w-full" disabled={busy || !name.trim()}>{busy ? 'Saving…' : playlist ? 'Save changes' : 'Create playlist'}</button>
        {playlist && <button type="button" className="mt-2 w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-rose-300 transition hover:bg-rose-500/10" disabled={busy} onClick={remove}>Delete playlist</button>}
      </form>
    </Modal>
  );
}
