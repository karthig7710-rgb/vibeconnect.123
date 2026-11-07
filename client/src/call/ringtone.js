// A soft ringing sound made with the Web Audio API (no audio files). Browsers may block it until the
// person has tapped something; in that case the call screen still shows and the phone can vibrate.
export function startRingtone(kind = 'incoming') {
  let ctx, timer, stopped = false;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
  } catch { return () => {}; }
  const beep = (freq, at, len) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0, ctx.currentTime + at);
    g.gain.linearRampToValueAtTime(0.12, ctx.currentTime + at + 0.03);
    g.gain.linearRampToValueAtTime(0, ctx.currentTime + at + len);
    o.connect(g); g.connect(ctx.destination);
    o.start(ctx.currentTime + at); o.stop(ctx.currentTime + at + len + 0.05);
  };
  const ring = () => {
    if (stopped) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    if (kind === 'incoming') { beep(880, 0, 0.25); beep(660, 0.3, 0.25); beep(880, 0.8, 0.25); beep(660, 1.1, 0.25); if (navigator.vibrate) navigator.vibrate([300, 150, 300]); }
    else { beep(440, 0, 0.9); }
  };
  ring();
  timer = setInterval(ring, kind === 'incoming' ? 2600 : 3000);
  return () => { stopped = true; clearInterval(timer); if (navigator.vibrate) navigator.vibrate(0); ctx.close().catch(() => {}); };
}
