/* Діаграми порталу: горизонтальні і вертикальні стовпчики, кільце.
   Анімація під час появи, підписи не накладаються (довгі — обрізаються «…» і повністю показуються у підказці),
   кожен показник клікабельний (фільтрує перелік). Без зовнішніх бібліотек. */
(function () {
  'use strict';
  var C = {cyan: '#35D6E8', gold: '#F5C518', violet: '#8B7BF7', ok: '#3DD68C', lim: '#F5A524', lost: '#F0524E',
           unk: '#6E7F9E', blue: '#4C8DF6', closed: '#5B7DB1', red: '#F0524E', yellow: '#F5C518', grey: '#8A94A6'};
  var PAL = ['#35D6E8', '#F5C518', '#8B7BF7', '#3DD68C', '#F5A524', '#4C8DF6', '#F0524E', '#6E7F9E', '#5B7DB1', '#C3B8FF', '#7FD1AE', '#E58FB4'];
  var tip = null;
  function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"]/g, function (c) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]; }); }
  function fmt(v, unit) {
    v = Number(v) || 0; var a = Math.abs(v), s;
    if (unit === 'money') {
      if (a >= 1e9) return (v / 1e9).toFixed(2).replace('.', ',') + ' млрд ₴';
      if (a >= 1e6) return (v / 1e6).toFixed(1).replace('.', ',') + ' млн ₴';
      return Math.round(v).toLocaleString('uk-UA') + ' ₴';
    }
    if (a >= 1e6) return (v / 1e6).toFixed(1).replace('.', ',') + ' млн';
    if (a >= 1e4) return (v / 1e3).toFixed(1).replace('.', ',') + ' тис.';
    s = (Math.round(v * 10) / 10).toString().replace('.', ',');
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }
  function full(v, unit) { return unit === 'money' ? Math.round(v).toLocaleString('uk-UA') + ' ₴' : Number(v).toLocaleString('uk-UA'); }
  function color(d, i) { var c = d.colors ? d.colors[i] : d.color; return C[c] || c || PAL[i % PAL.length]; }
  function showTip(e, html) {
    if (!tip) { tip = document.createElement('div'); tip.className = 'ch-tip'; document.body.appendChild(tip); }
    tip.innerHTML = html; tip.style.display = 'block';
    var x = e.clientX + 14, y = e.clientY + 14, w = tip.offsetWidth, h = tip.offsetHeight;
    if (x + w > window.innerWidth - 8) x = e.clientX - w - 14;
    if (y + h > window.innerHeight - 8) y = e.clientY - h - 14;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  function hideTip() { if (tip) tip.style.display = 'none'; }
  function bind(el, d, i, total) {
    var pct = total ? ' · ' + (d.values[i] * 100 / total).toFixed(1).replace('.', ',') + '%' : '';
    var html = '<b>' + esc(d.labels[i]) + '</b><br>' + full(d.values[i], d.unit) + pct + (d.links && d.links[i] ? '<div class="ch-tip-h">клікніть — показати перелік</div>' : '');
    el.addEventListener('mousemove', function (e) { showTip(e, html); });
    el.addEventListener('mouseleave', hideTip);
    if (d.links && d.links[i]) {
      el.classList.add('ch-link');
      el.addEventListener('click', function () { hideTip(); location.href = d.links[i]; });
    }
  }
  function sum(a) { return a.reduce(function (s, v) { return s + (Number(v) || 0); }, 0); }

  function barh(box, d) {
    var max = Math.max.apply(null, d.values.concat([1])), total = sum(d.values);
    var wrap = document.createElement('div'); wrap.className = 'ch-barh';
    d.labels.forEach(function (lab, i) {
      var row = document.createElement('div'); row.className = 'ch-row';
      row.innerHTML = '<div class="ch-lbl" title="' + esc(lab) + '">' + esc(lab) + '</div><div class="ch-track"><div class="ch-fill" style="background:' + color(d, i) + '"></div></div><div class="ch-val">' + fmt(d.values[i], d.unit) + '</div>';
      bind(row, d, i, total); wrap.appendChild(row);
      var fill = row.querySelector('.ch-fill');
      setTimeout(function () { fill.style.width = Math.max(1.5, d.values[i] * 100 / max) + '%'; }, 30 + i * 35);
    });
    box.appendChild(wrap);
  }
  function barv(box, d) {
    var max = Math.max.apply(null, d.values.concat([1])), total = sum(d.values);
    var wrap = document.createElement('div'); wrap.className = 'ch-barv';
    d.labels.forEach(function (lab, i) {
      var col = document.createElement('div'); col.className = 'ch-col';
      col.innerHTML = '<div class="ch-cval">' + fmt(d.values[i], d.unit) + '</div><div class="ch-ctrack"><div class="ch-cfill" style="background:' + color(d, i) + '"></div></div><div class="ch-clbl" title="' + esc(lab) + '">' + esc(lab) + '</div>';
      bind(col, d, i, total); wrap.appendChild(col);
      var f = col.querySelector('.ch-cfill');
      setTimeout(function () { f.style.height = Math.max(2, d.values[i] * 100 / max) + '%'; }, 30 + i * 40);
    });
    box.appendChild(wrap);
  }
  function donut(box, d) {
    var total = sum(d.values) || 1, R = 54, CIRC = 2 * Math.PI * R, off = 0;
    var wrap = document.createElement('div'); wrap.className = 'ch-donut';
    var svg = '<svg viewBox="0 0 140 140" class="ch-dsvg"><circle cx="70" cy="70" r="' + R + '" fill="none" stroke="rgba(255,255,255,.05)" stroke-width="24"/>';
    d.values.forEach(function (v, i) {
      var len = CIRC * v / total;
      svg += '<circle class="ch-seg" data-i="' + i + '" cx="70" cy="70" r="' + R + '" fill="none" stroke="' + color(d, i) + '" stroke-width="24" stroke-dasharray="0 ' + CIRC + '" data-len="' + len + '" stroke-dashoffset="' + (-off) + '" transform="rotate(-90 70 70)"/>';
      off += len;
    });
    svg += '<text x="70" y="66" text-anchor="middle" class="ch-dtot">' + fmt(sum(d.values), d.unit) + '</text><text x="70" y="84" text-anchor="middle" class="ch-dsub">' + esc(d.center || 'усього') + '</text></svg>';
    wrap.innerHTML = svg;
    var lg = document.createElement('div'); lg.className = 'ch-legend';
    d.labels.forEach(function (lab, i) {
      var r = document.createElement('div'); r.className = 'ch-li';
      r.innerHTML = '<i style="background:' + color(d, i) + '"></i><span class="ch-ll" title="' + esc(lab) + '">' + esc(lab) + '</span><b>' + fmt(d.values[i], d.unit) + '</b><em>' + (d.values[i] * 100 / total).toFixed(0) + '%</em>';
      bind(r, d, i, total); lg.appendChild(r);
    });
    wrap.appendChild(lg); box.appendChild(wrap);
    wrap.querySelectorAll('.ch-seg').forEach(function (c) {
      var i = +c.getAttribute('data-i'); bind(c, d, i, total);
      setTimeout(function () { c.setAttribute('stroke-dasharray', c.getAttribute('data-len') + ' ' + CIRC); }, 40 + i * 60);
    });
  }
  function render(root) {
    (root || document).querySelectorAll('[data-chart]').forEach(function (box) {
      if (box.dataset.done) return;
      var d; try { d = JSON.parse(box.dataset.chart); } catch (e) { return; }
      box.dataset.done = '1'; box.innerHTML = '';
      if (!d.values || !d.values.length || !sum(d.values)) { box.innerHTML = '<div class="empty">Немає даних</div>'; return; }
      ({barh: barh, barv: barv, donut: donut}[d.type] || barh)(box, d);
    });
  }
  window.ArmaCharts = {render: render, fmt: fmt, hideTip: hideTip};
})();
