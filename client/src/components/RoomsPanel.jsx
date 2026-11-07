import { useState } from 'react';
import { Headphones, Plus, Users } from 'lucide-react';
import { useRoom } from '../context/RoomContext.jsx';
import Avatar from './Avatar.jsx';
import RoomView from './RoomView.jsx';

export default function RoomsPanel() {
  const { room, rooms, create, join } = useRoom();
  const [name, setName] = useState('');
  const [controls, setControls] = useState('everyone');
  const [busy, setBusy] = useState(false);

  if (room) return <RoomView />;

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const r = await create(name.trim(), controls);
    setBusy(false);
    if (!r.error) setName('');
  };

  return (
    <div className="scroll-y h-full px-4 pb-28 pt-3 md:pb-24">
      <section className="rounded-3xl bg-gradient-to-br from-vibe/25 to-vibe-pink/20 p-4">
        <div className="flex items-center gap-2"><Headphones size={20} className="text-vibe-soft" /><h3 className="font-bold">Listen Together</h3></div>
        <p className="mt-1 text-sm text-slate-300">Create a private room, invite friends, and hear the same song at the same moment. Play, pause and skip stay in sync for everyone.</p>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <input className="input" placeholder="Room name (e.g. Friday chill)" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
          <div className="seg">
            <button type="button" className={`seg-btn ${controls === 'everyone' ? 'seg-btn-on' : ''}`} onClick={() => setControls('everyone')}>Everyone controls</button>
            <button type="button" className={`seg-btn ${controls === 'host' ? 'seg-btn-on' : ''}`} onClick={() => setControls('host')}>Only me</button>
          </div>
          <button className="btn-primary w-full" disabled={busy || !name.trim()}><Plus size={16} /> {busy ? 'Creating…' : 'Create private room'}</button>
        </form>
      </section>

      <h3 className="mb-2 mt-6 text-xs font-semibold text-slate-400">Your rooms &amp; invitations</h3>
      {rooms.length === 0 && (
        <div className="rounded-2xl border border-dashed border-edge p-6 text-center">
          <p className="font-semibold">No rooms yet</p>
          <p className="mt-1 text-sm text-slate-400">Create one above, or wait for a friend to invite you.</p>
        </div>
      )}
      {rooms.map((r) => (
        <div key={r.id} className="mb-2 flex animate-rise items-center gap-3 rounded-2xl border border-edge bg-panel p-3">
          <Avatar user={r.host} size={44} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{r.name}</p>
            <p className="truncate text-xs text-slate-400">
              {r.isHost ? 'You are hosting' : `Hosted by ${r.host.username}`} · <Users size={11} className="inline" /> {r.memberCount}
              {r.nowPlaying ? ` · ♪ ${r.nowPlaying}` : ''}
            </p>
          </div>
          <button className="btn-primary !px-4 !py-1.5 text-xs" onClick={() => join(r.id)}>{r.isHost ? 'Open' : 'Join'}</button>
        </div>
      ))}
    </div>
  );
}
