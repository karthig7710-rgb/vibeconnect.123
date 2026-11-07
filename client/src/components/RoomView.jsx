import { useEffect, useState } from 'react';
import { ArrowLeft, Play, Pause, SkipBack, SkipForward, UserPlus, X, Plus, Search, Trash2, Volume2, Check, Link2 } from 'lucide-react';
import { api, errMsg, fmtDuration } from '../api.js';
import { useRoom } from '../context/RoomContext.jsx';
import { useChat } from '../context/ChatContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import Avatar from './Avatar.jsx';
import Modal from './Modal.jsx';
import { Equalizer } from './SongCard.jsx';
import { trackSeconds } from '../catalog.js';
import Cover from './Cover.jsx';

function InviteModal({ onClose }) {
  const { room, invite } = useRoom();
  const { friends } = useChat();
  return (
    <Modal title="Invite friends" onClose={onClose}>
      <p className="mb-3 text-xs text-slate-400">Only people you invite (or friends who get your invite link) can join this room.</p>
      {friends.length === 0 && <p className="text-sm text-slate-400">Add friends first.</p>}
      {friends.map((f) => {
        const invited = room.invited.includes(f._id) || room.members.some((m) => m._id === f._id);
        return (
          <div key={f._id} className="mb-1 flex items-center gap-3 rounded-2xl px-2 py-2">
            <Avatar user={f} size={40} showStatus />
            <p className="min-w-0 flex-1 truncate font-semibold">{f.username}</p>
            {invited ? <span className="flex items-center gap-1 text-xs text-emerald-400"><Check size={14} /> Invited</span>
              : <button className="btn-primary !px-4 !py-1.5 text-xs" onClick={() => invite(f._id)}>Invite</button>}
          </div>
        );
      })}
    </Modal>
  );
}

