import { lazy, Suspense, useEffect, useState } from 'react';
import { MessageCircle, Music2, Users, LogOut, Gamepad2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useChat } from '../context/ChatContext.jsx';
import { useMusic } from '../context/MusicContext.jsx';
import { useRoom } from '../context/RoomContext.jsx';
import { useGames } from '../context/GameContext.jsx';
import Avatar from '../components/Avatar.jsx';
import ChatList from '../components/ChatList.jsx';
import ChatWindow from '../components/ChatWindow.jsx';
import FriendsPanel from '../components/FriendsPanel.jsx';
import PlayerBar from '../components/PlayerBar.jsx';
import RoomBar from '../components/RoomBar.jsx';
import Toasts from '../components/Toasts.jsx';
import IncomingCall from '../components/IncomingCall.jsx';
import PremiumModal from '../components/PremiumModal.jsx';

// Heavy screens load only when first opened, so the first screen appears sooner
const MusicPanel = lazy(() => import('../components/MusicPanel.jsx'));
const GamesPanel = lazy(() => import('../components/GamesPanel.jsx'));
const GameView = lazy(() => import('../components/GameView.jsx'));
const ProfileModal = lazy(() => import('../components/ProfileModal.jsx'));
const CallScreen = lazy(() => import('../components/CallScreen.jsx'));
const Loading = () => <div className="grid h-full place-items-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-edge border-t-vibe" aria-label="Loading" /></div>;

const Badge = ({ n, dot }) =>
  n > 0 || dot ? (
    <span className={`absolute -right-1 -top-1 grid place-items-center rounded-full bg-vibe-pink font-bold ${dot && !n ? 'h-2.5 w-2.5' : 'h-4 min-w-4 px-1 text-[10px]'}`}>{n ? (n > 9 ? '9+' : n) : ''}</span>
  ) : null;

