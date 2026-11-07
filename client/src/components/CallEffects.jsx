import { useState } from 'react';
import { Lock } from 'lucide-react';
import { FILTER_LIST, VOICE_LIST } from '../catalog.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCall } from '../context/CallContext.jsx';

function Tile({ item, active, locked, onClick }) {
  return (
    <button onClick={onClick} aria-pressed={active}
      className={`relative flex w-[76px] shrink-0 flex-col items-center gap-1 rounded-2xl border p-2 text-center transition active:scale-95 ${active ? 'border-white bg-white/20' : 'border-white/15 bg-white/10'}`}>
      <span className="text-2xl">{item.emoji}</span>
      <span className="text-[11px] font-semibold leading-tight">{item.name}</span>
      {locked && <Lock size={12} className="absolute right-1.5 top-1.5 text-amber-vibe" />}
    </button>
  );
}

// Bottom sheet inside the call screen: face filters and voice changer
export default function CallEffects() {
  const { user } = useAuth();
  const { hasVideo, filter, voice, chooseFilter, chooseVoice, faceStatus } = useCall();
  const [tab, setTab] = useState(hasVideo ? 'filters' : 'voices');
  return (
    <div className="animate-rise rounded-t-3xl bg-black/85 p-3" role="region" aria-label="Effects">
      <div className="seg mb-3 !bg-white/10">
        <button className={`seg-btn ${tab === 'filters' ? 'seg-btn-on !text-white' : '!text-white/60'}`} onClick={() => setTab('filters')}>😜 Filters</button>
        <button className={`seg-btn ${tab === 'voices' ? 'seg-btn-on !text-white' : '!text-white/60'}`} onClick={() => setTab('voices')}>🎤 Voices</button>
      </div>
      {tab === 'filters' && !hasVideo && <p className="py-4 text-center text-sm text-white/70">Face filters work in video calls.</p>}
      {tab === 'filters' && hasVideo && (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {FILTER_LIST.map((f) => <Tile key={f.id} item={f} active={filter === f.id} locked={f.premium && !user.isPremium} onClick={() => chooseFilter(f.id)} />)}
          </div>
          {faceStatus === 'loading' && <p className="mt-2 text-center text-xs text-white/70">Loading face tracking (first time only)…</p>}
          {faceStatus === 'failed' && <p className="mt-2 text-center text-xs text-amber-vibe">Face tracking could not load, so filters sit in the middle of the screen.</p>}
        </>
      )}
      {tab === 'voices' && (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {VOICE_LIST.map((v) => <Tile key={v.id} item={v} active={voice === v.id} locked={v.premium && !user.isPremium} onClick={() => chooseVoice(v.id)} />)}
          </div>
          <p className="mt-2 text-center text-xs text-white/60">Use headphones to avoid echo. The other person hears the changed voice.</p>
        </>
      )}
    </div>
  );
}
