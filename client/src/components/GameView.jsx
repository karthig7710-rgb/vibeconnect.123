import { ArrowLeft, X, RotateCcw } from 'lucide-react';
import { useGames } from '../context/GameContext.jsx';
import { useChat } from '../context/ChatContext.jsx';
import { GAME_INFO } from '../catalog.js';
import Avatar from './Avatar.jsx';

const mark = ['text-vibe-soft', 'text-amber-vibe'];

function TicTacToe({ g, onMove, myTurn }) {
  const { board, line } = g.state;
  return (
    <div className="mx-auto grid w-full max-w-xs grid-cols-3 gap-2">
      {board.map((c, i) => (
        <button key={i} disabled={!myTurn || c !== null} onClick={() => onMove(i)} aria-label={`Square ${i + 1}${c !== null ? (c === 0 ? ' X' : ' O') : ''}`}
          className={`grid aspect-square place-items-center rounded-2xl bg-raised text-5xl font-extrabold transition ${myTurn && c === null ? 'hover:bg-edge active:scale-95' : ''} ${line?.includes(i) ? 'animate-shine ring-2 ring-amber-vibe' : ''}`}>
          {c !== null && <span className={`animate-pop ${mark[c]}`}>{c === 0 ? '✕' : '○'}</span>}
        </button>
      ))}
    </div>
  );
}