export default function Home() {
  const { user, logout } = useAuth();
  const { activeId, setActiveId, totalUnread, requests, connected } = useChat();
  const { track } = useMusic();
  const { room } = useRoom();
  const { activeGameId, setActiveGameId, pendingInvites, focus } = useGames();
  const [tab, setTab] = useState('chats');
  const [profile, setProfile] = useState(false);
  const [premium, setPremium] = useState(null); // { feature } when the Premium sheet is open

  useEffect(() => {
    const open = (e) => setPremium({ feature: e.detail?.feature });
    window.addEventListener('vc:premium', open);
    return () => window.removeEventListener('vc:premium', open);
  }, []);

  // Accepting/starting a game from a toast jumps to the Games tab
  useEffect(() => { if (focus) setTab('games'); }, [focus]);
  // Joining a room from a toast jumps to Music
  useEffect(() => {
    const open = () => setTab('music');
    window.addEventListener('vc:open-room', open);
    return () => window.removeEventListener('vc:open-room', open);
  }, []);

  const openChat = (id) => { setTab('chats'); setActiveId(id); };
  const wide = tab === 'music';
  const detail = (tab === 'chats' && activeId) || (tab === 'games' && activeGameId); // full-screen detail on phones
  const barOffset = !!detail;
  const hasBar = (track && !room) || room;

  const tabs = [
    ['chats', 'Chats', MessageCircle, totalUnread, false],
    ['music', 'Music', Music2, 0, !!room],
    ['games', 'Games', Gamepad2, pendingInvites, false],
    ['friends', 'Friends', Users, requests.incoming.length, false],
  ];

  return (
    <div className="flex h-full flex-col md:flex-row">
      {/* Desktop rail */}
      <nav className="hidden w-[72px] shrink-0 flex-col items-center gap-2 border-r border-edge bg-panel py-4 md:flex" aria-label="Main">
        <button onClick={() => setProfile(true)} aria-label="Your profile" className="mb-3"><Avatar user={user} size={42} /></button>
        {tabs.map(([k, label, Icon, n, dot]) => (
          <button key={k} onClick={() => setTab(k)} aria-label={label} title={label}
            className={`relative grid h-12 w-12 place-items-center rounded-2xl transition ${tab === k ? 'bg-gradient-to-br from-vibe to-vibe-pink text-white' : 'text-slate-400 hover:bg-raised hover:text-white'}`}>
            <Icon size={22} /><Badge n={n} dot={dot} />
          </button>
        ))}
        <div className="flex-1" />
        <span title={connected ? 'Connected' : 'Reconnecting…'} className={`mb-2 h-2 w-2 rounded-full ${connected ? 'bg-emerald-400' : 'animate-pulse bg-amber-vibe'}`} />
        <button onClick={logout} className="icon-btn" aria-label="Log out" title="Log out"><LogOut size={20} /></button>
      </nav>

      {/* Side panel */}
      <aside className={`${detail ? 'hidden' : 'flex'} min-h-0 flex-1 flex-col bg-night md:w-[340px] md:flex-none md:border-r md:border-edge ${wide ? 'md:w-auto md:max-w-3xl md:flex-1' : ''}`}>
        <div className="flex items-center justify-between border-b border-edge px-4 py-2 md:hidden">
          <button onClick={() => setProfile(true)} className="flex items-center gap-2"><Avatar user={user} size={30} /><span className="text-sm font-semibold">@{user.username}</span></button>
          <div className="flex items-center gap-1"><button onClick={logout} className="icon-btn" aria-label="Log out"><LogOut size={19} /></button></div>
        </div>
        <div className="min-h-0 flex-1">
          {tab === 'chats' && <ChatList meId={user._id} onGoFriends={() => setTab('friends')} />}
          <Suspense fallback={<Loading />}>
            {tab === 'music' && <MusicPanel />}
            {tab === 'games' && <GamesPanel />}
          </Suspense>
          {tab === 'friends' && <FriendsPanel onOpenChat={openChat} />}
        </div>
      </aside>

      {/* Detail pane */}
      {!wide && (
        <main className={`${detail ? 'flex' : 'hidden'} min-h-0 min-w-0 flex-1 flex-col bg-night md:flex ${hasBar ? 'pb-[68px]' : ''} md:pb-0`}>
          {tab === 'games' ? (
            <Suspense fallback={<Loading />}><GameView onBack={() => setActiveGameId(null)} /></Suspense>
          ) : tab === 'friends' && !activeId ? (
            <div className="hidden h-full place-items-center p-8 text-center md:grid">
              <p className="max-w-xs text-slate-400">Search for people, accept requests, then open a chat from your friends list.</p>
            </div>
          ) : (
            <ChatWindow onBack={() => setActiveId(null)} />
          )}
        </main>
      )}

      {/* Mobile bottom tabs */}
      <nav className={`${detail ? 'hidden' : 'flex'} safe-b shrink-0 border-t border-edge bg-panel md:hidden`} aria-label="Main">
        {tabs.map(([k, label, Icon, n, dot]) => (
          <button key={k} onClick={() => setTab(k)} className={`relative flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition ${tab === k ? 'text-vibe-soft' : 'text-slate-500'}`}>
            <span className="relative"><Icon size={21} /><Badge n={n} dot={dot} /></span>{label}
          </button>
        ))}
      </nav>

      <PlayerBar navHidden={barOffset} />
      <RoomBar navHidden={barOffset} onOpen={() => { setTab('music'); window.dispatchEvent(new CustomEvent('vc:open-room')); }} />
      <Toasts onOpenChat={openChat} />
      <Suspense fallback={null}>{profile && <ProfileModal onClose={() => setProfile(false)} />}</Suspense>
      <IncomingCall />
      <Suspense fallback={null}><CallScreen /></Suspense>
      {premium && <PremiumModal feature={premium.feature} onClose={() => setPremium(null)} />}
    </div>
  );
}
