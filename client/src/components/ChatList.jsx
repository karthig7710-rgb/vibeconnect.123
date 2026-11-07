import { Bell } from 'lucide-react';
import { useState } from 'react';
import { useChat } from '../context/ChatContext.jsx';
import Avatar from './Avatar.jsx';
import { timeAgo } from '../api.js';

const preview = (m, me) => {
  if (!m) return 'Say hi 👋';
  const p = m.from === me ? 'You: ' : '';
  if (m.type === 'image') return `${p}📷 Photo`;
  if (m.type === 'voice') return `${p}🎤 Voice message`;
  if (m.type === 'song') return `${p}🎵 ${m.song?.title}`;
  return p + m.text;
};

export default function ChatList({ meId, onGoFriends }) {
  const { friends, convos, activeId, setActiveId, typing } = useChat();
  const [perm, setPerm] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'denied');

  const sorted = [...friends].sort((a, b) => {
    const ta = convos[a._id]?.last?.createdAt || '';
    const tb = convos[b._id]?.last?.createdAt || '';
    return tb.localeCompare(ta) || a.username.localeCompare(b.username);
  });

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <h2 className="text-xl font-extrabold">Chats</h2>
        {perm === 'default' && (
          <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => Notification.requestPermission().then(setPerm)}>
            <Bell size={14} /> Enable alerts
          </button>
        )}
      </div>
      <div className="scroll-y flex-1 px-2 pb-2">
        {sorted.length === 0 && (
          <div className="mx-2 mt-8 rounded-2xl border border-dashed border-edge p-6 text-center">
            <p className="font-semibold">No friends yet</p>
            <p className="mt-1 text-sm text-slate-400">Search for people and send a request to start chatting.</p>
            <button className="btn-primary mt-4" onClick={onGoFriends}>Find friends</button>
          </div>
        )}
        {sorted.map((f) => {
          const c = convos[f._id];
          const active = activeId === f._id;
          return (
            <button
              key={f._id}
              onClick={() => setActiveId(f._id)}
              className={`mb-1 flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${active ? 'bg-raised' : 'hover:bg-raised/60'}`}
            >
              <Avatar user={f} size={46} showStatus />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate font-semibold">{f.username}</p>
                  {c?.last && <span className="shrink-0 text-[11px] text-slate-500">{timeAgo(c.last.createdAt)}</span>}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className={`truncate text-sm ${typing[f._id] ? 'text-vibe-soft' : c?.unread ? 'text-slate-100' : 'text-slate-400'}`}>
                    {typing[f._id] ? 'typing…' : preview(c?.last, meId)}
                  </p>
                  {c?.unread > 0 && (
                    <span className="grid h-5 min-w-5 shrink-0 animate-pop place-items-center rounded-full bg-gradient-to-r from-vibe to-vibe-pink px-1.5 text-[11px] font-bold">
                      {c.unread > 99 ? '99+' : c.unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