function ConnectFour({ g, onMove, myTurn }) {
  const { board, line, last } = g.state;
  const colors = ['bg-vibe', 'bg-amber-vibe'];
  return (
    <div className="mx-auto w-full max-w-sm rounded-3xl bg-edge p-2.5">
      <div className="grid grid-cols-7 gap-1.5">
        {board.map((c, i) => {
          const col = i % 7;
          return (
            <button key={i} disabled={!myTurn} onClick={() => onMove(col)} aria-label={`Column ${col + 1}`}
              className={`grid aspect-square place-items-center rounded-full bg-night ${myTurn ? 'hover:bg-night/60' : ''}`}>
              {c !== null && <span className={`block h-[82%] w-[82%] rounded-full ${colors[c]} ${last === i ? 'animate-drop' : ''} ${line?.includes(i) ? 'ring-4 ring-white animate-shine' : ''}`} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const RPS = { rock: '✊', paper: '✋', scissors: '✌️', hidden: '❔' };
function Rps({ g, onMove, canPlay }) {
  const { choices, score, last, round, target } = g.state;
  const mine = choices[g.me];
  const opp = g.players[1 - g.me];
  return (
    <div className="mx-auto w-full max-w-sm text-center">
      <p className="text-sm text-slate-400">Round {Math.min(round, target * 2 - 1)} · first to {target}</p>
      <div className="my-4 flex items-center justify-center gap-6 text-5xl">
        <div><div className="grid h-24 w-24 place-items-center rounded-2xl bg-raised">{mine ? RPS[mine] : '…'}</div><p className="mt-1 text-xs text-slate-400">You · {score[g.me]}</p></div>
        <span className="text-slate-600">vs</span>
        <div><div className="grid h-24 w-24 place-items-center rounded-2xl bg-raised">{choices[1 - g.me] ? RPS.hidden : '…'}</div><p className="mt-1 text-xs text-slate-400">{opp.username} · {score[1 - g.me]}</p></div>
      </div>
      {last && (
        <p className="mb-3 animate-rise text-sm text-slate-300" key={round}>
          Last round: you {RPS[last.choices[g.me]]} vs {RPS[last.choices[1 - g.me]]} — {last.winner === 'draw' ? 'draw, go again' : last.winner === g.me ? 'you won it' : `${opp.username} won it`}
        </p>
      )}
      <div className="flex justify-center gap-3">
        {['rock', 'paper', 'scissors'].map((c) => (
          <button key={c} disabled={!canPlay || !!mine} onClick={() => onMove(c)} aria-label={c}
            className="grid h-20 w-20 place-items-center rounded-2xl bg-raised text-4xl transition hover:bg-edge active:scale-90 disabled:opacity-40">{RPS[c]}</button>
        ))}
      </div>
      {mine && g.status === 'active' && <p className="mt-3 text-sm text-slate-400">Waiting for {opp.username}…</p>}
    </div>
  );
}

export default function GameView({ onBack }) {
  const { games, activeGameId, move, leave, respond, invite, dismiss, openGame } = useGames();
  const { toast } = useChat();
  const g = games[activeGameId];
  if (!g) {
    return (
      <div className="hidden h-full place-items-center p-8 text-center md:grid">
        <div><div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-vibe to-vibe-pink text-4xl">🎮</div>
          <p className="text-lg font-bold">Challenge a friend</p><p className="mt-1 text-sm text-slate-400">Pick a game, invite someone who is online, and play in real time.</p></div>
      </div>
    );
  }
  const info = GAME_INFO[g.type];
  const opp = g.players[1 - g.me];
  const me = g.players[g.me];
  const active = g.status === 'active';
  const myTurn = active && (g.state.turn === undefined ? true : g.state.turn === g.me);
  const finished = g.status === 'finished';
  const won = finished && g.winner === g.me;
  const draw = finished && g.winner === 'draw';

  const doMove = async (m) => { const r = await move(g.id, m); if (r.error) toast({ title: 'Game', body: r.error }); };
  const rematch = async () => {
    const r = await invite(opp._id, g.type);
    if (r.error) return toast({ title: 'Rematch', body: r.error });
    dismiss(g.id); openGame(r.id);
  };
  const quit = async () => {
    if (active && !window.confirm('Leave this game? You will forfeit.')) return;
    await leave(g.id);
    if (!active) dismiss(g.id);
  };

  let status = '';
  if (g.status === 'invited') status = g.me === 0 ? `Waiting for ${opp.username} to accept…` : `${opp.username} invited you`;
  else if (active) status = g.type === 'rps' ? 'Make your pick' : myTurn ? 'Your turn' : `${opp.username}'s turn`;
  else if (draw) status = "It's a draw";
  else status = won ? 'You won! 🎉' : `${opp.username} won`;
  if (finished && g.reason === 'forfeit') status += ' (forfeit)';

  const Player = ({ u, idx }) => (
    <div className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl p-2 transition ${active && g.state.turn === idx ? 'bg-raised ring-1 ring-vibe/50' : ''}`}>
      <Avatar user={u} size={44} />
      <p className="max-w-full truncate text-sm font-semibold">{u.username}</p>
      {g.type !== 'rps' && <span className={`text-lg font-extrabold ${mark[idx]}`}>{g.type === 'ttt' ? (idx === 0 ? '✕' : '○') : <span className={`inline-block h-4 w-4 rounded-full ${idx === 0 ? 'bg-vibe' : 'bg-amber-vibe'}`} />}</span>}
    </div>
  );

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-edge bg-panel px-3 py-3">
        <button className="icon-btn md:hidden" onClick={onBack} aria-label="Back"><ArrowLeft size={20} /></button>
        <span className="text-2xl">{info.emoji}</span>
        <div className="min-w-0 flex-1"><p className="truncate font-bold">{info.name}</p><p className="text-xs text-slate-400">vs {opp.username}</p></div>
        <button className="icon-btn" onClick={quit} aria-label={active ? 'Forfeit game' : 'Close'}><X size={19} /></button>
      </header>

      <div className="scroll-y flex-1 px-4 py-5">
        <div className="mx-auto flex max-w-sm items-center gap-2">
          <Player u={me} idx={g.me} />
          <div className="shrink-0 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Series</p>
            <p className="text-xl font-extrabold tabular-nums">{g.h2h.wins[g.me]} – {g.h2h.wins[1 - g.me]}</p>
            {g.h2h.draws > 0 && <p className="text-[10px] text-slate-500">{g.h2h.draws} draws</p>}
          </div>
          <Player u={opp} idx={1 - g.me} />
        </div>

        <p className={`my-5 text-center text-lg font-bold ${finished ? (won ? 'text-emerald-400' : draw ? 'text-slate-200' : 'text-rose-300') : myTurn ? 'text-vibe-soft' : 'text-slate-300'}`} role="status" aria-live="polite">{status}</p>

        {g.status === 'invited' && g.me === 1 && (
          <div className="mx-auto flex max-w-xs gap-2"><button className="btn-primary flex-1" onClick={() => respond(g.id, true)}>Accept</button><button className="btn-ghost flex-1" onClick={() => respond(g.id, false)}>Decline</button></div>
        )}
        {g.status === 'invited' && g.me === 0 && <div className="mx-auto flex max-w-xs justify-center"><button className="btn-ghost" onClick={quit}>Cancel invite</button></div>}

        {g.state && g.type === 'ttt' && <TicTacToe g={g} onMove={doMove} myTurn={myTurn} />}
        {g.state && g.type === 'c4' && <ConnectFour g={g} onMove={doMove} myTurn={myTurn} />}
        {g.state && g.type === 'rps' && <Rps g={g} onMove={doMove} canPlay={active} />}

        {finished && (
          <div className="mx-auto mt-6 max-w-xs animate-rise space-y-3">
            <div className="flex gap-2">
              <button className="btn-primary flex-1" onClick={rematch}><RotateCcw size={16} /> Rematch</button>
              <button className="btn-ghost flex-1" onClick={() => dismiss(g.id)}>Close</button>
            </div>
          </div>
        )}
        {active && <div className="mt-8 text-center"><button className="text-xs text-slate-500 hover:text-rose-300" onClick={quit}>Forfeit game</button></div>}
      </div>
    </div>
  );
}
