import { premiumUsernames } from '../config.js';

// Free vs Premium. IDs must match client/src/catalog.js (the client shows the same lists).
// Everything used in calls (filters, voices, call templates) is free. Premium only covers chat and profile templates.
export const FILTERS = { none: false, dog: false, cat: false, bigeyes: false, baby: false, cartoon: false, robot: false, alien: false };
export const VOICES = { normal: false, chipmunk: false, deep: false, baby: false, monster: false, robot: false, cartoon: false };
export const TEMPLATES = {
  chat: { classic: false, dots: false, waves: false, aurora: true, sakura: true, galaxy: true, grid: true },
  call: { plain: false, gradient: false, sunrise: false, galaxy: false, confetti: false },
  profile: { classic: false, gradient: false, glass: true, neon: true, gold: true, sakura: true },
};
export const DEFAULT_TEMPLATES = { chat: 'classic', call: 'plain', profile: 'classic' };

export function isPremium(user) {
  if (!user) return false;
  if (premiumUsernames.includes(String(user.username || '').toLowerCase())) return true;
  if (user.plan !== 'premium') return false;
  return !user.premiumUntil || new Date(user.premiumUntil) > new Date();
}

export const templateIsPremium = (kind, id) => TEMPLATES[kind]?.[id];
export const validTemplate = (kind, id) => Object.hasOwn(TEMPLATES[kind] || {}, id);

// Templates a user may actually see: premium ones fall back to the default if the plan lapsed.
export function effectiveTemplates(user) {
  const out = { ...DEFAULT_TEMPLATES };
  const premium = isPremium(user);
  for (const kind of Object.keys(TEMPLATES)) {
    const id = user?.templates?.[kind];
    if (id && validTemplate(kind, id) && (premium || !TEMPLATES[kind][id])) out[kind] = id;
  }
  return out;
}
