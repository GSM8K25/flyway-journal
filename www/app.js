/* Flyway Journal — waterfowl hunt logbook. All data stays on this phone (IndexedDB). */
'use strict';

// ---------- helpers ----------
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const pad = n => String(n).padStart(2, '0');
const isoDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const isoLocal = d => `${isoDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const fmtTime = t => new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const fmtDay = t => new Date(t).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const fmtDayLong = t => new Date(t).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const fmtLL = (a, b) => `${a.toFixed(5)}, ${b.toFixed(5)}`;
function hav(a, b, c, d) { const R = 6371000, r = Math.PI / 180, x = (c - a) * r, y = (d - b) * r; const h = Math.sin(x / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(y / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); }
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } };
const SP = Object.fromEntries(SPECIES.map(s => [s.id, s]));
const GR = Object.fromEntries(GROUPS.map(g => [g.id, g]));
const spColor = id => GR[SP[id]?.g]?.color || '#888';
let toastT, undoFn = null;
function toast(msg, undo, ms = 3000) {
  $('#toastMsg').textContent = msg; undoFn = undo || null; $('#toastUndo').hidden = !undo; $('#toast').hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { $('#toast').hidden = true; undoFn = null; }, undo ? 5000 : ms);
}
$('#toastUndo').onclick = () => { const f = undoFn; $('#toast').hidden = true; undoFn = null; f && f(); };
const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const compass = deg => deg == null ? '—' : COMPASS[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
const compass8 = deg => deg == null ? null : ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(((deg % 360) + 360) % 360 / 45) % 8];
const arrow = deg => deg == null ? '' : `<svg class="windarrow" viewBox="0 0 24 24" style="transform:rotate(${deg + 180}deg)" aria-hidden="true"><path d="M12 2 18 14h-4v8h-4v-8H6z" fill="currentColor"/></svg>`;
function season(t) { const d = new Date(t), y = d.getFullYear(); const s = d.getMonth() >= 6 ? y : y - 1; return `${s}–${String((s + 1) % 100).padStart(2, '0')}`; }
const I = {
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
  cam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  loc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>',
  layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/></svg>',
  flag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4h11l-2 4 2 4H5"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>'
};

// ---------- storage ----------
const DB = (() => {
  let dbp = null; const mem = { hunts: new Map(), spots: new Map(), photos: new Map() };
  function open() { if (dbp) return dbp; dbp = new Promise(res => { try { const r = indexedDB.open('flyway-journal', 1); r.onupgradeneeded = () => { for (const s of ['hunts', 'spots', 'photos']) r.result.createObjectStore(s, { keyPath: 'id' }); }; r.onsuccess = () => res(r.result); r.onerror = () => res(null); } catch { res(null); } }); return dbp; }
  async function tx(store, mode, fn) { const db = await open(); if (!db) return fn(null, mem[store]); return new Promise((res, rej) => { const t = db.transaction(store, mode); const out = fn(t.objectStore(store)); t.oncomplete = () => res(out && out.result !== undefined ? out.result : out); t.onerror = () => rej(t.error); }); }
  return {
    all: s => tx(s, 'readonly', (st, m) => m ? [...m.values()] : st.getAll()),
    get: (s, id) => tx(s, 'readonly', (st, m) => m ? m.get(id) : st.get(id)),
    put: async (s, v) => { const r = await tx(s, 'readwrite', (st, m) => m ? m.set(v.id, v) : st.put(v)); mirror(s, 'put', v); return r; },
    del: async (s, id) => { const r = await tx(s, 'readwrite', (st, m) => m ? m.delete(id) : st.delete(id)); mirror(s, 'del', id); return r; }
  };
})();
// native app: keep a copy of everything in the phone's Documents folder (see native.js)
function mirror(store, op, v) {
  if (!NATIVE.on) return;
  if (store === 'photos') return op === 'put' ? NATIVE.mirrorPhoto(v) : NATIVE.unmirrorPhoto(v);
  NATIVE.mirrorData(() => ({ hunts, spots }));
}
let hunts = [], spots = [], photoCache = new Map();
let view = lsGet('view', 'hunt'), openId = null, activeId = lsGet('activeHunt', null);
async function loadAll() {
  hunts = (await DB.all('hunts')) || []; spots = (await DB.all('spots')) || [];
  if (NATIVE.on && !hunts.length && !spots.length) {
    const b = await NATIVE.readAutobackup();
    if (b && (b.hunts.length || b.spots.length)) {
      for (const p of b.photos) await DB.put('photos', p); for (const h of b.hunts) await DB.put('hunts', h); for (const x of b.spots) await DB.put('spots', x);
      hunts = b.hunts; spots = b.spots; setTimeout(() => toast(`Journal restored from this phone’s backup: ${hunts.length} hunt${hunts.length === 1 ? '' : 's'}.`, null, 5000), 800);
    }
  }
  hunts.sort((a, b) => b.start - a.start);
  if (activeId && !hunts.find(h => h.id === activeId)) { activeId = null; lsSet('activeHunt', null); }
}
const H = id => hunts.find(h => h.id === id);
async function saveHunt(h) { h.updated = Date.now(); await DB.put('hunts', h); if (!hunts.includes(h)) hunts.unshift(h); hunts.sort((a, b) => b.start - a.start); }
async function saveSpot(s) { await DB.put('spots', s); if (!spots.includes(s)) spots.push(s); }
async function photo(id) { if (photoCache.has(id)) return photoCache.get(id); const p = await DB.get('photos', id); if (p) photoCache.set(id, p); return p; }
const total = h => Object.values(h.birds || {}).reduce((a, n) => a + n, 0);

// ---------- GPS ----------
const GPS = { last: null };
function getPos(timeout = 15000) {
  if (NATIVE.on) return NATIVE.getPos(timeout).then(p => {
    if (p && !p.denied) { GPS.last = { lat: p.lat, lng: p.lng, acc: p.acc, t: Date.now() }; return GPS.last; }
    if (p && p.denied) toast('Location is off for Flyway. Turn it on in Settings › Flyway › Location to mark spots.');
    return GPS.last && Date.now() - GPS.last.t < 180000 ? GPS.last : null;
  });
  return new Promise(res => {
    if (!navigator.geolocation) return res(null);
    navigator.geolocation.getCurrentPosition(p => { GPS.last = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy, t: Date.now() }; res(GPS.last); },
      e => { if (e.code === 1) toast('Location is off for this app. Turn it on in your phone settings to mark spots.'); res(GPS.last && Date.now() - GPS.last.t < 180000 ? GPS.last : null); },
      { enableHighAccuracy: true, timeout, maximumAge: 15000 });
  });
}
function nearestSpot(lat, lng, within = 500) { let best = null, bd = within; for (const s of spots) { const d = hav(lat, lng, s.lat, s.lng); if (d < bd) { bd = d; best = s; } } return best; }

// ---------- weather (Open-Meteo, free, no key) ----------
const WMO = c => c == null ? '' : c === 0 ? 'Clear' : c <= 2 ? 'Partly cloudy' : c === 3 ? 'Overcast' : c <= 48 ? 'Fog' : c <= 57 ? 'Drizzle' : c <= 67 ? 'Rain' : c <= 77 ? 'Snow' : c <= 82 ? 'Showers' : c <= 86 ? 'Snow showers' : 'Storms';
const inHg = hpa => hpa == null ? null : +(hpa * 0.02953).toFixed(2);
const parseLocal = s => new Date(s).getTime(); // Open-Meteo local times "YYYY-MM-DDTHH:MM"
async function fetchWx(lat, lng, t) {
  const old = Date.now() - t > 2 * 864e5;
  const d0 = isoDate(new Date(t - 864e5)), d1 = isoDate(new Date(t + 864e5));
  const common = `latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&hourly=temperature_2m,apparent_temperature,weather_code,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation,precipitation_probability&daily=sunrise,sunset&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=auto`;
  const url = old ? `https://archive-api.open-meteo.com/v1/archive?${common.replace(',precipitation_probability', '')}&start_date=${d0}&end_date=${d1}` : `https://api.open-meteo.com/v1/forecast?${common}&past_days=2&forecast_days=3`;
  const key = 'wx:' + url; const c = lsGet(key, null);
  if (c && Date.now() - c.at < (old ? 30 * 864e5 : 45 * 60e3)) return c.j;
  const r = await fetch(url); if (!r.ok) throw new Error('weather ' + r.status); const j = await r.json();
  lsSet(key, { at: Date.now(), j }); return j;
}
function wxAt(j, t) {
  const hs = j.hourly; if (!hs?.time?.length) return null;
  let i = 0, bd = Infinity; hs.time.forEach((s, k) => { const d = Math.abs(parseLocal(s) - t); if (d < bd) { bd = d; i = k; } });
  if (bd > 3 * 3600e3) return null;
  const p = hs.pressure_msl, back = Math.max(0, i - 3), dp = (p[i] != null && p[back] != null) ? (p[i] - p[back]) * 0.02953 : 0;
  const day = isoDate(new Date(t)); const di = (j.daily?.time || []).indexOf(day);
  return { temp: Math.round(hs.temperature_2m[i]), feels: Math.round(hs.apparent_temperature?.[i] ?? hs.temperature_2m[i]), code: hs.weather_code[i], sky: WMO(hs.weather_code[i]),
    wind: Math.round(hs.wind_speed_10m[i]), dir: hs.wind_direction_10m[i], gust: Math.round(hs.wind_gusts_10m?.[i] ?? 0), pressure: inHg(p[i]), trend: dp > .02 ? 'Rising' : dp < -.02 ? 'Falling' : 'Steady',
    precip: hs.precipitation?.[i] ?? 0, pop: hs.precipitation_probability?.[i] ?? null,
    sunrise: di >= 0 ? parseLocal(j.daily.sunrise[di]) : null, sunset: di >= 0 ? parseLocal(j.daily.sunset[di]) : null };
}
async function weatherFor(lat, lng, t) { try { return wxAt(await fetchWx(lat, lng, t), t); } catch { return null; } }
function moon(t) { const syn = 29.530588853, ref = Date.UTC(2000, 0, 6, 18, 14); const age = (((t - ref) / 864e5) % syn + syn) % syn; return ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'][Math.floor(((age + syn / 16) % syn) / (syn / 8))]; }

// ---------- photos ----------
let photoTarget = null;
function compress(file) {
  return new Promise((res, rej) => { const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => { const k = Math.min(1, 1600 / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', .8)); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Could not read that image.')); }; img.src = url; });
}
async function handlePhotos(files) {
  if (!files.length || !photoTarget) return; const tg = photoTarget; photoTarget = null; const ids = [];
  for (const f of files) { try { const p = { id: uid(), data: await compress(f), t: Date.now(), lat: GPS.last?.lat ?? null, lng: GPS.last?.lng ?? null }; await DB.put('photos', p); photoCache.set(p.id, p); ids.push(p.id); } catch (e) { toast(e.message); } }
  await tg.add(ids); toast(`${ids.length} photo${ids.length === 1 ? '' : 's'} saved.`);
}
$('#camIn').onchange = e => { handlePhotos([...e.target.files]); e.target.value = ''; };
$('#libIn').onchange = e => { handlePhotos([...e.target.files]); e.target.value = ''; };
async function photosHTML(ids, ctx) {
  const ps = (await Promise.all((ids || []).map(photo))).filter(Boolean);
  return `<div class="photos">${ps.map(p => `<div class="ph"><img src="${p.data}" alt="Photo" data-act="viewPhoto" data-id="${p.id}"><button type="button" class="del" data-act="delPhoto" data-ctx="${ctx}" data-id="${p.id}" aria-label="Delete photo">×</button></div>`).join('')}</div>
  <div class="row" style="margin-top:8px"><button type="button" class="btn sm" data-act="addPhoto" data-ctx="${ctx}" data-lib="0">${I.cam}Take photo</button><button type="button" class="btn sm" data-act="addPhoto" data-ctx="${ctx}" data-lib="1">From library</button></div>`;
}
// photo contexts: "hunt:<id>", "note:<huntId>:<noteId>", "band:<huntId>:<bandId>", "pin:<huntId>:<pinId>", "spot:<id>"
function ctxTarget(ctx) {
  const [kind, a, b] = ctx.split(':');
  if (kind === 'spot') { const s = spots.find(x => x.id === a); return { obj: s, save: () => saveSpot(s), reopen: () => openSpot(a) }; }
  const h = H(a); if (!h) return null;
  if (kind === 'hunt') return { obj: h, save: () => saveHunt(h), reopen: () => render() };
  const list = kind === 'note' ? h.notables : kind === 'band' ? h.bands : h.pins;
  const o = (list || []).find(x => x.id === b);
  return { obj: o, save: () => saveHunt(h), reopen: () => kind === 'note' ? openNotable(h.id, b) : kind === 'band' ? openBand(h.id, b) : openPin(h.id, b) };
}

