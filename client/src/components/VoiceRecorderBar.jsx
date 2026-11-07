import { useEffect, useRef, useState } from 'react';
import { Trash2, Send } from 'lucide-react';
import { startRecording, recorderError, MAX_VOICE_SECONDS } from '../call/recorder.js';
import { fmtDuration } from '../api.js';

// Replaces the message box while a voice message is being recorded.
export default function VoiceRecorderBar({ onSend, onCancel, onError }) {
  const [secs, setSecs] = useState(0);
  const [ready, setReady] = useState(false);
  const [sending, setSending] = useState(false);
  const recRef = useRef(null);
  const doneRef = useRef(false);

  const finish = async () => {
    if (!recRef.current || doneRef.current) return;
    doneRef.current = true;
    setSending(true);
    try {
      const out = await recRef.current.stop();
      if (out.durationMs < 600) { onError('Hold on a little longer: the message was too short.'); return onCancel(); }
      await onSend(out);
    } catch (e) {
      onError(e?.response?.data?.error || e?.message || 'Could not send the voice message.');
    }
    onCancel();
  };

  useEffect(() => {
    let alive = true;
    startRecording({ onTick: (s) => alive && setSecs(s), onLimit: () => alive && finishRef.current() })
      .then((r) => { if (!alive) return r.cancel(); recRef.current = r; setReady(true); })
      .catch((e) => { if (alive) { onError(recorderError(e)); onCancel(); } });
    return () => { alive = false; if (!doneRef.current) recRef.current?.cancel(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const finishRef = useRef(finish);
  finishRef.current = finish;

  const cancel = () => { doneRef.current = true; recRef.current?.cancel(); onCancel(); };

  return (
    <div className="flex items-center gap-2" role="status" aria-label="Recording a voice message">
      <button type="button" className="icon-btn text-rose-300" onClick={cancel} disabled={sending} aria-label="Discard recording"><Trash2 size={20} /></button>
      <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl bg-raised px-4 py-2.5">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full bg-rose-500 ${ready ? 'animate-pulse' : 'opacity-40'}`} />
        <span className="text-sm font-semibold tabular-nums">{fmtDuration(secs)}</span>
        <span className="truncate text-xs text-slate-400">{ready ? `Recording… max ${MAX_VOICE_SECONDS / 60} min` : 'Starting microphone…'}</span>
      </div>
      <button type="button" onClick={finish} disabled={!ready || sending} aria-label="Send voice message"
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-vibe to-vibe-pink text-white transition active:scale-90 disabled:opacity-40">
        <Send size={18} />
      </button>
    </div>
  );
}
