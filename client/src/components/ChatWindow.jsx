import { lazy, memo, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, Send, ImagePlus, Smile, Music2, X, CheckCheck, Check, Search, Pencil, Phone, Video, Mic } from 'lucide-react';
import { useChat } from '../context/ChatContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useCall } from '../context/CallContext.jsx';
import Avatar from './Avatar.jsx';
import SongCard from './SongCard.jsx';
import VoiceBubble from './VoiceBubble.jsx';
import VoiceRecorderBar from './VoiceRecorderBar.jsx';
import TrackRow from './TrackRow.jsx';
import Modal from './Modal.jsx';
import { api, errMsg, timeShort, timeAgo } from '../api.js';

const EmojiPicker = lazy(() => import('emoji-picker-react'));

function dayLabel(d) {
  const date = new Date(d);
  const today = new Date();
  const y = new Date(); y.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === y.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

const Bubble = memo(function Bubble({ m, mine, onImage, onEdit, editing }) {
  const canEdit = mine && m.type === 'text';
  return (
    <div className={`group flex animate-rise items-center gap-1 ${mine ? 'justify-end' : 'justify-start'}`}>
      {canEdit && (
        <button
          onClick={() => onEdit(m)}
          aria-label="Edit message"
          title="Edit message"
          className="icon-btn !h-8 !w-8 shrink-0 opacity-0 transition focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-50"
        >
          <Pencil size={14} />
        </button>
      )}
      <div
        className={`max-w-[82%] rounded-2xl px-3 py-2 sm:max-w-[70%] ${
          mine ? 'bubble-mine rounded-br-md bg-gradient-to-br from-vibe to-vibe-pink text-white' : 'rounded-bl-md bg-raised text-slate-100'
        } ${editing ? 'ring-2 ring-white/70' : ''}`}
      >
        {m.type === 'image' && (
          <button onClick={() => onImage(m.image)} className="-mx-1 -mt-0.5 mb-1 block overflow-hidden rounded-xl">
            <img src={m.image} alt="Shared photo" className="max-h-72 w-full object-cover" loading="lazy" />
          </button>
        )}
        {m.type === 'song' && <div className="mb-1"><SongCard song={m.song} mine={mine} /></div>}
        {m.type === 'voice' && <VoiceBubble m={m} mine={mine} />}
        {m.text && <p className="whitespace-pre-wrap break-words text-[15px] leading-snug">{m.text}</p>}
        <div className={`mt-0.5 flex items-center justify-end gap-1 text-[10px] ${mine ? 'text-white/70' : 'text-slate-500'}`}>
          {m.editedAt && <span title={`Edited ${timeShort(m.editedAt)}`}>edited</span>}
          {timeShort(m.createdAt)}
          {mine && (m.read ? <CheckCheck size={12} className="text-sky-200" /> : <Check size={12} />)}
        </div>
      </div>
    </div>
  );
}, (a, b) => a.m === b.m && a.mine === b.mine && a.editing === b.editing); // callbacks are stable (see ChatWindow)

function SongPicker({ onClose, onSend }) {
  const [q, setQ] = useState('');
  const [tracks, setTracks] = useState([]);
  const [err, setErr] = useState('');
  useEffect(() => {
    const t = setTimeout(() => {
      api.get('/library/songs', { params: { q: q.trim() } }).then((r) => { setTracks(r.data.tracks); setErr(''); }).catch((e) => setErr(errMsg(e)));
    }, 400);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <Modal title="Send a song" onClose={onClose}>
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input autoFocus className="input !pl-10" placeholder="Search your library" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {err && <p className="mt-2 text-sm text-rose-400">{err}</p>}
      <div className="mt-3">
        {tracks.map((t) => <TrackRow key={t.trackId} t={t} onPick={(s) => { onSend(s); onClose(); }} />)}
        {tracks.length === 0 && !err && <p className="py-4 text-center text-sm text-slate-500">No songs yet. Upload songs in Music → Playlists, then send them here. Only people who can open that playlist can play the card.</p>}
      </div>
    </Modal>
  );
}

export default function ChatWindow({ onBack }) {
  const { user } = useAuth();
  const { startCall } = useCall();
  const { friends, activeId, messages, hasMore, typing, loadMessages, sendMessage, sendVoice, editMessage, emitTyping, toast } = useChat();
  const friend = friends.find((f) => f._id === activeId);
  const list = messages[activeId];

  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [emoji, setEmoji] = useState(false);
  const [picker, setPicker] = useState(false);
  const [lightbox, setLightbox] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [editing, setEditing] = useState(null); // the message being edited, or null
  const [recording, setRecording] = useState(false);

  const scroller = useRef();
  const bottom = useRef();
  const fileRef = useRef();
  const inputRef = useRef();
  const typingState = useRef(false);
  const typingTimer = useRef();
  const keepScroll = useRef(null);

  // load history on open
  useEffect(() => {
    setText(''); setFile(null); setPreview(''); setEmoji(false); setEditing(null); setRecording(false);
    if (activeId && !messages[activeId]) loadMessages(activeId).catch((e) => toast({ title: 'Could not load messages', body: errMsg(e) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  // scroll handling: stick to bottom for new messages, preserve position when older ones are prepended
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (keepScroll.current != null) {
      el.scrollTop = el.scrollHeight - keepScroll.current;
      keepScroll.current = null;
    } else {
      bottom.current?.scrollIntoView({ behavior: list?.length > 1 ? 'smooth' : 'auto' });
    }
  }, [list?.length, typing[activeId]]);

  const loadOlder = async () => {
    if (!list?.length) return;
    setLoadingOlder(true);
    keepScroll.current = scroller.current.scrollHeight;
    try { await loadMessages(activeId, list[0].createdAt); } finally { setLoadingOlder(false); }
  };

  const stopTyping = () => {
    clearTimeout(typingTimer.current);
    if (typingState.current) { typingState.current = false; emitTyping(activeId, false); }
  };
  const onType = (e) => {
    setText(e.target.value);
    if (editing) return; // editing an old message isn't "typing a new one"
    if (!typingState.current) { typingState.current = true; emitTyping(activeId, true); }
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(stopTyping, 2000);
  };
  useEffect(() => stopTyping, [activeId]); // eslint-disable-line

  const pickFile = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!/^image\/(jpeg|png|gif|webp)$/.test(f.type)) return toast({ title: 'Unsupported file', body: 'Choose a JPG, PNG, GIF or WEBP image.' });
    if (f.size > 5 * 1024 * 1024) return toast({ title: 'Image too large', body: 'Photos must be under 5 MB.' });
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };
  const clearFile = () => { setFile(null); setPreview(''); };

  const submit = async (e) => {
    e?.preventDefault();
    const t = text.trim();
    if (editing) {
      if (!t || sending) return;
      if (t === editing.text) return cancelEdit(); // nothing changed
      setSending(true);
      try {
        await editMessage(activeId, editing._id, t);
        setText(''); setEditing(null); setEmoji(false);
      } catch (err) {
        toast({ title: 'Could not edit message', body: errMsg(err) });
      } finally {
        setSending(false);
        inputRef.current?.focus();
      }
      return;
    }
    if ((!t && !file) || sending) return;
    setSending(true);
    stopTyping();
    try {
      await sendMessage(activeId, { text: t, file });
      setText(''); clearFile(); setEmoji(false);
    } catch (err) {
      toast({ title: 'Message not sent', body: errMsg(err) });
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const startEdit = (m) => {
    stopTyping();
    clearFile();
    setEmoji(false);
    setEditing(m);
    setText(m.text);
    setTimeout(() => {
      const el = inputRef.current;
      if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    }, 0);
  };
  const startEditRef = useRef(startEdit);
  startEditRef.current = startEdit;
  const onEditStable = useCallback((m) => startEditRef.current(m), []);
  const cancelEdit = () => { setEditing(null); setText(''); inputRef.current?.focus(); };

  const sendSong = (song) =>
    sendMessage(activeId, { song }).catch((err) => toast({ title: 'Could not send song', body: errMsg(err) }));

  if (!friend) {
    return (
      <div className="hidden h-full place-items-center md:grid">
        <div className="text-center">
          <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-vibe to-vibe-pink text-4xl">🎧</div>
          <p className="text-lg font-bold">Pick a conversation</p>
          <p className="mt-1 text-sm text-slate-400">Messages, photos and songs from your friends show up here.</p>
        </div>
      </div>
    );
  }

  const callFriend = (video) => {
    if (!friend.online) return toast({ title: `${friend.username} is offline`, body: 'Calls only ring when your friend has VibeConnect open and is logged in. Ask them to open it, then call again.', duration: 9000 });
    startCall(friend, video);
  };
  const isTyping = typing[friend._id];
  let lastDay = '';

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-edge bg-panel px-3 py-3">
        <button className="icon-btn md:hidden" onClick={onBack} aria-label="Back to chats"><ArrowLeft size={20} /></button>
        <Avatar user={friend} size={42} showStatus />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{friend.username}</p>
          <p className={`text-xs ${isTyping ? 'text-vibe-soft' : friend.online ? 'text-emerald-400' : 'text-slate-500'}`}>
            {isTyping ? 'typing…' : friend.online ? 'Online' : `Last seen ${timeAgo(friend.lastSeen)}`}
          </p>
        </div>
        <button className="icon-btn" onClick={() => callFriend(false)} aria-label={`Voice call ${friend.username}`} title="Voice call"><Phone size={20} /></button>
        <button className="icon-btn" onClick={() => callFriend(true)} aria-label={`Video call ${friend.username}`} title="Video call"><Video size={20} /></button>
      </header>

      <div ref={scroller} className={`tpl-chat-${user.templates?.chat || 'classic'} scroll-y flex-1 space-y-1.5 px-3 py-4 sm:px-5`}>
        {hasMore[activeId] && (
          <div className="pb-2 text-center">
            <button className="btn-ghost !py-1.5 text-xs" onClick={loadOlder} disabled={loadingOlder}>{loadingOlder ? 'Loading…' : 'Load earlier messages'}</button>
          </div>
        )}
        {!list && <p className="py-10 text-center text-sm text-slate-500">Loading messages…</p>}
        {list?.length === 0 && <p className="py-10 text-center text-sm text-slate-500">No messages yet. Say hi to {friend.username}!</p>}
        {list?.map((m) => {
          const label = dayLabel(m.createdAt);
          const showDay = label !== lastDay;
          lastDay = label;
          return (
            <div key={m._id}>
              {showDay && <div className="my-3 text-center text-[11px] font-semibold text-slate-500">{label}</div>}
              <Bubble m={m} mine={m.from === user._id} onImage={setLightbox} onEdit={onEditStable} editing={editing?._id === m._id} />
            </div>
          );
        })}
        {isTyping && (
          <div className="flex animate-pop justify-start">
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-raised px-4 py-3" aria-label={`${friend.username} is typing`}>
              {[0, 0.15, 0.3].map((d) => <span key={d} className="h-1.5 w-1.5 animate-dot rounded-full bg-slate-400" style={{ animationDelay: `${d}s` }} />)}
            </div>
          </div>
        )}
        <div ref={bottom} />
      </div>

      {preview && (
        <div className="flex animate-rise items-center gap-3 border-t border-edge bg-panel px-4 py-2">
          <img src={preview} alt="Selected" className="h-14 w-14 rounded-xl object-cover" />
          <p className="min-w-0 flex-1 truncate text-sm text-slate-300">{file?.name}</p>
          <button className="icon-btn !h-8 !w-8" onClick={clearFile} aria-label="Remove photo"><X size={16} /></button>
        </div>
      )}

      {editing && (
        <div className="flex animate-rise items-center gap-3 border-t border-edge bg-panel px-4 py-2" role="status">
          <Pencil size={16} className="shrink-0 text-vibe-soft" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-vibe-soft">Editing message</p>
            <p className="truncate text-sm text-slate-400">{editing.text}</p>
          </div>
          <button className="icon-btn !h-8 !w-8" onClick={cancelEdit} aria-label="Cancel editing"><X size={16} /></button>
        </div>
      )}

      <div className="relative border-t border-edge bg-panel px-2 py-2 safe-b">
        {emoji && (
          <div className="absolute bottom-full left-2 z-20 mb-2 animate-pop">
            <Suspense fallback={<div className="rounded-xl bg-raised p-4 text-sm">Loading emoji…</div>}>
              <EmojiPicker theme="dark" width={Math.min(340, window.innerWidth - 16)} height={380} lazyLoadEmojis
                onEmojiClick={(e) => { setText((t) => t + e.emoji); inputRef.current?.focus(); }} />
            </Suspense>
          </div>
        )}
        {recording ? (
          <VoiceRecorderBar friendId={activeId} onCancel={() => setRecording(false)} onError={(b) => toast({ title: 'Voice message', body: b, duration: 8000 })} onSend={(out) => sendVoice(activeId, out)} />
        ) : (
        <form onSubmit={submit} className="flex items-end gap-1">
          <button type="button" className="icon-btn" onClick={() => setEmoji((v) => !v)} aria-label="Emoji"><Smile size={21} /></button>
          <button type="button" className="icon-btn" disabled={!!editing} onClick={() => fileRef.current.click()} aria-label="Send a photo"><ImagePlus size={21} /></button>
          <button type="button" className="icon-btn" disabled={!!editing} onClick={() => setPicker(true)} aria-label="Send a song"><Music2 size={21} /></button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" hidden onChange={pickFile} />
          <textarea
            ref={inputRef}
            rows={1}
            value={text}
            onChange={onType}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) submit(e); else if (e.key === 'Escape' && editing) cancelEdit(); }}
            placeholder={editing ? 'Edit your message' : 'Message'}
            maxLength={2000}
            className="input max-h-28 flex-1 resize-none !rounded-2xl !py-2.5"
          />
          {!text.trim() && !file && !editing ? (
            <button type="button" onClick={() => setRecording(true)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-vibe to-vibe-pink text-white transition active:scale-90" aria-label="Record a voice message" title="Voice message"><Mic size={18} /></button>
          ) : (
          <button type="submit" disabled={sending || (!text.trim() && !file)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-vibe to-vibe-pink text-white transition active:scale-90 disabled:opacity-40" aria-label={editing ? 'Save edit' : 'Send'}>
              {editing ? <Check size={18} /> : <Send size={18} />}
          </button>
          )}
        </form>
        )}
      </div>

      {picker && <SongPicker onClose={() => setPicker(false)} onSend={sendSong} />}
      {lightbox && (
        <div className="fixed inset-0 z-[70] grid animate-pop place-items-center bg-black/85 p-4" onClick={() => setLightbox('')}>
          <button className="icon-btn absolute right-4 top-4 bg-black/50" aria-label="Close"><X size={20} /></button>
          <img src={lightbox} alt="Full size" className="max-h-full max-w-full rounded-xl object-contain" />
        </div>
      )}
    </div>
  );
}
