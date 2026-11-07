import axios from 'axios';

export const api = axios.create({ baseURL: '/api', withCredentials: true });

export const errMsg = (e) => e?.response?.data?.error || e?.message || 'Something went wrong.';

export const timeShort = (d) => new Date(d).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export function timeAgo(d) {
  if (!d) return '';
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export const fmtDuration = (sec) => {
  if (!isFinite(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  return `${m}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
};
