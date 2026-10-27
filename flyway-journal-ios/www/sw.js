// Offline support: app files cached on install; map tiles cached as you view them.
const APP = 'flyway-v2', TILES = 'flyway-tiles-v1';
const CORE = ['./', 'index.html', 'app.js', 'data.js', 'map.js', 'qr.js', 'native.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'icon-180.png', 'fonts/Barlow-Regular.woff', 'fonts/Barlow-Medium.woff', 'fonts/Barlow-SemiBold.woff', 'fonts/Barlow-Bold.woff', 'fonts/BarlowCondensed-SemiBold.woff', 'fonts/BarlowCondensed-Bold.woff', 'fonts/JetBrainsMono.woff'];
self.addEventListener('install', e => e.waitUntil(caches.open(APP).then(c => c.addAll(CORE)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== APP && k !== TILES).map(k => caches.delete(k)))).then(() => self.clients.claim())));
async function trim() { const c = await caches.open(TILES); const ks = await c.keys(); for (let i = 0; i < ks.length - 1500; i++) await c.delete(ks[i]); }
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return; const u = new URL(e.request.url);
  if (u.hostname.endsWith('tile.openstreetmap.org') || u.hostname === 'server.arcgisonline.com') {
    e.respondWith(caches.open(TILES).then(async c => { const hit = await c.match(e.request); if (hit) return hit; try { const r = await fetch(e.request); if (r.ok || r.type === 'opaque') { c.put(e.request, r.clone()); trim(); } return r; } catch { return Response.error(); } }));
    return;
  }
  if (u.hostname.includes('open-meteo.com')) return;
  e.respondWith(caches.match(e.request).then(hit => { const net = fetch(e.request).then(r => { if (r.ok && (u.origin === location.origin || u.hostname.includes('fonts'))) caches.open(APP).then(c => c.put(e.request, r.clone())); return r; }).catch(() => hit); return hit || net; }));
});
