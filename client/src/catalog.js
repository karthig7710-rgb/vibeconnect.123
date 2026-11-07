// Display data for themes and games.
// The 10 themes are free for everyone. The real colours are CSS variables in index.css ([data-theme='...']).
export const THEMES = [
  { id: 'violet', name: 'Violet Night', swatch: ['#0f0c1d', '#8b5cf6', '#ec4899', '#f5b84b'] },
  { id: 'ocean', name: 'Deep Ocean', swatch: ['#08111c', '#0ea5e9', '#14b8a6', '#fbbf24'] },
  { id: 'sunset', name: 'Sunset Drive', swatch: ['#180c0e', '#f97316', '#f43f5e', '#facc15'] },
  { id: 'forest', name: 'Midnight Forest', swatch: ['#09140f', '#22c55e', '#84cc16', '#f59e0b'] },
  { id: 'neon', name: 'Neon Arcade', swatch: ['#06060c', '#d946ef', '#22d3ee', '#facc15'] },
  { id: 'rose', name: 'Rose Quartz', swatch: ['#1a0c14', '#f472b6', '#fb7185', '#fcd34d'] },
  { id: 'aurora', name: 'Aurora', swatch: ['#071a1a', '#2dd4bf', '#a78bfa', '#fde047'] },
  { id: 'mocha', name: 'Mocha', swatch: ['#16100c', '#d6a06a', '#ef8354', '#fcd34d'] },
  { id: 'graphite', name: 'Graphite', swatch: ['#0e1014', '#94a3b8', '#38bdf8', '#fbbf24'] },
  { id: 'candy', name: 'Candy Pop', swatch: ['#150b24', '#a855f7', '#f472b6', '#67e8f9'] },
];
export const THEME_IDS = THEMES.map((t) => t.id);

export const GAME_INFO = {
  ttt: { name: 'Tic Tac Toe', emoji: '❌', blurb: 'Three in a row wins', color: 'from-vibe to-vibe-pink' },
  c4: { name: 'Connect Four', emoji: '🔴', blurb: 'Drop discs, link four', color: 'from-amber-vibe to-vibe-pink' },
  rps: { name: 'Rock Paper Scissors', emoji: '✊', blurb: 'Best of three', color: 'from-vibe-soft to-vibe' },
};

// Playable length in seconds. Older Apple songs only ever had a 30-second preview, whatever their listed length.
export function trackSeconds(t) {
  if (!t) return 30;
  if (/apple\.com|mzstatic\.com/i.test(t.previewUrl || '')) return 30;
  return t.durationMs > 0 ? t.durationMs / 1000 : 30;
}

// ---------- Calls: filters, voices (premium: false = Premium plan only; server lists in utils/plans.js) ----------
export const FILTER_LIST = [
  { id: 'none', name: 'None', emoji: '🚫', premium: false },
  { id: 'dog', name: 'Dog', emoji: '🐶', premium: false },
  { id: 'cat', name: 'Cat', emoji: '🐱', premium: false },
  { id: 'bigeyes', name: 'Big Eyes', emoji: '👀', premium: false },
  { id: 'baby', name: 'Baby', emoji: '👶', premium: false },
  { id: 'cartoon', name: 'Cartoon', emoji: '🎨', premium: false },
  { id: 'robot', name: 'Robot', emoji: '🤖', premium: false },
  { id: 'alien', name: 'Alien', emoji: '👽', premium: false },
];
export const VOICE_LIST = [
  { id: 'normal', name: 'Normal', emoji: '🙂', premium: false, params: { ratio: 1 } },
  { id: 'chipmunk', name: 'Chipmunk', emoji: '🐿️', premium: false, params: { ratio: 1.9 } },
  { id: 'deep', name: 'Deep Voice', emoji: '🎙️', premium: false, params: { ratio: 0.72 } },
  { id: 'baby', name: 'Baby', emoji: '🍼', premium: false, params: { ratio: 1.5 } },
  { id: 'monster', name: 'Monster', emoji: '👹', premium: false, params: { ratio: 0.58, ring: 0.35, ringHz: 28, drive: 0.6 } },
  { id: 'robot', name: 'Robot', emoji: '🤖', premium: false, params: { ratio: 1, ring: 1, ringHz: 55 } },
  { id: 'cartoon', name: 'Cartoon', emoji: '🎭', premium: false, params: { ratio: 1.28, vib: 0.05 } },
];

// ---------- Templates ----------
export const TEMPLATE_KINDS = {
  chat: { label: 'Chat', hint: 'Background and bubbles of your chats (only you see this).', list: [
    { id: 'classic', name: 'Classic', premium: false },
    { id: 'dots', name: 'Polka Dots', premium: false },
    { id: 'waves', name: 'Soft Waves', premium: false },
    { id: 'aurora', name: 'Aurora', premium: true },
    { id: 'sakura', name: 'Sakura', premium: true },
    { id: 'galaxy', name: 'Galaxy', premium: true },
    { id: 'grid', name: 'Neon Grid', premium: true },
  ] },
  call: { label: 'Call', hint: 'The look of your call screen (and voice calls).', list: [
    { id: 'plain', name: 'Plain', premium: false },
    { id: 'gradient', name: 'Gradient', premium: false },
    { id: 'sunrise', name: 'Sunrise', premium: false },
    { id: 'galaxy', name: 'Galaxy', premium: false },
    { id: 'confetti', name: 'Confetti', premium: false },
  ] },
  profile: { label: 'Profile', hint: 'Your profile card. Friends see it when you call them.', list: [
    { id: 'classic', name: 'Classic', premium: false },
    { id: 'gradient', name: 'Gradient', premium: false },
    { id: 'glass', name: 'Glass', premium: true },
    { id: 'neon', name: 'Neon', premium: true },
    { id: 'gold', name: 'Gold', premium: true },
    { id: 'sakura', name: 'Sakura', premium: true },
  ] },
};
