import { useRef, useState } from 'react';
import { Camera, Check, Crown, Palette } from 'lucide-react';
import Modal from './Modal.jsx';
import Avatar from './Avatar.jsx';
import TemplatesModal from './TemplatesModal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { errMsg } from '../api.js';
import { THEMES } from '../catalog.js';

export default function ProfileModal({ onClose }) {
  const { user, updateProfile, setTheme } = useAuth();
  const [bio, setBio] = useState(user.bio || '');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [templates, setTemplates] = useState(false);
  const inputRef = useRef();

  const pick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) return setError('Image must be under 5 MB.');
    setError('');
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const pickTheme = async (id) => {
    if (id === user.theme) return;
    setError('');
    try { await setTheme(id); } catch (e) { setError(errMsg(e)); }
  };

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await updateProfile({ bio, avatar: file });
      onClose();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Your profile" onClose={onClose}>
      <div className={`tpl-profile-${user.templates?.profile || 'classic'} flex flex-col items-center gap-3 rounded-2xl p-4`}>
        <button onClick={() => inputRef.current.click()} className="group relative rounded-full" aria-label="Change profile picture">
          <Avatar user={{ ...user, avatar: preview || user.avatar }} size={96} />
          <span className="absolute inset-0 grid place-items-center rounded-full bg-black/55 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
            <Camera size={22} />
          </span>
        </button>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" hidden onChange={pick} />
        <p className="text-lg font-bold">@{user.username}</p>
        <p className="text-xs text-white/70">{user.email}</p>
        {user.isPremium && <span className="flex items-center gap-1 rounded-full bg-black/30 px-2.5 py-0.5 text-[11px] font-semibold text-amber-vibe"><Crown size={12} /> Premium</span>}
      </div>
      <label className="mt-5 block text-xs font-semibold text-slate-400">Bio</label>
      <textarea className="input mt-1 h-24 resize-none" maxLength={160} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="What are you listening to?" />
      <p className="mt-1 text-right text-xs text-slate-500">{bio.length}/160</p>

      <label className="mt-4 block text-xs font-semibold text-slate-400">Theme <span className="font-normal text-slate-500">· all free</span></label>
      <div className="mt-2 grid grid-cols-5 gap-2" role="radiogroup" aria-label="Theme">
        {THEMES.map((t) => {
          const on = (user.theme || 'violet') === t.id;
          return (
            <button key={t.id} type="button" role="radio" aria-checked={on} aria-label={t.name} title={t.name} onClick={() => pickTheme(t.id)}
              className={`relative overflow-hidden rounded-xl border-2 transition active:scale-95 ${on ? 'border-white' : 'border-edge hover:border-slate-500'}`}>
              <span className="block h-10" style={{ background: `linear-gradient(135deg, ${t.swatch[0]} 0%, ${t.swatch[0]} 38%, ${t.swatch[1]} 38%, ${t.swatch[1]} 70%, ${t.swatch[2]} 70%)` }} />
              {on && <span className="absolute inset-0 grid place-items-center bg-black/30"><Check size={16} /></span>}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-center text-xs text-slate-400">{THEMES.find((t) => t.id === (user.theme || 'violet'))?.name}</p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" className="btn-ghost" onClick={() => setTemplates(true)}><Palette size={16} /> Templates</button>
        <button type="button" className="btn-ghost" onClick={() => window.dispatchEvent(new CustomEvent('vc:premium'))}><Crown size={16} className="text-amber-vibe" /> {user.isPremium ? 'Premium' : 'Go Premium'}</button>
      </div>
      {templates && <TemplatesModal onClose={() => setTemplates(false)} />}

      {error && <p className="mt-2 text-sm text-rose-400">{error}</p>}
      <button className="btn-primary mt-4 w-full" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save changes'}</button>
    </Modal>
  );
}
