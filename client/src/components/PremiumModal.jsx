import { Crown, Check, Lock } from 'lucide-react';
import Modal from './Modal.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const FREE = ['Voice and video calls, all face filters and all voice changers', 'Voice messages, music, games, Listen Together', '10 app themes', '3 chat, 5 call and 2 profile templates'];
const PREMIUM = ['Everything in Free', '4 more chat templates (Aurora, Sakura, Galaxy, Neon Grid)', '4 more profile templates (Glass, Neon, Gold, Sakura)'];

export default function PremiumModal({ feature, onClose }) {
  const { user } = useAuth();
  return (
    <Modal title="VibeConnect Premium" onClose={onClose} z="z-[57]">
      <div className="mb-4 flex items-center gap-3 rounded-2xl bg-gradient-to-br from-amber-vibe/20 to-vibe-pink/20 p-4">
        <Crown className="shrink-0 text-amber-vibe" size={28} />
        <p className="text-sm">
          {user?.isPremium ? 'You have Premium. Everything is unlocked.'
            : feature ? <>Unlock <b>{feature}</b> and more with Premium.</> : 'Unlock extra chat and profile templates.'}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-edge p-3">
          <p className="mb-2 text-sm font-bold">Free</p>
          {FREE.map((t) => <p key={t} className="mb-1.5 flex gap-2 text-xs text-slate-300"><Check size={14} className="mt-0.5 shrink-0 text-emerald-400" />{t}</p>)}
        </div>
        <div className="rounded-2xl border border-amber-vibe/50 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-amber-vibe"><Crown size={14} /> Premium</p>
          {PREMIUM.map((t) => <p key={t} className="mb-1.5 flex gap-2 text-xs text-slate-300"><Check size={14} className="mt-0.5 shrink-0 text-amber-vibe" />{t}</p>)}
        </div>
      </div>
      {!user?.isPremium && (
        <p className="mt-4 flex gap-2 rounded-xl bg-raised p-3 text-xs text-slate-300">
          <Lock size={14} className="mt-0.5 shrink-0" />
          Online payment is not set up yet, so Premium can&apos;t be bought inside the app. The app owner can switch Premium on for your account.
        </p>
      )}
      <button className="btn-primary mt-4 w-full" onClick={onClose}>OK</button>
    </Modal>
  );
}
