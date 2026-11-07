// userId -> Set<socketId>
const online = new Map();

export function addSocket(userId, socketId) {
  const set = online.get(userId) || new Set();
  const wasOffline = set.size === 0;
  set.add(socketId);
  online.set(userId, set);
  return wasOffline;
}
export function removeSocket(userId, socketId) {
  const set = online.get(userId);
  if (!set) return false;
  set.delete(socketId);
  if (set.size === 0) {
    online.delete(userId);
    return true;
  }
  return false;
}
export const isOnline = (userId) => online.has(String(userId));
