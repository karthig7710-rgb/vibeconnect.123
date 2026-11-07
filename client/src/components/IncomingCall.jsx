import { Phone, Video, PhoneOff } from 'lucide-react';
import { useCall } from '../context/CallContext.jsx';
import Avatar from './Avatar.jsx';

export default function IncomingCall() {
  const { incoming, accept, decline } = useCall();
  if (!incoming) return null;
  const { from, video } = incoming;
  return (
    <div className="fixed inset-0 z-[56] grid place-items-end bg-black/85 sm:place-items-center" role="alertdialog" aria-label={`Incoming call from ${from.username}`}>
      <div className={`tpl-profile-${from.profileTemplate || 'classic'} safe-b w-full animate-pop rounded-t-3xl p-6 text-center text-white sm:max-w-sm sm:rounded-3xl`}>
        <div className="mx-auto w-fit animate-pulse rounded-full p-1.5 ring-4 ring-white/25"><Avatar user={from} size={96} /></div>
        <p className="mt-4 text-xl font-extrabold">{from.username}</p>
        <p className="text-sm text-white/80">Incoming {video ? 'video' : 'voice'} call…</p>
        <div className="mt-6 flex justify-center gap-10">
          <div className="flex flex-col items-center gap-1.5">
            <button onClick={decline} className="grid h-16 w-16 place-items-center rounded-full bg-rose-600 transition active:scale-90" aria-label="Decline"><PhoneOff size={26} /></button>
            <span className="text-xs">Decline</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <button onClick={accept} className="grid h-16 w-16 place-items-center rounded-full bg-emerald-500 transition active:scale-90" aria-label="Accept">{video ? <Video size={26} /> : <Phone size={26} />}</button>
            <span className="text-xs">Accept</span>
          </div>
        </div>
      </div>
    </div>
  );
}
