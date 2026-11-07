const hues = [262, 330, 200, 28, 160, 290];
const hueFor = (s = '') => hues[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % hues.length];

export default function Avatar({ user, size = 40, showStatus = false }) {
  const name = user?.username || '?';
  const h = hueFor(name);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {user?.avatar ? (
        <img src={user.avatar} alt={name} className="h-full w-full rounded-full object-cover bg-raised" loading="lazy" />
      ) : (
        <div
          className="grid h-full w-full place-items-center rounded-full font-bold uppercase text-white"
          style={{ background: `linear-gradient(135deg, hsl(${h} 70% 52%), hsl(${(h + 40) % 360} 70% 42%))`, fontSize: size * 0.4 }}
        >
          {name[0]}
        </div>
      )}
      {showStatus && (
        <span
          className={`absolute bottom-0 right-0 block rounded-full border-2 border-panel ${user?.online ? 'bg-emerald-400' : 'bg-slate-600'}`}
          style={{ width: size * 0.28, height: size * 0.28 }}
          title={user?.online ? 'Online' : 'Offline'}
        />
      )}
    </div>
  );
}