function AddSong() {
  const { control } = useRoom();
  const [q, setQ] = useState('');
  const [tracks, setTracks] = useState([]);
  const [err, setErr] = useState('');
  const [added, setAdded] = useState({});

  useEffect(() => {
    const t = setTimeout(() => {
      api.get('/library/songs', { params: { q: q.trim() } }).then((r) => { setTracks(r.data.tracks.slice(0, 15)); setErr(''); }).catch((e) => setErr(errMsg(e)));
    }, 400);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div>
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input className="input !pl-10" placeholder="Search songs to add" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {err && <p className="mt-2 text-sm text-rose-400">{err}</p>}
      <div className="mt-2">
        {tracks.map((t) => (
          <div key={t.trackId} className="mb-1 flex items-center gap-3 rounded-2xl p-2 hover:bg-raised/60">
            <Cover src={t.artwork} className="h-11 w-11 rounded-lg" />
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{t.title}</p><p className="truncate text-xs text-slate-400">{t.artist}</p></div>
            <button className="btn-ghost !px-3 !py-1.5 text-xs" disabled={added[t.trackId]} onClick={async () => { const r = await control('add', { track: t }); if (!r?.error) setAdded((a) => ({ ...a, [t.trackId]: true })); }}>
              {added[t.trackId] ? <Check size={14} /> : <Plus size={14} />} {added[t.trackId] ? 'Added' : 'Add'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RoomView() {
  const { user } = useAuth();
  const { getLink, room, track, canControl, needsTap, volume, setVolume, leave, closeRoom, control, resumeAudio, expected } = useRoom();
  const [invite, setInvite] = useState(false);
  const [adding, setAdding] = useState(false);
  const [now, setNow] = useState(0);
  const isHost = room.hostId === user._id;
  const { toast } = useChat();

  const shareLink = async () => {
    const url = await getLink();
    if (!url) return;
    const text = `Listen to music together with me on VibeConnect: ${room.name}`;
    try {
      if (navigator.share) { await navigator.share({ title: 'VibeConnect', text, url }); return; }
    } catch (e) { if (e?.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(url); toast({ title: 'Link copied', body: 'Send it to a friend. Only your friends can join with it.' }); }
    catch { window.prompt('Copy this link:', url); }
  };

  // smooth progress display from the shared clock
  useEffect(() => {
    const t = setInterval(() => setNow(expected()), 250);
    return () => clearInterval(t);
  }, [expected]);
  const pos = room.playing ? now : room.position;
  const total = trackSeconds(track);
  const pct = track ? Math.min(100, (pos / total) * 100) : 0;

  return (
    <div className="scroll-y h-full px-4 pb-28 pt-3 md:pb-24">
      <div className="flex items-center gap-2">
        <button className="icon-btn" onClick={leave} aria-label="Leave room"><ArrowLeft size={20} /></button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{room.name}</p>
          <p className="text-xs text-slate-400">{room.controls === 'everyone' ? 'Everyone can control' : `${room.host.username} controls playback`}</p>
        </div>
        {isHost && <button className="btn-ghost !px-3 !py-2 text-xs" onClick={shareLink} aria-label="Share invite link"><Link2 size={15} /> Link</button>}
        {isHost && <button className="btn-ghost !px-3 !py-2 text-xs" onClick={() => setInvite(true)}><UserPlus size={15} /> Invite</button>}
        {isHost && <button className="icon-btn hover:text-rose-300" aria-label="Close room for everyone" onClick={() => window.confirm('Close this room for everyone?') && closeRoom()}><X size={19} /></button>}
      </div>

      <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1" aria-label="Listeners">
        {room.members.map((m) => (
          <div key={m._id} className="flex shrink-0 items-center gap-2 rounded-full bg-raised py-1 pl-1 pr-3">
            <Avatar user={m} size={26} /><span className="text-xs font-semibold">{m.username}</span>
          </div>
        ))}
      </div>

      {needsTap && (
        <button onClick={resumeAudio} className="btn-primary mt-4 w-full animate-pop !py-3"><Volume2 size={18} /> Tap to listen in</button>
      )}

      <div className="mt-4 rounded-3xl border border-edge bg-panel p-5 text-center">
        {track ? (
          <>
            <Cover src={track.artwork} iconSize={56} className={`mx-auto h-44 w-44 rounded-2xl shadow-2xl shadow-vibe/20 transition-transform duration-500 ${room.playing ? 'scale-105' : ''}`} />
            <p className="mt-4 truncate text-lg font-extrabold">{track.title}</p>
            <p className="truncate text-sm text-slate-400">{track.artist}</p>
            <div className="mt-4">
              <input type="range" min={0} max={total} step="0.1" value={Math.min(pos, total)} disabled={!canControl}
                onChange={(e) => control('seek', { position: Number(e.target.value) })} aria-label="Seek"
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full accent-amber-400 disabled:cursor-default"
                style={{ background: `linear-gradient(90deg,rgb(var(--c-amber)) ${pct}%,rgb(var(--c-edge)) ${pct}%)` }} />
              <div className="mt-1 flex justify-between text-[11px] text-slate-500"><span>{fmtDuration(pos)}</span><span>{fmtDuration(total)}</span></div>
            </div>
            <div className="mt-2 flex items-center justify-center gap-3">
              <button className="icon-btn" disabled={!canControl} onClick={() => control('prev')} aria-label="Previous"><SkipBack size={22} /></button>
              <button className="grid h-14 w-14 place-items-center rounded-full bg-amber-vibe text-night transition active:scale-90 disabled:opacity-50" disabled={!canControl}
                onClick={() => control(room.playing ? 'pause' : 'play')} aria-label={room.playing ? 'Pause for everyone' : 'Play for everyone'}>
                {room.playing ? <Pause size={26} fill="currentColor" /> : <Play size={26} fill="currentColor" className="ml-1" />}
              </button>
              <button className="icon-btn" disabled={!canControl} onClick={() => control('next')} aria-label="Next"><SkipForward size={22} /></button>
            </div>
            <div className="mt-3 flex items-center justify-center gap-2 text-slate-400">
              <Volume2 size={15} /><input type="range" min={0} max={1} step="0.05" value={volume} onChange={(e) => setVolume(Number(e.target.value))} aria-label="Your volume" className="w-28 accent-amber-400" />
              <span className="text-[11px]">only for you</span>
            </div>
          </>
        ) : (
          <div className="py-8"><p className="text-4xl">🎶</p><p className="mt-2 font-bold">The queue is empty</p><p className="text-sm text-slate-400">Add a song and it starts playing for everyone.</p></div>
        )}
      </div>

      <div className="mt-5 flex items-center justify-between">
        <h3 className="font-bold">Up next ({room.queue.length})</h3>
        {canControl && <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => setAdding((v) => !v)}>{adding ? 'Done' : <><Plus size={14} /> Add songs</>}</button>}
      </div>
      {!canControl && <p className="mt-1 text-xs text-slate-500">Only the host can change the queue in this room.</p>}
      {adding && canControl && <div className="mt-3 animate-rise"><AddSong /></div>}
      <div className="mt-2">
        {room.queue.map((t, i) => (
          <div key={`${t.trackId}-${i}`} className={`mb-1 flex items-center gap-3 rounded-2xl p-2 ${i === room.index ? 'bg-raised' : 'hover:bg-raised/60'}`}>
            <button className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-edge disabled:cursor-default" disabled={!canControl} onClick={() => control('select', { index: i })} aria-label={`Play ${t.title}`}>
              <Cover src={t.artwork} className="h-full w-full" />
            </button>
            <div className="min-w-0 flex-1"><p className={`truncate text-sm font-semibold ${i === room.index ? 'text-amber-vibe' : ''}`}>{t.title}</p><p className="truncate text-xs text-slate-400">{t.artist}</p></div>
            {i === room.index && room.playing && <Equalizer />}
            {canControl && <button className="icon-btn !h-9 !w-9 hover:text-rose-300" onClick={() => control('remove', { index: i })} aria-label={`Remove ${t.title}`}><Trash2 size={16} /></button>}
          </div>
        ))}
      </div>
      {invite && <InviteModal onClose={() => setInvite(false)} />}
    </div>
  );
}
