import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from './AuthContext.jsx';
import { useChat } from './ChatContext.jsx';
import { GAME_INFO } from '../catalog.js';

const Ctx = createContext(null);
export const useGames = () => useContext(Ctx);

const REASONS = {
  declined: 'Invite declined',
  expired: 'Invite expired',
  cancelled: 'Invite cancelled',
};

export function GameProvider({ children }) {
  const { user } = useAuth();
  const { socket, toast, dismissToast } = useChat();
  const [games, setGames] = useState({}); // id -> view
  const [activeGameId, setActiveGameId] = useState(null);
  const [focus, setFocus] = useState(0); // bump to ask Home to open the Games tab
  const [lbVersion, setLbVersion] = useState(0);
  const seen = useRef({}); // id -> last status, to detect transitions

  const emit = useCallback(
    (event, payload) =>
      new Promise((resolve) => {
        if (!socket) return resolve({ error: 'Not connected. Reconnecting…' });
        socket.timeout(8000).emit(event, payload, (err, res) => resolve(err ? { error: 'The server took too long to respond.' } : res || {}));
      }),
    [socket]
  );

  const openGame = useCallback((id) => { setActiveGameId(id); setFocus((n) => n + 1); }, []);

  const respond = useCallback(async (id, accept) => {
    dismissToast(`invite-${id}`);
    const r = await emit('game:respond', { id, accept });
    if (r.error) toast({ title: 'Game', body: r.error });
    else if (accept) openGame(id);
    return r;
  }, [emit, toast, dismissToast, openGame]);

  useEffect(() => {
    if (!socket || !user) return;

    const onUpdate = (g) => {
      const prev = seen.current[g.id];
      seen.current[g.id] = g.status;
      setGames((m) => ({ ...m, [g.id]: g }));
      const opp = g.players[1 - g.me];
      const name = GAME_INFO[g.type].name;

      if (g.status === 'invited' && g.me === 1 && !prev) {
        toast({
          id: `invite-${g.id}`, kind: 'friend', duration: 120000, avatar: opp.avatar,
          title: `${opp.username} invited you`, body: `Play ${name}?`,
          actions: [
            { label: 'Accept', primary: true, onClick: () => respond(g.id, true) },
            { label: 'Decline', onClick: () => respond(g.id, false) },
          ],
        });
      }
      if (g.status === 'active' && prev === 'invited') {
        if (g.me === 0) { toast({ title: `${opp.username} accepted`, body: `${name} is on!` }); setActiveGameId(g.id); setFocus((n) => n + 1); }
      }
      if (g.status === 'finished' && prev !== 'finished') setLbVersion((n) => n + 1);
    };

    const onEnded = ({ id, reason }) => {
      delete seen.current[id];
      dismissToast(`invite-${id}`);
      setGames((m) => {
        const g = m[id];
        if (g && REASONS[reason]) {
          const opp = g.players[1 - g.me];
          toast({ title: REASONS[reason], body: `${GAME_INFO[g.type].name} with ${opp.username}` });
        }
        const { [id]: _drop, ...rest } = m;
        return rest;
      });
      setActiveGameId((a) => (a === id ? null : a));
    };

    const sync = async () => {
      const r = await emit('game:sync', {});
      if (!r.games) return;
      const map = {};
      r.games.forEach((g) => { map[g.id] = g; seen.current[g.id] = g.status; });
      setGames((old) => {
        // keep recently finished games the user is still looking at
        Object.values(old).forEach((g) => { if (g.status === 'finished') map[g.id] = g; });
        return map;
      });
    };

    socket.on('game:update', onUpdate);
    socket.on('game:ended', onEnded);
    socket.on('connect', sync);
    if (socket.connected) sync();
    return () => {
      socket.off('game:update', onUpdate);
      socket.off('game:ended', onEnded);
      socket.off('connect', sync);
    };
  }, [socket, user?._id]); // eslint-disable-line

  const invite = (to, type) => emit('game:invite', { to, type });
  const move = (id, m) => emit('game:move', { id, move: m });
  const leave = (id) => emit('game:leave', { id });
  const dismiss = (id) => {
    setGames((m) => { const { [id]: _d, ...rest } = m; return rest; });
    delete seen.current[id];
    setActiveGameId((a) => (a === id ? null : a));
  };

  const list = Object.values(games).sort((a, b) => b.createdAt - a.createdAt);
  const pendingInvites = list.filter((g) => g.status === 'invited' && g.me === 1).length;

  return (
    <Ctx.Provider value={{ games, list, pendingInvites, activeGameId, setActiveGameId, openGame, focus, lbVersion, invite, respond, move, leave, dismiss }}>
      {children}
    </Ctx.Provider>
  );
}
