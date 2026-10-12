/* Розділ «Ідентифікація»: структура таблиці «БАЗОВА Ідентифікація», зіставлення з Реєстром за номером активу,
   аналітика за період, закріплення привабливих активів за відділом ДМА з планом дій, висновки, групи записів одного
   активу, вивантаження у XLSX у структурі файлу (з формулами) з даними Реєстру. */
(function () {
  'use strict';
  var A = window.A, D = window.D, N = A.N, esc = A.esc, S = A.S, dd = A.dd;
  var COLS = D.IDENT_COLUMNS || [], SECS = D.IDENT_SECTIONS || [];
  var COUNTERS = [1, 5, 10, 11, 15, 16, 36, 37, 39, 40, 42], DATES = [32, 35], FORMULA = {38: 'AK{r}+AL{r}'};
  var LONG = [2, 3, 6, 7, 8, 9, 17, 18, 21, 22, 24, 29, 33, 34, 41, 44, 45, 46, 47, 48, 49, 54, 55, 59, 63, 64, 65];
  var STAGES = [['registered', 'Звернення зареєстровано'], ['mtu', 'Доручення МТУ'], ['inspected', 'Огляд проведено'], ['conclusion', 'Висновок підписано'], ['possible', 'Управління можливе'], ['impossible', 'Управління неможливе'], ['accepted', 'Прийнято в управління АРМА']];
  var STG = A.map(STAGES);
  A.identStage = function (s) { return '<span class="stage ' + esc(s || '') + '">' + esc(STG[s] || 'Не визначено') + '</span>'; };
  function canE() { return A.can('ident_edit'); }
  function val(r, i) { var d = r.data || {}; return d['c' + i]; }
  function normMtu(v) {
    var s = String(v || '').trim().toLowerCase(); if (!s || s === '0' || s === '#n/a' || s.indexOf('відділ') >= 0 || s.indexOf('/') >= 0) return null;
    if (s.indexOf('центрально') >= 0) return 'tu_centralwest'; if (s.indexOf('північно') >= 0) return 'mtu_northeast'; if (/південно\s?-\s?схід/.test(s)) return 'mtu_southeast';
    if (s.indexOf('захід') >= 0) return 'mtu_west'; if (s.indexOf('півден') >= 0) return 'mtu_south'; if (s.indexOf('центральн') >= 0) return 'mtu_central'; return null;
  }
  function isoDate(s) { if (!s) return null; s = String(s); var m = s.match(/(\d{2})\.(\d{2})\.(\d{4})/); if (m) return m[3] + '-' + m[2] + '-' + m[1]; m = s.match(/\d{4}-\d{2}-\d{2}/); return m ? m[0] : null; }
  // ключові поля запису з колонок таблиці (та сама логіка, що й під час імпорту)
  A.identDerive = function (data) {
    var g = function (i) { return data['c' + i]; }, ruling = String(g(6) || ''), cs = ruling.match(/справ[аі]\s*№?\s*([\d/\-]+[\w\-/]*)/), pr = (String(g(7) || '') + ' ' + ruling).match(/\b(\d{17})\b/);
    var possible = g(39) ? 'yes' : g(40) ? 'no' : null, res = String(g(41) || '').toLowerCase();
    if (!possible && res) possible = res.indexOf('неможлив') >= 0 ? 'no' : res.indexOf('можлив') >= 0 ? 'yes' : null;
    var st = 'registered'; if (g(27)) st = 'mtu'; if (g(32) || g(30) || g(31)) st = 'inspected'; if (g(35)) st = 'conclusion';
    if (possible === 'yes') st = 'possible'; else if (possible === 'no') st = 'impossible'; if (g(44) || g(49) || g(64)) st = 'accepted';
    return {appeal_no: g(0) !== undefined && g(0) !== null ? String(g(0)) : null, appeal_date: isoDate(g(2)), ruling_no: g(4) !== undefined && g(4) !== null ? String(g(4)) : null,
      case_no: cs ? cs[1] : null, proceeding_no: pr ? pr[1] : null, asset_desc: g(9) || null, kind: g(12) || null, atype: g(13) || null, owner: g(17) || null, location: g(18) || null,
      mtu_code: normMtu(g(19)), conclusion_date: isoDate(g(35)) || g(35) || null, possible: possible, result: g(41) || null, stage: st};
  };
  function visible() { return A.T('ident_records'); }
  function unitKey(r) { return r.group_id ? 'g' + r.group_id : 'r' + r.id; }
  function cplx(r) { return /складн/i.test(r.atype || '') || val(r, 15) ? 'complex' : 'simple'; }
  // підтипи як у зведенні «Інформація про опрацювання звернень» (Аркуш2 файлу)
  var SUB_C = ['Земельні ділянки у складі майнового комплексу', 'Майнові комплекси', 'Готельний комплекс / розважальні заклади', 'Нежитлові будівлі', 'Транспорт у складі майнового комплексу', 'Корпоративні права', 'Інше (складні)'];
  var SUB_S = ['Квартири', 'Будинки', 'Гаражі / машиномісця', 'Транспорт', 'Земельні ділянки', 'Об’єкти нежитлової нерухомості', 'Інше (прості)'];
  function subtype(r) {
    var t = ((r.asset_desc || '') + ' ' + (r.kind || '')).toLowerCase();
    if (cplx(r) === 'complex') {
      if (/корпоратив|частк[аиу] в статутн|акці/.test(t)) return SUB_C[5]; if (/транспорт|автомоб|причіп|вагон|трактор/.test(t)) return SUB_C[4];
      if (/земельн|кадастров/.test(t)) return SUB_C[0]; if (/готел|розважальн|ресторан|санатор/.test(t)) return SUB_C[2]; if (/майнов\w* комплекс|цілісн/.test(t)) return SUB_C[1];
      if (/нежитл|будівл|приміщен/.test(t)) return SUB_C[3]; return SUB_C[6];
    }
    if (/квартир/.test(t)) return SUB_S[0]; if (/будинок|котедж/.test(t) && !/нежитл/.test(t)) return SUB_S[1]; if (/гараж|машиномісц|паркомісц/.test(t)) return SUB_S[2];
    if (/транспорт|автомоб|мотоцикл|причіп/.test(t)) return SUB_S[3]; if (/земельн|кадастров/.test(t)) return SUB_S[4]; if (/нежитл|приміщен|будівл/.test(t)) return SUB_S[5]; return SUB_S[6];
  }
  A.identSub = subtype;
  function inPeriod(r, f) { var d = r.appeal_date || ''; return (!f.from || d >= f.from) && (!f.to || (d && d <= f.to)); }

  // ================================================================ аналітика
  A.on(/^\/ident$/, function (f) {
    if (!A.can('ident_view') && !A.can('ident_edit')) return A.deny();
    var all = visible().filter(function (r) { return inPeriod(r, f); }), L = function (o) { return A.link('/ident/list', Object.assign({from: f.from, to: f.to}, o)); };
    var appeals = {}, rulings = {}, units = {}, unitRec = {};
    all.forEach(function (r) { if (r.appeal_no) appeals[r.appeal_no] = 1; if (r.ruling_no) rulings[(r.appeal_no || '') + '/' + r.ruling_no] = 1; var k = unitKey(r); if (!units[k]) { units[k] = r; unitRec[k] = []; } unitRec[k].push(r); });
    var U = Object.keys(units).map(function (k) { return units[k]; });
    var cnt = function (fn) { return U.filter(fn).length; }, attr = all.filter(function (r) { return (r.data || {}).attractive; });
    var concl = {}; all.forEach(function (r) { if (r.conclusion_date || val(r, 42)) concl[r.appeal_no + ':' + (r.conclusion_date || '')] = 1; });
    var h = '<form class="filters" data-act="filter" data-base="/ident"><span class="mini">Період надходження звернень:</span><input type="date" name="from" value="' + esc(f.from || '') + '"><input type="date" name="to" value="' + esc(f.to || '') + '">' +
      '<button class="btn">Показати</button>' + ['30', '90', '365'].map(function (d) { var t = new Date(Date.now() - d * 864e5).toISOString().slice(0, 10); return '<a class="btn sm plain" href="' + A.link('/ident', {from: t}) + '">' + {30: 'місяць', 90: 'квартал', 365: 'рік'}[d] + '</a>'; }).join('') +
      '<button type="button" class="btn plain" data-click="reset" data-base="/ident">Увесь період</button></form>';
    h += '<div class="grid g5">' + A.kpi('Звернень прокурорів', A.num(Object.keys(appeals).length), 'за період') + A.kpi('Ухвал суду', A.num(Object.keys(rulings).length), 'у зверненнях') +
      A.kpi('Активів', A.num(U.length), 'складних ' + cnt(function (r) { return cplx(r) === 'complex'; }) + ' · простих ' + cnt(function (r) { return cplx(r) === 'simple'; }), L({})) +
      A.kpi('Висновків', A.num(Object.keys(concl).length), 'підписано / направлено') + A.kpi('Інвестиційно привабливі', A.num(attr.length), 'відмічено ідентифікацією', L({attractive: 1})) + '</div><div class="grid g5" style="margin-top:14px">' +
      A.kpi('Управління можливе', A.num(cnt(function (r) { return r.possible === 'yes'; })), 'за висновком', L({possible: 'yes'})) + A.kpi('Управління неможливе', A.num(cnt(function (r) { return r.possible === 'no'; })), 'за висновком', L({possible: 'no'})) +
      A.kpi('Прийнято в управління', A.num(cnt(function (r) { return r.stage === 'accepted'; })), 'акт / ухвала про передачу', L({stage: 'accepted'})) +
      A.kpi('Зіставлено з Реєстром', A.num(all.filter(function (r) { return r.asset_id; }).length), 'за номером активу', L({linked: 'yes'})) + A.kpi('Ще не в Реєстрі', A.num(all.filter(function (r) { return !r.asset_id; }).length), 'номер можна прив’язати пізніше', L({linked: 'no'}), 'overdue') + '</div>';
    var months = A.grp(U.filter(function (r) { return r.appeal_date; }), function (r) { return r.appeal_date.slice(0, 7); }).sort(function (a, b) { return a[0].localeCompare(b[0]); }).slice(-18);
    var stg = A.series(A.grp(U, 'stage'), STG, function (v) { return L({stage: v}); }), mtu = A.series(A.grp(U, 'mtu_code'), N.MTU, function (v) { return L({mtu: v}); });
    var subC = A.grp(U.filter(function (r) { return cplx(r) === 'complex'; }), subtype), subS = A.grp(U.filter(function (r) { return cplx(r) === 'simple'; }), subtype);
    h += '<h2>Аналітика</h2><div class="grid g3"><div class="panel"><h3>Надходження звернень <span>активів за місяцями</span></h3>' + A.chart('barv', [months.map(function (m) { return m[0].slice(5) + '.' + m[0].slice(2, 4); }), months.map(function (m) { return m[1]; }), months.map(function (m) { var y = m[0].split('-'); var last = new Date(+y[0], +y[1], 0).getDate(); return L({from: m[0] + '-01', to: m[0] + '-' + last}); })], 'cyan') + '</div>' +
      '<div class="panel"><h3>Етап ідентифікації</h3>' + A.chart('donut', stg, null, stg[0].map(function (_, i) { return ['#6E7F9E', '#35D6E8', '#8B7BF7', '#C3B8FF', '#3DD68C', '#F0524E', '#4C8DF6'][i % 7]; })) + '</div>' +
      '<div class="panel"><h3>За МТУ</h3>' + A.chart('barh', mtu, 'gold') + '</div><div class="panel"><h3>Складні активи <span>за видами</span></h3>' + A.chart('barh', A.series(subC, null, function (v) { return L({sub: v}); }), 'violet') + '</div>' +
      '<div class="panel"><h3>Прості активи <span>за видами</span></h3>' + A.chart('barh', A.series(subS, null, function (v) { return L({sub: v}); }), 'ok') + '</div>' +
      '<div class="panel"><h3>Зіставлення з Реєстром</h3>' + A.chart('donut', A.series(A.grp(all, function (r) { return r.match_level || 'Не знайдено'; }), null, function (v) { return L({match: v}); }), null, ['#3DD68C', '#F5C518', '#F0524E', '#4C8DF6']) + '</div></div>';
    // зведення за зверненнями — як у презентаційному аркуші файлу
    var byA = {}; all.forEach(function (r) { var k = r.appeal_no || '—'; (byA[k] = byA[k] || []).push(r); });
    h += '<h2>Опрацювання звернень <span class="mini">структура зведення «Інформація про опрацювання звернень слідчих прокурорів»</span></h2><div class="wrap-tbl"><table><thead><tr><th>№</th><th>Звернення (АРМА)</th><th>Орган</th><th class="num">Ухвал</th><th class="num">Складні</th><th class="num">Прості</th><th class="num">Активів</th><th class="num">Ідентифіковано</th><th class="num">Можливе</th><th class="num">Неможливе</th><th>Висновок до прокуратури</th></tr></thead><tbody>' +
      Object.keys(byA).sort(function (a, b) { return (+a || 0) - (+b || 0); }).map(function (k) { var rs = byA[k], u = {}, rl = {}; rs.forEach(function (r) { u[unitKey(r)] = r; if (r.ruling_no) rl[r.ruling_no] = 1; }); var us = Object.keys(u).map(function (x) { return u[x]; });
        var n = function (fn) { return us.filter(fn).length; }, idn = rs.reduce(function (s, r) { return s + (Number(val(r, 36)) || 0) + (Number(val(r, 37)) || 0); }, 0);
        return '<tr><td><a href="' + L({appeal: k}) + '">' + esc(k) + '</a></td><td class="mini">' + esc(val(rs[0], 2) || '') + '</td><td class="mini" style="max-width:260px">' + A.clip(String(val(rs[0], 3) || ''), 90) + '</td><td class="num">' + Object.keys(rl).length + '</td>' +
          '<td class="num">' + n(function (r) { return cplx(r) === 'complex'; }) + '</td><td class="num">' + n(function (r) { return cplx(r) === 'simple'; }) + '</td><td class="num"><b>' + us.length + '</b></td><td class="num">' + (idn || '—') + '</td>' +
          '<td class="num">' + n(function (r) { return r.possible === 'yes'; }) + '</td><td class="num">' + n(function (r) { return r.possible === 'no'; }) + '</td><td class="mini">' + esc(String(val(rs.filter(function (r) { return val(r, 43); })[0] || {}, 43) || '')) + '</td></tr>'; }).join('') + '</tbody></table></div>';
    var act = '<a class="btn" href="' + L({}) + '">Перелік записів</a>' + (canE() ? '<a class="btn gold" href="#/ident/new">+ Запис</a>' : '') + (A.can('export') ? '<a class="btn" href="#" data-click="ident-xlsx" data-q="' + esc(JSON.stringify({from: f.from, to: f.to})) + '">XLSX у структурі «БАЗОВА»</a>' : '');
    A.render(A.shell('Ідентифікація активів', 'Звернення прокурорів, ухвали, висновки щодо можливості управління · Управління ідентифікації, оцінки та збереження активів', act, h), A.keep);
  });

  // ================================================================ перелік
  var SEL = {get: function () { try { return JSON.parse(sessionStorage.getItem('ident-sel') || '[]'); } catch (e) { return []; } }, set: function (a) { sessionStorage.setItem('ident-sel', JSON.stringify(a)); }};
  A.identFilter = function (f) {
    var w = (f.q || '').toLowerCase().split(/\s+/).filter(Boolean);
    return visible().filter(function (r) {
      if (!inPeriod(r, f)) return false;
      if (w.length) { var s = r._s || (r._s = [r.appeal_no, r.asset_desc, r.owner, r.location, r.case_no, r.proceeding_no, r.asset_no, r.kind, r.result].join(' ').toLowerCase()); if (!w.every(function (x) { return s.indexOf(x) >= 0; })) return false; }
      if (f.stage && r.stage !== f.stage) return false; if (f.possible && r.possible !== f.possible) return false; if (f.mtu && (f.mtu === '__none__' ? r.mtu_code : r.mtu_code !== f.mtu)) return false;
      if (f.match && (r.match_level || 'Не знайдено') !== f.match) return false; if (f.linked === 'yes' && !r.asset_id) return false; if (f.linked === 'no' && r.asset_id) return false;
      if (f.attractive && !(r.data || {}).attractive) return false; if (f.appeal && r.appeal_no !== f.appeal) return false; if (f.sub && subtype(r) !== f.sub) return false;
      if (f.dept && r.dept_code !== f.dept) return false; if (f.group && String(r.group_id) !== f.group) return false; if (f.cx && cplx(r) !== f.cx) return false; if (f.sel && SEL.get().indexOf(r.id) < 0) return false;
      return true;
    }).sort(function (a, b) { return (a.row_no || 1e9) - (b.row_no || 1e9) || a.id - b.id; });
  };
  A.on(/^\/ident\/list$/, function (f) {
    if (!A.can('ident_view') && !A.can('ident_edit')) return A.deny();
    var list = A.identFilter(f), pg = A.pageOf(list, f), q = Object.assign({}, f); delete q.page; var sel = SEL.get();
    var h = '<form class="filters" data-act="filter" data-base="/ident/list"><input name="q" value="' + esc(f.q || '') + '" placeholder="Звернення, опис активу, власник, справа, № у Реєстрі" style="flex:1;min-width:260px">' +
      A.sel('stage', STAGES, f.stage, 'Усі етапи') + A.sel('possible', [['yes', 'Можливе'], ['no', 'Неможливе']], f.possible, 'Можливість управління') + A.sel('mtu', A.OPT.MTU.concat([['__none__', 'Без МТУ']]), f.mtu, 'Усі МТУ') +
      A.sel('linked', [['yes', 'Є в Реєстрі'], ['no', 'Ще не в Реєстрі']], f.linked, 'Зіставлення') + A.sel('cx', [['complex', 'Складні'], ['simple', 'Прості']], f.cx, 'Складність') + A.sel('attractive', [['1', 'Інвестиційно привабливі']], f.attractive, 'Привабливість') +
      '<input type="date" name="from" value="' + esc(f.from || '') + '" title="Звернення з"><input type="date" name="to" value="' + esc(f.to || '') + '" title="по">' + ['appeal', 'sub', 'match', 'group', 'dept', 'sel'].map(function (k) { return f[k] ? '<input type="hidden" name="' + k + '" value="' + esc(f[k]) + '">' : ''; }).join('') +
      '<button class="btn">Знайти</button><button type="button" class="btn plain" data-click="reset" data-base="/ident/list">Скинути все</button></form>' +
      (sel.length ? '<div class="sel-basket">Обрано записів: <b>' + sel.length + '</b> (зберігаються між пошуками) · <a href="' + A.link('/ident/list', {sel: 1}) + '">показати обрані</a> · <a href="#" data-click="ident-sel-clear">очистити</a></div>' : '') +
      A.pager(list.length, pg.page, '/ident/list', q) + '<div class="wrap-tbl"><table><thead><tr><th style="width:26px"></th><th>Рядок / звернення</th><th>Актив</th><th>Вид / складність</th><th>МТУ</th><th>Етап</th><th>№ у Реєстрі</th><th>Група</th></tr></thead><tbody>' +
      pg.rows.map(function (r) { var g = r.group_id && A.get('ident_groups', r.group_id);
        return '<tr><td><input type="checkbox" data-isel value="' + r.id + '"' + (sel.indexOf(r.id) >= 0 ? ' checked' : '') + ' style="width:auto"></td><td class="nowrap"><a class="id" href="#/ident/' + r.id + '">' + (r.row_no ? 'р. ' + r.row_no : '#' + r.id) + '</a><span class="sub">зв. ' + esc(r.appeal_no || '—') + (r.appeal_date ? ' · ' + A.dt(r.appeal_date) : '') + '</span></td>' +
          '<td style="max-width:420px"><span class="clip" title="' + esc(r.asset_desc) + '">' + esc(r.asset_desc || '—') + '</span><span class="sub">' + esc((r.owner || '').slice(0, 80)) + '</span></td><td class="mini">' + esc(r.kind || '') + '<br>' + esc(r.atype || '') + '</td><td class="mini">' + esc(N.MTU[r.mtu_code] || '—') + '</td>' +
          '<td>' + A.identStage(r.stage) + ((r.data || {}).attractive ? '<span class="sub"><span class="tag t-gold">привабливий</span></span>' : '') + '</td><td class="mini">' + (r.asset_id ? '<a href="#/asset/' + r.asset_id + '">' + esc(r.asset_no) + '</a><br><span class="mini">' + esc(r.match_level || '') + '</span>' : '<span class="tag t-lim">не в Реєстрі</span>') + '</td>' +
          '<td class="mini">' + (g ? '<a href="#/ident/group/' + g.id + '">' + esc(g.code) + '</a>' : '—') + '</td></tr>'; }).join('') + (list.length ? '' : '<tr><td colspan="8"><div class="empty">Записів не знайдено.</div></td></tr>') + '</tbody></table></div>' + A.pager(list.length, pg.page, '/ident/list', q) +
      (canE() ? '<form class="sel-bar" data-act="ident-bulk"><span class="mini">Обрано: <b>' + sel.length + '</b></span><select name="action"><option value="">— дія з обраними —</option><option value="group">Об’єднати в групу (пул ідентифікації одного активу)</option><option value="ungroup">Вилучити з групи</option><option value="attractive">Відмітити як інвестиційно привабливі</option><option value="mtu">Призначити МТУ</option></select>' +
        A.sel('mtu_v', A.OPT.MTU, null, '— МТУ —') + '<button class="btn gold"' + (sel.length ? '' : ' disabled') + '>Застосувати</button></form>' : '');
    var act = (canE() ? '<a class="btn gold" href="#/ident/new">+ Запис</a>' : '') + (A.can('export') ? '<a class="btn" href="#" data-click="ident-xlsx" data-q="' + esc(JSON.stringify(q)) + '">XLSX у структурі «БАЗОВА» (за фільтром)</a>' : '') + '<a class="btn plain" href="' + A.link('/ident', {from: f.from, to: f.to}) + '">Аналітика</a>';
    A.render(A.shell('Ідентифікація · перелік записів', 'Записів за умовами: ' + list.length, act, h), A.keep);
  });
  A.afterRender.push(function (root) { root.querySelectorAll('input[data-isel]').forEach(function (b) { b.addEventListener('change', function () { var s = SEL.get(), i = s.indexOf(+b.value); if (b.checked && i < 0) s.push(+b.value); if (!b.checked && i >= 0) s.splice(i, 1); SEL.set(s); var c = root.querySelector('.sel-bar b'); if (c) c.textContent = s.length; var btn = root.querySelector('form[data-act="ident-bulk"] button'); if (btn) btn.disabled = !s.length; }); }); });
  A.CLICK['ident-sel-clear'] = function () { SEL.set([]); A.route(true); };
  A.ACT['ident-bulk'] = function (f, d) {
    var ids = SEL.get(), rs = ids.map(function (i) { return A.get('ident_records', i); }).filter(Boolean), tx = A.tx();
    if (!rs.length || !d.action) return A.toast('Оберіть записи і дію', 'err');
    if (d.action === 'group') {
      var gid = A.tmpId(), first = rs[0], y = new Date().getFullYear();
      tx.put('ident_groups', {id: gid, code: 'ІД-' + (first.appeal_no || 0) + '-' + y + '-' + (A.T('ident_groups').length + 1), name: (first.asset_desc || '').slice(0, 200), appeal_no: first.appeal_no, ruling: String(val(first, 6) || '').slice(0, 500), dept_code: first.dept_code});
      rs.forEach(function (r) { tx.put('ident_records', {id: r.id, group_id: gid}); });
      tx.log('Створено групу записів ідентифікації', 'ident_group', null, {records: rs.length});
      return tx.commit().then(function (res) { SEL.set([]); A.toast('Групу створено'); A.go('#/ident/group/' + res.id('ident_groups', gid)); });
    }
    rs.forEach(function (r) {
      if (d.action === 'ungroup') tx.put('ident_records', {id: r.id, group_id: null});
      if (d.action === 'attractive') tx.put('ident_records', {id: r.id, data: Object.assign({}, r.data, {attractive: 1})});
      if (d.action === 'mtu' && d.mtu_v) tx.put('ident_records', {id: r.id, mtu_code: d.mtu_v});
    });
    if (!tx.size()) return A.toast('Вкажіть значення', 'err');
    tx.log('Масова дія (ідентифікація): ' + d.action, 'ident', null, {count: rs.length});
    return tx.commit().then(function () { A.toast('Оновлено записів: ' + rs.length); A.route(true); });
  };

  // ================================================================ картка запису: етап, Реєстр, форма у структурі файлу
  A.identLifecycle = function (r) {
    var a = r.asset_id && A.get('assets', r.asset_id), g = function (i) { return val(r, i); };
    var v = a && (a.val_amount || a.val_source === 'Групова оцінка'), plan = a && A.plansOf(a.pool_id ? 'pool' : 'asset', a.pool_id || a.id).filter(function (p) { return p.status === 'active'; })[0];
    var cur = plan && (A.indexes.stepsByPlan[plan.id] || []).filter(function (s) { return s.status === 'active' || s.status === 'review'; }).map(function (s) { return s.name; }).join('; ');
    var steps = [['Звернення зареєстровано', !!(r.appeal_date || g(2)), A.dt(r.appeal_date)], ['Доручення МТУ', !!g(27), g(27)], ['Огляд активу', !!(g(32) || g(30) || g(31)), g(32) ? A.dt(isoDate(g(32)) || g(32)) : g(31)],
      ['Висновок підписано', !!g(35), r.conclusion_date ? A.dt(r.conclusion_date) : ''], ['Висновок направлено до прокуратури', !!g(43), g(43)],
      [r.possible === 'no' ? 'Управління неможливе' : 'Управління можливе', !!r.possible, r.result || '', r.possible === 'no'],
      ['Звернення / ухвала про передачу в управління', !!g(44), g(44)], ['Акт приймання-передачі від прокурора', !!g(49), g(49)],
      ['Внесено до Реєстру активів', !!a, a ? a.asset_no : 'номер можна прив’язати пізніше'], ['Оцінка', !!(v || g(50)), a && a.val_amount ? A.money(a.val_amount) + ' · ' + A.dt(a.val_date) : g(50) ? A.dt(isoDate(g(50)) || g(50)) : ''],
      ['Зберігання', !!((a && a.custodian_name) || g(55)), (a && a.custodian_name) || g(56) || ''],
      ['Визначення управителя / реалізація', !!(a && ['manager_contract', 'realization'].indexOf(a.transfer_way) >= 0) || !!g(65), a ? (N.WAY[a.transfer_way] || '') + (cur ? ' · зараз: ' + cur : '') : '']];
    var curIdx = -1; steps.forEach(function (s, i) { if (curIdx < 0 && !s[1]) curIdx = i; });
    if (r.possible === 'no') curIdx = -2;
    return '<ol class="steps">' + steps.map(function (s, i) { var cls = s[3] ? 'skip' : s[1] ? 'done' : i === curIdx ? 'now' : '';
      return '<li class="' + cls + '"><span class="n">' + (i + 1) + '</span><div><div class="t">' + esc(s[0]) + '</div>' + (s[2] ? '<div class="s">' + (typeof s[2] === 'string' && s[2].indexOf('<') < 0 ? esc(s[2]) : s[2]) + '</div>' : '') + '</div><div class="s">' + (s[1] ? 'виконано' : i === curIdx ? '<b style="color:var(--gold)">поточний етап</b>' : '') + '</div><div></div><div></div></li>'; }).join('') + '</ol>' +
      (r.possible === 'no' ? '<p class="mini">За висновком управління активом неможливе — подальші етапи не застосовуються.</p>' : '');
  };
  function registryPanel(r) {
    var a = r.asset_id && A.get('assets', r.asset_id);
    var h = '<div class="panel"><h3>Реєстр активів</h3>';
    if (a) {
      var cv = A.T('valuations').filter(function (v) { return v.is_current && ((v.target_type === 'asset' && v.target_id === a.id) || (a.pool_id && v.target_type === 'pool' && v.target_id === a.pool_id)); })[0];
      h += '<dl class="kv">' + dd('№ у Реєстрі', '<a class="id" href="#/asset/' + a.id + '">' + esc(a.asset_no) + '</a> ' + A.zone(a.zone, true), true) + dd('Зіставлення', (r.match_level || '') + (r.match_note ? ' · ' + r.match_note : '')) + dd('Правовий стан', A.legal(a.legal_status), true) +
        dd('Відділ ДМА', N.DMA[a.dept_code] || 'не закріплено') + dd('Спосіб передачі', N.WAY[a.transfer_way]) + dd('Оцінка', cv ? (cv.value_uah ? A.money(cv.value_uah) + ' · ' : '') + (cv.status || '') + (cv.value_date ? ' · ' + A.dt(cv.value_date) : '') : a.val_amount ? A.money(a.val_amount) : 'немає') +
        dd('Зберігач', a.custodian_name) + dd('Управитель', a.manager_name) + '</dl>';
    } else h += '<p class="mini">Актив ще не зіставлено з Реєстром. Коли актив буде внесено до Реєстру, прив’яжіть його номер — дані оцінки, зберігання й управління підтягуватимуться автоматично.</p>';
    if (canE()) h += '<form class="filters" data-act="ident-link" data-id="' + r.id + '" style="margin-top:8px"><input name="asset_no" value="' + esc(r.asset_no || '') + '" placeholder="№ активу в Реєстрі" style="min-width:180px"><button class="btn sm gold">Прив’язати</button>' + (r.asset_id ? '<button class="btn sm plain" name="unlink" value="1">Відв’язати</button>' : '') + '</form>' +
      (!r.asset_id && (A.can('create_assets') || A.can('edit_any_asset')) ? '<p class="mini"><a href="' + A.link('/asset/new', {category: /земел/i.test(r.asset_desc || '') ? 'land' : /корпорат/i.test(r.kind || '') ? 'corporate' : /рухом/i.test(r.kind || '') && !/нерух/i.test(r.kind || '') ? 'transport' : 'realestate'}) + '">Завести актив у Реєстрі →</a></p>' : '');
    return h + '</div>';
  }
  function attractPanel(r) {
    var at = (r.data || {}).attractive, plans = A.plansOf('ident', r.id);
    var h = '<div class="panel"><h3>Інвестиційна привабливість і закріплення</h3><div>' + (at ? '<span class="tag t-gold">Інвестиційно привабливий</span>' : '<span class="tag t-unk">не відмічено</span>') + (r.dept_code ? ' · ' + esc(N.DMA[r.dept_code]) : '') + '</div>';
    if (plans.length) h += '<p class="mini">План дій: ' + plans.map(function (p) { return esc(N.PROC[p.process]) + ' (' + ({active: 'діє', done: 'завершено', cancelled: 'скасовано'}[p.status] || p.status) + ')'; }).join('; ') + '</p>';
    if (canE() || A.can('crm_edit')) h += '<form data-act="ident-attract" data-id="' + r.id + '" style="margin-top:8px">' + A.fsel('Привабливість', 'attractive', [['1', 'Інвестиційно привабливий'], ['0', 'Не привабливий / не оцінено']], at ? '1' : '0', 0, '', '', '', null) +
      A.fsel('Відповідальний відділ ДМА', 'dept_code', D.DMA, r.dept_code) + A.fsel('Розпочати план дій (CRM)', 'process', D.PROCESSES.map(function (p) { return [p[0], p[1]]; }), plans.length ? '' : 'acceptance', 0, 'Порожньо — без плану', '', '', 'Без плану') + '<button class="btn gold">Зберегти і закріпити</button></form>';
    return h + '</div>';
  }
  function formHtml(r, edit) {
    var data = r.data || {};
    var h = '<form data-act="ident-save" data-id="' + (r.id || '') + '">';
    SECS.forEach(function (s, si) {
      h += '<details class="ident-sec"' + (si < 4 || !r.id ? ' open' : '') + '><summary>' + (si + 1) + '. ' + esc(s[0]) + ' <span class="mini">колонки ' + COLS[s[1]][1] + '–' + COLS[s[2]][1] + '</span></summary><fieldset' + (edit ? '' : ' disabled') + ' style="border:0;margin:0;padding:0;background:none"><div class="form-grid">';
      for (var i = s[1]; i <= s[2]; i++) {
        var c = COLS[i], v = data['c' + i], lab = c[1] + ' · ' + c[2];
        if (FORMULA[i]) { h += '<div class="field"><label title="Формула: AK+AL">' + esc(lab) + '</label><input value="' + ((Number(data.c36) || 0) + (Number(data.c37) || 0)) + '" disabled><div class="mini">формула =AK+AL</div></div>'; continue; }
        if (COUNTERS.indexOf(i) >= 0) { h += A.fsel(lab, 'c' + i, [['1', '1']], v ? '1' : '', 0, '', '', '', '—'); continue; }
        if (DATES.indexOf(i) >= 0) { h += A.field(lab, 'c' + i, isoDate(v) || '', 'date', 0, v && !isoDate(v) ? 'у файлі: ' + v : ''); continue; }
        if (i === 19) { h += A.fsel(lab, 'c19', D.MTU.map(function (m) { return [m[1], m[1]]; }).concat(v && !D.MTU.some(function (m) { return m[1] === v; }) ? [[v, v]] : []), v, 0); continue; }
        h += A.field(lab, 'c' + i, v, LONG.indexOf(i) >= 0 ? 'textarea' : 'text', 0, '', LONG.indexOf(i) >= 0 ? 'wide' : '');
      }
      h += '</div></fieldset></details>';
    });
    if (edit) h += '<div class="form-actions"><a class="btn plain" href="' + (r.id ? '#/ident/' + r.id : '#/ident/list') + '">Скасувати</a><button class="btn gold">Зберегти запис</button></div>';
    return h + '</form>';
  }
  A.on(/^\/ident\/new$/, function () { if (!canE()) return A.deny(); A.render(A.shell('Новий запис ідентифікації', 'Структура відповідає таблиці «БАЗОВА Ідентифікація»', '', formHtml({data: {}}, true))); });
  A.on(/^\/ident\/(\d+)$/, function (id) {
    if (!A.can('ident_view') && !A.can('ident_edit')) return A.deny();
    var r = A.get('ident_records', +id); if (!r) return A.notFound(); var g = r.group_id && A.get('ident_groups', r.group_id);
    var act = (A.can('delete_records') || canE() ? '<button class="btn danger" data-click="ident-del" data-id="' + r.id + '" data-confirm="Видалити запис ідентифікації?">Видалити</button>' : '') + '<a class="btn plain" href="#" data-click="back">Назад</a>';
    var h = '<div class="card-grid"><div>' + (g ? '<div class="banner">Запис входить до групи <a href="#/ident/group/' + g.id + '"><b>' + esc(g.code) + '</b></a> — записи одного активу (план ідентифікації ведеться на рівні групи).</div>' : '') +
      '<div class="panel"><h3>На якому етапі актив <span>' + A.identStage(r.stage) + '</span></h3>' + A.identLifecycle(r) + '</div><h2>Дані запису <span class="mini">у структурі файлу «БАЗОВА Ідентифікація»</span></h2>' + formHtml(r, canE()) + '</div><aside class="side">' +
      '<div class="panel"><h3>Запис</h3><dl class="kv" style="grid-template-columns:110px 1fr">' + dd('Рядок файлу', r.row_no) + dd('Звернення', r.appeal_no) + dd('Дата', A.dt(r.appeal_date), true) + dd('Справа', r.case_no) + dd('МТУ', N.MTU[r.mtu_code]) + dd('Оновлено', (r.updated_at || '') + ' · ' + (r.updated_by || '')) + '</dl></div>' +
      registryPanel(r) + attractPanel(r) + A.docsBlock('ident', r.id, canE(), ['ident_conclusion', 'inspection_act', 'court_scan', 'other']) + '</aside></div>';
    A.render(A.shell('Ідентифікація · ' + (r.row_no ? 'рядок ' + r.row_no : 'запис ' + r.id), (r.asset_desc || '').slice(0, 140), act, h), A.keep);
  });
  A.ACT['ident-save'] = function (form, d) {
    var isNew = !form.dataset.id, r = isNew ? {data: {}} : A.get('ident_records', +form.dataset.id), data = Object.assign({}, r.data || {});
    Object.keys(d).forEach(function (k) { if (!/^c\d+$/.test(k)) return; var v = typeof d[k] === 'string' ? d[k].trim() : d[k], i = +k.slice(1);
      if (COUNTERS.indexOf(i) >= 0) v = v ? 1 : null; else if (v !== '' && /^-?\d+([.,]\d+)?$/.test(v) && [0, 4, 53, 60].indexOf(i) >= 0) v = A.parseNum(v);
      if (v === '' || v === null) delete data[k]; else data[k] = v; });
    if (!data.c9 && !data.c6 && !data.c2) throw new Error('Заповніть хоча б опис активу, реквізити ухвали або дату звернення');
    var der = A.identDerive(data), rec = Object.assign({id: isNew ? A.tmpId() : r.id, data: data, updated_by: S.user && S.user.login, updated_at: A.nowS()}, der);
    if (!der.mtu_code && r.mtu_code && !data.c19) rec.mtu_code = r.mtu_code;
    if (isNew) rec.row_no = null;
    var tx = A.tx(); tx.put('ident_records', rec); tx.log(isNew ? 'Додано запис ідентифікації' : 'Змінено запис ідентифікації', 'ident', isNew ? null : r.id);
    return tx.commit().then(function (res) { form.classList.remove('dirty'); A.toast('Запис збережено · етап: ' + STG[der.stage]); A.go('#/ident/' + res.id('ident_records', rec.id)); });
  };
  A.ACT['ident-link'] = function (f, d, btn) {
    var r = A.get('ident_records', +f.dataset.id), tx = A.tx();
    if (d.unlink) tx.put('ident_records', {id: r.id, asset_id: null, asset_no: null, match_level: 'Не знайдено', match_note: 'відв’язано вручну'});
    else { var a = A.indexes.byNo[(d.asset_no || '').trim()]; if (!a) return A.toast('Актив з номером «' + (d.asset_no || '') + '» у Реєстрі не знайдено', 'err');
      tx.put('ident_records', {id: r.id, asset_id: a.id, asset_no: a.asset_no, match_level: 'Вручну', match_note: 'прив’язано ' + (S.user ? S.user.login : '') + ' ' + A.today()}); }
    tx.log('Зіставлення ідентифікації з Реєстром', 'ident', r.id, {asset_no: d.asset_no});
    return tx.commit().then(function () { A.toast(d.unlink ? 'Відв’язано' : 'Прив’язано до активу Реєстру'); A.route(true); });
  };
  A.ACT['ident-attract'] = function (f, d) {
    var r = A.get('ident_records', +f.dataset.id), tx = A.tx(), at = d.attractive === '1';
    tx.put('ident_records', {id: r.id, dept_code: d.dept_code || null, data: Object.assign({}, r.data, {attractive: at ? 1 : null})});
    var tt = r.group_id ? 'ident_group' : 'ident', tid = r.group_id || r.id;
    if (d.process) { if (!A.can('crm_edit')) throw new Error('Немає права створювати план дій'); A.createPlan(tx, tt, tid, d.process, d.dept_code, null); }
    if (r.group_id && d.dept_code) tx.put('ident_groups', {id: r.group_id, dept_code: d.dept_code});
    var a = r.asset_id && A.get('assets', r.asset_id);
    if (a && d.dept_code && A.canEdit(a, 'main')) tx.put('assets', {id: a.id, dept_code: a.dept_code || d.dept_code, invest_grade: at && (!a.invest_grade || a.invest_grade === 'unknown') ? 'attractive' : a.invest_grade}, a.updated_at);
    tx.log('Закріплення актива ідентифікації за відділом ДМА', 'ident', r.id, {dept: d.dept_code, attractive: at, plan: d.process});
    return tx.commit().then(function () { A.toast('Збережено' + (d.process ? '; план дій створено' : '')); A.route(true); });
  };
  A.CLICK['ident-del'] = function (t) { var tx = A.tx(); tx.del('ident_records', +t.dataset.id); tx.log('Видалено запис ідентифікації', 'ident', +t.dataset.id); return tx.commit().then(function () { A.go('#/ident/list'); }); };

  // ================================================================ група записів одного активу
  A.on(/^\/ident\/group\/(\d+)$/, function (id) {
    var g = A.get('ident_groups', +id); if (!g) return A.notFound(); var rs = (A.indexes.identByGroup[g.id] || []).slice().sort(function (a, b) { return (a.row_no || 0) - (b.row_no || 0); });
    var linked = rs.filter(function (r) { return r.asset_id; }), pool = g.pool_id && A.get('pools', g.pool_id);
    var act = (canE() ? '<button class="btn danger" data-click="ident-group-del" data-id="' + g.id + '" data-confirm="Розформувати групу? Записи залишаться.">Розформувати</button>' : '') + '<a class="btn plain" href="' + A.link('/ident/list', {group: g.id}) + '">Записи групи в переліку</a>';
    var h = '<div class="grid g4">' + A.kpi('Записів', A.num(rs.length), 'рядків файлу ідентифікації') + A.kpi('Зіставлено з Реєстром', A.num(linked.length), 'активів Реєстру') + A.kpi('Відділ ДМА', esc(N.DMA_SHORT[g.dept_code] || '—'), N.DMA[g.dept_code] || 'не закріплено') +
      A.kpi('Пул у Реєстрі', pool ? '<a href="#/pool/' + pool.id + '">' + esc(pool.code) + '</a>' : '—', pool ? pool.name : 'можна створити з зіставлених активів') + '</div>' +
      '<div class="panel" style="margin-top:14px"><dl class="kv">' + dd('Код групи', g.code) + dd('Назва', g.name) + dd('Звернення', g.appeal_no) + dd('Ухвала', g.ruling) + dd('Примітка', g.note) + '</dl>' +
      (canE() ? '<form class="filters" data-act="ident-group-save" data-id="' + g.id + '" style="margin-top:10px"><input name="name" value="' + esc(g.name || '') + '" placeholder="Назва групи" style="flex:1;min-width:260px">' + A.sel('dept_code', D.DMA, g.dept_code, 'Відділ ДМА') + '<input name="note" value="' + esc(g.note || '') + '" placeholder="Примітка"><button class="btn gold">Зберегти</button></form>' : '') +
      (!pool && linked.length && A.can('manage_pools') ? '<p><button class="btn" data-click="ident-group-pool" data-id="' + g.id + '">Створити пул у Реєстрі з зіставлених активів (' + linked.length + ')</button></p>' : '') + '</div>' +
      '<h2>Записи групи</h2><div class="wrap-tbl"><table><thead><tr><th>Рядок</th><th>Актив</th><th>Етап</th><th>№ у Реєстрі</th></tr></thead><tbody>' + rs.map(function (r) {
        return '<tr><td><a class="id" href="#/ident/' + r.id + '">' + (r.row_no ? 'р. ' + r.row_no : '#' + r.id) + '</a></td><td><span class="clip">' + esc(r.asset_desc || '') + '</span></td><td>' + A.identStage(r.stage) + '</td><td class="mini">' + (r.asset_id ? '<a href="#/asset/' + r.asset_id + '">' + esc(r.asset_no) + '</a>' : '—') + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      '<h2>План ідентифікації</h2>' + A.planBlock('ident_group', g.id, canE() || A.can('crm_edit'), g.dept_code) + '<div style="margin-top:14px">' + A.docsBlock('ident_group', g.id, canE(), ['ident_conclusion', 'inspection_act', 'court_scan', 'other']) + '</div>';
    A.render(A.shell('Група ідентифікації ' + g.code, (g.name || '').slice(0, 140), act, h), A.keep);
  });
  A.ACT['ident-group-save'] = function (f, d) { var tx = A.tx(); tx.put('ident_groups', {id: +f.dataset.id, name: d.name || null, dept_code: d.dept_code || null, note: d.note || null}); return tx.commit().then(function () { A.toast('Збережено'); A.route(true); }); };
  A.CLICK['ident-group-del'] = function (t) { var tx = A.tx(); tx.del('ident_groups', +t.dataset.id); tx.log('Розформовано групу ідентифікації', 'ident_group', +t.dataset.id); return tx.commit().then(function () { A.go('#/ident/list'); }); };
  A.CLICK['ident-group-pool'] = function (t) {
    var g = A.get('ident_groups', +t.dataset.id), rs = (A.indexes.identByGroup[g.id] || []).filter(function (r) { return r.asset_id; }), tx = A.tx(), pid = A.tmpId(), y = new Date().getFullYear();
    tx.put('pools', {id: pid, code: 'П-' + y + '-ІД' + g.id, name: g.name || g.code, complexity: 'pool', dept_code: g.dept_code, court_basis: g.ruling, source: 'Ідентифікація ' + g.code, ident_group_id: g.id});
    tx.put('ident_groups', {id: g.id, pool_id: pid});
    rs.forEach(function (r) { var a = A.get('assets', r.asset_id); if (a && !a.pool_id) tx.put('assets', {id: a.id, pool_id: pid}, a.updated_at); });
    tx.log('Створено пул з групи ідентифікації', 'ident_group', g.id);
    return tx.commit().then(function (r) { A.toast('Пул створено'); A.go('#/pool/' + r.id('pools', pid)); });
  };

  // ================================================================ вивантаження у структурі «БАЗОВА Ідентифікація»
  function regFill(r) {
    var a = r.asset_id && A.get('assets', r.asset_id); if (!a) return {};
    var v = A.T('valuations').filter(function (x) { return x.is_current && x.value_uah && ((x.target_type === 'asset' && x.target_id === a.id) || (a.pool_id && x.target_type === 'pool' && x.target_id === a.pool_id)); })[0];
    var o = {50: v ? A.dt(v.value_date) : a.val_date ? A.dt(a.val_date) : null, 51: v && v.appraiser, 52: v && A.can('view_internal') ? v.appraiser_code : null, 53: v ? Math.round(v.value_uah / 10) / 100 : a.val_amount ? Math.round(a.val_amount / 10) / 100 : null,
      55: [a.storage_contract_no, a.storage_contract_date && A.dt(a.storage_contract_date)].filter(Boolean).join(' від ') || null, 56: a.custodian_name, 57: A.can('view_internal') ? a.custodian_code : null, 58: a.storage_kind, 59: a.storage_place,
      60: a.storage_cost_month, 61: a.storage_contract_date ? A.dt(a.storage_contract_date) : null, 62: a.storage_until ? A.dt(a.storage_until) : null, 65: a.mgmt_contract, 66: a.manager_name, 67: A.can('view_internal') ? a.manager_code : null};
    Object.keys(o).forEach(function (k) { if (o[k] === '—' || o[k] === undefined) o[k] = null; });
    return o;
  }
  A.identRows = function (list) {
    return list.map(function (r) {
      var d = r.data || {}, f = regFill(r), row = [];
      for (var i = 0; i < 68; i++) { var v = d['c' + i]; if ((v === undefined || v === null || v === '') && f[i] !== undefined && f[i] !== null) v = f[i];
        if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) v = A.dt(v); row.push(v === undefined ? null : v); }
      return row;
    });
  };
  A.CLICK['ident-xlsx'] = function (t) {
    var f = A.json(t.dataset.q, {}), list = A.identFilter(f);
    if (!list.length) return A.toast('Немає записів для вивантаження', 'err');
    A.busy(true);
    return fetch(A.asset('ident_template.xlsx'), {cache: 'no-cache'}).then(function (r) { if (!r.ok) throw new Error('Шаблон не знайдено'); return r.arrayBuffer(); }).then(function (buf) {
      return window.XLSX.fillTemplate(buf, {sheet: 'Аркуш1', protoRow: 7, firstRow: 7, cols: 68, rows: A.identRows(list), formulas: FORMULA,
        extraSheets: {'Аркуш1': [['A2', 'Електронна таблиця\nданих про ідентифікацію активів станом на ' + A.dt(A.today())]]}});
    }).then(function (blob) { A.busy(false); window.XLSX.download(blob, 'БАЗОВА_Ідентифікація_' + A.today() + '.xlsx'); A.audit('Вивантажено ідентифікацію XLSX', 'ident', null, {rows: list.length}); }, function (e) { A.busy(false); throw e; });
  };
})();
