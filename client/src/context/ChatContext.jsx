import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { api } from '../api.js';
import { useAuth } from './AuthContext.jsx';

const ChatCtx = createContext(null);
export const useChat = () => useContext(ChatCtx);

export function ChatProvider({ children }) {
  const { user } = useAuth();
  const [friends, setFriends] = useState([]);
  const [convos, setConvos] = useState({}); // friendId -> { last, unread }
  const [messages, setMessages] = useState({}); // friendId -> Message[]
  const [hasMore, setHasMore] = useState({});
  const [typing, setTyping] = useState({});
  const [requests, setRequests] = useState({ incoming: [], outgoing: [] });
  const [activeId, setActiveIdState] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [connected, setConnected] = useState(false);
  const [socket, setSocket] = useState(null);

  const activeRef = useRef(null);
  const friendsRef = useRef([]);
  const typingTimers = useRef({});
  const socketRef = useRef(null);
  const me = user?._id;

  const toast = useCallback((t) => {
    const id = t.id || Math.random().toString(36).slice(2);
    setToasts((x) => [...x.filter((y) => y.id !== id).slice(-3), { ...t, id }]);
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), t.duration || 5000);
  }, []);
  const dismissToast = useCallback((id) => setToasts((x) => x.filter((y) => y.id !== id)), []);

  const loadFriends = useCallback(
    () => api.get('/friends').then((r) => { friendsRef.current = r.data.friends; setFriends(r.data.friends); }),
    []
  );
  const loadRequests = useCallback(() => api.get('/friends/requests').then((r) => setRequests(r.data)), []);
  const loadConvos = useCallback(
    () =>
      api.get('/messages/conversations').then((r) => {
        const map = {};
        r.data.conversations.forEach((c) => (map[c.friendId] = { last: c.last, unread: c.unread }));
        setConvos(map);
      }),
    []
  );

  const markRead = useCallback((friendId) => {
    api.post(`/messages/${friendId}/read`).catch(() => {});
    setConvos((c) => (c[friendId] ? { ...c, [friendId]: { ...c[friendId], unread: 0 } } : c));
  }, []);

  const setActiveId = useCallback((id) => {
    activeRef.current = id;
    setActiveIdState(id);
    if (id) markRead(id);
  }, [markRead]);

  const loadMessages = useCallback(async (friendId, before) => {
    const r = await api.get(`/messages/${friendId}`, { params: before ? { before } : {} });
    setMessages((m) => {
      const existing = m[friendId] || [];
      const ids = new Set(existing.map((x) => x._id));
      const merged = [...r.data.messages.filter((x) => !ids.has(x._id)), ...existing];
      return { ...m, [friendId]: merged };
    });
    setHasMore((h) => ({ ...h, [friendId]: r.data.hasMore }));
  }, []);

  const pushMessage = useCallback((msg, otherId) => {
    setMessages((m) => {
      const list = m[otherId];
      if (!list) return m;
      if (list.some((x) => x._id === msg._id)) return m;
      return { ...m, [otherId]: [...list, msg] };
    });
  }, []);

  // initial data + socket lifecycle
  useEffect(() => {
    if (!me) return;
    loadFriends();
    loadRequests();
    loadConvos();

    const socket = io({ withCredentials: true, transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    setSocket(socket);
    socket.on('connect', () => {
      setConnected(true);
      loadFriends(); // resync presence after (re)connect
    });
    socket.on('disconnect', () => setConnected(false));

    socket.on('message:new', (msg) => {
      const mine = msg.from === me;
      const other = mine ? msg.to : msg.from;
      pushMessage(msg, other);
      setConvos((c) => {
        const prev = c[other] || { unread: 0 };
        const viewing = activeRef.current === other && document.visibilityState === 'visible';
        return { ...c, [other]: { last: msg, unread: mine || viewing ? prev.unread : prev.unread + 1 } };
      });
      if (!mine) {
        const viewing = activeRef.current === other && document.visibilityState === 'visible';
        if (viewing) markRead(other);
        else {
          const f = friendsRef.current.find((x) => x._id === other);
          const preview = msg.type === 'image' ? '📷 Photo' : msg.type === 'voice' ? '🎤 Voice message' : msg.type === 'song' ? `🎵 ${msg.song?.title}` : msg.text;
          toast({ kind: 'message', title: f?.username || 'New message', body: preview, avatar: f?.avatar, friendId: other });
          if ('Notification' in window && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
            new Notification(f?.username || 'VibeConnect', { body: preview, icon: f?.avatar || undefined, tag: other });
          }
        }
      }
    });

    socket.on('messages:read', ({ by }) =>
      setMessages((m) => (m[by] ? { ...m, [by]: m[by].map((x) => (x.from === me ? { ...x, read: true } : x)) } : m))
    );
    // A message was edited (by the sender, possibly from another tab): update it in place.
    socket.on('message:edited', (msg) => {
      const other = msg.from === me ? msg.to : msg.from;
      setMessages((m) => (m[other] ? { ...m, [other]: m[other].map((x) => (x._id === msg._id ? msg : x)) } : m));
      setConvos((c) => (c[other]?.last?._id === msg._id ? { ...c, [other]: { ...c[other], last: msg } } : c));
    });
    socket.on('messages:read-self', ({ friendId }) =>
      setConvos((c) => (c[friendId] ? { ...c, [friendId]: { ...c[friendId], unread: 0 } } : c))
    );

    socket.on('typing', ({ from, isTyping }) => {
      clearTimeout(typingTimers.current[from]);
      setTyping((t) => ({ ...t, [from]: isTyping }));
      if (isTyping) typingTimers.current[from] = setTimeout(() => setTyping((t) => ({ ...t, [from]: false })), 4000);
    });

    socket.on('presence', ({ userId, online, lastSeen }) =>
      setFriends((fs) => {
        const next = fs.map((f) => (f._id === userId ? { ...f, online, lastSeen: lastSeen || f.lastSeen } : f));
        friendsRef.current = next;
        return next;
      })
    );

    socket.on('friend:request', ({ request }) => {
      loadRequests();
      toast({ kind: 'friend', title: 'New friend request', body: `${request.from.username} wants to connect`, avatar: request.from.avatar });
    });
    socket.on('friend:request-updated', () => loadRequests());
    socket.on('friend:accepted', () => {
      loadFriends();
      loadRequests();
      toast({ kind: 'friend', title: 'You have a new friend', body: 'Say hi in Chats' });
    });
    socket.on('friend:removed', ({ userId }) => {
      loadFriends();
      if (activeRef.current === userId) setActiveId(null);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setSocket(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me]);

  // unread count in the tab title
  const totalUnread = Object.values(convos).reduce((n, c) => n + (c.unread || 0), 0);
  useEffect(() => {
    document.title = totalUnread ? `(${totalUnread}) VibeConnect` : 'VibeConnect';
  }, [totalUnread]);

  // mark as read when the tab becomes visible again
  useEffect(() => {
    const onVis = () => document.visibilityState === 'visible' && activeRef.current && markRead(activeRef.current);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [markRead]);

  const emitTyping = useCallback((to, isTyping) => socketRef.current?.emit('typing', { to, isTyping }), []);

  const sendMessage = useCallback(async (friendId, { text, file, song }) => {
    let r;
    if (file) {
      const fd = new FormData();
      fd.append('image', file);
      if (text) fd.append('text', text);
      r = await api.post(`/messages/${friendId}`, fd);
    } else {
      r = await api.post(`/messages/${friendId}`, song ? { song: JSON.stringify(song), text } : { text });
    }
    const msg = r.data.message;
    pushMessage(msg, friendId);
    setConvos((c) => ({ ...c, [friendId]: { last: msg, unread: c[friendId]?.unread || 0 } }));
    return msg;
  }, [pushMessage]);

  const sendVoice = useCallback(async (friendId, { blob, durationMs, mime }) => {
    const fd = new FormData();
    fd.append('durationMs', String(durationMs));
    fd.append('audio', blob, `voice.${mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm'}`);
    const r = await api.post(`/messages/${friendId}/voice`, fd);
    const msg = r.data.message;
    pushMessage(msg, friendId);
    setConvos((c) => ({ ...c, [friendId]: { last: msg, unread: c[friendId]?.unread || 0 } }));
    return msg;
  }, [pushMessage]);

  const editMessage = useCallback(async (friendId, messageId, text) => {
    const r = await api.patch(`/messages/${messageId}`, { text });
    const msg = r.data.message;
    setMessages((m) => (m[friendId] ? { ...m, [friendId]: m[friendId].map((x) => (x._id === msg._id ? msg : x)) } : m));
    setConvos((c) => (c[friendId]?.last?._id === msg._id ? { ...c, [friendId]: { ...c[friendId], last: msg } } : c));
    return msg;
  }, []);

  const sendRequest = useCallback(async (userId) => { await api.post(`/friends/request/${userId}`); loadRequests(); }, [loadRequests]);
  const acceptRequest = useCallback(async (id) => { await api.post(`/friends/requests/${id}/accept`); }, []);
  const removeRequest = useCallback(async (id) => { await api.delete(`/friends/requests/${id}`); loadRequests(); }, [loadRequests]);
  const unfriend = useCallback(async (id) => { await api.delete(`/friends/${id}`); if (activeRef.current === id) setActiveId(null); }, [setActiveId]);

  // One stable object: screens only re-render when something they could show has really changed.
  const value = useMemo(() => ({
    friends, convos, messages, hasMore, typing, requests, activeId, toasts, connected, totalUnread, socket,
    setActiveId, loadMessages, sendMessage, sendVoice, editMessage, emitTyping, sendRequest, acceptRequest, removeRequest, unfriend,
    dismissToast, toast,
  }), [friends, convos, messages, hasMore, typing, requests, activeId, toasts, connected, totalUnread, socket,
    setActiveId, loadMessages, sendMessage, sendVoice, editMessage, emitTyping, sendRequest, acceptRequest, removeRequest, unfriend, dismissToast, toast]);

  return <ChatCtx.Provider value={value}>{children}</ChatCtx.Provider>;
}
