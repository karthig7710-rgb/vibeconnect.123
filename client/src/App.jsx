import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { ChatProvider } from './context/ChatContext.jsx';
import { MusicProvider } from './context/MusicContext.jsx';
import { GameProvider } from './context/GameContext.jsx';
import { RoomProvider } from './context/RoomContext.jsx';
import { CallProvider } from './context/CallContext.jsx';
import AuthPage from './pages/AuthPage.jsx';
import Home from './pages/Home.jsx';

function Gate() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="grid h-full place-items-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-edge border-t-vibe" aria-label="Loading" />
      </div>
    );
  }
  if (!user) return <AuthPage />;
  return (
    <ChatProvider>
      <MusicProvider>
        <GameProvider>
          <RoomProvider>
            <CallProvider>
              <Home />
            </CallProvider>
          </RoomProvider>
        </GameProvider>
      </MusicProvider>
    </ChatProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
