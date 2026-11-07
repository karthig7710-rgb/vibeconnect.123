import { useRef, useState } from 'react';
import { Upload, Check, X, AlertCircle } from 'lucide-react';
import Modal from './Modal.jsx';
import { api, errMsg } from '../api.js';
import { fmtMB } from './playlistMeta.js';

let seq = 0;

// Read a song's length in the browser (the server needs it for Listen Together timing).
function readDuration(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const a = new Audio();
    const finish = (err, value) => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      err ? reject(err) : resolve(value);
    };
    const timer = setTimeout(() => finish(new Error('timeout')), 10000);
    a.preload = 'metadata';
    a.onloadedmetadata = () => (Number.isFinite(a.duration) && a.duration > 0 ? finish(null, a.duration) : finish(new Error('no duration')));
    a.onerror = () => finish(new Error('unreadable'));
    a.src = url;
  });
}

const baseName = (name) => name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim();

export default function UploadModal({ playlistId, usage, onClose, onUploaded }) {
  const [items, setItems] = useState([]);
  const [rights, setRights] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef();

  const patch = (key, p) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...p } : i)));
  const maxBytes = usage?.maxFileBytes || 15 * 1024 * 1024;

  const addFiles = async (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    for (const file of files) {
      const key = ++seq;
      const item = { key, file, title: baseName(file.name).slice(0, 150), artist: '', status: 'ready', progress: 0, error: '', durationSec: 0 };
      if (file.size > maxBytes) { item.status = 'error'; item.error = `Too large (max ${fmtMB(maxBytes)})`; }
      setItems((l) => [...l, item]);
      if (item.status === 'error') continue;
      try {
        // eslint-disable-next-line no-await-in-loop
        const durationSec = await readDuration(file);
        patch(key, { durationSec });
      } catch {
        patch(key, { status: 'error', error: 'Could not read this audio file' });
      }
    }
  };

  const uploadAll = async () => {
    setBusy(true);
    let uploaded = 0;
    for (const it of items) {
      if (it.status === 'done' || !it.durationSec || (it.status === 'error' && !it.retry)) continue;
      patch(it.key, { status: 'uploading', progress: 0, error: '' });
      const fd = new FormData();
      fd.append('title', it.title);
      fd.append('artist', it.artist);
      fd.append('durationSec', String(it.durationSec));
      fd.append('rights', 'true');
      fd.append('audio', it.file);
      try {
        // eslint-disable-next-line no-await-in-loop
        await api.post(`/library/playlists/${playlistId}/tracks`, fd, {
          onUploadProgress: (ev) => patch(it.key, { progress: Math.min(99, Math.round((ev.loaded / (ev.total || it.file.size)) * 100)) }),
        });
        patch(it.key, { status: 'done', progress: 100 });
        uploaded++;
      } catch (err) {
        patch(it.key, { status: 'error', error: errMsg(err), retry: true });
      }
    }
    setBusy(false);
    if (uploaded) onUploaded();
  };

  const pending = items.filter((i) => i.status === 'ready' || (i.status === 'error' && i.retry));
  const canUpload = rights && !busy && pending.length > 0 && pending.every((i) => i.title.trim());

  return (
    <Modal title="Upload songs" onClose={busy ? () => {} : onClose}>
      <input ref={inputRef} type="file" multiple hidden accept="audio/*,.mp3,.m4a,.ogg,.wav,.flac" onChange={addFiles} />
      <button type="button" className="btn-ghost w-full" onClick={() => inputRef.current.click()} disabled={busy}>
        <Upload size={16} /> Choose songs from your phone or computer
      </button>
      <p className="mt-2 text-center text-xs text-slate-500">
        MP3, M4A, OGG, WAV or FLAC · up to {fmtMB(maxBytes)} each
        {usage ? ` · ${fmtMB(usage.usedBytes)} of ${fmtMB(usage.quotaBytes)} used` : ''}
      </p>

      <div className="mt-3 space-y-2">
        {items.map((it) => (
          <div key={it.key} className="rounded-2xl border border-edge bg-night/40 p-3">
            <div className="flex items-center gap-2">
              <input className="input !py-2" value={it.title} maxLength={150} disabled={busy || it.status === 'done'} placeholder="Title"
                onChange={(e) => patch(it.key, { title: e.target.value })} aria-label="Song title" />
              {it.status === 'done' && <Check size={18} className="shrink-0 text-emerald-400" />}
              {!busy && it.status !== 'done' && <button className="icon-btn !h-8 !w-8 shrink-0" aria-label="Remove" onClick={() => setItems((l) => l.filter((x) => x.key !== it.key))}><X size={15} /></button>}
            </div>
            <input className="input mt-2 !py-2" value={it.artist} maxLength={100} disabled={busy || it.status === 'done'} placeholder="Artist (optional)"
              onChange={(e) => patch(it.key, { artist: e.target.value })} aria-label="Artist" />
            {it.status === 'uploading' && (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-edge"><div className="h-full bg-amber-vibe transition-all" style={{ width: `${it.progress}%` }} /></div>
            )}
            {it.error && <p className="mt-2 flex items-center gap-1.5 text-xs text-rose-400"><AlertCircle size={13} /> {it.error}</p>}
          </div>
        ))}
      </div>

      <label className="mt-4 flex items-start gap-2.5 text-sm text-slate-300">
        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-violet-500" checked={rights} onChange={(e) => setRights(e.target.checked)} />
        <span>I made these songs, or I have permission to share them with the people who can listen to this playlist.</span>
      </label>

      <button className="btn-primary mt-4 w-full" disabled={!canUpload} onClick={uploadAll}>
        {busy ? 'Uploading…' : pending.length ? `Upload ${pending.length} song${pending.length === 1 ? '' : 's'}` : 'Upload'}
      </button>
    </Modal>
  );
}