// ---------- sheets ----------
const sheet = $('#sheet');
function openSheet(html) { sheet.innerHTML = html; if (!sheet.open) sheet.showModal(); sheet.scrollTop = 0; }
function closeSheet() { if (sheet.open) sheet.close(); }
sheet.addEventListener('click', e => { if (e.target === sheet) closeSheet(); });
const head = t => `<div class="sheet-h"><h2>${t}</h2><button class="x" data-act="close" aria-label="Close">×</button></div>`;
const speciesSelect = (name, cur, onlyIds) => `<select name="${name}">${GROUPS.map(g => { const list = SPECIES.filter(s => s.g === g.id && (!onlyIds || onlyIds.includes(s.id) || s.id === cur)); return list.length ? `<optgroup label="${esc(g.name)}">${list.map(s => `<option value="${s.id}" ${s.id === cur ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</optgroup>` : ''; }).join('')}</select>`;

// ---------- hunts ----------
async function startHunt(manual) {
  const t = Date.now();
  const h = { id: uid(), start: manual ? t - 3 * 3600e3 : t, end: manual ? t : null, lat: null, lng: null, spotId: null, spotName: '', setup: '', hunters: 1, names: '', decoys: '',
    birds: {}, checked: [], shots: 0, retrieves: 0, bands: [], notables: [], photos: [], pins: [], notes: '', wx: null, moon: moon(t) };
  const last = hunts[0]; if (last) { h.checked = (last.checked || []).slice(); h.setup = last.setup || ''; h.hunters = last.hunters || 1; h.names = last.names || ''; }
  if (!manual) { activeId = h.id; lsSet('activeHunt', h.id); }
  await saveHunt(h); openId = h.id; view = 'hunt'; render();
  if (!manual) {
    toast('Getting your location and weather…', null, 6000);
    const p = await getPos();
    if (p) { h.lat = p.lat; h.lng = p.lng; const s = nearestSpot(p.lat, p.lng); if (s) { h.spotId = s.id; h.spotName = s.name; if (!h.setup && s.type) h.setup = s.type; } }
    if (h.lat != null) h.wx = await weatherFor(h.lat, h.lng, h.start);
    await saveHunt(h); render();
    toast(h.spotName ? `Hunt started at ${h.spotName}.` : p ? 'Hunt started. Tap the location name to save this spot.' : 'Hunt started. GPS isn’t available; you can set the spot later.');
  }
}
async function endHunt(id) { NATIVE.on && NATIVE.tap('success'); const h = H(id); h.end = Date.now(); await saveHunt(h); if (activeId === id) { activeId = null; lsSet('activeHunt', null); } openId = id; render(); toast('Hunt saved to your journal.'); }
async function bump(id, field, sp, d) {
  const h = H(id); if (!h) return;
  if (field === 'birds') { const v = (h.birds[sp] || 0) + d; if (v < 0) return; h.birds[sp] = v; if (!h.checked.includes(sp)) h.checked.push(sp); }
  else { const v = (h[field] || 0) + d; if (v < 0) return; h[field] = v; }
  NATIVE.on && NATIVE.tap(d > 0 ? 'medium' : 'light');
  await saveHunt(h); if (field === 'shots') return render(); updateCounts(h);
  if (d > 0 && field === 'birds') toast(`+1 ${SP[sp].name} · ${total(h)} total`, () => bump(id, field, sp, -1));
}
function updateCounts(h) {
  document.querySelectorAll('[data-count]').forEach(el => {
    const k = el.dataset.count; el.textContent = k === 'total' ? total(h) : k.startsWith('sp:') ? (h.birds[k.slice(3)] || 0) : k === 'bands' ? h.bands.length : (h[k] || 0);
  });
}
async function huntHTML(h) {
  const isA = h.id === activeId, w = h.wx, tot = total(h);
  const shoot = w?.sunrise ? `<span>Sunrise <b>${fmtTime(w.sunrise)}</b></span><span>Sunset <b>${fmtTime(w.sunset)}</b></span><span>Shooting light ≈ <b>${fmtTime(w.sunrise - 30 * 60e3)}</b></span>` : '';
  const sps = (h.checked || []).filter(id => SP[id]);
  let html = `<div class="card huntcard">
    <div class="row" style="align-items:flex-start;flex-wrap:nowrap"><div style="flex:1;min-width:0"><div class="label">${isA ? 'Hunting now' : fmtDayLong(h.start)}</div>
      <button class="where" data-act="spotPick" data-id="${h.id}" style="background:none;border:0;padding:0;text-align:left;color:inherit">${esc(h.spotName || 'Name this spot')} <span style="color:var(--blaze);font-size:18px">✎</span></button>
      <div class="muted small mono">${fmtTime(h.start)}${h.end ? '–' + fmtTime(h.end) : ''} · ${esc(h.setup || 'Setup?')} · ${h.hunters || 1} hunter${(h.hunters || 1) > 1 ? 's' : ''}${h.decoys ? ' · ' + esc(h.decoys) + ' decoys' : ''}</div></div>
      <button class="btn sm" data-act="details" data-id="${h.id}">Details</button></div>
    ${w ? `<div class="wx"><div><div class="l">Temp</div><div class="v">${w.temp}°F</div><div class="s">feels ${w.feels}°</div></div>
      <div><div class="l">Wind</div><div class="v">${arrow(w.dir)} ${compass(w.dir)} ${w.wind}</div><div class="s">gust ${w.gust} mph</div></div>
      <div><div class="l">Pressure</div><div class="v">${w.pressure ?? '—'}</div><div class="s">${w.trend}</div></div>
      <div><div class="l">Sky</div><div class="v" style="font-size:15px">${esc(w.sky)}</div><div class="s">${h.moon || ''}</div></div></div>
      <div class="sun">${shoot}</div>`
      : `<div class="row"><span class="muted small">No weather yet.</span><button class="btn sm" data-act="getWx" data-id="${h.id}">Get weather</button></div>`}
  </div>
  <div class="tallies">
    <div class="total"><div class="n" data-count="total">${tot}</div><div class="l">Birds</div></div>
    <div class="tally"><div class="l">Dog retrieves</div><div class="n" data-count="retrieves">${h.retrieves || 0}</div><div class="pm"><button class="pmb" data-act="bump" data-f="retrieves" data-d="-1" data-id="${h.id}" aria-label="One less retrieve">−</button><button class="pmb plus" data-act="bump" data-f="retrieves" data-d="1" data-id="${h.id}" aria-label="One more retrieve">+</button></div></div>
    <div class="tally"><div class="l">Bands</div><div class="n" data-count="bands">${h.bands.length}</div><div class="pm" style="grid-template-columns:1fr"><button class="pmb plus" data-act="newBand" data-id="${h.id}" aria-label="Add a band" style="font-size:18px">+ Add</button></div></div>
  </div>
  <div class="tallies" style="grid-template-columns:repeat(2,minmax(0,1fr))">
    <div class="tally"><div class="l">Shots fired</div><div class="row" style="justify-content:center;flex-wrap:nowrap"><button class="pmb" style="width:48px" data-act="bump" data-f="shots" data-d="-1" data-id="${h.id}" aria-label="One less shot">−</button><div class="n" data-count="shots" style="min-width:44px">${h.shots || 0}</div><button class="pmb plus" style="width:48px" data-act="bump" data-f="shots" data-d="1" data-id="${h.id}" aria-label="One more shot">+</button></div></div>
    <div class="tally"><div class="l">Birds per shot</div><div class="n" style="font-size:28px">${h.shots ? (tot / h.shots).toFixed(2) : '—'}</div><div class="small muted">${h.shots ? Math.round(tot / h.shots * 100) + '% hit rate' : 'Count shots to track'}</div></div>
  </div>
  <div class="sec"><h2>Bag</h2><span class="muted small">tap + as birds come to hand</span></div>
  <div class="splist">${sps.map(id => `<div class="sprow"><div class="bar" style="background:${spColor(id)}"></div>
      <div style="min-width:0"><div class="nm">${esc(SP[id].name)}</div><div class="sub">${esc(GR[SP[id].g].name)}${SP[id].note ? ' · ' + esc(SP[id].note) : ''}</div></div>
      <div class="ctr"><button class="pmb" data-act="bump" data-f="birds" data-sp="${id}" data-d="-1" data-id="${h.id}" aria-label="One less ${esc(SP[id].name)}">−</button><div class="n" data-count="sp:${id}">${h.birds[id] || 0}</div><button class="pmb plus" data-act="bump" data-f="birds" data-sp="${id}" data-d="1" data-id="${h.id}" aria-label="One more ${esc(SP[id].name)}">+</button></div></div>`).join('')}
    <button class="addsp" data-act="checklist" data-id="${h.id}">${sps.length ? '+ Add / remove species' : '+ Pick species for today'}</button></div>
  <div class="sec"><h2>Bands</h2><span class="spacer"></span><button class="btn sm" data-act="newBand" data-id="${h.id}">+ Band</button></div>
  ${h.bands.length ? `<div class="splist">${h.bands.map(b => `<button class="band" data-act="openBand" data-id="${h.id}" data-b="${b.id}"><div><div class="num">${esc(b.number || 'Band # not entered')}</div><div class="small muted">${esc(SP[b.sp]?.name || '')}${b.notes ? ' · ' + esc(b.notes.slice(0, 60)) : ''}</div></div><div class="small" style="color:${b.reported ? 'var(--good)' : 'var(--warn)'}">${b.reported ? 'Reported ✓' : 'Not reported'}</div></button>`).join('')}</div>` : '<div class="muted small" style="margin-top:-6px">No bands yet. Fingers crossed.</div>'}
  <div class="sec"><h2>Notable birds</h2><span class="spacer"></span><button class="btn sm" data-act="newNotable" data-id="${h.id}">+ Bird</button></div>`;
  if (h.notables.length) {
    html += '<div class="splist">';
    for (const n of h.notables) { const p = n.photos?.[0] ? await photo(n.photos[0]) : null;
      html += `<button class="item" data-act="openNotable" data-id="${h.id}" data-n="${n.id}"><div style="min-width:0"><div class="t">${esc(SP[n.sp]?.name || 'Bird')}${n.sex ? ' · ' + esc(n.sex) : ''}</div><div class="small muted">${esc((n.notes || '').slice(0, 90))}</div></div>${p ? `<img src="${p.data}" alt="" style="width:64px;height:64px;object-fit:cover;border-radius:10px">` : '<span></span>'}</button>`; }
    html += '</div>';
  } else html += '<div class="muted small" style="margin-top:-6px">Mounts, drakes in full plumage, oddballs, a great retrieve: give them their own entry with photos.</div>';
  html += `<div class="sec"><h2>Photos</h2></div><div>${await photosHTML(h.photos, 'hunt:' + h.id)}</div>
  <div class="sec"><h2>Locations</h2><span class="spacer"></span><button class="btn sm" data-act="markHere" data-id="${h.id}">${I.pin}Mark here</button></div>
  ${h.pins.length ? `<div class="splist">${h.pins.map(p => `<button class="item" data-act="openPin" data-id="${h.id}" data-p="${p.id}"><div><div class="t" style="font-size:17px"><span style="color:${PIN[p.type]?.c}">●</span> ${esc(p.name || PIN[p.type]?.l)}</div><div class="d">${fmtTime(p.t)} · ${fmtLL(p.lat, p.lng)}</div></div><span></span></button>`).join('')}</div>${h.pins.length || h.lat != null ? '' : ''}` : '<div class="muted small" style="margin-top:-6px">Blind, decoy spread, where birds were working, a bird down you couldn’t find.</div>'}
  ${h.pins.length || h.lat != null ? '<div class="minimap" id="hmap"></div>' : ''}
  <label class="f">Hunt notes<textarea id="hNotes" data-id="${h.id}" placeholder="How the birds worked, calling, what you'd change…">${esc(h.notes)}</textarea></label>
  <div class="row">${isA ? `<button class="btn primary" style="flex:1" data-act="endHunt" data-id="${h.id}">End hunt & save</button>` : ''}<button class="btn" style="flex:1" data-act="shareHunt" data-id="${h.id}">${I.share}Share summary</button></div>
  ${isA ? '' : `<button class="btn danger ghost sm" data-act="delHunt" data-id="${h.id}" style="justify-self:start">Delete this hunt</button>`}`;
  return html;
}
const PIN = { blind: { l: 'Blind / hide', c: '#F26A1B' }, decoys: { l: 'Decoy spread', c: '#3FA88A' }, working: { l: 'Birds working', c: '#E8B04A' }, down: { l: 'Bird down / lost', c: '#EF7B6B' }, scout: { l: 'Scouting note', c: '#9EC1E8' }, other: { l: 'Other', c: '#C8C8C8' } };
function pinIcon(c, big) { const s = big ? 36 : 28; return { html: `<svg class="mk" width="${s}" height="${s * 1.25}" viewBox="0 0 24 30"><path d="M12 29s-10-9-10-16.5A10 10 0 0 1 22 12.5C22 20 12 29 12 29z" fill="${c}" stroke="#fff" stroke-width="1.6"/><circle cx="12" cy="12.5" r="3.6" fill="#fff"/></svg>`, anchor: [s / 2, s * 1.25 - 1] }; }
function spotIcon() { return { html: `<svg class="mk" width="34" height="34" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5" fill="#F26A1B" stroke="#fff" stroke-width="1.6"/><path d="M6 14c2-.5 3-2.5 6-2.5s3.5 1.3 5 .7c.7-.3 1.3-1.2 1.4-2-.3 2-1.4 3.8-3.4 4.6-2 .7-4 0-6 .6s-2 .2-3-1.4z" fill="#12160F"/></svg>`, anchor: [17, 17] }; }

