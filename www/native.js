/* Flyway Journal — native iPhone features (Capacitor).
   When the app runs as a website/PWA, NATIVE.on is false and app.js uses the normal web APIs instead.
   Plugins used: Geolocation, Haptics, Share, Filesystem, StatusBar, SplashScreen. */
'use strict';

// ---- EDIT THESE once the App Store listing exists ----------------------------------------
const APP_CONFIG = {
  // From App Store Connect > your app > App Information > Apple ID, e.g. https://apps.apple.com/app/id6740000000
  appStoreUrl: '',
  // Your website copy of the app (Netlify). Used for sharing until appStoreUrl is filled in.
  webUrl: 'https://flyway-journal.netlify.app/'
};
// --------------------------------------------------------------------------------------------

const NATIVE = (() => {
  const C = window.Capacitor;
  const on = !!(C && typeof C.isNativePlatform === 'function' && C.isNativePlatform());
  const P = on ? (C.Plugins || {}) : {};
  if (on) document.documentElement.classList.add('native');

  const AUTO = 'Flyway Autobackup';            // folder in the app's Documents (visible in the Files app)
  const DOCS = 'DOCUMENTS', CACHE = 'CACHE', UTF8 = 'utf8';

  // ---------- GPS ----------
  // Returns {lat,lng,acc} or null; {denied:true} when the person turned location off for the app.
  async function getPos(timeout) {
    const G = P.Geolocation; if (!G) return null;
    try {
      let perm = await G.checkPermissions();
      if (perm.location === 'prompt' || perm.location === 'prompt-with-rationale') perm = await G.requestPermissions({ permissions: ['location'] });
      if (perm.location === 'denied') return { denied: true };
      const p = await G.getCurrentPosition({ enableHighAccuracy: true, timeout, maximumAge: 15000 });
      return { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy };
    } catch (e) {
      const m = String(e && (e.message || e)).toLowerCase();
      if (m.includes('denied') || m.includes('disabled') || m.includes('not authorized')) return { denied: true };
      return null;
    }
  }

  // ---------- haptics ----------
  function tap(kind) {
    const Hp = P.Haptics; if (!Hp) return;
    try {
      if (kind === 'success') Hp.notification({ type: 'SUCCESS' });
      else if (kind === 'warn') Hp.notification({ type: 'WARNING' });
      else Hp.impact({ style: kind === 'light' ? 'LIGHT' : 'MEDIUM' });
    } catch { }
  }

  // ---------- share sheet ----------
  async function shareText(o) {
    if (!P.Share) return false;
    try { await P.Share.share({ title: o.title, text: o.text, url: o.url, dialogTitle: o.title }); } catch { /* cancelled */ }
    return true;
  }

  // Saves a file (backup or CSV): writes it to Documents/Flyway Exports, then opens the share sheet
  // so it can go to Files, Mail, Messages, AirDrop or Google Drive.
  async function saveFile(name, text) {
    const F = P.Filesystem; if (!F) return false;
    const path = `Flyway Exports/${name}`;
    await F.writeFile({ path, data: text, directory: DOCS, encoding: UTF8, recursive: true });
    const { uri } = await F.getUri({ path, directory: DOCS });
    try { await P.Share.share({ title: name, files: [uri], dialogTitle: name }); } catch { /* cancelled; file is still saved */ }
    return true;
  }

  // ---------- automatic backup to the phone's Documents folder ----------
  // iPhone backups (iCloud or computer) include this folder, so a lost or replaced phone doesn't lose the journal.
  // Hunts and spots are one small file rewritten a few seconds after each change; each photo is its own file, written once.
  let dataTimer = null, getData = null;
  function mirrorData(fn) {
    if (!P.Filesystem) return; getData = fn; clearTimeout(dataTimer);
    dataTimer = setTimeout(writeData, 4000);
  }
  async function writeData() {
    if (!getData) return;
    try {
      const d = getData();
      await P.Filesystem.writeFile({ path: `${AUTO}/journal.json`, directory: DOCS, encoding: UTF8, recursive: true,
        data: JSON.stringify({ app: 'flyway-journal', version: 1, savedAt: new Date().toISOString(), hunts: d.hunts, spots: d.spots }) });
    } catch { }
  }
  async function mirrorPhoto(p) {
    if (!P.Filesystem) return;
    try { await P.Filesystem.writeFile({ path: `${AUTO}/photos/${p.id}.json`, directory: DOCS, encoding: UTF8, recursive: true, data: JSON.stringify(p) }); } catch { }
  }
  async function unmirrorPhoto(id) {
    if (!P.Filesystem) return;
    try { await P.Filesystem.deleteFile({ path: `${AUTO}/photos/${id}.json`, directory: DOCS }); } catch { }
  }
  // If the in-app database is empty (iOS cleared it, or a restored phone), rebuild it from the autobackup.
  async function readAutobackup() {
    const F = P.Filesystem; if (!F) return null;
    try {
      const r = await F.readFile({ path: `${AUTO}/journal.json`, directory: DOCS, encoding: UTF8 });
      const j = JSON.parse(r.data); if (j.app !== 'flyway-journal') return null;
      const photos = [];
      try {
        const ls = await F.readdir({ path: `${AUTO}/photos`, directory: DOCS });
        for (const f of ls.files || []) {
          const nm = typeof f === 'string' ? f : f.name; if (!nm.endsWith('.json')) continue;
          try { const pr = await F.readFile({ path: `${AUTO}/photos/${nm}`, directory: DOCS, encoding: UTF8 }); photos.push(JSON.parse(pr.data)); } catch { }
        }
      } catch { }
      return { hunts: j.hunts || [], spots: j.spots || [], photos };
    } catch { return null; }
  }

  // ---------- status bar & splash ----------
  function syncStatusBar() {
    const S = P.StatusBar; if (!S) return;
    const forced = document.documentElement.dataset.theme;
    const dark = forced ? forced === 'dark' : !matchMedia('(prefers-color-scheme: light)').matches;
    try { S.setStyle({ style: dark ? 'DARK' : 'LIGHT' }); } catch { }   // DARK = light text for dark backgrounds
  }
  function ready() {
    if (!on) return;
    syncStatusBar();
    try { matchMedia('(prefers-color-scheme: light)').addEventListener('change', syncStatusBar); } catch { }
    try { P.SplashScreen && P.SplashScreen.hide({ fadeOutDuration: 250 }); } catch { }
  }

  const shareUrl = () => APP_CONFIG.appStoreUrl || APP_CONFIG.webUrl;
  return { on, getPos, tap, shareText, saveFile, mirrorData, mirrorPhoto, unmirrorPhoto, readAutobackup, ready, shareUrl };
})();
