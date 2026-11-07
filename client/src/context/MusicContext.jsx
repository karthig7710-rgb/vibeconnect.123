import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { api } from '../api.js';
import { useChat } from './ChatContext.jsx';

// Uploaded songs use relative URLs (/api/library/stream/..) while audio.src is always absolute.
const abs = (u) => new URL(u, window.location.href).href;

const MusicCtx = createContext(null);
export const useMusic = () => useContext(MusicCtx);
// Position/length change several times a second, so they live in their own context (only the player bar reads it).
const ProgressCtx = createContext({ progress: 0, duration: 0 });
export const useMusicProgress = () => useContext(ProgressCtx);

export function MusicProvider({ children }) {
  const { toast } = useChat();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const audioRef = useRef(null);
  const queueRef = useRef([]);
  const [track, setTrack] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.8);
  const [favorites, setFavorites] = useState([]);

  useEffect(() => {
    const a = new Audio();
    a.preload = 'auto';
    a.volume = 0.8;
    audioRef.current = a;
    const onTime = () => setProgress(a.currentTime);
    const onMeta = () => setDuration(a.duration);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnd = () => next();
    const onError = () => {
      if (!a.getAttribute('src')) return;
      setPlaying(false);
      toastRef.current?.({ kind: 'error', title: 'Could not play this song', body: 'It may have been removed or you may no longer have access.' });
    };
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('play', onPlay);
    a.addEventListener('pause', onPause);
    a.addEventListener('ended', onEnd);
    a.addEventListener('error', onError);
    const onRoomPlay = () => a.pause();
    window.addEventListener('vc:room-play', onRoomPlay);
    api.get('/music/favorites').then((r) => setFavorites(r.data.favorites)).catch(() => {});
    return () => {
      a.pause();
      a.src = '';
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('play', onPlay);
      a.removeEventListener('pause', onPause);
      a.removeEventListener('ended', onEnd);
      a.removeEventListener('error', onError);
      window.removeEventListener('vc:room-play', onRoomPlay);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const play = useCallback((t, queue) => {
    const a = audioRef.current;
    if (queue) queueRef.current = queue;
    if (!queueRef.current.some((q) => q.trackId === t.trackId)) queueRef.current = [t];
    if (a.src !== abs(t.previewUrl)) {
      a.src = t.previewUrl;
      setProgress(0);
      setDuration(0);
    }
    setTrack(t);
    window.dispatchEvent(new Event('vc:personal-play'));
    a.play().catch(() => setPlaying(false));
  }, []);

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a?.src) return;
    a.paused ? a.play().catch(() => {}) : a.pause();
  }, []);

  const step = useCallback((dir) => {
    const q = queueRef.current;
    const cur = audioRef.current?.src;
    const i = q.findIndex((t) => abs(t.previewUrl) === cur);
    if (i === -1 || q.length === 0) return;
    const n = q[(i + dir + q.length) % q.length];
    play(n);
  }, [play]);
  const next = useCallback(() => step(1), [step]);
  const prev = useCallback(() => step(-1), [step]);

  const seek = useCallback((t) => { audioRef.current.currentTime = t; setProgress(t); }, []);
  const setVolume = useCallback((v) => { audioRef.current.volume = v; setVolumeState(v); }, []);

  const isFav = useCallback((id) => favorites.some((f) => f.trackId === id), [favorites]);
  const toggleFavorite = useCallback(async (t) => {
    if (isFav(t.trackId)) {
      const r = await api.delete(`/music/favorites/${encodeURIComponent(t.trackId)}`);
      setFavorites(r.data.favorites);
    } else {
      const r = await api.post('/music/favorites', t);
      setFavorites(r.data.favorites);
    }
  }, [isFav]);

  const value = useMemo(
    () => ({ track, playing, volume, favorites, play, toggle, next, prev, seek, setVolume, isFav, toggleFavorite }),
    [track, playing, volume, favorites, play, toggle, next, prev, seek, setVolume, isFav, toggleFavorite]
  );
  const progressValue = useMemo(() => ({ progress, duration }), [progress, duration]);

  return (
    <MusicCtx.Provider value={value}>
      <ProgressCtx.Provider value={progressValue}>{children}</ProgressCtx.Provider>
    </MusicCtx.Provider>
  );
}
