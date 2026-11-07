import { useState } from 'react';
import { ArrowLeft, Swords } from 'lucide-react';
import { useChat } from '../context/ChatContext.jsx';
import { useGames } from '../context/GameContext.jsx';
import { GAME_INFO } from '../catalog.js';
import Avatar from './Avatar.jsx';

export default function GamesPanel() {
  const { friends, toast } = useChat();
  const { list, activeGameId, openGame, invite, respond } = useGames();
  const [pick, setPick] = useState(null); // game type being set up
  const [busy, setBusy] = useState('');

  const send = async (friend) => {
    setBusy(friend._id);
    const r = await invite(friend._id, pick);
    setBusy('');
    if (r.error) toast({ title: 'Game', body: r.error });
    else { toast({ title: 'Invite sent', body: `Waiting for ${friend.username}…` }); setPick(null); openGame(r.id); }
  };

  return (
    <div className="scroll-y h-full px-4 pb-4 pt-4">
      <h2 className="text-xl font-extrabold">Games</h2>

      {!pick && (
        <>
          {list.length > 0 && (
            <section className="mt-5">
              <h3 className="mb-2 text-xs font-semibold text-slate-400">Your games</h3>
              {list.map((g) => {
                const opp = g.players[1 - g.me];
                const info = GAME_INFO[g.type];
                const incoming = g.status === 'invited' && g.me === 1;
                return (
                  <div key={g.id} className={`mb-1.5 flex animate-rise items-center gap-3 rounded-2xl px-3 py-2.5 ${activeGameId === g.id ? 'bg-raised' : 'hover:bg-raised/60'}`}>
                    <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => openGame(g.id)}>
                      <Avatar user={opp} size={40} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{info.emoji} {info.name}</p>
                        <p className="truncate text-xs text-slate-400">
                          vs {opp.username} · {g.status === 'invited' ? (incoming ? 'wants to play' : 'waiting for reply') : g.status === 'finished' ? 'finished' : g.state?.turn === g.me ? 'your turn' : 'in progress'}
                        </p>
                      </div>
                    </button>
                    {incoming && <button className="btn-primary !px-3 !py-1.5 text-xs" onClick={async () => { const r = await respond(g.id, true); if (r?.error) toast({ title: 'Game', body: r.error }); }}>Accept</button>}
                  </div>
                );
              })}
            </section>
          )}
          <section className="mt-5">
            <h3 className="mb-2 text-xs font-semibold text-slate-400">Start a game</h3>
            <div className="space-y-2">
              {Object.entries(GAME_INFO).map(([k, g]) => (
                <button key={k} onClick={() => setPick(k)} className="flex w-full items-center gap-3 rounded-2xl border border-edge bg-panel p-3 text-left transition hover:border-vibe/60 active:scale-[.98]">
                  <span className={`grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br ${g.color} text-2xl`}>{g.emoji}</span>
                  <span className="flex-1"><span className="block font-bold">{g.name}</span><span className="text-xs text-slate-400">{g.blurb} · 2 players</span></span>
                  <Swords size={18} className="text-slate-500" />
                </button>
              ))}
            </div>
          </section>
        </>
      )}

      {pick && (
        <section className="mt-4">
          <button className="mb-3 flex items-center gap-1.5 text-sm text-slate-400 hover:text-white" onClick={() => setPick(null)}><ArrowLeft size={16} /> Back</button>
          <h3 className="font-bold">Invite a friend to {GAME_INFO[pick].name}</h3>
          <p className="mb-3 text-xs text-slate-400">Friends must be online to play in real time.</p>
          {friends.length === 0 && <p className="text-sm text-slate-500">Add friends first from the Friends tab.</p>}
          {[...friends].sort((a, b) => Number(b.online) - Number(a.online)).map((f) => (
            <div key={f._id} className="mb-1 flex items-center gap-3 rounded-2xl px-2 py-2">
              <Avatar user={f} size={40} showStatus />
              <p className="min-w-0 flex-1 truncate font-semibold">{f.username}</p>
              <button className="btn-primary !px-4 !py-1.5 text-xs" disabled={!f.online || busy === f._id} onClick={() => send(f)}>{f.online ? (busy === f._id ? '…' : 'Invite') : 'Offline'}</button>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