// checklist
function openChecklist(id) {
  const h = H(id); const used = {}; hunts.forEach(x => Object.entries(x.birds || {}).forEach(([k, v]) => used[k] = (used[k] || 0) + v));
  openSheet(`${head('Species today')}<div class="sheet-b">
    <input class="search" id="ckq" placeholder="Search species" autocomplete="off">
    <div class="small muted">Check the species you might shoot today. Each one gets its own counter. Species you've logged before show your season total.</div>
    <div id="cklist">${GROUPS.map(g => `<div class="grp" data-g="${g.id}"><h3><span style="color:${g.color}">■</span> ${esc(g.name)}</h3>${SPECIES.filter(s => s.g === g.id).map(s => `<button class="ck ${h.checked.includes(s.id) ? 'on' : ''}" data-ck="${s.id}"><span class="box">${I.check}</span><span><span class="t">${esc(s.name)}</span>${s.note ? `<br><span class="note">${esc(s.note)}</span>` : ''}</span><span class="cnt">${h.birds[s.id] ? h.birds[s.id] + ' today' : used[s.id] ? used[s.id] + ' all-time' : ''}</span></button>`).join('')}</div>`).join('')}</div>
  </div><div class="sheet-f"><button class="btn primary" data-act="close">Done</button></div>`);
  $('#ckq').oninput = e => { const q = e.target.value.toLowerCase(); sheet.querySelectorAll('[data-ck]').forEach(b => b.hidden = q && !SP[b.dataset.ck].name.toLowerCase().includes(q)); sheet.querySelectorAll('.grp').forEach(g => g.hidden = ![...g.querySelectorAll('[data-ck]')].some(b => !b.hidden)); };
  sheet.querySelectorAll('[data-ck]').forEach(b => b.onclick = async () => {
    const s = b.dataset.ck, on = h.checked.includes(s);
    if (on && h.birds[s]) { if (!b.dataset.armed) { b.dataset.armed = '1'; b.querySelector('.cnt').textContent = 'Tap again to remove ' + h.birds[s]; return; } delete h.birds[s]; }
    h.checked = on ? h.checked.filter(x => x !== s) : h.checked.concat(s);
    b.classList.toggle('on', !on); delete b.dataset.armed; await saveHunt(h);
  });
  sheet.addEventListener('close', () => render(), { once: true });
}

