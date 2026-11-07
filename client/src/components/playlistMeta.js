import { Lock, Users, Globe } from 'lucide-react';

export const VIS = {
  private: { label: 'Only me', hint: 'Nobody else can see or play it.', Icon: Lock },
  friends: { label: 'My friends', hint: 'Your friends can see and play it.', Icon: Users },
  public: { label: 'Everyone', hint: 'Every VibeConnect user can see and play it.', Icon: Globe },
};

export const fmtMB = (bytes) => `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;

export const totalLabel = (n, ms) => {
  const mins = Math.round(ms / 60000);
  return `${n} song${n === 1 ? '' : 's'}${n ? ` · ${mins >= 60 ? `${Math.floor(mins / 60)} h ${mins % 60} min` : `${Math.max(mins, 1)} min`}` : ''}`;
};
