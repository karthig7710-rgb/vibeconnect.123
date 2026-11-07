// Minimal service worker. It exists so browsers treat VibeConnect as an installable app.
// It does not cache anything: every request goes straight to the network.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
