/* Формування XLSX у браузері без зовнішніх бібліотек (однаково на сервері і в дзеркалі).
   ZIP: стиснення deflate через CompressionStream (сучасні браузери), інакше — без стиснення.
   XLSX.table — звичайний звіт; XLSX.fillTemplate — заповнення шаблону зі збереженням оформлення і формул. */
(function () {
  'use strict';
  var CRC = (function () { var t = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b) { var c = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  var enc = new TextEncoder(), dec = new TextDecoder();
  function streamBytes(data, stream) { return new Response(new Blob([data]).stream().pipeThrough(stream)).arrayBuffer().then(function (b) { return new Uint8Array(b); }); }
  function deflate(u8) { if (typeof CompressionStream === 'undefined') return Promise.resolve(null); try { return streamBytes(u8, new CompressionStream('deflate-raw')).catch(function () { return null; }); } catch (e) { return Promise.resolve(null); } }
  function inflate(u8) { return streamBytes(u8, new DecompressionStream('deflate-raw')); }
  function zip(files) {     // files: {name: string|Uint8Array}
    var names = Object.keys(files);
    return Promise.all(names.map(function (n) { var d = typeof files[n] === 'string' ? enc.encode(files[n]) : files[n]; return deflate(d).then(function (z) { return {n: enc.encode(n), d: d, z: z && z.length < d.length ? z : null}; }); })).then(function (items) {
      var parts = [], central = [], off = 0;
      items.forEach(function (it) {
        var crc = crc32(it.d), body = it.z || it.d, m = it.z ? 8 : 0, h = new DataView(new ArrayBuffer(30));
        h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, m, true); h.setUint32(14, crc, true); h.setUint32(18, body.length, true); h.setUint32(22, it.d.length, true); h.setUint16(26, it.n.length, true);
        parts.push(new Uint8Array(h.buffer), it.n, body);
        var c = new DataView(new ArrayBuffer(46)); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, m, true); c.setUint32(16, crc, true); c.setUint32(20, body.length, true); c.setUint32(24, it.d.length, true); c.setUint16(28, it.n.length, true); c.setUint32(42, off, true);
        central.push(new Uint8Array(c.buffer), it.n); off += 30 + it.n.length + body.length;
      });
      var size = central.reduce(function (s, x) { return s + x.length; }, 0), e = new DataView(new ArrayBuffer(22));
      e.setUint32(0, 0x06054b50, true); e.setUint16(8, items.length, true); e.setUint16(10, items.length, true); e.setUint32(12, size, true); e.setUint32(16, off, true);
      return new Blob(parts.concat(central, [new Uint8Array(e.buffer)]), {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    });
  }
  function unzip(buf) {
    var u = new Uint8Array(buf), v = new DataView(buf), eo = u.length - 22;
    while (eo > 0 && v.getUint32(eo, true) !== 0x06054b50) eo--;
    var n = v.getUint16(eo + 10, true), p = v.getUint32(eo + 16, true), jobs = [];
    for (var i = 0; i < n; i++) {
      var m = v.getUint16(p + 10, true), cs = v.getUint32(p + 20, true), nl = v.getUint16(p + 28, true), xl = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true), lo = v.getUint32(p + 42, true);
      var name = dec.decode(u.subarray(p + 46, p + 46 + nl)), ds = lo + 30 + v.getUint16(lo + 26, true) + v.getUint16(lo + 28, true), data = u.subarray(ds, ds + cs);
      jobs.push((function (name, m, data) { return (m === 8 ? inflate(data) : Promise.resolve(data)).then(function (d) { return [name, d]; }); })(name, m, data));
      p += 46 + nl + xl + cl;
    }
    return Promise.all(jobs).then(function (r) { var o = {}; r.forEach(function (x) { o[x[0]] = x[1]; }); return o; });
  }
  function x(s) { return String(s).replace(/[&<>"]/g, function (c) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]; }).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ''); }
  function col(i) { var s = ''; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
  function cell(ref, v, s) {
    var st = s !== undefined && s !== null ? ' s="' + s + '"' : '';
    if (v === null || v === undefined || v === '') return s !== undefined && s !== null ? '<c r="' + ref + '"' + st + '/>' : '';
    if (typeof v === 'object' && v.f) return '<c r="' + ref + '"' + st + '><f>' + x(v.f) + '</f></c>';
    if (typeof v === 'number' && isFinite(v)) return '<c r="' + ref + '"' + st + '><v>' + v + '</v></c>';
    return '<c r="' + ref + '"' + st + ' t="inlineStr"><is><t xml:space="preserve">' + x(v) + '</t></is></c>';
  }
  var CT = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>';
  var STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts><fonts count="3"><font><sz val="10"/><name val="Arial"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/></font><font><b/><sz val="13"/><name val="Arial"/></font></fonts>' +
    '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F3A60"/></patternFill></fill></fills><borders count="2"><border/><border><left style="thin"><color rgb="FFB0B8C4"/></left><right style="thin"><color rgb="FFB0B8C4"/></right><top style="thin"><color rgb="FFB0B8C4"/></top><bottom style="thin"><color rgb="FFB0B8C4"/></bottom></border></borders>' +
    '<cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="5"><xf/><xf fontId="1" fillId="2" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf><xf borderId="1" applyBorder="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf><xf borderId="1" numFmtId="164" applyBorder="1" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf><xf fontId="2" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  // sheets: [{name, title, cols:[{h, w, num}], rows:[[...]]}]
  function table(sheets) {
    var files = {'_rels/.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>', 'xl/styles.xml': STYLES};
    var ct = CT, wb = '', rels = '';
    sheets.forEach(function (sh, si) {
      var n = si + 1, top = sh.title ? 2 : 0, body = '';
      if (sh.title) body += '<row r="1">' + cell('A1', sh.title, 4) + '</row>';
      body += '<row r="' + (top + 1) + '" ht="32" customHeight="1">' + sh.cols.map(function (c, i) { return cell(col(i) + (top + 1), c.h, 1); }).join('') + '</row>';
      sh.rows.forEach(function (r, ri) { var rn = top + 2 + ri; body += '<row r="' + rn + '">' + r.map(function (v, i) { return cell(col(i) + rn, v, typeof v === 'number' ? 3 : 2); }).join('') + '</row>'; });
      var last = col(sh.cols.length - 1) + (top + 1 + sh.rows.length);
      files['xl/worksheets/sheet' + n + '.xml'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"' + (si ? '' : ' tabSelected="1"') + '><pane ySplit="' + (top + 1) + '" topLeftCell="A' + (top + 2) + '" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>' +
        sh.cols.map(function (c, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + (c.w || 16) + '" customWidth="1"/>'; }).join('') + '</cols><sheetData>' + body + '</sheetData>' + (sh.rows.length ? '<autoFilter ref="A' + (top + 1) + ':' + last + '"/>' : '') + '</worksheet>';
      ct += '<Override PartName="/xl/worksheets/sheet' + n + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
      wb += '<sheet name="' + x((sh.name || 'Аркуш' + n).replace(/[\\\/?*\[\]:]/g, ' ').slice(0, 31)) + '" sheetId="' + n + '" r:id="rId' + n + '"/>';
      rels += '<Relationship Id="rId' + n + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + n + '.xml"/>';
    });
    var k = sheets.length + 1;
    files['[Content_Types].xml'] = ct + '</Types>';
    files['xl/workbook.xml'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + wb + '</sheets></workbook>';
    files['xl/_rels/workbook.xml.rels'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + rels + '<Relationship Id="rId' + k + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
    return zip(files);
  }
  /* Заповнення шаблону: рядок-зразок protoRow (стилі комірок) розмножується для кожного запису;
     formulas: {індекс колонки: 'AK{r}+AL{r}'}; підсумкові SUM(X7:X299) перераховуються на фактичний діапазон;
     extraSheets: {назва аркуша: [[адреса, значення], ...]} — оновлення окремих комірок інших аркушів. */
  function fillTemplate(buf, opt) {
    return unzip(buf).then(function (f) {
      var wbx = dec.decode(f['xl/workbook.xml']), rels = dec.decode(f['xl/_rels/workbook.xml.rels']);
      function sheetPath(name) { var m = wbx.match(new RegExp('<sheet[^>]*name="' + name + '"[^>]*r:id="(rId\\d+)"')) || wbx.match(new RegExp('<sheet[^>]*r:id="(rId\\d+)"[^>]*name="' + name + '"')); if (!m) return null; var t = rels.match(new RegExp('Id="' + m[1] + '"[^>]*Target="([^"]+)"')) || rels.match(new RegExp('Target="([^"]+)"[^>]*Id="' + m[1] + '"')); return t ? 'xl/' + t[1].replace(/^\/?xl\//, '') : null; }
      var sp = sheetPath(opt.sheet) || 'xl/worksheets/sheet1.xml', s = dec.decode(f[sp]), pr = opt.protoRow, first = opt.firstRow || pr;
      var rm = s.match(new RegExp('<row r="' + pr + '"[^>]*>([\\s\\S]*?)</row>')), rowAttr = (s.match(new RegExp('<row r="' + pr + '"([^>]*)>')) || [])[1] || '';
      var styles = {}; if (rm) rm[1].replace(/<c r="([A-Z]+)\d+"(?:[^>]*?\ss="(\d+)")?[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g, function (_, c, st) { styles[c] = st; return ''; });
      rowAttr = rowAttr.replace(/\s(hidden|ht|customHeight)="[^"]*"/g, '');
      var last = first + opt.rows.length - 1, out = '';
      opt.rows.forEach(function (r, i) { var rn = first + i, cells = '';
        for (var c = 0; c < opt.cols; c++) { var L = col(c), v = r[c]; if (opt.formulas && opt.formulas[c]) v = {f: opt.formulas[c].replace(/\{r\}/g, rn)}; cells += cell(L + rn, v, styles[L] !== undefined ? styles[L] : null); }
        out += '<row r="' + rn + '"' + rowAttr + '>' + cells + '</row>'; });
      s = s.replace(new RegExp('<row r="' + pr + '"[^>]*>[\\s\\S]*?</row>'), out);
      s = s.replace(/SUM\(([A-Z]+)(\d+):([A-Z]+)(\d+)\)/g, function (m0, a, r1, b, r2) { return +r1 === first ? 'SUM(' + a + first + ':' + b + Math.max(first, last) + ')' : m0; });
      s = s.replace(/<dimension ref="([A-Z]+\d+):([A-Z]+)\d+"\/>/, function (m0, a, b) { return '<dimension ref="' + a + ':' + b + Math.max(first, last) + '"/>'; });
      s = s.replace(/<autoFilter ref="([A-Z]+\d+):([A-Z]+)\d+"/, function (m0, a, b) { return '<autoFilter ref="' + a + ':' + b + Math.max(first, last) + '"'; });
      s = s.replace(/<v><\/v>/g, '');
      f[sp] = enc.encode(s);
      wbx = wbx.replace(/(_FilterDatabase[^>]*>[^<]*!\$[A-Z]+\$\d+:\$[A-Z]+\$)\d+/, function (m0, a) { return a + Math.max(first, last); });
      if (!/fullCalcOnLoad/.test(wbx)) wbx = wbx.replace(/<calcPr([^>]*)\/>/, '<calcPr$1 fullCalcOnLoad="1"/>');
      f['xl/workbook.xml'] = enc.encode(wbx);
      Object.keys(opt.extraSheets || {}).forEach(function (name) { var p = sheetPath(name); if (!p) return; var t = dec.decode(f[p]);
        opt.extraSheets[name].forEach(function (u) { var ref = u[0], re = new RegExp('<c r="' + ref + '"([^>]*?)(?:/>|>[\\s\\S]*?</c>)'); var m = t.match(re); var st = m && (m[1].match(/\ss="(\d+)"/) || [])[1];
          if (m) t = t.replace(re, cell(ref, u[1], st === undefined ? null : st) || '<c r="' + ref + '"' + (st ? ' s="' + st + '"' : '') + '/>'); });
        f[p] = enc.encode(t); });
      delete f['xl/calcChain.xml'];
      var ct = dec.decode(f['[Content_Types].xml']).replace(/<Override PartName="\/xl\/calcChain.xml"[^>]*\/>/, ''); f['[Content_Types].xml'] = enc.encode(ct);
      return zip(f);
    });
  }
  function download(blob, name) {
    var a = document.createElement('a'), u = URL.createObjectURL(blob); a.href = u; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(u); a.remove(); }, 1500);
  }
  window.XLSX = {zip: zip, unzip: unzip, table: table, fillTemplate: fillTemplate, download: download, col: col};
})();
