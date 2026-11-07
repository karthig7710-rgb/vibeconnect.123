import { useState } from 'react';
import { Crown, Check } from 'lucide-react';
import Modal from './Modal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api, errMsg } from '../api.js';
import { TEMPLATE_KINDS } from '../catalog.js';

export default function TemplatesModal({ onClose }) {
  const { user, patchUser } = useAuth();
  const [kind, setKind] = useState('chat');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { hint, list } = TEMPLATE_KINDS[kind];
  const current = user.templates?.[kind];

  const pick = async (t) => {
    if (t.id === current || busy) return;
    if (t.premium && !user.isPremium) return window.dispatchEvent(new CustomEvent('vc:premium', { detail: { feature: `the ${t.name} template` } }));
    setBusy(true); setError('');
    try {
      const r = await api.put('/plan/templates', { [kind]: t.id });
      patchUser(r.data.user);
    } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <Modal title="Templates" onClose={onClose}>
      <div className="seg mb-3">
        {Object.entries(TEMPLATE_KINDS).map(([k, v]) => (
          <button key={k} className={`seg-btn ${kind === k ? 'seg-btn-on' : ''}`} onClick={() => setKind(k)}>{v.label}</button>
        ))}
      </div>
      <p className="mb-3 text-xs text-slate-400">{hint}</p>
      <div className="grid grid-cols-3 gap-3">
        {list.map((t) => (
          <button key={t.id} onClick={() => pick(t)} aria-pressed={current === t.id}
            className={`relative overflow-hidden rounded-2xl border-2 text-left transition active:scale-95 ${current === t.id ? 'border-vibe' : 'border-edge'}`}>
            <div className={`tpl-${kind}-${t.id} grid h-24 place-items-center`}>
              {kind === 'chat' && (
                <div className="w-full space-y-1.5 px-2">
                  <div className="h-3 w-2/3 rounded-lg rounded-bl-sm bg-raised" />
                  <div className="bubble-mine ml-auto h-3 w-1/2 rounded-lg rounded-br-sm bg-gradient-to-br from-vibe to-vibe-pink" />
                </div>
              )}
              {kind === 'profile' && <div className="h-9 w-9 rounded-full bg-white/30" />}
              {kind === 'call' && <div className="h-9 w-9 rounded-full bg-white/25" />}
            </div>
            <div className="flex items-center justify-between bg-panel px-2 py-1.5 text-[11px] font-semibold">
              <span className="truncate">{t.name}</span>
              {current === t.id ? <Check size={13} className="text-vibe-soft" /> : t.premium && !user.isPremium ? <Crown size={13} className="text-amber-vibe" /> : null}
            </div>
          </button>
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}
    </Modal>
  );
}
