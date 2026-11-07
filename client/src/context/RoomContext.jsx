import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { api } from '../api.js';
import { useAuth } from './AuthContext.jsx';
import { useChat } from './ChatContext.jsx';
import { trackSeconds } from '../catalog.js';

const Ctx = createContext(null);
export const useRoom = () => useContext(Ctx);

export function RoomProvider({ children }) {
  const { user } = useAuth();
  const { socket, toast, dismissToast } = useChat();
  const [room, setRoom] = useState(null); // current room view (server state)
  const [rooms, setRooms] = useState([]); // rooms I host or was invited to
  const [needsTap, setNeedsTap] = useState(false);
  const [volume, setVolumeState] = useState(0.8);

  const roomRef = useRef(null);
  const offsetRef = useRef(0); // serverNow - clientNow
  const audioRef = useRef(null);
  const holdRef = useRef(false); // user chose personal music; don't auto-play the room
  const endedFor = useRef(null);
  const srcRef = useRef(''); // the preview URL currently loaded (avoids reloads on every room update)

  const emit = useCallback(
    (event, payload) =>
      new Promise((resolve) => {
        if (!socket) return resolve({ error: 'Not connected. Reconnecting…' });
        socket.timeout(8000).emit(event, payload, (err, res) => resolve(err ? { error: 'The server took too long to respond.' } : res || {}));
      }),
    [socket]
  );

  const expected = () => {
    const r = roomRef.current;
    if (!r || r.index < 0) return 0;
    const t = r.playing ? r.position + (Date.now() + offsetRef.current - r.updatedAt) / 1000 : r.position;
    return Math.max(0, Math.min(t, trackSeconds(r.queue[r.index])));
  };

  // ---- audio element -------------------------------------------------
  useEffect(() => {
    const a = new Audio();
    a.preload = 'auto';
    a.volume = 0.8;
    audioRef.current = a;
    const onEnd = () => {
      const r = roomRef.current;
      if (r && endedFor.current !== `${r.id}:${r.index}:${r.updatedAt}`) {
        endedFor.current = `${r.id}:${r.index}:${r.updatedAt}`;
        socket?.emit('room:ended', { id: r.id, index: r.index });
      }
    };
    const onPersonal = () => { holdRef.current = true; a.pause(); if (roomRef.current) setNeedsTap(true); };
    a.addEventListener('ended', onEnd);
    window.addEventListener('vc:personal-play', onPersonal);
    return () => {
      a.pause(); a.src = '';
      a.removeEventListener('ended', onEnd);
      window.removeEventListener('vc:personal-play', onPersonal);
    };
  }, [socket]);

  // Make the local audio match the room's state
  const applyState = useCallback((r) => {
    const a = audioRef.current;
    if (!a) return;
    const track = r && r.index >= 0 ? r.queue[r.index] : null;
    if (!track) { a.pause(); if (srcRef.current) { srcRef.current = ''; a.removeAttribute('src'); a.load(); } return; }

    const sync = () => {
      const target = expected();
      if (Math.abs(a.currentTime - target) > 0.5) a.currentTime = target;
      if (roomRef.current?.playing && !holdRef.current) {
        window.dispatchEvent(new Event('vc:room-play'));
        a.play().then(() => setNeedsTap(false)).catch(() => setNeedsTap(true));
      } else {
        a.pause();
        if (roomRef.current?.playing && holdRef.current) setNeedsTap(true);
      }
    };
    if (srcRef.current !== track.previewUrl) {
      srcRef.current = track.previewUrl;
      a.src = track.previewUrl;
      a.addEventListener('loadedmetadata', sync, { once: true });
      a.load();
    } else sync();
  }, []);

  const setRoomState = useCallback((r) => {
    roomRef.current = r;
    setRoom(r);
    applyState(r);
  }, [applyState]);

  // drift correction while playing
  useEffect(() => {
    if (!room) return;
    const t = setInterval(() => {
      const a = audioRef.current;
      if (!a || !roomRef.current?.playing || a.paused || holdRef.current) return;
      if (Math.abs(a.currentTime - expected()) > 0.8) a.currentTime = expected();
    }, 2500);
    return () => clearInterval(t);
  }, [!!room]); // eslint-disable-line

  // ---- clock sync ------------------------------------------------------
  const syncClock = useCallback(async () => {
    if (!socket?.connected) return;
    let best = null;
    for (let i = 0; i < 4; i++) {
      const t0 = Date.now();
      // eslint-disable-next-line no-await-in-loop
      const serverNow = await new Promise((res) => socket.timeout(3000).emit('time', (err, v) => res(err ? null : v)));
      const t1 = Date.now();
      if (serverNow == null) continue;
      const rtt = t1 - t0;
      if (!best || rtt < best.rtt) best = { rtt, offset: serverNow + rtt / 2 - t1 };
    }
    if (best) offsetRef.current = best.offset;
  }, [socket]);

  const loadRooms = useCallback(() => api.get('/rooms').then((r) => setRooms(r.data.rooms)).catch(() => {}), []);

  // ---- socket events -----------------------------------------------------
  useEffect(() => {
    if (!socket || !user) return;
    loadRooms();

    const onConnect = async () => {
      await syncClock();
      loadRooms();
      const r = roomRef.current; // rejoin after a reconnect
      if (r) {
        const res = await emit('room:join', { id: r.id });
        if (res.room) setRoomState(res.room);
        else { setRoomState(null); }
      }
    };
    const onUpdate = (r) => { if (roomRef.current?.id === r.id) setRoomState(r); loadRooms(); };
    const onInvited = ({ room: sum, from }) => {
      loadRooms();
      toast({
        id: `room-${sum.id}`, kind: 'friend', avatar: from.avatar, duration: 20000,
        title: `${from.username} invited you`, body: `Listen together in “${sum.name}”`,
        actions: [{ label: 'Join', primary: true, onClick: () => join(sum.id) }],
      });
    };
    const onClosed = ({ id, reason }) => {
      dismissToast(`room-${id}`);
      if (roomRef.current?.id === id) {
        setRoomState(null);
        toast({ title: 'Room closed', body: reason === 'empty' ? 'Nobody was listening.' : 'The host closed the room.' });
      }
      loadRooms();
    };

    socket.on('connect', onConnect);
    socket.on('room:update', onUpdate);
    socket.on('room:invited', onInvited);
    socket.on('room:closed', onClosed);
    if (socket.connected) syncClock();
    const clock = setInterval(syncClock, 30000);
    return () => {
      clearInterval(clock);
      socket.off('connect', onConnect);
      socket.off('room:update', onUpdate);
      socket.off('room:invited', onInvited);
      socket.off('room:closed', onClosed);
    };
  }, [socket, user?._id]); // eslint-disable-line

  // ---- actions -----------------------------------------------------------
  const join = useCallback(async (id, token) => {
    await syncClock();
    holdRef.current = false;
    window.dispatchEvent(new Event('vc:room-play'));
    const res = await emit('room:join', { id, token });
    if (res.error) { toast({ title: 'Listen Together', body: res.error }); loadRooms(); return res; }
    setRoomState(res.room);
    window.dispatchEvent(new CustomEvent('vc:open-room'));
    return res;
  }, [emit, syncClock, toast, loadRooms, setRoomState]);

  const create = async (name, controls) => {
    await syncClock();
    holdRef.current = false;
    const res = await emit('room:create', { name, controls });
    if (res.error) { toast({ title: 'Listen Together', body: res.error }); return res; }
    setRoomState(res.room);
    loadRooms();
    return res;
  };

  const leave = async () => {
    const r = roomRef.current;
    if (!r) return;
    setRoomState(null);
    await emit('room:leave', { id: r.id });
    loadRooms();
  };
  const closeRoom = async () => {
    const r = roomRef.current;
    if (!r) return;
    const res = await emit('room:close', { id: r.id });
    if (res.error) toast({ title: 'Listen Together', body: res.error });
  };
  const invite = async (to) => {
    const res = await emit('room:invite', { id: roomRef.current.id, to });
    if (res.error) toast({ title: 'Listen Together', body: res.error });
    return res;
  };
  // Shareable invite link (host only). Only the host's friends can join through it.
  const getLink = async (reset = false) => {
    const r = roomRef.current;
    if (!r) return null;
    const res = await emit('room:link', { id: r.id, reset });
    if (res.error) { toast({ title: 'Listen Together', body: res.error }); return null; }
    return `${window.location.origin}/?room=${r.id}&k=${res.token}`;
  };
  const control = async (action, extra = {}) => {
    const r = roomRef.current;
    if (!r) return;
    const res = await emit('room:control', { id: r.id, action, ...extra });
    if (res.error) toast({ title: 'Listen Together', body: res.error });
    return res;
  };

  // Opened from a shared link (/?room=..&k=..): join once we are connected, then tidy the address bar
  useEffect(() => {
    if (!socket || !user) return undefined;
    const params = new URLSearchParams(window.location.search);
    const id = params.get('room'), k = params.get('k');
    if (!id || !k) return undefined;
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      window.history.replaceState({}, '', window.location.pathname);
      join(id, k);
    };
    if (socket.connected) go(); else socket.once('connect', go);
    return () => socket.off('connect', go);
  }, [socket, user?._id]); // eslint-disable-line

  // browsers block autoplay until a user gesture; this runs inside a click
  const resumeAudio = () => {
    holdRef.current = false;
    window.dispatchEvent(new Event('vc:room-play'));
    const a = audioRef.current;
    const r = roomRef.current;
    if (!a || !r) return;
    if (r.playing) { a.currentTime = expected(); a.play().then(() => setNeedsTap(false)).catch(() => {}); }
    else setNeedsTap(false);
  };
  const setVolume = (v) => { audioRef.current.volume = v; setVolumeState(v); };

  const track = room && room.index >= 0 ? room.queue[room.index] : null;
  const canControl = !!room && (room.controls === 'everyone' || room.hostId === user?._id);

  return (
    <Ctx.Provider value={{ room, rooms, track, canControl, needsTap, volume, setVolume, join, create, leave, closeRoom, invite, getLink, control, resumeAudio, loadRooms, expected }}>
      {children}
    </Ctx.Provider>
  );
}
