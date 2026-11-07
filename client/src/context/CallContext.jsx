import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { api } from '../api.js';
import { useAuth } from './AuthContext.jsx';
import { useChat } from './ChatContext.jsx';
import { LocalMedia } from '../call/media.js';
import { startRingtone } from '../call/ringtone.js';
import { FILTER_LIST, VOICE_LIST } from '../catalog.js';

const Ctx = createContext(null);
export const useCall = () => useContext(Ctx);

const FALLBACK_ICE = [{ urls: ['stun:stun.l.google.com:19302'] }];

function mediaError(e) {
  if (!window.isSecureContext) return 'Calls need a secure (https) connection. Use the https link of your app.';
  if (!navigator.mediaDevices?.getUserMedia) return 'This browser cannot make calls.';
  if (e?.name === 'NotAllowedError') return 'Microphone/camera is blocked. Click the camera icon at the right of the address bar, choose Allow, then reload and call again.';
  if (e?.name === 'NotFoundError') return 'No microphone was found on this device.';
  if (e?.name === 'NotReadableError') return 'Your microphone is being used by another app or window.';
  return `Could not start your microphone (${e?.name || 'unknown error'}).`;
}

export function CallProvider({ children }) {
  const { user } = useAuth();
  const { socket, toast } = useChat();

  const [call, setCall] = useState(null); // active / outgoing call
  const [incoming, setIncoming] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [muted, setMutedState] = useState(false);
  const [camOff, setCamOffState] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [filter, setFilterState] = useState('none');
  const [voice, setVoiceState] = useState('normal');
  const [faceStatus, setFaceStatus] = useState('');
  const [peerMedia, setPeerMedia] = useState({ muted: false, camOff: false });
  const [seconds, setSeconds] = useState(0);
  const [notice, setNotice] = useState(''); // a call problem the person must see (shown as a dialog, not a toast)

  const callRef = useRef(null);
  const incomingRef = useRef(null);
  const pcRef = useRef(null);
  const mediaRef = useRef(null);
  const sendersRef = useRef({});
  const pendingIce = useRef([]);
  const stopRing = useRef(null);
  const iceRef = useRef(null);
  const dropTimer = useRef(null);
  const premiumRef = useRef(false);
  premiumRef.current = !!user?.isPremium;
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const emit = useCallback((event, payload) => new Promise((resolve) => {
    if (!socket) return resolve({ error: 'Not connected. Reconnecting…' });
    socket.timeout(8000).emit(event, payload, (err, res) => resolve(err ? { error: 'The server took too long to respond.' } : res || {}));
  }), [socket]);

  const stopRinging = () => { stopRing.current?.(); stopRing.current = null; };

  const cleanup = useCallback((message, isError = false) => {
    stopRinging();
    clearTimeout(dropTimer.current);
    try { pcRef.current?.close(); } catch { /* already closed */ }
    pcRef.current = null;
    mediaRef.current?.stop();
    mediaRef.current = null;
    sendersRef.current = {};
    pendingIce.current = [];
    callRef.current = null;
    setCall(null); setRemoteStream(null); setLocalStream(null);
    setMutedState(false); setCamOffState(false); setSpeakerOn(true);
    setFilterState('none'); setVoiceState('normal'); setFaceStatus(''); setPeerMedia({ muted: false, camOff: false }); setSeconds(0);
    if (message && isError) setNotice(message);
    else if (message) toastRef.current?.({ title: 'Call', body: message, duration: 8000 });
  }, []);

  const iceServers = async () => {
    if (!iceRef.current) {
      try { iceRef.current = (await api.get('/calls/config')).data.iceServers; } catch { iceRef.current = FALLBACK_ICE; }
    }
    return iceRef.current;
  };

  const rebuildLocalPreview = () => {
    const m = mediaRef.current;
    if (!m) return;
    setLocalStream(new MediaStream(m.videoTrack ? [m.videoTrack] : []));
  };

  const makeMedia = (video) => new LocalMedia({
    video,
    onAudioTrack: (t) => sendersRef.current.audio?.replaceTrack(t),
    onVideoTrack: (t) => { sendersRef.current.video?.replaceTrack(t); rebuildLocalPreview(); },
    onFaceStatus: setFaceStatus,
  });

  async function createPeer(callId, initiator) {
    const pc = new RTCPeerConnection({ iceServers: await iceServers() });
    pcRef.current = pc;
    const media = mediaRef.current;
    const stream = new MediaStream();
    sendersRef.current = {};
    if (media.audioTrack) sendersRef.current.audio = pc.addTrack(media.audioTrack, stream);
    if (media.videoTrack) sendersRef.current.video = pc.addTrack(media.videoTrack, stream);

    pc.onicecandidate = (e) => { if (e.candidate) emit('call:signal', { id: callId, data: { kind: 'candidate', candidate: e.candidate.toJSON() } }); };
    pc.ontrack = (e) => setRemoteStream((prev) => {
      const s = prev || new MediaStream();
      if (!s.getTracks().includes(e.track)) s.addTrack(e.track);
      return new MediaStream(s.getTracks()); // new object so React re-renders
    });
    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      if (st === 'connected') {
        clearTimeout(dropTimer.current);
        stopRinging();
        setCall((c) => (c && c.status !== 'active' ? { ...c, status: 'active', startedAt: Date.now() } : c));
      } else if (st === 'disconnected') {
        clearTimeout(dropTimer.current);
        dropTimer.current = setTimeout(() => { if (pcRef.current === pc && pc.connectionState !== 'connected') hangup('Connection lost.'); }, 8000);
      } else if (st === 'failed') {
        hangup(iceRef.current?.length > 1 ? 'The call could not connect.' : 'The call could not connect. Your two networks may block direct calls and need a TURN server (see README).', true);
      }
    };

    if (initiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      emit('call:signal', { id: callId, data: { kind: 'offer', sdp: pc.localDescription.sdp } });
    }
    return pc;
  }

  const onSignal = async ({ id, data }) => {
    const pc = pcRef.current;
    if (!pc || callRef.current?.id !== id) return;
    try {
      if (data.kind === 'offer') {
        await pc.setRemoteDescription({ type: 'offer', sdp: data.sdp });
        for (const c of pendingIce.current.splice(0)) await pc.addIceCandidate(c).catch(() => {});
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        emit('call:signal', { id, data: { kind: 'answer', sdp: pc.localDescription.sdp } });
      } else if (data.kind === 'answer') {
        await pc.setRemoteDescription({ type: 'answer', sdp: data.sdp });
        for (const c of pendingIce.current.splice(0)) await pc.addIceCandidate(c).catch(() => {});
      } else if (data.kind === 'candidate') {
        if (pc.remoteDescription) await pc.addIceCandidate(data.candidate).catch(() => {});
        else pendingIce.current.push(data.candidate);
      }
    } catch {
      hangup('The call could not connect.');
    }
  };

  // ---------- actions ----------
  const startCall = useCallback(async (friend, video) => {
    if (callRef.current || incomingRef.current) return toast({ title: 'Call', body: 'You are already in a call.' });
    callRef.current = { id: null, peer: friend, video, dir: 'out', status: 'calling' };
    setCall(callRef.current);
    const media = (mediaRef.current = makeMedia(video));
    try {
      await media.start();
    } catch (e) {
      cleanup(mediaError(e), true);
      return;
    }
    if (video && !media.rawVideo) toastRef.current?.({ title: 'Camera not available', body: 'Starting with voice only. Another app or window may be using the camera.', duration: 9000 });
    rebuildLocalPreview();
    stopRing.current = startRingtone('outgoing');
    const res = await emit('call:invite', { to: friend._id, video });
    if (res.error) return cleanup(res.error, true);
    callRef.current = { ...callRef.current, id: res.id };
    setCall(callRef.current);
  }, [emit, toast, cleanup]); // eslint-disable-line

  const accept = useCallback(async () => {
    const inc = incomingRef.current;
    if (!inc) return;
    stopRinging();
    incomingRef.current = null;
    setIncoming(null);
    callRef.current = { id: inc.id, peer: inc.from, video: inc.video, dir: 'in', status: 'connecting' };
    setCall(callRef.current);
    const media = (mediaRef.current = makeMedia(inc.video));
    try {
      await media.start();
    } catch (e) {
      emit('call:reject', { id: inc.id });
      cleanup(mediaError(e), true);
      return;
    }
    if (inc.video && !media.rawVideo) toastRef.current?.({ title: 'Camera not available', body: 'Joining with voice only. Another app or window may be using the camera.', duration: 9000 });
    rebuildLocalPreview();
    try {
      await createPeer(inc.id, false); // ready for the offer before we tell the caller we answered
    } catch { emit('call:end', { id: inc.id }); return cleanup('The call could not connect.', true); }
    const res = await emit('call:accept', { id: inc.id });
    if (res.error) cleanup(res.error, true);
  }, [emit, cleanup]); // eslint-disable-line

  const decline = useCallback(() => {
    const inc = incomingRef.current;
    if (!inc) return;
    stopRinging();
    incomingRef.current = null;
    setIncoming(null);
    emit('call:reject', { id: inc.id });
  }, [emit]);

  function hangup(message, isError = false) {
    const c = callRef.current;
    if (c?.id) emit('call:end', { id: c.id });
    cleanup(typeof message === 'string' ? message : '', isError);
  }

  const toggleMute = () => {
    const m = mediaRef.current; if (!m) return;
    const next = !m.muted;
    m.setMuted(next); setMutedState(next);
    emit('call:media', { id: callRef.current?.id, muted: next, camOff: m.camOff });
  };
  const toggleCam = () => {
    const m = mediaRef.current; if (!m?.rawVideo) return;
    const next = !m.camOff;
    m.setCamOff(next); setCamOffState(next);
    emit('call:media', { id: callRef.current?.id, muted: m.muted, camOff: next });
  };
  const flipCamera = async () => {
    try { await mediaRef.current?.switchCamera(); } catch { toast({ title: 'Camera', body: 'Could not switch the camera.' }); }
  };

  const gate = (free, feature) => {
    if (free || premiumRef.current) return true;
    window.dispatchEvent(new CustomEvent('vc:premium', { detail: { feature } }));
    return false;
  };
  const chooseFilter = async (id) => {
    const f = FILTER_LIST.find((x) => x.id === id);
    if (!mediaRef.current?.rawVideo) return toast({ title: 'No camera', body: 'Filters need a working camera.' });
    if (!f || !gate(!f.premium, `the ${f.name} filter`)) return;
    await mediaRef.current.setFilter(id);
    setFilterState(id);
  };
  const chooseVoice = async (id) => {
    const v = VOICE_LIST.find((x) => x.id === id);
    if (!v || !mediaRef.current || !gate(!v.premium, `the ${v.name} voice`)) return;
    const ok = await mediaRef.current.setVoice(id);
    if (!ok && id !== 'normal') toast({ title: 'Voice changer', body: 'This browser does not support the voice changer.' });
    setVoiceState(ok ? id : 'normal');
  };

  // ---------- socket events ----------
  useEffect(() => {
    if (!socket) return undefined;
    const onIncoming = (inc) => {
      if (callRef.current || incomingRef.current) return;
      incomingRef.current = inc;
      setIncoming(inc);
      stopRing.current = startRingtone('incoming');
    };
    const onAccepted = async ({ id }) => {
      if (callRef.current?.id !== id) return;
      stopRinging();
      setCall((c) => (c ? { ...c, status: 'connecting' } : c));
      try { await createPeer(id, true); } catch { hangup('The call could not connect.'); }
    };
    const onEnded = ({ id, reason }) => {
      if (incomingRef.current?.id === id) {
        stopRinging(); incomingRef.current = null; setIncoming(null);
        if (reason === 'missed' || reason === 'cancelled') toastRef.current?.({ title: 'Missed call', body: 'You missed a call.' });
        return;
      }
      if (callRef.current?.id !== id) return;
      const msg = { declined: 'Call declined.', missed: 'No answer.', cancelled: 'Call cancelled.', dropped: 'Connection lost.', ended: 'Call ended.' }[reason] || 'Call ended.';
      cleanup(msg);
    };
    const onHandled = ({ id }) => { if (incomingRef.current?.id === id) { stopRinging(); incomingRef.current = null; setIncoming(null); } };
    const onMedia = ({ id, muted: m, camOff: c }) => { if (callRef.current?.id === id) setPeerMedia({ muted: m, camOff: c }); };
    const onReconnect = () => { if (callRef.current) cleanup('Connection lost.'); };
    socket.on('call:incoming', onIncoming);
    socket.on('call:accepted', onAccepted);
    socket.on('call:signal', onSignal);
    socket.on('call:ended', onEnded);
    socket.on('call:handled', onHandled);
    socket.on('call:media', onMedia);
    socket.on('connect', onReconnect);
    const bye = () => { if (callRef.current?.id) socket.emit('call:end', { id: callRef.current.id }); };
    window.addEventListener('pagehide', bye);
    return () => {
      socket.off('call:incoming', onIncoming);
      socket.off('call:accepted', onAccepted);
      socket.off('call:signal', onSignal);
      socket.off('call:ended', onEnded);
      socket.off('call:handled', onHandled);
      socket.off('call:media', onMedia);
      socket.off('connect', onReconnect);
      window.removeEventListener('pagehide', bye);
    };
  }, [socket]); // eslint-disable-line

  useEffect(() => () => { stopRinging(); mediaRef.current?.stop(); pcRef.current?.close(); }, []);

  // call timer
  useEffect(() => {
    if (call?.status !== 'active') return undefined;
    const t = setInterval(() => setSeconds(Math.floor((Date.now() - call.startedAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [call?.status, call?.startedAt]);

  const hasVideo = !!call?.video;
  return (
    <Ctx.Provider value={{
      call, incoming, remoteStream, localStream, muted, camOff, speakerOn, filter, voice, faceStatus, peerMedia, seconds, hasVideo,
      notice, dismissNotice: () => setNotice(''), startCall, accept, decline, hangup: () => hangup(''), toggleMute, toggleCam, flipCamera, setSpeakerOn, chooseFilter, chooseVoice,
      facing: mediaRef.current?.facing || 'user',
    }}>
      {children}
    </Ctx.Provider>
  );
}
