/* Легка інтерактивна карта без платних API: підкладка OpenStreetMap (або інший сервер плиток із налаштувань),
   точки і контури ділянок на canvas, перетягування, масштаб колесом / кнопками / двома пальцями.
   Якщо плитки недоступні (закрита мережа) — показується схема з обласними центрами. */
(function () {
  'use strict';
  var CITIES = [['Київ', 50.45, 30.52], ['Львів', 49.84, 24.03], ['Одеса', 46.48, 30.73], ['Харків', 49.99, 36.23], ['Дніпро', 48.46, 35.05], ['Запоріжжя', 47.84, 35.14], ['Вінниця', 49.23, 28.47], ['Житомир', 50.25, 28.66], ['Чернігів', 51.49, 31.29], ['Суми', 50.91, 34.80], ['Полтава', 49.59, 34.55], ['Черкаси', 49.44, 32.06], ['Кропивницький', 48.51, 32.26], ['Миколаїв', 46.98, 31.99], ['Херсон', 46.64, 32.61], ['Сімферополь', 44.95, 34.10], ['Донецьк', 48.02, 37.80], ['Луганськ', 48.57, 39.31], ['Рівне', 50.62, 26.25], ['Луцьк', 50.75, 25.33], ['Тернопіль', 49.55, 25.59], ['Хмельницький', 49.42, 26.99], ['Чернівці', 48.29, 25.94], ['Івано-Франківськ', 48.92, 24.71], ['Ужгород', 48.62, 22.29]];
  function lon2x(lon, z) { return (lon + 180) / 360 * 256 * Math.pow(2, z); }
  function lat2y(lat, z) { var s = Math.sin(lat * Math.PI / 180); return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 256 * Math.pow(2, z); }
  function x2lon(x, z) { return x / (256 * Math.pow(2, z)) * 360 - 180; }
  function y2lat(y, z) { var n = Math.PI - 2 * Math.PI * y / (256 * Math.pow(2, z)); return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))); }

  function Map(el, opt) {
    var self = this; opt = opt || {};
    this.el = el; this.points = []; this.polys = []; this.onClick = opt.onClick; this.tileUrl = opt.tiles || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    el.classList.add('map-wrap');
    el.innerHTML = '<div class="map-tiles"></div><canvas></canvas><div class="map-ctrl"><button type="button" data-z="1" title="Наблизити">+</button><button type="button" data-z="-1" title="Віддалити">−</button><button type="button" data-z="0" title="Уся Україна">⌂</button></div><div class="map-attr">© OpenStreetMap contributors</div>';
    this.tilesEl = el.querySelector('.map-tiles'); this.cv = el.querySelector('canvas'); this.ctx = this.cv.getContext('2d');
    this.failed = 0; this.loaded = 0;
    this.fit(44.3, 22, 52.4, 40.3);
    el.querySelectorAll('[data-z]').forEach(function (b) { b.addEventListener('click', function () { var z = +b.dataset.z; if (z === 0) self.fit(44.3, 22, 52.4, 40.3); else self.zoomAt(self.w / 2, self.h / 2, z); }); });
    var ptrs = {}, last = null, pinch = null, moved = false;
    el.addEventListener('pointerdown', function (e) { if (e.target.closest('.map-ctrl')) return; el.setPointerCapture(e.pointerId); ptrs[e.pointerId] = [e.offsetX, e.offsetY]; last = [e.clientX, e.clientY]; moved = false;
      var k = Object.keys(ptrs); if (k.length === 2) pinch = dist(ptrs[k[0]], ptrs[k[1]]); });
    el.addEventListener('pointermove', function (e) {
      if (ptrs[e.pointerId]) {
        var k = Object.keys(ptrs); ptrs[e.pointerId] = [e.offsetX, e.offsetY];
        if (k.length === 2 && pinch) { var d = dist(ptrs[k[0]], ptrs[k[1]]); if (Math.abs(Math.log2(d / pinch)) > 0.5) { self.zoomAt((ptrs[k[0]][0] + ptrs[k[1]][0]) / 2, (ptrs[k[0]][1] + ptrs[k[1]][1]) / 2, d > pinch ? 1 : -1); pinch = d; } return; }
        var dx = e.clientX - last[0], dy = e.clientY - last[1]; if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
        last = [e.clientX, e.clientY]; self.cx -= dx; self.cy -= dy; self.draw();
      } else self.hover(e.offsetX, e.offsetY, e);
    });
    function up(e) { delete ptrs[e.pointerId]; if (Object.keys(ptrs).length < 2) pinch = null; if (!moved && e.type === 'pointerup') self.click(e.offsetX, e.offsetY); }
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', function (e) { e.preventDefault(); self.zoomAt(e.offsetX, e.offsetY, e.deltaY < 0 ? 1 : -1); }, {passive: false});
    window.addEventListener('resize', function () { self.resize(); self.draw(); });
  }
  function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]) || 1; }
  Map.prototype.resize = function () { var r = this.el.getBoundingClientRect(); this.w = r.width || 800; this.h = r.height || 500; var dpr = window.devicePixelRatio || 1; this.cv.width = this.w * dpr; this.cv.height = this.h * dpr; this.cv.style.width = this.w + 'px'; this.cv.style.height = this.h + 'px'; this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
  Map.prototype.fit = function (lat0, lon0, lat1, lon1) {
    this.resize(); var z = 18;
    while (z > 3 && (lon2x(lon1, z) - lon2x(lon0, z) > this.w * 0.95 || lat2y(lat0, z) - lat2y(lat1, z) > this.h * 0.95)) z--;
    this.z = z; this.cx = (lon2x(lon0, z) + lon2x(lon1, z)) / 2; this.cy = (lat2y(lat0, z) + lat2y(lat1, z)) / 2; this.draw();
  };
  Map.prototype.fitPoints = function () {
    var pts = this.points.concat([].concat.apply([], this.polys.map(function (p) { return p.rings[0].map(function (c) { return {lat: c[1], lon: c[0]}; }); })));
    if (!pts.length) return this.fit(44.3, 22, 52.4, 40.3);
    var la = pts.map(function (p) { return p.lat; }), lo = pts.map(function (p) { return p.lon; });
    var a = Math.min.apply(null, la), b = Math.min.apply(null, lo), c = Math.max.apply(null, la), d = Math.max.apply(null, lo);
    if (c - a < 0.02) { a -= 0.02; c += 0.02; } if (d - b < 0.02) { b -= 0.02; d += 0.02; }
    this.fit(a, b, c, d);
  };
  Map.prototype.zoomAt = function (px, py, dz) {
    var nz = Math.max(3, Math.min(18, this.z + dz)); if (nz === this.z) return;
    var wx = this.cx - this.w / 2 + px, wy = this.cy - this.h / 2 + py, k = Math.pow(2, nz - this.z);
    this.cx = wx * k - px + this.w / 2; this.cy = wy * k - py + this.h / 2; this.z = nz; this.draw();
  };
  Map.prototype.px = function (lat, lon) { return [lon2x(lon, this.z) - this.cx + this.w / 2, lat2y(lat, this.z) - this.cy + this.h / 2]; };
  Map.prototype.setData = function (points, polys) { this.points = points || []; this.polys = polys || []; this.draw(); };
  Map.prototype.draw = function () {
    var self = this, z = this.z, n = Math.pow(2, z), x0 = this.cx - this.w / 2, y0 = this.cy - this.h / 2;
    // плитки
    var want = {}, tx0 = Math.floor(x0 / 256), ty0 = Math.floor(y0 / 256), tx1 = Math.floor((x0 + this.w) / 256), ty1 = Math.floor((y0 + this.h) / 256);
    if (this.failed < 4) {
      for (var tx = tx0; tx <= tx1; tx++) for (var ty = ty0; ty <= ty1; ty++) {
        if (ty < 0 || ty >= n) continue; var wx = ((tx % n) + n) % n, key = z + '/' + wx + '/' + ty + '/' + tx; want[key] = 1;
        var img = this.tilesEl.querySelector('img[data-k="' + key + '"]');
        if (!img) { img = document.createElement('img'); img.dataset.k = key; img.alt = ''; img.draggable = false;
          img.onerror = function () { self.failed++; if (self.failed >= 4) { self.tilesEl.innerHTML = ''; self.el.querySelector('.map-attr').textContent = 'Схема (підкладка карти недоступна в цій мережі)'; self.draw(); } };
          img.src = this.tileUrl.replace('{z}', z).replace('{x}', wx).replace('{y}', ty); this.tilesEl.appendChild(img); }
        img.style.left = (tx * 256 - x0) + 'px'; img.style.top = (ty * 256 - y0) + 'px';
      }
      this.tilesEl.querySelectorAll('img').forEach(function (i) { if (!want[i.dataset.k]) i.remove(); });
    }
    var c = this.ctx; c.clearRect(0, 0, this.w, this.h);
    if (this.failed >= 4) {
      c.fillStyle = '#5B6B88'; c.font = '11px sans-serif';
      CITIES.forEach(function (ct) { var p = self.px(ct[1], ct[2]); c.beginPath(); c.arc(p[0], p[1], 2, 0, 7); c.fill(); c.fillText(ct[0], p[0] + 5, p[1] - 4); });
    }
    this.polys.forEach(function (pg) {
      c.beginPath(); pg.rings.forEach(function (ring) { ring.forEach(function (pt, i) { var p = self.px(pt[1], pt[0]); if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); c.closePath(); });
      c.fillStyle = pg.color + '55'; c.strokeStyle = pg.color; c.lineWidth = 1.5; c.fill(); c.stroke();
    });
    var r = z >= 12 ? 6 : z >= 9 ? 4.5 : 3.2;
    this.screen = [];
    this.points.forEach(function (pt) {
      var p = self.px(pt.lat, pt.lon); if (p[0] < -10 || p[1] < -10 || p[0] > self.w + 10 || p[1] > self.h + 10) return;
      c.beginPath(); c.arc(p[0], p[1], r, 0, 7); c.fillStyle = pt.color; c.fill(); c.lineWidth = 1; c.strokeStyle = 'rgba(0,0,0,.6)'; c.stroke();
      self.screen.push([p[0], p[1], pt]);
    });
  };
  Map.prototype.find = function (x, y) { var best = null, bd = 100; (this.screen || []).forEach(function (s) { var d = (s[0] - x) * (s[0] - x) + (s[1] - y) * (s[1] - y); if (d < bd) { bd = d; best = s[2]; } }); return best; };
  Map.prototype.hover = function (x, y, e) { var p = this.find(x, y); this.el.style.cursor = p ? 'pointer' : 'grab'; this.el.title = p ? p.label : ''; };
  Map.prototype.click = function (x, y) { var p = this.find(x, y); if (p && this.onClick) this.onClick(p); };
  window.ArmaMap = Map;
})();
