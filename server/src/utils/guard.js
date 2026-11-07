import { HttpError } from './errors.js';

// Wraps a socket handler: ack-safe, error-safe, and rate-limited (80 events / 5s per socket).
export function wrap(socket, handler) {
  return async (data, cb) => {
    const reply = typeof cb === 'function' ? cb : () => {};
    try {
      const b = (socket.data.bucket ||= { n: 0, t: Date.now() });
      if (Date.now() - b.t > 5000) { b.n = 0; b.t = Date.now(); }
      if (++b.n > 80) return reply({ error: 'Slow down a little.' });
      await handler(data && typeof data === 'object' ? data : {}, reply);
    } catch (e) {
      if (e instanceof HttpError) reply({ error: e.message });
      else {
        console.error(e);
        reply({ error: 'Something went wrong.' });
      }
    }
  };
}
