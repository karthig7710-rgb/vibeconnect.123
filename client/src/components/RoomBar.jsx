import { Play, Pause, Headphones, Volume2 } from 'lucide-react';
import { useRoom } from '../context/RoomContext.jsx';
import Cover from './Cover.jsx';

// Persistent mini player shown while you are in a Listen Together room
export default function RoomBar({ navHidden, onOpen }) {
  const { room, track, canControl, needsTap, control, resumeAudio } = useRoom();
  if (!room) return null;
  return (
    <div className={`fixed inset-x-0 ${navHidden ? 'bottom-0' : 'bottom-[calc(56px+env(safe-area-inset-bottom))]'} z-30 animate-rise border-t border-edge bg-panel md:bottom-0`}>
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-3 py-2.5">
        <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label="Open room">
          {track ? <Cover src={track.artwork} className="h-11 w-11 rounded-lg" /> : <span className="grid h-11 w-11 place-items-center rounded-lg bg-raised"><Headphones size={20} /></span>}
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{track ? track.title : 'Queue is empty'}</span>
            <span className="block truncate text-xs text-vibe-soft">🎧 {room.name} · {room.members.length} listening</span>
          </span>
        </button>
        {needsTap ? (
          <button className="btn-primary !px-3 !py-2 text-xs" onClick={resumeAudio}><Volume2 size={15} /> Listen in</button>
        ) : (
          <button className="grid h-11 w-11 place-items-center rounded-full bg-amber-vibe text-night transition active:scale-90 disabled:opacity-40" disabled={!canControl || !track}
            onClick={() => control(room.playing ? 'pause' : 'play')} aria-label={room.playing ? 'Pause for everyone' : 'Play for everyone'}>
            {room.playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
          </button>
        )}
      </div>
    </div>
  );
}
