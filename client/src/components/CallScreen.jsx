import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Video, VideoOff, Volume2, VolumeX, PhoneOff, Sparkles, SwitchCamera } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useCall } from '../context/CallContext.jsx';
import Avatar from './Avatar.jsx';
import CallEffects from './CallEffects.jsx';

const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

function Ctl({ on, danger, label, onClick, children, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-label={label} aria-pressed={on} title={label}
      className={`grid h-14 w-14 place-items-center rounded-full transition active:scale-90 disabled:opacity-40 ${danger ? 'bg-rose-600 hover:bg-rose-500' : on ? 'bg-white text-slate-900' : 'bg-white/15 hover:bg-white/25'}`}>
      {children}
    </button>
  );
}

export default function CallScreen() {
  const { user } = useAuth();
  const c = useCall();
  const { call, remoteStream, localStream, muted, camOff, speakerOn, peerMedia, seconds, hasVideo, filter } = c;
  const remoteEl = useRef();
  const localEl = useRef();
  const [effects, setEffects] = useState(false);
  const noCamera = !localStream || localStream.getVideoTracks().length === 0;

  useEffect(() => { if (remoteEl.current) remoteEl.current.srcObject = remoteStream; }, [remoteStream]);
  useEffect(() => { if (remoteEl.current) remoteEl.current.muted = !speakerOn; }, [speakerOn, remoteStream]);
  useEffect(() => { if (localEl.current) localEl.current.srcObject = localStream; }, [localStream, effects]);
  useEffect(() => { if (remoteStream) remoteEl.current?.play().catch(() => {}); }, [remoteStream]);

  if (!call) {
    return c.notice ? (
      <div className="fixed inset-0 z-[56] grid place-items-center bg-black/80 p-5" role="alertdialog" aria-label="Call problem">
        <div className="w-full max-w-sm animate-pop rounded-3xl border border-edge bg-panel p-6 text-center">
          <p className="text-lg font-bold">Call problem</p>
          <p className="mt-2 text-sm text-slate-300">{c.notice}</p>
          <button className="btn-primary mt-5 w-full" onClick={c.dismissNotice}>OK</button>
        </div>
      </div>
    ) : null;
  }
  const peer = call.peer;
  const tpl = user.templates?.call || 'plain';
  const remoteHasVideo = hasVideo && remoteStream?.getVideoTracks().some((t) => t.readyState === 'live') && !peerMedia.camOff;
  const status = call.status === 'calling' ? 'Calling…' : call.status === 'connecting' ? 'Connecting…' : fmt(seconds);

  return (
    <div className={`tpl-call-${tpl} fixed inset-0 z-[55] flex flex-col text-white`} role="dialog" aria-label="Call">
      {/* the remote element plays the sound for both voice and video calls */}
      <video ref={remoteEl} autoPlay playsInline className={remoteHasVideo ? 'absolute inset-0 h-full w-full object-cover' : 'pointer-events-none absolute h-px w-px opacity-0'} />
      {remoteHasVideo && <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/60" />}

      <header className="relative z-10 flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <div>
          <p className="text-lg font-bold drop-shadow">{peer.username}</p>
          <p className="text-sm text-white/80 drop-shadow">{call.video ? 'Video call' : 'Voice call'} · {status}</p>
        </div>
        {peerMedia.muted && <span className="flex items-center gap-1 rounded-full bg-black/40 px-3 py-1 text-xs"><MicOff size={13} /> Muted</span>}
      </header>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center">
        {!remoteHasVideo && (
          <div className="flex flex-col items-center gap-4">
            <div className={`rounded-full p-2 ${call.status === 'active' ? '' : 'animate-pulse'} ring-4 ring-white/20`}><Avatar user={peer} size={132} /></div>
            {hasVideo && call.status === 'active' && <p className="text-sm text-white/70">{peerMedia.camOff ? 'Camera is off' : 'Waiting for video…'}</p>}
          </div>
        )}
        {hasVideo && (
          <div className="absolute right-3 top-3 h-40 w-[7.5rem] overflow-hidden rounded-2xl border border-white/30 bg-black/50 shadow-xl sm:h-48 sm:w-36">
            {camOff || noCamera
              ? <div className="grid h-full place-items-center text-white/70"><VideoOff size={26} /></div>
              : <video ref={localEl} autoPlay muted playsInline className={`h-full w-full object-cover ${c.facing === 'user' ? '-scale-x-100' : ''}`} />}
            {filter !== 'none' && <span className="absolute bottom-1 left-1 rounded-full bg-black/50 px-2 py-0.5 text-[10px]">Filter on</span>}
          </div>
        )}
      </div>

      <div className="relative z-10">
        {effects && <CallEffects />}
        <div className="flex items-center justify-center gap-3 px-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
          <Ctl on={muted} label={muted ? 'Unmute microphone' : 'Mute microphone'} onClick={c.toggleMute}>{muted ? <MicOff size={22} /> : <Mic size={22} />}</Ctl>
          {hasVideo && <Ctl disabled={noCamera} on={camOff} label={camOff ? 'Turn camera on' : 'Turn camera off'} onClick={c.toggleCam}>{camOff ? <VideoOff size={22} /> : <Video size={22} />}</Ctl>}
          <Ctl on={!speakerOn} label={speakerOn ? 'Turn sound off' : 'Turn sound on'} onClick={() => c.setSpeakerOn(!speakerOn)}>{speakerOn ? <Volume2 size={22} /> : <VolumeX size={22} />}</Ctl>
          {hasVideo && <Ctl label="Switch camera" onClick={c.flipCamera}><SwitchCamera size={22} /></Ctl>}
          <Ctl on={effects} label="Filters and voices" onClick={() => setEffects((v) => !v)}><Sparkles size={22} /></Ctl>
          <Ctl danger label="End call" onClick={c.hangup}><PhoneOff size={22} /></Ctl>
        </div>
      </div>
    </div>
  );
}