// details
function openDetails(id) {
  const h = H(id);
  openSheet(`${head('Hunt details')}<form id="F" class="sheet-b">
    <div class="two"><label class="f">Start<input type="datetime-local" name="start" value="${isoLocal(new Date(h.start))}"></label><label class="f">End<input type="datetime-local" name="end" value="${h.end ? isoLocal(new Date(h.end)) : ''}"></label></div>
    <div><div class="label" style="margin-bottom:6px">Setup</div><div class="chips">${SETUPS.map(s => `<button type="button" class="chip ${h.setup === s ? 'on' : ''}" data-setup="${esc(s)}">${esc(s)}</button>`).join('')}</div></div>
    <div class="three"><label class="f">Hunters<input type="number" name="hunters" min="1" value="${h.hunters || 1}" inputmode="numeric"></label><label class="f">Decoys<input name="decoys" value="${esc(h.decoys)}" placeholder="e.g. 4 dozen"></label><label class="f">Shots<input type="number" name="shots" min="0" value="${h.shots || 0}" inputmode="numeric"></label></div>
    <label class="f">Who was there<input name="names" value="${esc(h.names)}" placeholder="e.g. Greg, Sarah, Dad"></label>
    <label class="f">Dog(s)<input name="dog" value="${esc(h.dog || '')}" placeholder="e.g. Ruby"></label>
    ${h.wx ? `<div class="two"><label class="f">Temp °F<input type="number" name="temp" value="${h.wx.temp}"></label><label class="f">Wind mph<input type="number" name="wind" value="${h.wx.wind}"></label></div>
    <div class="two"><label class="f">Wind from<select name="dir">${COMPASS.map((c, i) => `<option value="${i * 22.5}" ${compass(h.wx.dir) === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label><label class="f">Sky<input name="sky" value="${esc(h.wx.sky)}"></label></div>` : ''}
    <div class="row"><button type="button" class="btn sm" data-act="getWx" data-id="${h.id}">Re-check weather for this time</button></div>
  </form><div class="sheet-f"><button class="btn primary" data-act="saveDetails" data-id="${h.id}">Save</button></div>`);
  sheet.querySelectorAll('[data-setup]').forEach(b => b.onclick = () => { sheet.querySelectorAll('[data-setup]').forEach(x => x.classList.toggle('on', x === b && !b.classList.contains('on'))); });
}
async function saveDetails(id) {
  const h = H(id), F = $('#F'); const s = new Date(F.start.value).getTime(); if (s) h.start = s; const e = new Date(F.end.value).getTime(); h.end = e || (h.id === activeId ? null : h.end);
  const on = sheet.querySelector('[data-setup].on'); h.setup = on ? on.dataset.setup : '';
  h.hunters = Math.max(1, +F.hunters.value || 1); h.decoys = F.decoys.value.trim(); h.shots = Math.max(0, +F.shots.value || 0); h.names = F.names.value.trim(); h.dog = F.dog.value.trim();
  if (h.wx && F.temp) { h.wx.temp = +F.temp.value; h.wx.wind = +F.wind.value; h.wx.dir = +F.dir.value; h.wx.sky = F.sky.value.trim(); }
  h.moon = moon(h.start); await saveHunt(h); closeSheet(); render(); toast('Saved.');
}

// spots
function openSpotPicker(id) {
  const h = H(id); const p = GPS.last;
  const list = spots.slice().sort((a, b) => p ? hav(p.lat, p.lng, a.lat, a.lng) - hav(p.lat, p.lng, b.lat, b.lng) : a.name.localeCompare(b.name));
  openSheet(`${head('Where are you hunting?')}<div class="sheet-b">
    <form id="NS" class="card" style="display:grid;gap:10px"><label class="f">Save this location as a new spot<input name="name" placeholder="e.g. North pothole, Smith's corn" autocomplete="off"></label>
      <div class="small muted mono">${h.lat != null ? fmtLL(h.lat, h.lng) : 'No GPS yet. Saving will try to get your position.'}</div>
      <button class="btn primary">Save spot</button></form>
    ${list.length ? `<div class="label">Or pick a saved spot</div><div class="splist">${list.map(s => `<button class="item" data-pickspot="${s.id}"><div><div class="t">${esc(s.name)}</div><div class="d">${esc(s.type || '')}${p ? ' · ' + (hav(p.lat, p.lng, s.lat, s.lng) / 1609.344).toFixed(1) + ' mi away' : ''} · ${hunts.filter(x => x.spotId === s.id).length} hunts</div></div><span></span></button>`).join('')}</div>` : ''}
  </div>`);
  $('#NS').onsubmit = async e => {
    e.preventDefault(); const name = e.target.name.value.trim(); if (!name) return toast('Give the spot a name.');
    if (h.lat == null) { const q = await getPos(); if (q) { h.lat = q.lat; h.lng = q.lng; } else return toast('No GPS fix. Try again outside, or drop the spot on the Map tab.'); }
    const s = { id: uid(), name, type: h.setup || '', lat: h.lat, lng: h.lng, notes: '', photos: [], created: Date.now() }; await saveSpot(s);
    h.spotId = s.id; h.spotName = s.name; await saveHunt(h); closeSheet(); render(); toast(`Saved “${name}”.`);
  };
  sheet.querySelectorAll('[data-pickspot]').forEach(b => b.onclick = async () => { const s = spots.find(x => x.id === b.dataset.pickspot); h.spotId = s.id; h.spotName = s.name; if (h.lat == null) { h.lat = s.lat; h.lng = s.lng; } if (!h.setup && s.type) h.setup = s.type; await saveHunt(h); closeSheet(); render(); });
}
async function openSpot(id) {
  const s = spots.find(x => x.id === id); if (!s) return;
  const hs = hunts.filter(h => h.spotId === id), birds = hs.reduce((a, h) => a + total(h), 0);
  openSheet(`${head(esc(s.name))}<form id="SF" class="sheet-b">
    <div class="kpis"><div class="kpi"><div class="l">Hunts</div><div class="v">${hs.length}</div></div><div class="kpi"><div class="l">Birds</div><div class="v">${birds}</div></div><div class="kpi"><div class="l">Per hunt</div><div class="v">${hs.length ? (birds / hs.length).toFixed(1) : '—'}</div></div></div>
    <label class="f">Name<input name="name" value="${esc(s.name)}"></label>
    <label class="f">Setup<select name="type"><option value="">—</option>${SETUPS.map(x => `<option ${s.type === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
    <label class="f">Notes<textarea name="notes" placeholder="Access, best wind, landowner, where to park…">${esc(s.notes)}</textarea></label>
    <div class="small muted mono">${fmtLL(s.lat, s.lng)}</div>
    <div class="row"><a class="btn sm" href="https://maps.apple.com/?daddr=${s.lat},${s.lng}" target="_blank" rel="noopener">Apple Maps</a><a class="btn sm" href="https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}" target="_blank" rel="noopener">Google Maps</a></div>
    <div><div class="label" style="margin-bottom:6px">Photos</div><div id="sph"></div></div>
  </form><div class="sheet-f"><button class="btn danger" data-act="delSpot" data-id="${s.id}">Delete</button><button class="btn primary" data-act="saveSpot" data-id="${s.id}">Save</button></div>`);
  $('#sph').innerHTML = await photosHTML(s.photos, 'spot:' + s.id);
}

// bands
function openBand(hid, bid) {
  const h = H(hid); const b = h.bands.find(x => x.id === bid);
  openSheet(`${head(b.number ? esc(b.number) : 'New band')}<form id="BF" class="sheet-b">
    <label class="f">Band number<input name="number" value="${esc(b.number)}" placeholder="e.g. 1807-12345" autocomplete="off" inputmode="text"></label>
    <label class="f">Species${speciesSelect('sp', b.sp, null)}</label>
    <div class="two"><label class="f">Sex<select name="sex">${['', 'Drake / gander', 'Hen', 'Unknown'].map(x => `<option ${b.sex === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label><label class="f">Band type<select name="kind">${['', 'Leg band (aluminum)', 'Reward band', 'Neck collar', 'Nasal saddle', 'Other'].map(x => `<option ${b.kind === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label></div>
    <label class="f">Notes<textarea name="notes" placeholder="Where it was banded, age, report results…">${esc(b.notes)}</textarea></label>
    <label class="row" style="gap:10px"><input type="checkbox" name="reported" ${b.reported ? 'checked' : ''} style="width:24px;height:24px"> <span>Reported to the Bird Banding Lab</span></label>
    <div class="notice small">Report bands at <b>reportband.gov</b>. You keep the band, and you'll get a certificate with where and when the bird was banded. <a href="https://www.reportband.gov" target="_blank" rel="noopener" style="color:var(--blaze)">Open reportband.gov</a></div>
    <div><div class="label" style="margin-bottom:6px">Photos</div><div id="bph"></div></div>
  </form><div class="sheet-f"><button class="btn danger" data-act="delBand" data-id="${hid}" data-b="${bid}">Delete</button><button class="btn primary" data-act="saveBand" data-id="${hid}" data-b="${bid}">Save</button></div>`);
  photosHTML(b.photos, `band:${hid}:${bid}`).then(x => { const el = $('#bph'); if (el) el.innerHTML = x; });
}
async function saveBandForm(hid, bid) { const h = H(hid), b = h.bands.find(x => x.id === bid), F = $('#BF'); if (!F) return; Object.assign(b, { number: F.number.value.trim(), sp: F.sp.value, sex: F.sex.value, kind: F.kind.value, notes: F.notes.value, reported: F.reported.checked }); await saveHunt(h); }

// notable birds
function openNotable(hid, nid) {
  const h = H(hid); const n = h.notables.find(x => x.id === nid);
  openSheet(`${head('Notable bird')}<form id="NF" class="sheet-b">
    <label class="f">Species${speciesSelect('sp', n.sp, null)}</label>
    <div class="two"><label class="f">Sex<select name="sex">${['', 'Drake', 'Hen', 'Gander', 'Unknown'].map(x => `<option ${n.sex === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label><label class="f">Age<select name="age">${['', 'Adult', 'Juvenile', 'Unknown'].map(x => `<option ${n.age === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label></div>
    <div class="chips">${['Going to the taxidermist', 'Full plumage', 'Banded', 'Unusual color', 'Great retrieve', 'First of species'].map(t => `<button type="button" class="chip ${(n.tags || []).includes(t) ? 'on' : ''}" data-tag="${esc(t)}">${esc(t)}</button>`).join('')}</div>
    <label class="f">Notes<textarea name="notes" placeholder="What made this bird special…">${esc(n.notes)}</textarea></label>
    <div><div class="label" style="margin-bottom:6px">Photos</div><div id="nph"></div></div>
  </form><div class="sheet-f"><button class="btn danger" data-act="delNotable" data-id="${hid}" data-n="${nid}">Delete</button><button class="btn primary" data-act="saveNotable" data-id="${hid}" data-n="${nid}">Save</button></div>`);
  sheet.querySelectorAll('[data-tag]').forEach(b => b.onclick = () => b.classList.toggle('on'));
  photosHTML(n.photos, `note:${hid}:${nid}`).then(x => { const el = $('#nph'); if (el) el.innerHTML = x; });
}
async function saveNotableForm(hid, nid) { const h = H(hid), n = h.notables.find(x => x.id === nid), F = $('#NF'); if (!F) return; Object.assign(n, { sp: F.sp.value, sex: F.sex.value, age: F.age.value, notes: F.notes.value, tags: [...sheet.querySelectorAll('[data-tag].on')].map(b => b.dataset.tag) }); await saveHunt(h); }

// pins
async function addPin(hid, lat, lng) {
  const h = H(hid);
  if (lat == null) { toast('Getting your location…', null, 5000); const p = await getPos(); if (!p) return toast('No GPS fix. On the Map tab, tap the pin button and tap the spot instead.'); lat = p.lat; lng = p.lng; }
  const p = { id: uid(), type: 'blind', name: '', notes: '', lat, lng, t: Date.now(), photos: [] };
  h.pins.push(p); await saveHunt(h); openPin(hid, p.id, true);
}
function openPin(hid, pid, isNew) {
  const h = H(hid), p = h.pins.find(x => x.id === pid);
  openSheet(`${head(isNew ? 'Location marked' : esc(p.name || PIN[p.type].l))}<form id="PF" class="sheet-b">
    <div class="chips">${Object.entries(PIN).map(([k, v]) => `<button type="button" class="chip ${p.type === k ? 'on' : ''}" data-ptype="${k}"><span style="color:${v.c}">●</span> ${v.l}</button>`).join('')}</div>
    <label class="f">Name (optional)<input name="name" value="${esc(p.name)}" placeholder="e.g. Point blind"></label>
    <label class="f">Notes<textarea name="notes" placeholder="Wind, where birds landed, what to try next time…">${esc(p.notes)}</textarea></label>
    <div class="small muted mono">${fmtLL(p.lat, p.lng)} · ${fmtDay(p.t)} ${fmtTime(p.t)}</div>
    <div class="row"><a class="btn sm" href="https://maps.apple.com/?daddr=${p.lat},${p.lng}" target="_blank" rel="noopener">Apple Maps</a><a class="btn sm" href="https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}" target="_blank" rel="noopener">Google Maps</a></div>
    <div><div class="label" style="margin-bottom:6px">Photos</div><div id="pph"></div></div>
  </form><div class="sheet-f"><button class="btn danger" data-act="delPin" data-id="${hid}" data-p="${pid}">Delete</button><button class="btn primary" data-act="savePin" data-id="${hid}" data-p="${pid}">Save</button></div>`);
  sheet.querySelectorAll('[data-ptype]').forEach(b => b.onclick = () => sheet.querySelectorAll('[data-ptype]').forEach(x => x.classList.toggle('on', x === b)));
  photosHTML(p.photos, `pin:${hid}:${pid}`).then(x => { const el = $('#pph'); if (el) el.innerHTML = x; });
}
async function savePinForm(hid, pid) { const h = H(hid), p = h.pins.find(x => x.id === pid), F = $('#PF'); if (!F) return; Object.assign(p, { type: sheet.querySelector('[data-ptype].on')?.dataset.ptype || p.type, name: F.name.value.trim(), notes: F.notes.value }); await saveHunt(h); }

function summaryText(h) {
  const sp = Object.entries(h.birds).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).map(([id, n]) => `${SP[id]?.name || id} ${n}`).join(', ');
  const w = h.wx ? `\n${compass(h.wx.dir)} wind ${h.wx.wind} mph · ${h.wx.temp}°F · ${h.wx.pressure ?? ''} inHg ${h.wx.trend?.toLowerCase() || ''} · ${h.wx.sky}` : '';
  return `${fmtDay(h.start)} · ${h.spotName || 'Waterfowl hunt'}${h.setup ? ' (' + h.setup + ')' : ''}\n${total(h)} birds${sp ? ': ' + sp : ''}\nDog retrieves ${h.retrieves || 0} · Bands ${h.bands.length} · ${h.hunters || 1} hunter${(h.hunters || 1) > 1 ? 's' : ''}${h.shots ? ' · ' + h.shots + ' shots' : ''}${w}${h.notes ? '\n' + h.notes : ''}\n— Flyway Journal`;
}

// ---------- map ----------
const TILE = { street: NATIVE.on ? { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', attr: 'Tiles © Esri' } : { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attr: '© OpenStreetMap' }, sat: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr: 'Imagery © Esri, Maxar' } };
const MAPV = {
  map: null, drop: false, sat: lsGet('mapSat', true),
  mount(el) {
    el.innerHTML = `<div id="map"></div>${this.drop ? `<div class="maphint">Tap the map to ${activeId ? 'mark a location on today’s hunt' : 'save a new spot'}</div>` : ''}
    <div class="mapctl"><button data-act="mapLocate" aria-label="Center on me">${I.loc}</button><button data-act="mapLayer" aria-label="Satellite or street map">${I.layers}</button><button data-act="mapDrop" class="${this.drop ? 'on' : ''}" aria-label="Drop a pin">${I.pin}</button></div>`;
    const saved = lsGet('mapView', null), v = saved || [39.5, -96, 4], t = this.sat ? TILE.sat : TILE.street;
    const m = this.map = new TinyMap($('#map'), { lat: v[0], lng: v[1], zoom: v[2], tileUrl: t.url, attribution: t.attr });
    m.on('move', () => lsSet('mapView', [m.lat, m.lng, m.z]));
    m.on('click', ll => { if (this.drop) { this.drop = false; this.dropAt(ll); } });
    m.on('longpress', ll => this.dropAt(ll));
    this.draw();
    if (!saved) { const pts = spots.map(s => [s.lat, s.lng]).concat(hunts.flatMap(h => h.pins.map(p => [p.lat, p.lng]))); if (pts.length) requestAnimationFrame(() => m.fitBounds(pts, 60, 16)); else if (GPS.last) m.setView(GPS.last.lat, GPS.last.lng, 13); }
  },
  async dropAt(ll) {
    if (activeId) { render(); return addPin(activeId, ll.lat, ll.lng); }
    const s = { id: uid(), name: 'New spot', type: '', lat: ll.lat, lng: ll.lng, notes: '', photos: [], created: Date.now() }; await saveSpot(s); render(); openSpot(s.id);
  },
  draw() {
    if (!this.map) return; const marks = [];
    for (const s of spots) marks.push(Object.assign(spotIcon(), { lat: s.lat, lng: s.lng, label: s.name, onClick: () => openSpot(s.id) }));
    for (const h of hunts) for (const p of h.pins) marks.push(Object.assign(pinIcon(PIN[p.type]?.c || '#ccc'), { lat: p.lat, lng: p.lng, label: p.name || PIN[p.type]?.l, onClick: () => openPin(h.id, p.id) }));
    if (GPS.last) marks.push({ lat: GPS.last.lat, lng: GPS.last.lng, html: '<div class="me"></div>', anchor: [9, 9] });
    this.map.setOverlay([], marks);
  }
};
function huntMiniMap(h) {
  const el = $('#hmap'); if (!el) return;
  const m = new TinyMap(el, { tileUrl: (MAPV.sat ? TILE.sat : TILE.street).url, attribution: (MAPV.sat ? TILE.sat : TILE.street).attr });
  const marks = h.pins.map(p => Object.assign(pinIcon(PIN[p.type]?.c || '#ccc'), { lat: p.lat, lng: p.lng, onClick: () => openPin(h.id, p.id) }));
  if (h.lat != null) marks.unshift(Object.assign(spotIcon(), { lat: h.lat, lng: h.lng }));
  m.setOverlay([], marks); const pts = marks.map(k => [k.lat, k.lng]);
  requestAnimationFrame(() => pts.length > 1 ? m.fitBounds(pts, 40, 17) : pts.length ? m.setView(pts[0][0], pts[0][1], 15) : 0);
}

// ---------- views ----------
function go(v) { view = v; lsSet('view', v); if (v === 'hunt') openId = null; render(); $('#main').scrollTop = 0; }
async function render() {
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.go === view));
  const main = $('#main'), y = main.scrollTop;
  if (view !== 'map' && MAPV.map) { MAPV.map.destroy(); MAPV.map = null; }
  if (view === 'map') { main.innerHTML = '<div class="view map"></div>'; MAPV.mount(main.firstChild); return; }
  let html = '';
  if (view === 'journal') html = renderJournal();
  else if (view === 'stats') html = renderStats();
  else { const h = H(openId) || H(activeId); html = h ? await huntHTML(h) : await renderStart(); }
  main.innerHTML = `<div class="view">${html}</div>`; main.scrollTop = y;
  if (view === 'hunt') { const h = H(openId) || H(activeId); if (h) huntMiniMap(h); }
}
async function renderStart() {
  let fc = '';
  const p = GPS.last;
  if (p) {
    try {
      const j = await fetchWx(p.lat, p.lng, Date.now());
      const tomorrow = isoDate(new Date(Date.now() + 864e5)); const di = j.daily.time.indexOf(tomorrow);
      if (di >= 0) { const sr = parseLocal(j.daily.sunrise[di]); const w = wxAt(j, sr);
        if (w) fc = `<div class="card"><div class="label">Tomorrow at shooting light · ${fmtTime(sr - 30 * 60e3)}</div>
        <div class="wx" style="margin-top:8px"><div><div class="l">Temp</div><div class="v">${w.temp}°F</div></div><div><div class="l">Wind</div><div class="v">${arrow(w.dir)} ${compass(w.dir)} ${w.wind}</div></div><div><div class="l">Pressure</div><div class="v">${w.pressure}</div><div class="s">${w.trend}</div></div><div><div class="l">Sky</div><div class="v" style="font-size:15px">${esc(w.sky)}</div><div class="s">${w.pop != null ? w.pop + '% precip' : ''}</div></div></div></div>`; }
    } catch { }
  }
  const s = hunts.filter(h => season(h.start) === season(Date.now()));
  return `<div class="card" style="display:grid;gap:12px"><div class="label">${fmtDayLong(Date.now())}</div>
    <button class="btn primary big" data-act="startHunt">Start today's hunt</button>
    <div class="small muted">Saves the time, GPS spot and weather. Then tap + as birds come to hand.</div>
    <button class="btn ghost sm" data-act="pastHunt">+ Log a past hunt</button></div>
  ${fc || (p ? '' : '<div class="notice small">Allow location to see tomorrow’s shooting-light forecast here.</div>')}
  <div class="kpis"><div class="kpi hot"><div class="l">${season(Date.now())} birds</div><div class="v">${s.reduce((a, h) => a + total(h), 0)}</div></div><div class="kpi"><div class="l">Hunts</div><div class="v">${s.length}</div></div><div class="kpi"><div class="l">Bands</div><div class="v">${s.reduce((a, h) => a + h.bands.length, 0)}</div></div></div>
  ${hunts.length ? `<div class="sec"><h2>Last hunt</h2></div>${huntItem(hunts[0])}` : ''}
  <div class="notice small">Shooting hours, bag limits and open species vary by state and zone. Check your regulations before you go.</div>`;
}
function huntItem(h) {
  const sps = Object.entries(h.birds || {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  return `<button class="item" data-act="openHunt" data-id="${h.id}"><div style="min-width:0"><div class="t">${esc(h.spotName || 'Hunt')}${h.id === activeId ? ' <span style="color:var(--blaze)">· now</span>' : ''}</div>
    <div class="d">${fmtDay(h.start)}${h.setup ? ' · ' + esc(h.setup) : ''}${h.wx ? ` · ${compass(h.wx.dir)} ${h.wx.wind} · ${h.wx.temp}°` : ''}</div></div>
    <div class="big">${total(h)}<small>birds</small></div>
    ${sps.length ? `<div class="sps">${sps.map(([id, n]) => `<span class="pill"><i style="background:${spColor(id)}"></i>${esc(SP[id]?.name || id)} ${n}</span>`).join('')}</div>` : ''}
    <div class="sps small muted">${h.retrieves ? `<span>${h.retrieves} dog retrieves</span>` : ''}${h.bands.length ? `<span>· ${h.bands.length} band${h.bands.length > 1 ? 's' : ''}</span>` : ''}${h.notables.length ? `<span>· ${h.notables.length} notable</span>` : ''}</div></button>`;
}
function seasonsList() { const s = new Set(hunts.map(h => season(h.start))); s.add(season(Date.now())); return [...s].sort().reverse(); }
let journalSeason = 'all', statSeason = null;
function renderJournal() {
  const ss = seasonsList(); const list = hunts.filter(h => journalSeason === 'all' || season(h.start) === journalSeason);
  return `<div class="row"><h2 style="font-size:28px;text-transform:uppercase">Journal</h2><span class="spacer"></span><button class="btn sm" data-act="pastHunt">+ Past hunt</button></div>
  <div class="chips"><button class="chip ${journalSeason === 'all' ? 'on' : ''}" data-jseason="all">All</button>${ss.map(s => `<button class="chip ${journalSeason === s ? 'on' : ''}" data-jseason="${s}">${s}</button>`).join('')}</div>
  ${list.length ? `<div class="splist">${list.map(huntItem).join('')}</div>` : '<div class="card empty">No hunts logged yet. Start one from the Hunt tab.</div>'}`;
}
function renderStats() {
  const ss = seasonsList(); if (!statSeason) statSeason = ss[0];
  const list = hunts.filter(h => statSeason === 'all' || season(h.start) === statSeason);
  const birds = list.reduce((a, h) => a + total(h), 0), ret = list.reduce((a, h) => a + (h.retrieves || 0), 0), bands = list.flatMap(h => h.bands.map(b => ({ b, h }))), shots = list.reduce((a, h) => a + (h.shots || 0), 0);
  const bySp = {}; list.forEach(h => Object.entries(h.birds).forEach(([k, n]) => { if (n) bySp[k] = (bySp[k] || 0) + n; }));
  const spRows = Object.entries(bySp).sort((a, b) => b[1] - a[1]); const max = spRows[0]?.[1] || 1;
  const group = (keyFn) => { const o = {}; list.forEach(h => { const k = keyFn(h); if (!k) return; o[k] = o[k] || { n: 0, b: 0 }; o[k].n++; o[k].b += total(h); }); return Object.entries(o).sort((a, b) => b[1].b / b[1].n - a[1].b / a[1].n); };
  const tbl = (rows, label) => rows.length ? `<div style="overflow-x:auto"><table class="t"><thead><tr><th>${label}</th><th class="num">Hunts</th><th class="num">Birds</th><th class="num">Per hunt</th></tr></thead><tbody>${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="num">${v.n}</td><td class="num">${v.b}</td><td class="num">${(v.b / v.n).toFixed(1)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="muted small">Not enough hunts yet.</div>';
  const lifelist = new Set(hunts.flatMap(h => Object.entries(h.birds).filter(([, n]) => n > 0).map(([k]) => k)));
  return `<div class="row"><h2 style="font-size:28px;text-transform:uppercase">Season</h2><span class="spacer"></span><select class="search" style="width:auto" id="statSeason"><option value="all" ${statSeason === 'all' ? 'selected' : ''}>All seasons</option>${ss.map(s => `<option ${s === statSeason ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
  <div class="kpis"><div class="kpi hot"><div class="l">Birds</div><div class="v">${birds}</div></div><div class="kpi"><div class="l">Hunts</div><div class="v">${list.length}</div></div><div class="kpi"><div class="l">Per hunt</div><div class="v">${list.length ? (birds / list.length).toFixed(1) : '—'}</div></div>
  <div class="kpi"><div class="l">Dog retrieves</div><div class="v">${ret}</div></div><div class="kpi"><div class="l">Bands</div><div class="v">${bands.length}</div></div><div class="kpi"><div class="l">Birds / shot</div><div class="v">${shots ? (birds / shots).toFixed(2) : '—'}</div></div></div>
  <div class="card" style="display:grid;gap:10px"><div class="label">By species · ${spRows.length} species</div>
    ${spRows.map(([id, n]) => `<div class="hbar"><span>${esc(SP[id]?.name || id)}</span><span class="mono">${n}</span><div class="track"><i style="width:${(n / max * 100).toFixed(0)}%;background:${spColor(id)}"></i></div></div>`).join('') || '<div class="muted small">No birds logged yet.</div>'}</div>
  <div class="card"><div class="label" style="margin-bottom:6px">Best spots</div>${tbl(group(h => h.spotName), 'Spot')}</div>
  <div class="card"><div class="label" style="margin-bottom:6px">Best wind</div>${tbl(group(h => h.wx ? compass8(h.wx.dir) : null), 'Wind from')}</div>
  <div class="card"><div class="label" style="margin-bottom:6px">By setup</div>${tbl(group(h => h.setup), 'Setup')}</div>
  <div class="card"><div class="label" style="margin-bottom:6px">Pressure trend</div>${tbl(group(h => h.wx?.trend), 'Barometer')}</div>
  ${bands.length ? `<div class="card" style="display:grid;gap:8px"><div class="label">Bands</div>${bands.map(({ b, h }) => `<button class="band" data-act="openBand" data-id="${h.id}" data-b="${b.id}"><div><div class="num">${esc(b.number || '—')}</div><div class="small muted">${esc(SP[b.sp]?.name || '')} · ${fmtDay(h.start)} · ${esc(h.spotName || '')}</div></div><div class="small" style="color:${b.reported ? 'var(--good)' : 'var(--warn)'}">${b.reported ? 'Reported' : 'Report'}</div></button>`).join('')}</div>` : ''}
  <div class="card"><div class="label" style="margin-bottom:6px">Life list · ${lifelist.size} species all-time</div><div class="chips">${SPECIES.filter(s => lifelist.has(s.id)).map(s => `<span class="pill"><i style="background:${spColor(s.id)}"></i>${esc(s.name)}</span>`).join('') || '<span class="muted small">Your first bird starts the list.</span>'}</div></div>
  <div class="card" style="display:grid;gap:10px"><div class="label">Your data</div><div class="small muted">Everything stays on this phone. Save a backup now and then, and before switching phones.</div>
    <div class="row"><button class="btn sm" data-act="exportData">Save backup</button><button class="btn sm" data-act="importData">Restore backup</button><button class="btn sm" data-act="exportCSV">Season spreadsheet (CSV)</button></div><a class="small" style="color:var(--ink2)" href="${NATIVE.on ? APP_CONFIG.webUrl : ''}privacy.html" target="_blank" rel="noopener">Privacy policy</a></div>
  <p class="small muted">Weather: Open-Meteo.com (CC BY 4.0). Maps: ${NATIVE.on ? 'Esri' : '© OpenStreetMap contributors'}, imagery © Esri, Maxar.</p>`;
}

// ---------- share, backup ----------
const appURL = () => NATIVE.on ? NATIVE.shareUrl() : location.origin + location.pathname.replace(/index\.html$/, '');
function openShare() {
  if (!NATIVE.on && !(location.protocol === 'https:' || location.hostname === 'localhost')) return openSheet(`${head('Share this app')}<div class="sheet-b"><div class="notice">Sharing works once the app is online at its own web address.</div></div>`);
  openSheet(`${head('Share this app')}<div class="sheet-b"><p style="margin:0">Hunting buddies can scan this with their phone camera to get the app. It's free, and everyone's journal stays private on their own phone.</p>
    <div class="qrbox">${qrSVG(appURL(), 250)}</div><div class="urlbox" id="urlbox">${esc(appURL())}</div>
    <div class="two">${NATIVE.on || navigator.share ? '<button class="btn primary" data-act="nativeShare">Send link…</button>' : ''}<button class="btn" data-act="copyLink">Copy link</button></div></div>`);
}
function download(name, text, type) {
  if (NATIVE.on) return NATIVE.saveFile(name, text).then(() => toast('Saved. Also in the Files app › On My iPhone › Flyway › Flyway Exports.', null, 4500)).catch(e => toast('Couldn’t save: ' + (e.message || e)));
  const blob = new Blob([text], { type }); const file = new File([blob], name, { type });
  if (navigator.canShare?.({ files: [file] })) return navigator.share({ files: [file], title: name }).catch(() => { });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
async function exportData() { download(`flyway-backup-${isoDate(new Date())}.json`, JSON.stringify({ app: 'flyway-journal', version: 1, exportedAt: new Date().toISOString(), hunts, spots, photos: await DB.all('photos') }), 'application/json'); }
function exportCSV() {
  const list = hunts.filter(h => statSeason === 'all' || !statSeason || season(h.start) === statSeason).slice().reverse();
  const cols = ['Date', 'Start', 'End', 'Spot', 'Setup', 'Hunters', 'Total birds', ...SPECIES.map(s => s.name), 'Dog retrieves', 'Bands', 'Band numbers', 'Shots', 'Temp F', 'Wind mph', 'Wind from', 'Pressure inHg', 'Trend', 'Sky', 'Notes'];
  const q = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const rows = list.map(h => [isoDate(new Date(h.start)), fmtTime(h.start), h.end ? fmtTime(h.end) : '', h.spotName, h.setup, h.hunters, total(h), ...SPECIES.map(s => h.birds[s.id] || ''), h.retrieves || 0, h.bands.length, h.bands.map(b => b.number).filter(Boolean).join(' '), h.shots || '', h.wx?.temp ?? '', h.wx?.wind ?? '', h.wx ? compass(h.wx.dir) : '', h.wx?.pressure ?? '', h.wx?.trend ?? '', h.wx?.sky ?? '', h.notes]);
  download(`flyway-${String(statSeason || 'all').replace('–', '-')}.csv`, [cols, ...rows].map(r => r.map(q).join(',')).join('\n'), 'text/csv');
}
$('#importIn').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { const j = JSON.parse(await f.text()); if (j.app !== 'flyway-journal') throw new Error('That isn’t a Flyway Journal backup.');
    let n = 0; for (const p of j.photos || []) await DB.put('photos', p); for (const h of j.hunts || []) { if (!H(h.id)) n++; await DB.put('hunts', h); } for (const s of j.spots || []) await DB.put('spots', s);
    await loadAll(); render(); toast(`Restored. ${n} new hunt${n === 1 ? '' : 's'} added; nothing was deleted.`);
  } catch (err) { toast('Couldn’t restore: ' + err.message); }
};

// ---------- events ----------
// forms here never submit to a server; stop any stray submit from reloading the page
document.addEventListener('submit', e => e.preventDefault(), true);
document.addEventListener('click', async e => {
  const b = e.target.closest('button, img[data-act]'); if (!b) return; const d = b.dataset;
  if (d.go) return go(d.go);
  if (d.jseason) { journalSeason = d.jseason; return render(); }
  if (d.ck || d.pickspot || d.setup || d.ptype || d.tag || d.col) return;
  const ctxSaveFirst = async () => { if ($('#BF')) await saveBandForm(...[...sheet.querySelectorAll('[data-act=saveBand]')].map(x => [x.dataset.id, x.dataset.b])[0]); if ($('#NF')) await saveNotableForm(...[...sheet.querySelectorAll('[data-act=saveNotable]')].map(x => [x.dataset.id, x.dataset.n])[0]); if ($('#PF')) await savePinForm(...[...sheet.querySelectorAll('[data-act=savePin]')].map(x => [x.dataset.id, x.dataset.p])[0]); };
  switch (d.act) {
    case 'close': return closeSheet();
    case 'startHunt': return startHunt(false);
    case 'pastHunt': await startHunt(true); return openDetails(openId);
    case 'openHunt': openId = d.id; view = 'hunt'; lsSet('view', 'hunt'); await render(); $('#main').scrollTop = 0; return;
    case 'endHunt': return endHunt(d.id);
    case 'bump': return bump(d.id, d.f, d.sp, +d.d);
    case 'checklist': return openChecklist(d.id);
    case 'details': return openDetails(d.id);
    case 'saveDetails': return saveDetails(d.id);
    case 'spotPick': return openSpotPicker(d.id);
    case 'getWx': { const h = H(d.id); if (h.lat == null) { const p = await getPos(); if (!p) return toast('Need a location to look up weather.'); h.lat = p.lat; h.lng = p.lng; } toast('Checking weather…'); const w = await weatherFor(h.lat, h.lng, h.start); if (!w) return toast('Couldn’t get weather for that time. Check your connection.'); h.wx = w; h.moon = moon(h.start); await saveHunt(h); closeSheet(); render(); return toast('Weather added.'); }
    case 'newBand': { const h = H(d.id); const sp = Object.entries(h.birds).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])[0]?.[0] || h.checked[0] || 'mall'; const band = { id: uid(), number: '', sp, sex: '', kind: 'Leg band (aluminum)', notes: '', reported: false, photos: [], t: Date.now() }; h.bands.push(band); await saveHunt(h); updateCounts(h); return openBand(h.id, band.id); }
    case 'openBand': return openBand(d.id, d.b);
    case 'saveBand': await saveBandForm(d.id, d.b); closeSheet(); render(); return toast('Band saved.');
    case 'delBand': { if (!b.dataset.armed) { b.dataset.armed = 1; b.textContent = 'Tap again to delete'; return; } const h = H(d.id); h.bands = h.bands.filter(x => x.id !== d.b); await saveHunt(h); closeSheet(); return render(); }
    case 'newNotable': { const h = H(d.id); const sp = Object.entries(h.birds).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])[0]?.[0] || 'mall'; const n = { id: uid(), sp, sex: '', age: '', notes: '', tags: [], photos: [], t: Date.now() }; h.notables.push(n); await saveHunt(h); return openNotable(h.id, n.id); }
    case 'openNotable': return openNotable(d.id, d.n);
    case 'saveNotable': await saveNotableForm(d.id, d.n); closeSheet(); render(); return toast('Saved.');
    case 'delNotable': { if (!b.dataset.armed) { b.dataset.armed = 1; b.textContent = 'Tap again to delete'; return; } const h = H(d.id); h.notables = h.notables.filter(x => x.id !== d.n); await saveHunt(h); closeSheet(); return render(); }
    case 'markHere': return addPin(d.id);
    case 'openPin': return openPin(d.id, d.p);
    case 'savePin': await savePinForm(d.id, d.p); closeSheet(); render(); return toast('Saved.');
    case 'delPin': { if (!b.dataset.armed) { b.dataset.armed = 1; b.textContent = 'Tap again to delete'; return; } const h = H(d.id); h.pins = h.pins.filter(x => x.id !== d.p); await saveHunt(h); closeSheet(); return render(); }
    case 'saveSpot': { const s = spots.find(x => x.id === d.id), F = $('#SF'); s.name = F.name.value.trim() || s.name; s.type = F.type.value; s.notes = F.notes.value; await saveSpot(s); hunts.filter(h => h.spotId === s.id).forEach(h => { h.spotName = s.name; saveHunt(h); }); closeSheet(); render(); return toast('Spot saved.'); }
    case 'delSpot': { if (!b.dataset.armed) { b.dataset.armed = 1; b.textContent = 'Tap again (hunts keep their records)'; return; } await DB.del('spots', d.id); spots = spots.filter(x => x.id !== d.id); closeSheet(); return render(); }
    case 'delHunt': { if (!b.dataset.armed) { b.dataset.armed = 1; b.textContent = 'Tap again to delete this hunt'; return; } const h = H(d.id); for (const pid of [...h.photos, ...h.notables.flatMap(n => n.photos || []), ...h.bands.flatMap(x => x.photos || []), ...h.pins.flatMap(x => x.photos || [])]) await DB.del('photos', pid); await DB.del('hunts', d.id); hunts = hunts.filter(x => x.id !== d.id); openId = null; render(); return toast('Hunt deleted.'); }
    case 'shareHunt': { const t = summaryText(H(d.id)); if (NATIVE.on) { await NATIVE.shareText({ title: 'Hunt summary', text: t }); return; } if (navigator.share) { try { await navigator.share({ title: 'Hunt summary', text: t }); } catch { } } else { try { await navigator.clipboard.writeText(t); toast('Summary copied.'); } catch { openSheet(`${head('Hunt summary')}<div class="sheet-b"><pre style="white-space:pre-wrap;font:15px var(--body)">${esc(t)}</pre></div>`); } } return; }
    case 'addPhoto': { await ctxSaveFirst(); const tg = ctxTarget(d.ctx); photoTarget = { add: async ids => { tg.obj.photos = (tg.obj.photos || []).concat(ids); await tg.save(); tg.reopen(); } }; return (d.lib === '1' ? $('#libIn') : $('#camIn')).click(); }
    case 'delPhoto': { if (!b.dataset.armed) { b.dataset.armed = 1; b.textContent = '?'; b.style.background = '#B23A2E'; return; } await ctxSaveFirst(); const tg = ctxTarget(d.ctx); tg.obj.photos = tg.obj.photos.filter(x => x !== d.id); await DB.del('photos', d.id); photoCache.delete(d.id); await tg.save(); return tg.reopen(); }
    case 'viewPhoto': { const p = await photo(d.id); return p && openSheet(`${head(fmtDay(p.t) + ' ' + fmtTime(p.t))}<div class="sheet-b"><img src="${p.data}" alt="Photo" style="width:100%;border-radius:12px"></div>`); }
    case 'mapLocate': { const p = await getPos(); if (p && MAPV.map) { MAPV.map.setView(p.lat, p.lng, 15); MAPV.draw(); } return; }
    case 'mapLayer': MAPV.sat = !MAPV.sat; lsSet('mapSat', MAPV.sat); return MAPV.map?.setTiles((MAPV.sat ? TILE.sat : TILE.street).url, (MAPV.sat ? TILE.sat : TILE.street).attr);
    case 'mapDrop': MAPV.drop = !MAPV.drop; return render();
    case 'share': return openShare();
    case 'nativeShare': if (NATIVE.on) { await NATIVE.shareText({ title: 'Flyway Journal', text: 'Free waterfowl hunting journal app', url: appURL() }); return; } try { await navigator.share({ title: 'Flyway Journal', text: 'Free waterfowl hunting journal app', url: appURL() }); } catch { } return;
    case 'copyLink': try { await navigator.clipboard.writeText(appURL()); toast('Link copied.'); } catch { toast('Press and hold the address to copy it.'); } return;
    case 'exportData': return exportData();
    case 'importData': return $('#importIn').click();
    case 'exportCSV': return exportCSV();
  }
});
document.addEventListener('change', e => {
  if (e.target.id === 'statSeason') { statSeason = e.target.value; render(); }
  if (e.target.id === 'hNotes') { const h = H(e.target.dataset.id); h.notes = e.target.value; saveHunt(h); }
});
document.addEventListener('input', e => { if (e.target.id === 'hNotes') { const h = H(e.target.dataset.id); h.notes = e.target.value; clearTimeout(window._nt); window._nt = setTimeout(() => saveHunt(h), 600); } });

// ---------- start ----------
(async function boot() {
  await loadAll();
  try { await navigator.storage?.persist?.(); } catch { }
  if (view === 'hunt' && activeId) openId = activeId;
  await render();
  NATIVE.ready();
  getPos(10000).then(p => { if (p && view === 'hunt' && !activeId && !openId) render(); if (p && MAPV.map) MAPV.draw(); });
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });
})();
