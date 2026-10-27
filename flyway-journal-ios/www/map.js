// TinyMap: a small slippy map (Web Mercator tiles, routes, markers, pan/pinch/tap). No outside libraries.
(function () {
  const TS = 256;
  const lon2x = (lng, z) => (lng + 180) / 360 * TS * 2 ** z;
  const lat2y = (lat, z) => { const s = Math.sin(lat * Math.PI / 180); return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * TS * 2 ** z; };
  const x2lon = (x, z) => x / (TS * 2 ** z) * 360 - 180;
  const y2lat = (y, z) => { const n = Math.PI - 2 * Math.PI * y / (TS * 2 ** z); return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))); };

  class TinyMap {
    constructor(el, o = {}) {
      this.el = el; this.lat = o.lat ?? 26.445; this.lng = o.lng ?? -82.09; this.z = o.zoom ?? 13;
      this.minZ = 3; this.maxZ = o.maxZoom ?? 19; this.tileUrl = o.tileUrl; this.attr = o.attribution || ''; this.interactive = o.interactive !== false;
      this.handlers = {}; this.lines = []; this.markers = []; this.tiles = new Map();
      el.classList.add('tmap'); el.innerHTML = '<div class="tm-tiles"></div><svg class="tm-svg"></svg><div class="tm-marks"></div><div class="tm-attr"></div>';
      this.tEl = el.querySelector('.tm-tiles'); this.svg = el.querySelector('.tm-svg'); this.mEl = el.querySelector('.tm-marks');
      el.querySelector('.tm-attr').innerHTML = this.attr;
      if (this.interactive) this._gestures();
      this._ro = new ResizeObserver(() => this.render()); this._ro.observe(el);
      this.render();
    }
    on(ev, fn) { this.handlers[ev] = fn; return this; }
    _emit(ev, a) { this.handlers[ev]?.(a); }
    size() { return { w: this.el.clientWidth, h: this.el.clientHeight }; }
    project(lat, lng, z = this.z) { const { w, h } = this.size(); return { x: lon2x(lng, z) - lon2x(this.lng, z) + w / 2, y: lat2y(lat, z) - lat2y(this.lat, z) + h / 2 }; }
    unproject(px, py) { const { w, h } = this.size(); return { lat: y2lat(lat2y(this.lat, this.z) + py - h / 2, this.z), lng: x2lon(lon2x(this.lng, this.z) + px - w / 2, this.z) }; }
    setView(lat, lng, z = this.z) { this.lat = lat; this.lng = lng; this.z = Math.max(this.minZ, Math.min(this.maxZ, z)); this.render(); this._emit('move'); }
    setTiles(url, attr) { this.tileUrl = url; this.attr = attr || ''; this.el.querySelector('.tm-attr').innerHTML = this.attr; this.tiles.forEach(t => t.remove()); this.tiles.clear(); this.render(); }
    fitBounds(pts, padPx = 40, maxZ = 17) {
      if (!pts.length) return;
      let a = 90, b = -90, c = 180, d = -180; for (const [la, ln] of pts) { a = Math.min(a, la); b = Math.max(b, la); c = Math.min(c, ln); d = Math.max(d, ln); }
      const { w, h } = this.size(); let z = maxZ;
      while (z > this.minZ && (lon2x(d, z) - lon2x(c, z) > w - 2 * padPx || lat2y(a, z) - lat2y(b, z) > h - 2 * padPx)) z -= .25;
      this.setView((a + b) / 2, (c + d) / 2, Math.floor(z * 4) / 4);
    }
    setOverlay(lines, markers) { this.lines = lines || []; this.markers = markers || []; this._drawMarkers(); this.render(); }
    zoomAround(px, py, dz) {
      const before = this.unproject(px, py); const nz = Math.max(this.minZ, Math.min(this.maxZ, this.z + dz)); if (nz === this.z) return;
      this.z = nz; const after = this.unproject(px, py);
      this.lat += before.lat - after.lat; this.lng += before.lng - after.lng; this.render(); this._emit('move');
    }
    render() {
      if (this._raf) return;
      this._raf = requestAnimationFrame(() => { this._raf = 0; this._renderNow(); });
    }
    _renderNow() {
      const { w, h } = this.size(); if (!w || !h) return;
      const tz = Math.max(0, Math.min(this.maxZ, Math.round(this.z))), sc = 2 ** (this.z - tz);
      const cx = lon2x(this.lng, tz), cy = lat2y(this.lat, tz);
      const left = cx - w / 2 / sc, top = cy - h / 2 / sc, n = 2 ** tz;
      const keep = new Set();
      if (this.tileUrl) for (let ty = Math.floor(top / TS); ty <= Math.floor((top + h / sc) / TS); ty++) {
        if (ty < 0 || ty >= n) continue;
        for (let tx = Math.floor(left / TS); tx <= Math.floor((left + w / sc) / TS); tx++) {
          const wx = ((tx % n) + n) % n, key = `${tz}/${wx}/${ty}`; keep.add(key);
          let img = this.tiles.get(key);
          if (!img) { img = new Image(); img.alt = ''; img.draggable = false; img.decoding = 'async'; img.onerror = () => img.classList.add('tm-err'); img.src = this.tileUrl.replace('{z}', tz).replace('{x}', wx).replace('{y}', ty).replace('{s}', 'abc'[(wx + ty) % 3]); this.tEl.appendChild(img); this.tiles.set(key, img); }
          const s = TS * sc;
          img.style.cssText = `width:${s + .5}px;height:${s + .5}px;transform:translate(${((tx * TS - left) * sc).toFixed(1)}px,${((ty * TS - top) * sc).toFixed(1)}px)`;
        }
      }
      for (const [k, img] of this.tiles) if (!keep.has(k)) { img.remove(); this.tiles.delete(k); }
      // routes
      this.svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      this.svg.innerHTML = this.lines.map((l, i) => {
        const d = l.pts.map((p, j) => { const q = this.project(p[0], p[1]); return (j ? 'L' : 'M') + q.x.toFixed(1) + ',' + q.y.toFixed(1); }).join('');
        return `<path d="${d}" fill="none" stroke="#fff" stroke-width="${(l.width || 4) + 3}" stroke-linecap="round" stroke-linejoin="round" opacity=".7"/><path data-line="${i}" d="${d}" fill="none" stroke="${l.color}" stroke-width="${l.width || 4}" stroke-linecap="round" stroke-linejoin="round" opacity="${l.opacity || 1}"/>`;
      }).join('');
      for (const m of this.markers) { const q = this.project(m.lat, m.lng); m.el.style.transform = `translate(${(q.x - m.ax).toFixed(1)}px,${(q.y - m.ay).toFixed(1)}px)`; }
    }
    _drawMarkers() {
      this.mEl.innerHTML = '';
      for (const m of this.markers) {
        const el = document.createElement(m.onClick ? 'button' : 'div'); el.className = 'tm-mark'; el.innerHTML = m.html; if (m.label) el.setAttribute('aria-label', m.label);
        if (m.onClick) el.addEventListener('click', e => { e.stopPropagation(); m.onClick(); });
        [m.ax, m.ay] = m.anchor || [0, 0]; m.el = el; this.mEl.appendChild(el);
      }
    }
    lineAt(px, py) { // nearest route within 14px
      let best = -1, bd = 14;
      this.lines.forEach((l, i) => { if (!l.onClick) return; for (let j = 1; j < l.pts.length; j++) { const a = this.project(l.pts[j - 1][0], l.pts[j - 1][1]), b = this.project(l.pts[j][0], l.pts[j][1]); const dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy || 1; let t = ((px - a.x) * dx + (py - a.y) * dy) / L; t = Math.max(0, Math.min(1, t)); const d = Math.hypot(px - a.x - t * dx, py - a.y - t * dy); if (d < bd) { bd = d; best = i; } } });
      return best;
    }
    _gestures() {
      const el = this.el, pts = new Map(); let start = null, pinch = null, lastTap = 0, lpTimer = null;
      const rel = e => { const r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
      el.addEventListener('pointerdown', e => {
        if (e.target.closest('.tm-mark, button, a')) return;
        el.setPointerCapture(e.pointerId); pts.set(e.pointerId, rel(e));
        if (pts.size === 1) {
          const p = rel(e); start = { p, t: Date.now(), lat: this.lat, lng: this.lng, moved: false };
          clearTimeout(lpTimer); lpTimer = setTimeout(() => { if (start && !start.moved && pts.size === 1) { start.long = true; this._emit('longpress', this.unproject(p.x, p.y)); } }, 650);
        } else if (pts.size === 2) {
          clearTimeout(lpTimer); const [a, b] = [...pts.values()];
          pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: this.z, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } }; if (start) start.moved = true;
        }
      });
      el.addEventListener('pointermove', e => {
        if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, rel(e));
        if (pts.size === 2 && pinch) {
          const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
          const target = pinch.z + Math.log2(d / pinch.d); this.zoomAround(pinch.mid.x, pinch.mid.y, target - this.z); return;
        }
        if (pts.size === 1 && start) {
          const p = rel(e), dx = p.x - start.p.x, dy = p.y - start.p.y;
          if (!start.moved && Math.hypot(dx, dy) < 8) return; start.moved = true; clearTimeout(lpTimer);
          const z = this.z; const x = lon2x(start.lng, z) - dx, y = lat2y(start.lat, z) - dy;
          this.lng = x2lon(x, z); this.lat = y2lat(y, z); this.render();
        }
      });
      const end = e => {
        if (!pts.has(e.pointerId)) return; pts.delete(e.pointerId); clearTimeout(lpTimer);
        if (pts.size < 2) pinch = null;
        if (pts.size === 0 && start) {
          if (!start.moved && !start.long && Date.now() - start.t < 600) {
            const p = start.p, now = Date.now();
            if (now - lastTap < 300) { this.zoomAround(p.x, p.y, 1); lastTap = 0; }
            else { lastTap = now; const li = this.lineAt(p.x, p.y); if (li >= 0) this.lines[li].onClick(); else this._emit('click', this.unproject(p.x, p.y)); }
          } else if (start.moved) this._emit('move');
          start = null;
        }
      };
      el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
      el.addEventListener('wheel', e => { e.preventDefault(); const p = rel(e); this.zoomAround(p.x, p.y, -e.deltaY / 300); }, { passive: false });
      el.addEventListener('dblclick', e => e.preventDefault());
    }
    destroy() { this._ro?.disconnect(); this.el.innerHTML = ''; }
  }
  window.TinyMap = TinyMap;
})();
