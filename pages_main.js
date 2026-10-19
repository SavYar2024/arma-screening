/* Огляд портфеля, реєстр активів, сторінки категорій. */
(function () {
  'use strict';
  var A = window.A, D = window.D, N = A.N, esc = A.esc, S = A.S;

  // ================================================================ меню
  A.NAV.push({group: 'Аналітика', items: [{href: '/', label: 'Огляд портфеля'}]});
  A.NAV.push({group: 'Категорії активів', items: D.CATEGORIES.map(function (c) { return {href: '/c/' + c[0], label: c[1], match: '/c/' + c[0], show: function () { return A.catAllowed(c[0]); }}; })});
  A.NAV.push({group: 'Робота з активами', items: [
    {href: '/assets', label: 'Реєстр активів', match: '/asset'}, {href: '/pools', label: 'Пули і складні активи', match: '/pool'},
    {href: '/plans', label: 'Плани дій (CRM)', match: '/plans'},
    {href: '/approvals', label: 'Погодження', match: '/approvals', show: function () { return A.can('crm_confirm') || A.can('crm_edit'); }, badge: function () { return A.myApprovals ? A.myApprovals().length : 0; }}, {href: '/decisions', label: 'Судові рішення', match: '/decision'},
    {href: '/valuations', label: 'Оцінки', match: '/valuation'}, {href: '/companies', label: 'Товариства (корп. права)', match: '/compan', show: function () { return A.can('view_all') || A.can('edit_corp_extra'); }},
    {href: '/ident', label: 'Ідентифікація', match: '/ident', show: function () { return A.can('ident_view') || A.can('ident_edit'); }},
    {href: '/reports', label: 'Звіти XLSX', match: '/reports', show: function () { return A.can('export'); }}]});

  // ================================================================ вхід у дзеркалі (вибір користувача)
  A.on(/^\/login$/, function () {
    if (A.mode === 'server') { location.href = A.api + '/login'; return; }
    var groups = {}; A.T('users').forEach(function (u) { var r = A.T('roles').filter(function (x) { return x.code === u.role_code; })[0]; var g = r ? r.name : u.role_code; (groups[g] = groups[g] || []).push(u); });
    var h = '<div class="login-demo"><div class="panel" style="max-width:920px;margin:40px auto"><div style="display:flex;gap:14px;align-items:center;margin-bottom:10px"><img src="' + A.asset('logo.png') + '" style="width:56px">' +
      '<div><h1 style="margin:0">Реєстр активів АРМА</h1><p class="sub">Дзеркало робочої системи для перевірки · оберіть роль</p></div></div>' +
      '<p class="mini">Це точна копія інтерфейсу робочої системи. Дані — знімок бази сервера' + (S.built ? ' станом на ' + esc(S.built) : '') + ' без персональних даних. ' +
      'Вхід без пароля: оберіть роль — і система покаже те, що бачить ця роль. Усі зміни зберігаються тільки у вашому браузері.</p><div class="grid g3">';
    Object.keys(groups).forEach(function (g) {
      h += '<div><h3 style="margin:10px 0 6px;font-size:13px;color:var(--gold)">' + esc(g) + '</h3>' + groups[g].map(function (u) {
        return '<a class="tile" href="#/" data-click="login" data-login="' + esc(u.login) + '" style="margin-bottom:6px;display:block"><b style="font-size:14px">' + esc(u.full_name) + '</b><span>' + esc(u.login) + '</span></a>';
      }).join('') + '</div>';
    });
    h += '</div><p class="mini" style="margin-top:14px"><a href="public.html">Публічний сайт (каталог активів) →</a></p></div></div>';
    document.getElementById('app').innerHTML = h;
  });
  A.CLICK.login = function (t) { A.setUser(t.dataset.login); A.audit('Вхід до системи', 'user', S.user.id); A.go('#/'); };
  A.CLICK.logout = function () { A.setUser(null); A.go('#/login'); };

  // ================================================================ фільтри активів
  A.reType = function (a) {
    var d = a.details || {}; if (d.object_type) return d.object_type;
    var n = (a.name || '').toLowerCase();
    if (/незаверш/.test(n)) return 'Незавершене будівництво';
    if (/готел|санатор|база відпоч/.test(n)) return 'Готельна';
    if (/склад|ангар|сховищ/.test(n)) return 'Складська';
    if (/гараж|паркінг|машиномісц|паркомісц/.test(n)) return 'Гараж / паркомісце';
    if (/торгов|магазин|павільйон|кіоск|тц\b/.test(n)) return 'Торговельна';
    if (/офіс|адміністрат/.test(n)) return 'Офісна';
    if (/виробнич|цех|завод|майстерн|котельн|підприєм/.test(n)) return 'Виробнича';
    if (/квартир/.test(n)) return 'Квартира';
    if (/житлов.*будин|будинок|котедж|дача/.test(n)) return 'Житловий будинок';
    if (/майнов.*комплекс|цілісн/.test(n)) return 'Майновий комплекс';
    if (/нежитлов|приміщен/.test(n)) return 'Нежитлові приміщення';
    return (a.vid || '').indexOf('Житлов') === 0 ? 'Інша житлова' : 'Інша нежитлова';
  };
  A.areaGroup = function (a) { var h = Number((a.details || {}).area_ha); if (!h) return 'Площа не вказана'; if (h < 1) return 'до 1 га'; if (h < 5) return '1–5 га'; if (h < 20) return '5–20 га'; if (h < 100) return '20–100 га'; return 'понад 100 га'; };
  A.shareGroup = function (a) { if ((a.details || {}).corp_dup) return 'Дубль (не враховується)'; var p = Number((a.details || {}).share_pct); if (!p) return 'Не визначено'; if (p >= 100) return '100%'; if (p >= 50) return '50–99,9%'; if (p >= 25) return '25–49,9%'; if (p >= 10) return '10–24,9%'; return 'до 10%'; };
  var KEYS = ['q', 'category', 'mtu', 'dept', 'legal', 'invest', 'reason', 'way', 'complexity', 'region', 'zone', 'status', 'photo', 'val', 'plan', 'pool', 'review', 'discrepancy', 'unassigned', 'public', 'publish', 'company', 'kind', 'retype', 'vid', 'tech', 'purpose', 'area', 'share', 'cstatus', 'kved', 'basket', 'sort', 'legalbasis'];
  function planIndex() {
    var act = {}, over = {}, t = A.today();
    A.T('plans').forEach(function (p) { if (p.status !== 'active') return; var k = p.target_type + ':' + p.target_id; act[k] = 1;
      (A.indexes.stepsByPlan[p.id] || []).forEach(function (s) { if ((s.status === 'active' || s.status === 'review') && s.due_date && s.due_date < t) over[k] = 1; }); });
    return {act: act, over: over};
  }
  A.filterAssets = function (f, base) {
    var list = (base || A.T('assets')).filter(A.inScope), words = (f.q || '').toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6), tests = [];
    function eq(field, v) { return v === '__none__' ? function (a) { return !a[field]; } : function (a) { return String(a[field]) === v; }; }
    if (words.length) tests.push(function (a) { var s = a._s || (a._s = [a.asset_no, a.name, a.cadastral, a.company_code, a.region, a.settl_name, a.owner_name, a.vid, a.prozorro_id].join(' ').toLowerCase()); return words.every(function (w) { return s.indexOf(w) >= 0; }); });
    [['category', 'category'], ['mtu', 'mtu_code'], ['dept', 'dept_code'], ['legal', 'legal_status'], ['invest', 'invest_grade'], ['reason', 'impossible_reason'], ['way', 'transfer_way'],
     ['complexity', 'complexity'], ['region', 'region'], ['zone', 'zone'], ['company', 'company_code'], ['kind', 'report_kind'], ['status', 'proposal'], ['vid', 'vid'], ['legalbasis', 'legal_basis']].forEach(function (p) { if (f[p[0]]) tests.push(eq(p[1], f[p[0]])); });
    if (f.tech) tests.push(function (a) { return (a.tech_state || a.phys_src || '__none__') === f.tech || (f.tech === '__none__' && !(a.tech_state || a.phys_src)); });
    if (f.retype) tests.push(function (a) { return A.reType(a) === f.retype; });
    if (f.purpose) tests.push(function (a) { return ((a.details || {}).purpose || '__none__') === f.purpose; });
    if (f.area) tests.push(function (a) { return A.areaGroup(a) === f.area; });
    if (f.share) tests.push(function (a) { return A.shareGroup(a) === f.share; });
    if (f.cstatus) tests.push(function (a) { return ((A.indexes.comp[a.company_code] || {}).status || 'Не визначено') === f.cstatus; });
    if (f.kved) tests.push(function (a) { return ((A.indexes.comp[a.company_code] || {}).kved || '').slice(0, 2) === f.kved; });
    if (f.photo === 'yes') tests.push(function (a) { return a.photo_count > 0; }); if (f.photo === 'no') tests.push(function (a) { return !a.photo_count; });
    if (f.val === 'yes') tests.push(function (a) { return a.val_amount || a.val_source === 'Групова оцінка'; });
    if (f.val === 'no') tests.push(function (a) { return !a.val_amount && a.val_source !== 'Групова оцінка'; });
    if (f.val === 'group') tests.push(function (a) { return a.val_source === 'Групова оцінка'; });
    if (f.pool === 'any') tests.push(function (a) { return a.pool_id; }); else if (f.pool === 'none') tests.push(function (a) { return !a.pool_id; }); else if (f.pool) tests.push(function (a) { return String(a.pool_id) === f.pool; });
    if (f.review) tests.push(function (a) { return a.needs_review; }); if (f.discrepancy) tests.push(function (a) { return a.legal_note; });
    if (f.unassigned) tests.push(function (a) { return !a.mtu_code && !a.dept_code; });
    if (f.public) tests.push(function (a) { return a.public_candidate; }); if (f.publish) tests.push(function (a) { return a.publish; });
    if (f.basket) { var b = {}; A.basket.get().forEach(function (i) { b[i] = 1; }); tests.push(function (a) { return b[a.id]; }); }
    if (f.plan) { var pi = planIndex(); tests.push(function (a) { var k1 = 'asset:' + a.id, k2 = 'pool:' + a.pool_id; return f.plan === 'active' ? (pi.act[k1] || pi.act[k2]) : f.plan === 'none' ? !(pi.act[k1] || pi.act[k2]) : (pi.over[k1] || pi.over[k2]); }); }
    list = list.filter(function (a) { for (var i = 0; i < tests.length; i++) if (!tests[i](a)) return false; return true; });
    var s = f.sort;
    if (s === 'value') list.sort(function (a, b) { return (b.val_amount || 0) - (a.val_amount || 0); });
    else if (s === 'name') list.sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); });
    else if (s === 'decision') list.sort(function (a, b) { return (b.last_decision_date || '').localeCompare(a.last_decision_date || ''); });
    else if (s === 'updated') list.sort(function (a, b) { return (b.updated_at || '').localeCompare(a.updated_at || ''); });
    return list;
  };
  A.filtersForm = function (f, base, fixedCat) {
    var sel = A.sel, more = KEYS.slice(6).some(function (k) { return f[k] && k !== 'sort'; });
    return '<form class="filters" data-act="filter" data-base="' + base + '"><input name="q" value="' + esc(f.q || '') + '" placeholder="Номер у Реєстрі, назва, ЄДРПОУ, кадастровий номер, область, Prozorro" style="min-width:300px;flex:1">' +
      (fixedCat ? '' : sel('category', A.OPT.CAT.filter(function (c) { return A.catAllowed(c[0]); }), f.category, 'Усі категорії')) +
      sel('mtu', A.OPT.MTU.concat([['__none__', 'Не закріплено за МТУ']]), f.mtu, 'Усі МТУ') + sel('dept', D.DMA.concat([['__none__', 'Не закріплено за відділом']]), f.dept, 'Усі відділи ДМА') +
      sel('zone', D.ZONES, f.zone, 'Усі зони') + sel('legal', A.OPT.LEGAL, f.legal, 'Правовий стан') + sel('invest', D.INVEST_GRADES, f.invest, 'Привабливість') +
      '<button class="btn">Знайти</button><button type="button" class="btn plain" data-click="reset" data-base="' + base + '">Скинути все</button>' +
      '<details style="width:100%"' + (more ? ' open' : '') + '><summary class="mini" style="cursor:pointer;margin:4px 0 8px">Додаткові фільтри</summary><div class="filters" style="margin:0">' +
      sel('status', A.OPT.STATUS, f.status, 'Стан активу (кол. 42)') + sel('reason', D.IMPOSSIBLE_REASONS, f.reason, 'Причина неможливості управління') + sel('way', D.TRANSFER_WAYS, f.way, 'Спосіб передачі') +
      sel('complexity', D.COMPLEXITY, f.complexity, 'Простий / складний / пул') + sel('region', D.REGIONS, f.region, 'Усі області') +
      sel('photo', [['yes', 'Є фото'], ['no', 'Немає фото']], f.photo, 'Фото') + sel('val', [['yes', 'Є оцінка'], ['no', 'Немає оцінки'], ['group', 'Групова оцінка']], f.val, 'Оцінка') +
      sel('plan', [['active', 'План діє'], ['overdue', 'Прострочений крок'], ['none', 'Без плану']], f.plan, 'План дій') + sel('pool', [['any', 'У пулі'], ['none', 'Не в пулі']], f.pool, 'Пул') +
      sel('discrepancy', [['1', 'Є розбіжність у правовому стані']], f.discrepancy, 'Розбіжності') + sel('legalbasis', [['manual', 'Встановлено вручну'], ['decisions', 'За рішеннями'], ['inventory', 'За інвентаризацією']], f.legalbasis, 'Джерело правового стану') +
      sel('unassigned', [['1', 'Не закріплено ні за МТУ, ні за відділом']], f.unassigned, 'Закріплення') + sel('public', [['1', 'Публічний за критерієм']], f.public, 'Критерій критичності') + sel('publish', [['1', 'Опубліковано']], f.publish, 'Публікація') +
      sel('sort', [['no', 'за номером'], ['name', 'за назвою'], ['value', 'за оцінкою'], ['decision', 'за датою рішення'], ['updated', 'нещодавно змінені']], f.sort, 'Сортування') +
      ['retype', 'vid', 'tech', 'purpose', 'area', 'share', 'cstatus', 'kved', 'basket', 'kind', 'company', 'm'].map(function (k) { return f[k] ? '<input type="hidden" name="' + k + '" value="' + esc(f[k]) + '">' : ''; }).join('') +
      '</div></details></form>';
  };
  A.assetTable = function (rows, opts) {
    opts = opts || {};
    var h = '<form data-act="bulk" data-back="' + esc(location.hash) + '"><div class="wrap-tbl"><table><thead><tr><th style="width:26px"><input type="checkbox" data-select-all style="width:auto" title="Обрати всі на сторінці"></th><th>№ у Реєстрі</th><th>Найменування</th><th>Підрозділ</th><th>Правовий стан</th><th>Привабливість</th><th class="num">Оцінка</th><th class="num">Фото</th><th>Пул</th></tr></thead><tbody>';
    rows.forEach(function (r) {
      var p = r.pool_id && A.get('pools', r.pool_id);
      h += '<tr><td><input type="checkbox" value="' + r.id + '" data-row style="width:auto"></td><td class="nowrap"><a class="id" href="#/asset/' + r.id + '">' + esc(r.asset_no) + '</a><span class="sub">' + A.zone(r.zone, true) + '</span></td>' +
        '<td style="max-width:420px"><span class="clip" title="' + esc(r.name) + '">' + esc(r.name) + '</span><span class="sub">' + esc(N.CAT[r.category] || '') + (r.region ? ' · ' + esc(r.region) : '') + '</span></td>' +
        '<td class="mini">' + (r.mtu_code ? esc(N.MTU[r.mtu_code]) + '<br>' : '') + (r.dept_code ? esc(N.DMA_SHORT[r.dept_code]) : '') + (!r.mtu_code && !r.dept_code ? '<span class="tag t-lim">не закріплено</span>' : '') + '</td>' +
        '<td>' + A.legal(r.legal_status) + (r.legal_note ? '<span class="sub" style="color:var(--lim)" title="' + esc(r.legal_note) + '">розбіжність джерел</span>' : '') + (r.impossible_reason ? '<span class="sub">' + esc(N.REASON[r.impossible_reason]) + '</span>' : '') + '</td>' +
        '<td>' + A.invest(r.invest_grade) + (r.transfer_way && r.transfer_way !== 'none' ? '<span class="sub">' + esc(N.WAY[r.transfer_way]) + '</span>' : '') + '</td>' +
        '<td class="num nowrap">' + (r.val_amount ? A.money(r.val_amount) : r.val_source === 'Групова оцінка' ? '<span class="mini">групова</span>' : '—') + (r.val_date ? '<span class="sub">' + A.dt(r.val_date) + '</span>' : '') + '</td>' +
        '<td class="num">' + (r.photo_count || '—') + '</td><td class="mini">' + (p ? '<a href="#/pool/' + p.id + '">' + esc(p.code) + '</a>' : '—') + '</td></tr>';
    });
    if (!rows.length) h += '<tr><td colspan="9"><div class="empty">За умовами пошуку активів не знайдено. Натисніть «Скинути все».</div></td></tr>';
    h += '</tbody></table></div>';
    var mg = A.T('users').filter(function (u) { return u.dept_code; }), canMain = A.can('edit_assets') || A.can('edit_any_asset');
    h += '<div class="sel-bar"><span class="mini">Обрано (з усіх пошуків): <b data-sel-count>0</b></span><a class="btn sm plain" href="' + A.link('/assets', {basket: 1}) + '">Показати обрані</a><button type="button" class="btn sm plain" data-click="basket-clear">Очистити вибір</button>' +
      '<select name="action" style="min-width:220px"><option value="">— масова дія —</option>' +
      (canMain ? '<option value="dept">Закріпити за відділом ДМА</option><option value="mtu">Закріпити за МТУ</option><option value="manager">Призначити менеджера ДМА</option><option value="invest">Встановити привабливість</option><option value="status">Змінити стан активу (зона — автоматично)</option>' : '') +
      (A.can('manage_pools') ? '<option value="complex_new">Створити складний актив (ЦМК) з обраних</option><option value="pool_new">Створити пул з обраних</option><option value="pool_add">Додати до пулу</option><option value="pool_remove">Вилучити з пулу</option>' : '') +
      (A.can('manage_public') ? '<option value="publish">Опублікувати на сайті</option><option value="unpublish">Зняти з публікації</option>' : '') +
      (A.can('delete_records') ? '<option value="delete">Видалити обрані активи</option>' : '') +
      '</select><select name="value" style="min-width:220px"><option value="">— значення —</option><optgroup label="Відділ ДМА">' + A.opts(D.DMA, null, null) + '</optgroup><optgroup label="МТУ">' + A.opts(A.OPT.MTU, null, null) +
      '</optgroup><optgroup label="Менеджер ДМА">' + A.opts(mg.map(function (u) { return ['u' + u.id, u.full_name + ' — ' + (N.DMA_SHORT[u.dept_code] || '')]; }), null, null) +
      '</optgroup><optgroup label="Привабливість">' + A.opts(D.INVEST_GRADES, null, null) + '</optgroup><optgroup label="Стан активу">' + A.opts(A.OPT.STATUS.map(function (s) { return ['s:' + s, s]; }), null, null) +
      '</optgroup><optgroup label="Пул">' + A.opts(A.T('pools').map(function (p) { return ['p' + p.id, p.code + ' — ' + (p.name || '').slice(0, 50)]; }), null, null) +
      '</optgroup></select><button class="btn gold" data-need-sel>Застосувати</button></div></form>';
    return h;
  };
  A.CLICK['basket-clear'] = function () { A.basket.set([]); A.route(true); };
  A.ACT.filter = function (f, d) { var o = {}; for (var k in d) if (d[k]) o[k] = d[k]; A.go(A.link(f.dataset.base, o)); };
  A.ACT.search = function (f, d) { A.go(A.link('/assets', {q: d.q})); };
  A.ACT.bulk = function (f, d) {
    var ids = A.basket.get(), act = d.action, v = d.value || '', as = ids.map(function (i) { return A.get('assets', i); }).filter(Boolean);
    if (!ids.length || !act) { A.toast('Оберіть активи і дію.', 'err'); return; }
    if (act === 'pool_new' || act === 'complex_new') { if (!A.can('manage_pools')) return A.deny(); return A.go(A.link('/pool/new', {ids: ids.join(','), kind: act === 'complex_new' ? 'complex' : null})); }
    if (act === 'delete') { if (!confirm('Видалити ' + ids.length + ' активів разом з їхніми зв’язками? Дію не можна скасувати.')) return; var tx0 = A.tx(); ids.forEach(function (i) { tx0.del('assets', i); }); tx0.log('Видалено активи', 'asset', null, {count: ids.length});
      return tx0.commit().then(function () { A.basket.set([]); A.toast('Видалено активів: ' + ids.length); A.route(); }); }
    var tx = A.tx(), n = 0, need = {dept: 1, mtu: 1, manager: 1, invest: 1, status: 1};
    as.forEach(function (a) {
      var p = null;
      if (need[act] && !A.canEdit(a, 'main')) return;
      if (act === 'dept' && N.DMA[v]) p = {dept_code: v}; else if (act === 'mtu' && N.MTU[v]) p = {mtu_code: v};
      else if (act === 'invest' && N.INV[v]) p = {invest_grade: v};
      else if (act === 'manager' && v[0] === 'u') { var u = A.get('users', +v.slice(1)); if (u) p = {dma_manager_id: u.id, dma_manager: u.full_name}; }
      else if (act === 'status' && v.indexOf('s:') === 0) { var st = v.slice(2); p = {proposal: st, zone: A.zoneForStatus(st) || a.zone, zone_manual: 0}; }
      else if (act === 'pool_add' && v[0] === 'p' && A.get('pools', +v.slice(1))) p = {pool_id: +v.slice(1)};
      else if (act === 'pool_remove') p = {pool_id: null};
      else if (act === 'publish' && a.public_candidate && A.FIN.indexOf(a.category) < 0) p = {publish: 1};
      else if (act === 'unpublish') p = {publish: 0};
      if (p) { tx.put('assets', Object.assign({id: a.id}, p), a.updated_at); n++; }
    });
    if (!n) { A.toast('Немає активів, до яких можна застосувати дію (перевірте права, значення і критерії).', 'err'); return; }
    tx.log('Масова дія: ' + act, 'asset', null, {count: n});
    return tx.commit().then(function () { A.toast('Оновлено активів: ' + n + ' з ' + ids.length + '.'); A.route(true); });
  };

  // ================================================================ огляд портфеля
  A.on(/^\/$/, function () {
    var All = A.T('assets').filter(A.inScope), att = All.filter(function (a) { return a.invest_grade === 'attractive'; }), t = A.today(), L = function (o) { return A.link('/assets', o); };
    function c(fn) { return All.filter(fn).length; }
    var cur = A.T('valuations').filter(function (v) { return v.is_current && v.value_uah && !/^Інвентаризація/.test(v.source || ''); });
    var valTotal = cur.reduce(function (s, v) { return s + v.value_uah; }, 0);
    var act = A.T('plans').filter(function (p) { return p.status === 'active'; }), steps = [];
    act.forEach(function (p) { (A.indexes.stepsByPlan[p.id] || []).forEach(function (s) { if (s.status === 'active' || s.status === 'review') steps.push([p, s]); }); });
    var overdue = steps.filter(function (x) { return x[1].due_date && x[1].due_date < t; }).length, review = steps.filter(function (x) { return x[1].status === 'review'; }).length;
    var h = '<div class="grid g5">' + A.kpi('Активів в обліку', A.num(All.length), 'за Реєстром (інвентаризація)', '#/assets') +
      A.kpi('Інвестиційно привабливі', A.num(att.length), 'основний фокус роботи ДМА', L({invest: 'attractive'})) +
      A.kpi('Передано за договором', A.num(c(function (a) { return a.transfer_way === 'manager_contract'; })), 'управителя визначено', L({way: 'manager_contract'})) +
      A.kpi('Пошук управителя', A.num(c(function (a) { return a.transfer_way === 'manager_search'; })), 'конкурсний відбір', L({way: 'manager_search'})) +
      A.kpi('Реалізація', A.num(c(function (a) { return a.transfer_way === 'realization'; })), 'електронні торги', L({way: 'realization'})) + '</div><div class="grid g5" style="margin-top:14px">' +
      A.kpi('Оцінена вартість', A.num(valTotal, 2) + ' ₴', 'актуальні оцінки (' + cur.length + ')', '#/valuations') + A.kpi('Пулів активів', A.num(A.T('pools').length) + '<small> · ' + A.num(All.filter(function (a) { return a.pool_id; }).length) + ' активів</small>', 'активів у складі пулів; оцінка і план — на рівні пулу', '#/pools') +
      A.kpi('Активних планів дій', A.num(act.length), review + ' кроків очікують підтвердження', '#/plans') + A.kpi('Прострочені кроки', A.num(overdue), 'строк кроку минув', A.link('/plans', {state: 'overdue'}), 'overdue') +
      A.kpi('Розбіжності правового стану', A.num(c(function (a) { return a.legal_note && a.legal_basis !== 'manual'; })), 'потребують перевірки', L({discrepancy: 1})) + '</div>';
    var k = A.series(A.grp(att, 'report_kind'), N.KIND, function (v) { return L({invest: 'attractive', kind: v}); }),
      cx = A.series(A.grp(att, 'complexity'), N.CX, function (v) { return L({invest: 'attractive', complexity: v}); }),
      w = A.series(A.grp(att, 'transfer_way'), N.WAY, function (v) { return L({invest: 'attractive', way: v}); }),
      dp = A.series(A.grp(att, 'dept_code'), N.DMA_SHORT, function (v) { return L({invest: 'attractive', dept: v}); });
    h += '<h2>Інвестиційно привабливі активи</h2><div class="grid g4"><div class="panel"><h3>Рухоме / нерухоме майно</h3>' + A.chart('barh', k, 'gold') + '</div>' +
      '<div class="panel"><h3>Прості, складні, пули</h3>' + A.chart('donut', cx, null, ['#35D6E8', '#8B7BF7', '#F5C518', '#6E7F9E']) + '</div>' +
      '<div class="panel"><h3>Спосіб передачі</h3>' + A.chart('barh', w, 'ok') + '</div><div class="panel"><h3>За відділами ДМА</h3>' + A.chart('barh', dp, 'blue') + '</div></div>';
    // етапи робіт: кожен бізнес-процес — окремий блок
    h += '<h2>Етапи робіт за планами дій</h2><div class="proc-grid">' + D.PROCESSES.map(function (pr) {
      var ps = act.filter(function (p) { return p.process === pr[0]; }), cnt = {}, ov = {};
      ps.forEach(function (p) { (A.indexes.stepsByPlan[p.id] || []).forEach(function (s) { if (s.status === 'active' || s.status === 'review') { cnt[s.ord] = (cnt[s.ord] || 0) + 1; if (s.due_date && s.due_date < t) ov[s.ord] = (ov[s.ord] || 0) + 1; } }); });
      var groups = {}; pr[3].forEach(function (s) { groups[s[4]] = (groups[s[4]] || 0) + 1; });
      return '<div class="proc"><h4>' + esc(pr[1]) + '</h4><div class="pm">Діючих планів: <b>' + ps.length + '</b>' + (Object.keys(ov).length ? ' · <span class="overdue">прострочено кроків: ' + Object.keys(ov).reduce(function (s, k2) { return s + ov[k2]; }, 0) + '</span>' : '') + '</div><ol>' +
        pr[3].map(function (s, i) { var o = i + 1, par = groups[s[4]] > 1;
          return '<li class="' + (cnt[o] ? 'on' : '') + (par ? ' par' : '') + '" title="' + esc(s[0] + ' · ' + s[1] + ' · норматив ' + s[2] + ' р. дн.' + (par ? ' · виконується паралельно' : '')) + '"><span class="no">' + o + '</span><span class="nm">' + esc(s[0]) + '</span>' +
            (cnt[o] ? '<a class="cnt ' + (ov[o] ? 'over' : '') + '" href="' + A.link('/plans', {process: pr[0], step: o}) + '">' + cnt[o] + '</a>' : '<span class="mini">—</span>') + '</li>'; }).join('') + '</ol></div>';
    }).join('') + '</div><p class="mini">Пунктирна рамка — кроки, що виконуються паралельно (наприклад, оцінка і розроблення орієнтовного плану управління відповідальним відділом ДМА). Число — кількість планів на кроці; червоне — є прострочення.</p>';
    var rs = {}; All.forEach(function (a) { if (a.impossible_reason) rs[a.impossible_reason] = (rs[a.impossible_reason] || 0) + 1; });
    h += '<h2>Чому управління неможливе</h2><div class="tiles">' + D.IMPOSSIBLE_REASONS.map(function (r) { return '<a class="tile ' + (rs[r[0]] ? 'warn' : '') + '" href="' + L({reason: r[0]}) + '" title="' + esc(r[1]) + '"><b>' + A.num(rs[r[0]] || 0) + '</b><span>' + esc(r[1]) + '</span></a>'; }).join('') + '</div>';
    var leg = {}; All.forEach(function (a) { leg[a.legal_status] = (leg[a.legal_status] || 0) + 1; }); var tot = All.length || 1;
    h += '<h2>Правовий стан (обсяг повноважень АРМА)</h2><div class="panel"><div class="bar">' + D.LEGAL.map(function (l) { var v = leg[l[0]] || 0; return v ? '<a class="s-' + l[2] + '" style="width:' + (v * 100 / tot).toFixed(1) + '%;display:flex;align-items:center;justify-content:center;color:#0A0F1C;font-size:11px;font-weight:700" title="' + esc(l[1]) + ': ' + v + '" href="' + L({legal: l[0]}) + '">' + (v * 100 / tot > 5 ? (v * 100 / tot).toFixed(1) + '%' : '') + '</a>' : ''; }).join('') +
      '</div><div class="legend">' + D.LEGAL.map(function (l) { return '<div class="l-' + l[2] + '"><b><a href="' + L({legal: l[0]}) + '" style="color:inherit">' + A.num(leg[l[0]] || 0) + '</a></b>' + esc(l[1]) + '</div>'; }).join('') + '</div>' +
      '<p class="mini" style="margin:10px 0 0">Стан визначається за останнім за хронологією судовим рішенням і даними інвентаризації; якщо джерела розходяться — встановлюється більш обмежувальний стан і показується розбіжність. Менеджер може скоригувати стан вручну в картці активу.</p></div>';
    var zn = A.series(A.grp(All, 'zone'), null, function (v) { return L({zone: v}); }),
      ct = A.series(A.grp(All, 'category'), N.CAT, function (v) { return '#/c/' + v; }), mt = A.series(A.grp(All, 'mtu_code'), Object.assign({}, N.MTU), function (v) { return L({mtu: v}); }),
      de = A.series(A.grp(All, 'dept_code'), N.DMA_SHORT, function (v) { return L({dept: v}); });
    mt[0] = mt[0].map(function (x) { return x === 'Не визначено' ? 'Не закріплено за МТУ' : x; }); de[0] = de[0].map(function (x) { return x === 'Не визначено' ? 'Не закріплено за відділом' : x; });
    h += '<h2>Структура портфеля</h2><div class="grid g4"><div class="panel"><h3>Зони</h3>' + A.chart('donut', zn, null, zn[0].map(function (z) { return {'Червона зона': '#F0524E', 'Жовта зона': '#F5C518', 'Синя зона': '#4C8DF6', 'Сіра зона': '#8A94A6'}[z] || '#6E7F9E'; })) + '</div>' +
      '<div class="panel"><h3>Категорії</h3>' + A.chart('barh', ct, 'cyan') + '</div><div class="panel"><h3>За МТУ</h3>' + A.chart('barh', mt, 'gold') + '</div><div class="panel"><h3>За відділами ДМА</h3>' + A.chart('barh', de, 'violet') + '</div></div>';
    A.render(A.shell('Огляд портфеля', 'Інвестиційно привабливі активи та проходження етапів робіт', '<form data-act="search" style="display:flex;gap:6px"><input name="q" placeholder="Номер, назва, кадастровий номер" style="min-width:240px"><button class="btn">Знайти</button></form>', h), A.keep);
  });

  // ================================================================ реєстр
  A.on(/^\/assets$/, function (f) {
    var list = A.filterAssets(f), pg = A.pageOf(list, f), p = Object.assign({}, f); delete p.page;
    var act = (A.can('create_assets') || A.can('edit_any_asset') ? '<a class="btn gold" href="#/asset/new">+ Новий актив</a>' : '') + (A.can('export') ? '<a class="btn" href="#" data-click="xlsx-assets" data-q="' + esc(JSON.stringify(p)) + '">XLSX за фільтром</a>' : '');
    var b = A.basket.get().length;
    A.render(A.shell(f.basket ? 'Обрані активи' : 'Реєстр активів', 'Пошук, фільтри, масові дії. Позначені активи зберігаються між пошуками', act,
      (b ? '<div class="sel-basket">Обрано активів: <b>' + b + '</b> — позначки зберігаються, поки ви шукаєте інші активи. <a href="' + A.link('/assets', {basket: 1}) + '">Показати обрані</a> · <a href="#" data-click="basket-clear">очистити</a></div>' : '') +
      A.filtersForm(f, '/assets') + A.pager(list.length, pg.page, '/assets', p) + A.assetTable(pg.rows) + A.pager(list.length, pg.page, '/assets', p)), A.keep);
  });

  // ================================================================ категорії
  var ZCOL = {'Червона зона': '#F0524E', 'Жовта зона': '#F5C518', 'Синя зона': '#4C8DF6', 'Сіра зона': '#8A94A6'};
  A.areaOf = function (a) { var d = a.details || {}; var v = a.category === 'land' ? (d.area_ha || d.area_calc_ha) : d.area_sqm; v = A.parseNum(v); return v && v > 0 && v < 1e8 ? v : 0; };
  A.on(/^\/c\/(\w+)$/, function (code, f) {
    if (!N.CAT[code]) return A.notFound();
    if (!A.catAllowed(code)) return A.deny();
    var all = A.T('assets').filter(function (a) { return a.category === code && A.inScope(a); });
    var ff = Object.assign({}, f, {category: code}), list = A.filterAssets(ff, all), pg = A.pageOf(list, f), p = Object.assign({}, f); delete p.page;
    var foc = f.invest === 'attractive', base = foc ? all.filter(function (a) { return a.invest_grade === 'attractive'; }) : all;   // «Інвестиційно привабливі» — уся аналітика перераховується
    var areaCat = code === 'realestate' || code === 'land', byArea = areaCat && f.m === 'area', U = code === 'land' ? 'га' : 'м²';
    var keep = {}; if (foc) keep.invest = 'attractive'; if (byArea) keep.m = 'area';
    var C = function (o) { return A.link('/c/' + code, Object.assign({}, keep, o)); }, fin = A.FIN.indexOf(code) >= 0, h = '';
    var G = function (lst, key) { return byArea ? A.sum(lst, key, A.areaOf).map(function (x) { return [x[0], Math.round(x[1] * 100) / 100]; }).filter(function (x) { return x[1] > 0; }) : A.grp(lst, key); };
    if (code === 'money') h += A.moneyPage(all);
    else if (code === 'crypto') h += A.cryptoPage(all);
    else {
      var nAtt = all.filter(function (a) { return a.invest_grade === 'attractive'; }).length, totArea = base.reduce(function (s, a) { return s + A.areaOf(a); }, 0);
      h += '<div class="grid g5">' + A.kpi('Активів', A.num(base.length), foc ? 'інвестиційно привабливі' : N.CAT[code], A.link('/c/' + code, byArea ? {m: 'area'} : {})) +
        A.kpi('Інвестиційно привабливі', A.num(nAtt), foc ? 'показано лише привабливі · натисніть, щоб скинути' : 'натисніть — аналітика лише за ними', foc ? A.link('/c/' + code, byArea ? {m: 'area'} : {}) : C({invest: 'attractive'}), 'att' + (foc ? ' on' : '')) +
        (areaCat ? A.kpi(code === 'land' ? 'Площа земельних ділянок' : 'Площа нерухомості', A.num(totArea, code === 'land' ? 2 : 0) + ' ' + U, 'за даними карток (' + base.filter(function (a) { return A.areaOf(a); }).length + ' з площею)') : A.kpi('Повний обсяг повноважень', A.num(base.filter(function (a) { return a.legal_status === 'full'; }).length), 'правовий стан', C({legal: 'full'}))) +
        A.kpi('Оцінена вартість', A.money(base.reduce(function (s, a) { return s + (a.val_amount || 0); }, 0)), 'актуальні оцінки активів') +
        A.kpi('Не закріплено', A.num(base.filter(function (a) { return !a.mtu_code && !a.dept_code; }).length), 'ні за МТУ, ні за відділом', C({unassigned: 1}), 'overdue') + '</div>';
      if (foc) h += '<div class="flash info" style="margin-top:12px">Уся аналітика і перелік нижче — лише за інвестиційно привабливими активами (' + A.num(base.length) + '). <a href="' + A.link('/c/' + code, byArea ? {m: 'area'} : {}) + '">Показати всі</a></div>';
      if (areaCat) h += '<div class="chips-filter" style="margin-top:12px"><span class="mini" style="align-self:center">Аналітика за:</span><a href="' + A.link('/c/' + code, Object.assign({}, foc ? {invest: 'attractive'} : {})) + '" class="' + (byArea ? '' : 'on') + '">кількістю активів</a><a href="' + A.link('/c/' + code, Object.assign({m: 'area'}, foc ? {invest: 'attractive'} : {})) + '" class="' + (byArea ? 'on' : '') + '">площею, ' + U + '</a></div>';
      var unit = byArea ? ' <span>' + U + '</span>' : '';
      var sp = [];
      if (code === 'realestate') sp.push(['За типами нерухомості', A.series(G(base, A.reType), null, function (v) { return C({retype: v}); }), 'gold', 'barh']);
      if (code === 'land') { sp.push(['За цільовим призначенням', A.series(G(base, function (a) { return (a.details || {}).purpose; }), null, function (v) { return C({purpose: v}); }, 12), 'ok', 'barh']);
        var order = ['до 1 га', '1–5 га', '5–20 га', '20–100 га', 'понад 100 га', 'Площа не вказана'], ag = G(base, A.areaGroup).sort(function (a, b) { return order.indexOf(a[0]) - order.indexOf(b[0]); });
        sp.push(['Площа за групами', A.series(ag, null, function (v) { return C({area: v}); }), 'cyan', 'barv']); }
      if (code === 'transport') { sp.push(['За видами транспорту', A.series(A.grp(base, 'vid'), null, function (v) { return C({vid: v}); }), 'cyan', 'barh']);
        sp.push(['Технічний стан', A.series(A.grp(base, function (a) { return a.tech_state || a.phys_src; }), null, function (v) { return C({tech: v}); }), 'lim', 'barh']); }
      if (code === 'property') sp.push(['За видами майна', A.series(A.grp(base, 'vid'), null, function (v) { return C({vid: v}); }, 14), 'violet', 'barh']);
      if (code === 'corporate') {
        var cb = base.filter(function (a) { return !(a.details || {}).corp_dup; });
        var so = ['100%', '50–99,9%', '25–49,9%', '10–24,9%', 'до 10%', 'Не визначено'];
        sp.push(['За розміром частки', A.series(A.grp(cb, A.shareGroup).sort(function (a, b) { return so.indexOf(a[0]) - so.indexOf(b[0]); }), null, function (v) { return C({share: v}); }), 'gold', 'barv']);
        var cs = A.grp(cb, function (a) { return (A.indexes.comp[a.company_code] || {}).status || 'Не визначено'; });
        sp.push(['Стан юридичних осіб', A.series(cs, null, function (v) { return C({cstatus: v}); }), null, 'donut', cs.map(function (x) { return {'Зареєстровано (діюча)': '#3DD68C', 'В стані припинення': '#F5A524', 'Порушено справу про банкрутство': '#F0524E', 'Припинено': '#8B7BF7'}[x[0]] || '#6E7F9E'; })]);
        var divs = A.json(S.settings.kved_divisions), kv = A.grp(cb.filter(function (a) { return a.company_code; }), function (a) { return ((A.indexes.comp[a.company_code] || {}).kved || '').slice(0, 2); });
        sp.push(['За галузями (КВЕД)', [kv.slice(0, 12).map(function (x) { return x[0] ? x[0] + ' ' + (divs[x[0]] || '') : 'КВЕД не визначено'; }), kv.slice(0, 12).map(function (x) { return x[1]; }), kv.slice(0, 12).map(function (x) { return C({kved: x[0] || '__none__'}); })], 'blue', 'barh']);
      }
      var lg = A.series(G(base, 'legal_status'), N.LS, function (v) { return C({legal: v}); }), zn = A.series(G(base, 'zone'), null, function (v) { return C({zone: v}); });
      var iv = A.series(G(base, 'invest_grade'), N.INV, function (v) { return C({invest: v}); }), wy = A.series(G(base, 'transfer_way'), N.WAY, function (v) { return C({way: v}); });
      var dp = A.series(G(base, 'dept_code'), N.DMA_SHORT, function (v) { return C({dept: v}); }), mt = A.series(G(base, 'mtu_code'), N.MTU, function (v) { return C({mtu: v}); });
      var rg = A.series(G(base.filter(function (a) { return a.region; }), 'region'), null, function (v) { return C({region: v}); }, 12);
      h += '<h2>Аналітика' + (foc ? ' · інвестиційно привабливі' : '') + (byArea ? ' · за площею, ' + U : '') + '</h2><div class="grid g3">' + sp.map(function (x) { return '<div class="panel"><h3>' + esc(x[0]) + (x[0] === 'За розміром частки' || x[0] === 'Стан юридичних осіб' || x[0] === 'За галузями (КВЕД)' || code === 'transport' || code === 'property' ? '' : unit) + '</h3>' + A.chart(x[3], x[1], x[2], x[4]) + '</div>'; }).join('') +
        '<div class="panel"><h3>Зони' + unit + '</h3>' + A.chart('donut', zn, null, zn[0].map(function (z) { return ZCOL[z] || '#6E7F9E'; })) + '</div>' +
        '<div class="panel"><h3>Правовий стан' + unit + '</h3>' + A.chart('barh', lg, 'ok') + '</div>' + (foc ? '' : '<div class="panel"><h3>Інвестиційна привабливість' + unit + '</h3>' + A.chart('donut', iv, null, ['#F5C518', '#3DD68C', '#F5A524', '#6E7F9E', '#5B7DB1']) + '</div>') +
        '<div class="panel"><h3>Спосіб передачі' + unit + '</h3>' + A.chart('barh', wy, 'cyan') + '</div><div class="panel"><h3>Відділи ДМА' + unit + '</h3>' + A.chart('barh', dp, 'violet') + '</div>' +
        '<div class="panel"><h3>МТУ' + unit + '</h3>' + A.chart('barh', mt, 'gold') + '</div><div class="panel"><h3>Області <span>топ-12' + (byArea ? ', ' + U : '') + '</span></h3>' + A.chart('barh', rg, 'blue') + '</div></div>';
      if (code === 'land') h += A.landMapBlock(base);
      if (code === 'corporate') h += '<p style="margin-top:10px"><a class="btn" href="#/companies">Пул товариств і картки компаній →</a></p>';
    }
    h += '<h2>Перелік активів' + (foc ? ' · інвестиційно привабливі' : '') + '</h2>' + A.filtersForm(f, '/c/' + code, true) + A.pager(list.length, pg.page, '/c/' + code, p) + A.assetTable(pg.rows) + A.pager(list.length, pg.page, '/c/' + code, p);
    A.render(A.shell(N.CAT[code], fin ? 'Аналізується Відділом управління грошовими коштами та банківськими металами; на скринінг МТУ не передається' : 'Аналітика, перелік і картки активів категорії', '', h), A.keep);
  });

  // ---------------------------------------------------------------- земля: карта
  A.landMapBlock = function (all) {
    var f = A.params(), withPoly = all.filter(function (a) { return a.details && a.details.geometry; }).length, withPt = all.filter(function (a) { return a.lat && a.lon; }).length;
    A._landBase = all;
    return '<h2>Карта ділянок</h2><div class="panel"><div class="map-panel">' +
      A.sel('mregion', D.REGIONS, f.mregion, 'Уся Україна', 'data-mf') + A.sel('mzone', D.ZONES, f.mzone, 'Усі зони', 'data-mf') + A.sel('minvest', D.INVEST_GRADES, f.minvest, 'Будь-яка привабливість', 'data-mf') +
      '<input data-mf name="mq" value="' + esc(f.mq || '') + '" placeholder="Кадастровий № або назва" style="min-width:200px">' +
      '<span class="mini" data-mstat></span>' + (A.can('system') || A.can('edit_any_asset') ? '<label class="btn plain" style="margin-left:auto">Завантажити контури (GeoJSON)<input type="file" accept=".geojson,.json" data-geojson style="display:none"></label>' : '') + '</div>' +
      '<div data-map></div><p class="mini" style="margin-top:6px">Колір — зона активу; при малому масштабі ділянки групуються (клік — наблизити). Підкладки: «Схема», «Супутник», OSM; «Кадастр» — шар Публічної кадастрової карти (з масштабу 12, якщо сервер Держгеокадастру доступний з вашої мережі). ' +
      'На карті: точок ' + A.num(withPt) + ', контурів ' + A.num(withPoly) + ' з ' + A.num(all.length) + ' ділянок. Контури — з бази контурів за кадастровими номерами (land_polygons, завантажено при оновленні 2.4) і внесені вручну. Додати контур окремій ділянці: картка ділянки → «Редагувати» → «Адреса і координати» → «Контур ділянки (GeoJSON)» (текст або файл .geojson). Масово — кнопка «Завантажити контури» (FeatureCollection з кадастровим номером у властивостях). Контури, внесені вручну, імпорт не перезаписує.</p>' +
      '<div class="land-list" data-landlist></div></div>';
  };
  A.afterRender.push(function (root) {
    var el = root.querySelector('[data-map]'); if (!el || el.dataset.done) return; el.dataset.done = 1;
    var base = (A._landBase || A.T('assets').filter(function (a) { return a.category === 'land' && A.inScope(a); }));
    var m = new window.ArmaMap(el, {tiles: S.settings.map_tiles, cadastre: S.settings.map_cadastre, onClick: function (p) { A.go('#/asset/' + p.id); }});
    var leg = document.createElement('div'); leg.className = 'map-legend'; el.appendChild(leg);
    var shown = 60;
    function val(n) { var x = root.querySelector('[data-mf][name="' + n + '"]'); return x ? x.value.trim() : ''; }
    function apply(fit) {
      var rg = val('mregion'), zn = val('mzone'), iv = val('minvest'), q = val('mq').toLowerCase();
      var list = base.filter(function (a) { return (!rg || a.region === rg) && (!zn || a.zone === zn) && (!iv || a.invest_grade === iv) && (!q || ((a.cadastral || '') + ' ' + (a.name || '') + ' ' + a.asset_no).toLowerCase().indexOf(q) >= 0); });
      var pts = [], polys = [];
      list.forEach(function (a) {
        var d = a.details || {}, col = ZCOL[a.zone] || '#6E7F9E', lab = a.asset_no + ' · ' + (a.cadastral || '') + ' · ' + (d.area_ha ? A.num(d.area_ha, 4) + ' га' : '');
        var g = d.geometry; if (g && g.coordinates) (g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates]).forEach(function (poly) { polys.push({rings: poly, color: col, id: a.id, label: lab}); });
        if (a.lat && a.lon) pts.push({lat: a.lat, lon: a.lon, color: col, id: a.id, label: lab, hasPoly: !!g});
      });
      m.setData(pts, polys);
      if (fit) { if (rg || q || zn || iv) m.fitPoints(); else m.fit(44.3, 22, 52.4, 40.3); }
      var zc = {}; list.forEach(function (a) { zc[a.zone] = (zc[a.zone] || 0) + 1; });
      leg.innerHTML = Object.keys(ZCOL).map(function (z) { return '<span><i style="background:' + ZCOL[z] + '"></i>' + z.replace(' зона', '') + ' ' + (zc[z] || 0) + '</span>'; }).join('') + '<span>На карті: ' + pts.length + (polys.length ? ' · контурів ' + polys.length : '') + '</span>';
      var st = root.querySelector('[data-mstat]'); if (st) st.textContent = 'ділянок: ' + A.num(list.length) + ' · площа ' + A.num(list.reduce(function (x, a) { return x + (Number((a.details || {}).area_ha) || 0); }, 0), 1) + ' га';
      var rows = list.slice().sort(function (a, b) { return (Number((b.details || {}).area_ha) || 0) - (Number((a.details || {}).area_ha) || 0); });
      var box = root.querySelector('[data-landlist]');
      box.innerHTML = '<div class="wrap-tbl"><table><thead><tr><th>№ у Реєстрі</th><th>Ділянка</th><th>Область</th><th>Кадастровий №</th><th class="num">Площа, га</th><th>Зона</th></tr></thead><tbody>' + rows.slice(0, shown).map(function (a) {
        return '<tr><td class="nowrap"><a class="id" href="#/asset/' + a.id + '">' + esc(a.asset_no) + '</a></td><td style="max-width:420px"><span class="clip" title="' + esc(a.name) + '">' + esc((a.name || '').slice(0, 140)) + '</span></td><td class="mini">' + esc(a.region || '—') + '</td><td class="mono mini">' + esc(a.cadastral || '') + '</td><td class="num">' + A.num((a.details || {}).area_ha, 4) + '</td><td>' + A.zone(a.zone, true) + '</td></tr>';
      }).join('') + (rows.length ? '' : '<tr><td colspan="6"><div class="empty">Ділянок за умовами немає</div></td></tr>') + '</tbody></table></div>' + (rows.length > shown ? '<p><button type="button" class="btn sm" data-more>Показати ще (' + (rows.length - shown) + ')</button></p>' : '');
      var mb = box.querySelector('[data-more]'); if (mb) mb.addEventListener('click', function () { shown += 120; apply(false); });
      // стан фільтра карти — в адресі сторінки без перезавантаження сторінки
      try { var ps = A.params(); ['mregion', 'mzone', 'minvest', 'mq'].forEach(function (k) { var v = val(k); if (v) ps[k] = v; else delete ps[k]; }); history.replaceState(null, '', A.link(location.hash.slice(1).split('?')[0], ps)); } catch (e) { /* без збереження */ }
    }
    var tmr = null;
    root.querySelectorAll('[data-mf]').forEach(function (x) { x.addEventListener(x.tagName === 'INPUT' ? 'input' : 'change', function () { clearTimeout(tmr); tmr = setTimeout(function () { shown = 60; apply(true); }, x.tagName === 'INPUT' ? 350 : 0); }); });
    apply(!!(A.params().mregion || A.params().mq));
    var inp = root.querySelector('[data-geojson]');
    if (inp) inp.addEventListener('change', function () { var file = inp.files[0]; if (!file) return; var rd = new FileReader(); rd.onload = function () { A.importGeojson(rd.result, file.name); }; rd.readAsText(file); });
  });
  var CAD = /\b\d{10}:\d{2}:\d{3}:\d{4}\b/;
  function ringArea(ring) {
    var lat0 = ring.reduce(function (s, p) { return s + p[1]; }, 0) / ring.length, kx = 111320 * Math.cos(lat0 * Math.PI / 180), ky = 110540, a = 0;
    for (var i = 0; i < ring.length; i++) { var p = ring[i], q = ring[(i + 1) % ring.length]; a += p[0] * kx * q[1] * ky - q[0] * kx * p[1] * ky; }
    return Math.abs(a / 2) / 10000;
  }
  A.importGeojson = function (text, name) {
    var gj; try { gj = JSON.parse(text); } catch (e) { return A.toast('Файл не є коректним GeoJSON', 'err'); }
    var feats = gj.type === 'FeatureCollection' ? gj.features : [gj], tx = A.tx(), ok = 0, miss = 0, byCad = {};
    A.T('assets').forEach(function (a) { if (a.cadastral) (byCad[a.cadastral] = byCad[a.cadastral] || []).push(a); });
    feats.forEach(function (ft) {
      var props = ft.properties || {}, cad = null;
      Object.keys(props).some(function (k) { var m = String(props[k]).match(CAD); if (m) cad = m[0]; return cad; });
      var g = ft.geometry; if (!g || !/Polygon/.test(g.type)) return;
      var polys = g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates], area = polys.reduce(function (s, p) { return s + ringArea(p[0]); }, 0);
      var ring = polys[0][0], cen = ring.reduce(function (s, p) { return [s[0] + p[0] / ring.length, s[1] + p[1] / ring.length]; }, [0, 0]);
      var as = cad && byCad[cad];
      if (!as) { miss++; return; }
      as.forEach(function (a) { var det = Object.assign({}, a.details || {}, {geometry: g, area_calc_ha: Math.round(area * 10000) / 10000}); if (!det.area_ha) det.area_ha = det.area_calc_ha;
        tx.put('assets', {id: a.id, details: det, lat: a.lat || Math.round(cen[1] * 1e6) / 1e6, lon: a.lon || Math.round(cen[0] * 1e6) / 1e6}, a.updated_at); ok++; });
    });
    if (!ok) return A.toast('Жоден контур не зіставлено з активами (не знайдено кадастрових номерів). Без пари: ' + miss, 'err');
    tx.log('Завантажено GeoJSON', 'parcels', null, {file: name, matched: ok, unmatched: miss});
    return tx.commit().then(function () { A.toast('Контурів зіставлено з активами: ' + ok + '; без відповідного активу: ' + miss); A.route(true); });
  };

  // ---------------------------------------------------------------- кошти, метали, ОВДП
  function fx(cur) { var r = A.json(S.settings.fx_rates, {}); return cur === 'UAH' || !cur ? 1 : Number(r[cur]) || {USD: 41.3, EUR: 45.2, GBP: 52.4, CHF: 47, XAU: 0, XAG: 0}[cur] || 0; }
  A.moneyUAH = function (a) { var d = a.details || {}; if (d.money_kind === 'Банківський метал' && d.metal_weight) { var mp = A.json(S.settings.metal_prices, {}); return Number(d.metal_weight) * (Number(mp[d.currency]) || 0); } return (Number(d.amount) || 0) * fx(d.currency); };
  A.moneyPage = function (all) {
    var dep = [], ovdp = [], met = [], none = [];
    all.forEach(function (a) { var d = a.details || {}, pl = d.placement || ''; if (d.money_kind === 'Банківський метал') met.push(a); else if (pl === 'Депозит') dep.push(a); else if (pl === 'ОВДП') ovdp.push(a); else none.push(a); });
    var s = function (l) { return l.reduce(function (x, a) { return x + A.moneyUAH(a); }, 0); }, M = function (v) { return A.num(v / 1e6, 1) + '<small>млн ₴</small>'; };
    var banks = A.sum(dep, function (a) { return (a.details || {}).placement_bank || (a.details || {}).bank || 'Банк не вказано'; }, A.moneyUAH);
    var years = A.sum(ovdp, function (a) { return ((a.details || {}).maturity || '').slice(0, 4) || 'Дата не вказана'; }, A.moneyUAH).sort(function (a, b) { return a[0].localeCompare(b[0]); });
    var avg = dep.length ? dep.reduce(function (x, a) { return x + (Number((a.details || {}).rate) || 0); }, 0) / dep.length : 0;
    var h = '<div class="grid g4">' + A.kpi('На депозитах', M(s(dep)), banks.length + ' банк(ів)' + (avg ? ', середня ставка ' + A.num(avg, 1) + ' %' : '')) + A.kpi('В ОВДП', M(s(ovdp)), ovdp.length + ' записів') +
      A.kpi('Банківські метали', M(s(met)), met.length + ' записів') + A.kpi('Не розміщено', M(s(none)), none.length + ' активів') + '</div>';
    var struct = [['Депозити', 'ОВДП', 'Метали', 'Не розміщено'], [s(dep), s(ovdp), s(met), s(none)].map(function (v) { return Math.round(v); }), [null, null, null, null]];
    h += '<h2>Аналітика розміщення</h2><div class="grid g3"><div class="panel"><h3>Структура розміщення <span>₴</span></h3>' + A.chart('donut', struct, null, ['#35D6E8', '#3DD68C', '#F5C518', '#6E7F9E'], {unit: 'money'}) + '</div>' +
      '<div class="panel"><h3>Депозити за банками <span>₴</span></h3>' + A.chart('barh', A.series(banks), 'cyan', null, {unit: 'money'}) + '</div><div class="panel"><h3>Погашення ОВДП <span>₴ за роками</span></h3>' + A.chart('barv', A.series(years), 'ok', null, {unit: 'money'}) + '</div></div>';
    var cur = A.sum(all, function (a) { return (a.details || {}).currency || 'не вказано'; }, function (a) { return Number((a.details || {}).amount) || 0; });
    h += '<div class="grid g2" style="margin-top:14px"><div class="panel"><h3>Залишки за валютами <span>у валюті обліку</span></h3><table><tbody>' + cur.map(function (r) { return '<tr><td>' + esc(r[0]) + '</td><td class="num">' + A.num(r[1], 2) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      '<div class="panel"><h3>Депозити</h3><table><thead><tr><th>Банк</th><th class="num">Сума, ₴</th><th class="num">Ставка</th><th class="num">Дохід за рік, ₴</th></tr></thead><tbody>' +
      banks.map(function (b) { var ds = dep.filter(function (a) { return ((a.details || {}).placement_bank || (a.details || {}).bank || 'Банк не вказано') === b[0]; }), r = ds.length ? ds.reduce(function (x, a) { return x + (Number((a.details || {}).rate) || 0); }, 0) / ds.length : 0;
        return '<tr><td>' + esc(b[0]) + '</td><td class="num">' + A.num(b[1]) + '</td><td class="num">' + (r ? A.num(r, 1) + ' %' : '—') + '</td><td class="num">' + (r ? A.num(b[1] * r / 100) : '—') + '</td></tr>'; }).join('') + (banks.length ? '' : '<tr><td colspan="4" class="mini">Розміщення на депозитах ще не внесено (поля «Розміщення», «Банк», «Ставка» в картці активу).</td></tr>') + '</tbody></table></div></div>';
    if (A.can('edit_money') || A.can('system')) {
      var r = A.json(S.settings.fx_rates, {USD: 41.3, EUR: 45.2, GBP: 52.4});
      h += '<form class="panel" data-act="fx" style="margin-top:14px;display:flex;gap:8px;align-items:end;flex-wrap:wrap"><b style="width:100%">Курси для перерахунку в гривню</b><span class="mini" style="width:100%">Оновлюються автоматично щогодини з офіційного курсу НБУ' + (S.settings.rates_nbu_at ? ' · останнє оновлення: ' + esc(S.settings.rates_nbu_at) : '') + '. Ручне введення — лише якщо сервер не має доступу до bank.gov.ua.</span>' + ['USD', 'EUR', 'GBP', 'CHF'].map(function (c) { return A.field(c, 'fx_' + c, r[c], 'text'); }).join('') + '<button class="btn">Зберегти курси</button></form>';
    }
    return h + '<p class="mini">Розділ не передається на скринінг МТУ, фото і адреса не застосовуються. На публічний сайт — лише узагальнені показники.</p>';
  };
  A.ACT.fx = function (f, d) { var r = {}; ['USD', 'EUR', 'GBP', 'CHF'].forEach(function (c) { var v = A.parseNum(d['fx_' + c]); if (v) r[c] = v; }); var tx = A.tx(); tx.put('settings', {key: 'fx_rates', value: JSON.stringify(r)}); return tx.commit().then(function () { A.toast('Курси збережено'); A.route(true); }); };

  // ---------------------------------------------------------------- криптоактиви
  A.cryptoRows = function (all) {
    return all.map(function (a) { var d = a.details || {}, r = A.indexes.rate[d.token] || A.indexes.rate.USDT, u = Number(d.units) || 0;
      return {a: a, d: d, units: u, uah: r && r.uah ? u * r.uah : 0, usd: r && r.usd ? u * r.usd : (r && r.uah ? u * r.uah / fx('USD') : 0)}; });
  };
  A.cryptoPage = function (all) {
    var rows = A.cryptoRows(all), cur = A.params().cur === 'USD' ? 'USD' : 'UAH', val = function (x) { return cur === 'USD' ? x.usd : x.uah; }, tot = rows.reduce(function (s, x) { return s + val(x); }, 0);
    var type = function (x) { var t = (x.d.token || '').toUpperCase(); return t === 'USDT' || t === 'USDC' ? 'Стейблкоїни USDT/USDC' : t === 'BTC' ? 'BTC' : t === 'ETH' ? 'ETH' : t ? 'Інші криптоактиви' : 'Не визначено'; };
    var st = function (x) { var a = x.a; return a.transfer_way === 'realization' ? 'Підготовка до реалізації' : a.transfer_way === 'manager_contract' ? 'Передано в управління' : a.legal_status === 'lost' || a.legal_status === 'closed' ? 'Вибув / арешт скасовано' : 'Арештовано в межах КП'; };
    var unit = cur === 'USD' ? null : 'money';
    var stable = rows.filter(function (x) { return type(x).indexOf('Стейбл') === 0; }).reduce(function (s, x) { return s + val(x); }, 0);
    var h = '<div class="grid g4">' + A.kpi('Записів криптоактивів', A.num(all.length), 'у Реєстрі') + A.kpi('Поточна ринкова вартість', cur === 'USD' ? '$ ' + A.num(tot) : A.money(tot), 'кількість × курс агрегатора') +
      A.kpi('Стейблкоїни (фіксовані)', cur === 'USD' ? '$ ' + A.num(stable) : A.money(stable), 'USDT / USDC') + A.kpi('Волатильні', cur === 'USD' ? '$ ' + A.num(tot - stable) : A.money(tot - stable), 'BTC, ETH та інші') + '</div>' +
      '<div class="chips-filter" style="margin-top:12px"><a href="' + A.link('/c/crypto', {cur: 'UAH'}) + '" class="' + (cur === 'UAH' ? 'on' : '') + '">У гривні</a><a href="' + A.link('/c/crypto', {cur: 'USD'}) + '" class="' + (cur === 'USD' ? 'on' : '') + '">У доларах</a></div>' +
      '<h2>Аналітика</h2><div class="grid g3"><div class="panel"><h3>За типами активів</h3>' + A.chart('barh', A.series(A.sum(rows, type, val)), 'gold', null, {unit: unit}) + '</div>' +
      '<div class="panel"><h3>Спосіб зберігання</h3>' + A.chart('donut', A.series(A.grp(rows, function (x) { return x.d.storage || 'Холодні гаманці'; })), null, ['#35D6E8', '#8B7BF7', '#6E7F9E']) + '</div>' +
      '<div class="panel"><h3>Розподіл за мережами</h3>' + A.chart('barh', A.series(A.grp(rows, function (x) { return x.d.network || 'Не визначено'; })), 'cyan') + '</div>' +
      '<div class="panel"><h3>Статус активів</h3>' + A.chart('donut', A.series(A.grp(rows, st)), null, ['#F5C518', '#3DD68C', '#6E7F9E', '#F0524E']) + '</div>' +
      '<div class="panel" style="grid-column:span 2"><h3>Курси <span>CoinGecko, автоматично щогодини' + (S.settings.rates_crypto_at ? ' · оновлено ' + esc(S.settings.rates_crypto_at) : '') + '</span></h3>' + (A.can('edit_money') || A.can('system') ? '<p><button class="btn sm gold" data-click="rates-refresh">Оновити курси зараз</button> <span class="mini">ручне введення нижче — лише як резерв, якщо агрегатор недоступний</span></p>' : '') + '<table><tbody>' +
      A.T('rates').map(function (r) { return '<tr><td>' + esc(r.token) + '</td><td class="num">' + A.num(r.uah, 2) + ' ₴</td><td class="num">' + (r.usd ? '$ ' + A.num(r.usd, 4) : '—') + '</td><td class="mini">' + esc(r.fetched_at || '') + '</td></tr>'; }).join('') + '</tbody></table>' +
      (A.can('edit_money') || A.can('system') ? '<form data-act="rate" style="display:flex;gap:6px;margin-top:8px">' + A.sel('token', ['USDT', 'USDC', 'BTC', 'ETH', 'TRX', 'SOL'], 'USDT', null) + '<input name="uah" placeholder="курс, ₴" style="width:110px"><input name="usd" placeholder="курс, $" style="width:90px"><button class="btn">Зберегти курс</button></form>' : '') + '</div></div>' +
      '<h2>Записи</h2><div class="wrap-tbl"><table><thead><tr><th>№ у Реєстрі</th><th>Криптоактив</th><th class="num">Кількість</th><th class="num">Вартість</th><th>Зберігання</th><th>Лот Prozorro.Продажі</th>' + (A.can('view_internal') ? '<th>Гаманець (службово)</th>' : '') + '<th>Правовий стан</th></tr></thead><tbody>' +
      rows.map(function (x) { return '<tr><td><a class="id" href="#/asset/' + x.a.id + '">' + esc(x.a.asset_no) + '</a></td><td>' + esc(x.d.token || '—') + '<span class="sub">' + esc(x.d.network || '') + '</span></td><td class="num">' + A.num(x.units, 2) + '</td><td class="num"><b>' + (cur === 'USD' ? '$ ' + A.num(x.usd) : A.money(x.uah)) + '</b></td><td class="mini">ХОЛОДНІ ГАМАНЦІ' + (x.d.custodian ? '<br>' + esc(x.d.custodian) : '') + '</td><td class="mini mono">' + esc(x.d.prozorro_lot || '—') + '</td>' + (A.can('view_internal') ? '<td class="mini mono" style="word-break:break-all">' + esc(x.d.wallet || '—') + '</td>' : '') + '<td>' + A.legal(x.a.legal_status) + '</td></tr>'; }).join('') + '</tbody></table></div>';
    return h + '<p class="mini">Фото, скринінг МТУ і адреса для криптоактивів не застосовуються. На публічний сайт — лише узагальнена аналітика.</p>';
  };
  A.ACT.rate = function (f, d) { var u = A.parseNum(d.uah); if (!u) return A.toast('Вкажіть курс у гривнях', 'err');
    if (A.mode === 'server') return A.http('POST', '/api/rates/manual', {token: d.token, uah: u, usd: A.parseNum(d.usd)}).then(function () { A.toast('Курс збережено'); location.reload(); });
    var r = A.indexes.rate[d.token], tx = A.tx(); tx.put('rates', {id: r ? r.id : A.tmpId(), token: d.token, uah: u, usd: A.parseNum(d.usd), fetched_at: A.nowS() + ' (вручну)'}); return tx.commit().then(function () { A.toast('Курс збережено'); A.route(true); }); };
  // оновлення курсів: на сервері — НБУ і CoinGecko (так само працює щогодинна задача); у дзеркалі — запит з браузера до CoinGecko
  var CG = {USDT: 'tether', USDC: 'usd-coin', BTC: 'bitcoin', ETH: 'ethereum', TRX: 'tron', SOL: 'solana', BNB: 'binancecoin'};
  A.CLICK['rates-refresh'] = function () {
    if (A.mode === 'server') { A.busy(true); return A.http('POST', '/api/rates/refresh', {}).then(function (r) { A.busy(false); (r.messages || []).forEach(function (m) { A.toast(m, /не вдалося/.test(m) ? 'err' : 'ok'); }); setTimeout(function () { location.reload(); }, 1800); }, function (e) { A.busy(false); throw e; }); }
    var ids = Object.keys(CG).map(function (k) { return CG[k]; }).join(',');
    return fetch('https://api.coingecko.com/api/v3/simple/price?ids=' + ids + '&vs_currencies=uah,usd').then(function (r) { if (!r.ok) throw new Error('CoinGecko: ' + r.status); return r.json(); }).then(function (j) {
      var tx = A.tx(); Object.keys(CG).forEach(function (t) { var v = j[CG[t]]; if (!v || !v.uah) return; var r = A.indexes.rate[t]; tx.put('rates', {id: r ? r.id : A.tmpId(), token: t, uah: v.uah, usd: v.usd, fetched_at: A.nowS() + ' (CoinGecko)'}); });
      tx.put('settings', {key: 'rates_crypto_at', value: A.nowS()}); return tx.commit().then(function () { A.toast('Курси оновлено з CoinGecko'); A.route(true); });
    }).catch(function (e) { A.toast('Не вдалося отримати курси (' + e.message + '). Перевірте доступ до api.coingecko.com.', 'err'); });
  };
})();
