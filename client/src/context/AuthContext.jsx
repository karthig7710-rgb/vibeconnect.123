import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../api.js';
import { THEME_IDS } from '../catalog.js';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/auth/me').then((r) => setUser(r.data.user)).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (identifier, password) => {
    const r = await api.post('/auth/login', { identifier, password });
    setUser(r.data.user);
  }, []);

  const signup = useCallback(async ({ username, email, password, avatar }) => {
    const fd = new FormData();
    fd.append('username', username);
    fd.append('email', email);
    fd.append('password', password);
    if (avatar) fd.append('avatar', avatar);
    const r = await api.post('/auth/signup', fd);
    setUser(r.data.user);
  }, []);

  const patchUser = useCallback((patch) => setUser((u) => (u ? { ...u, ...patch } : u)), []);

  // Apply the theme (unknown/legacy values fall back to the default) and tint the browser UI to match.
  useEffect(() => {
    const t = THEME_IDS.includes(user?.theme) ? user.theme : 'violet';
    document.documentElement.dataset.theme = t;
    const night = getComputedStyle(document.documentElement).getPropertyValue('--c-night').trim().split(/\s+/).map(Number);
    if (night.length === 3 && night.every((n) => !Number.isNaN(n))) {
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', `rgb(${night.join(',')})`);
    }
  }, [user?.theme]);

  // Switch theme instantly, save it, and roll back if the server rejects it.
  const setTheme = useCallback(async (theme) => {
    if (!THEME_IDS.includes(theme)) return;
    let previous;
    setUser((u) => { previous = u?.theme; return u ? { ...u, theme } : u; });
    try {
      const r = await api.put('/auth/me', { theme });
      setUser(r.data.user);
    } catch (e) {
      setUser((u) => (u ? { ...u, theme: previous } : u));
      throw e;
    }
  }, []);

  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => {});
    setUser(null);
  }, []);

  const updateProfile = useCallback(async ({ bio, avatar }) => {
    const fd = new FormData();
    if (bio !== undefined) fd.append('bio', bio);
    if (avatar) fd.append('avatar', avatar);
    const r = await api.put('/auth/me', fd);
    setUser(r.data.user);
  }, []);

  return <AuthCtx.Provider value={{ user, loading, login, signup, logout, updateProfile, patchUser, setTheme }}>{children}</AuthCtx.Provider>;
}
