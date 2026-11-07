import { useRef, useState } from 'react';
import { Camera, Music2, MessageCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { errMsg } from '../api.js';

export default function AuthPage() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ identifier: '', username: '', email: '', password: '' });
  const [avatar, setAvatar] = useState(null);
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef();
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const pick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) return setError('Profile picture must be under 5 MB.');
    setAvatar(f);
    setPreview(URL.createObjectURL(f));
    setError('');
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') await login(form.identifier, form.password);
      else await signup({ username: form.username, email: form.email, password: form.password, avatar });
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-full lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-[#2a1458] via-[#3b1670] to-[#6b1d68] p-12 lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 h-96 w-96 animate-spinSlow rounded-full border-[28px] border-white/5" />
        <div className="absolute -bottom-32 -left-20 h-[28rem] w-[28rem] animate-spinSlow rounded-full border-[40px] border-amber-vibe/10" />
        <p className="relative text-2xl font-extrabold">VibeConnect</p>
        <div className="relative max-w-md">
          <h1 className="text-5xl font-extrabold leading-tight">Talk to your people. Share what’s playing.</h1>
          <ul className="mt-8 space-y-4 text-lg text-white/80">
            <li className="flex items-center gap-3"><MessageCircle className="text-amber-vibe" /> Instant private messages and photos</li>
            <li className="flex items-center gap-3"><Music2 className="text-amber-vibe" /> Search songs, keep favourites, send them as cards</li>
          </ul>
        </div>
        <p className="relative text-sm text-white/50">Upload your own songs and share playlists with your friends.</p>
      </div>

      <div className="flex items-center justify-center p-5 sm:p-10">
        <form onSubmit={submit} className="w-full max-w-sm animate-rise">
          <p className="mb-6 text-2xl font-extrabold lg:hidden">VibeConnect</p>
          <h2 className="text-3xl font-extrabold">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
          <p className="mt-1 text-sm text-slate-400">{mode === 'login' ? 'Log in to pick up your conversations.' : 'It takes less than a minute.'}</p>

          <div className="mt-6 space-y-3">
            {mode === 'signup' && (
              <>
                <button type="button" onClick={() => fileRef.current.click()} className="mx-auto flex flex-col items-center gap-2" aria-label="Choose profile picture">
                  <span className="grid h-20 w-20 place-items-center overflow-hidden rounded-full border-2 border-dashed border-edge bg-raised text-slate-400 transition hover:border-vibe">
                    {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <Camera />}
                  </span>
                  <span className="text-xs text-slate-400">Add a profile picture (optional)</span>
                </button>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" hidden onChange={pick} />
                <input className="input" placeholder="Username" autoComplete="username" value={form.username} onChange={set('username')} required minLength={3} maxLength={20} pattern="[A-Za-z0-9_]+" title="Letters, numbers and underscores" />
                <input className="input" type="email" placeholder="Email" autoComplete="email" value={form.email} onChange={set('email')} required />
              </>
            )}
            {mode === 'login' && <input className="input" placeholder="Email or username" autoComplete="username" value={form.identifier} onChange={set('identifier')} required />}
            <input className="input" type="password" placeholder={mode === 'signup' ? 'Password (8+ characters)' : 'Password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={form.password} onChange={set('password')} required minLength={mode === 'signup' ? 8 : 1} maxLength={72} />
          </div>

          {error && <p role="alert" className="mt-3 rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</p>}
          <button className="btn-primary mt-5 w-full !py-3" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}</button>
          <p className="mt-5 text-center text-sm text-slate-400">
            {mode === 'login' ? 'New here?' : 'Already have an account?'}{' '}
            <button type="button" className="font-semibold text-vibe-soft hover:underline" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}>
              {mode === 'login' ? 'Create an account' : 'Log in'}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
