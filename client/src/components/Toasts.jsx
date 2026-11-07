import { X } from 'lucide-react';
import { useChat } from '../context/ChatContext.jsx';
import Avatar from './Avatar.jsx';

export default function Toasts({ onOpenChat }) {
  const { toasts, dismissToast } = useChat();
  return (
    <div className="pointer-events-none fixed right-3 top-3 z-[60] flex w-[min(92vw,340px)] flex-col gap-2" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex animate-slideIn items-center gap-3 rounded-2xl border border-edge bg-raised p-3 shadow-xl shadow-black/40"
        >
          <button
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
            onClick={() => { if (t.friendId) onOpenChat(t.friendId); dismissToast(t.id); }}
          >
            <Avatar user={{ username: t.title, avatar: t.avatar }} size={36} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{t.title}</p>
              <p className="truncate text-xs text-slate-400">{t.body}</p>
            </div>
          </button>
          {t.actions?.map((a) => (
            <button key={a.label} className={a.primary ? 'btn-primary !px-3 !py-1.5 text-xs' : 'btn-ghost !px-3 !py-1.5 text-xs'}
              onClick={() => { a.onClick(); dismissToast(t.id); }}>{a.label}</button>
          ))}
          <button className="icon-btn !h-8 !w-8" onClick={() => dismissToast(t.id)} aria-label="Dismiss"><X size={14} /></button>
        </div>
      ))}
    </div>
  );
}
