/* Пули активів, плани дій (CRM), судові рішення, оцінки, товариства (корпоративні права). */
(function () {
  'use strict';
  var A = window.A, D = window.D, N = A.N, esc = A.esc, S = A.S, dd = A.dd;
  function same(a, b) { return (a === null || a === undefined ? '' : String(a)) === (b === null || b === undefined ? '' : String(b)); }
  function words(q) { return (q || '').toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6); }
  function match(s, w) { s = s.toLowerCase(); return w.every(function (x) { return s.indexOf(x) >= 0; }); }
  function nos(text) { return (text || '').split(/[\s,;]+/).map(function (x) { return x.trim(); }).filter(Boolean); }
  function diffPut(tx, t, old, rec, v) { var p = {id: old.id}, n = 0; Object.keys(rec).forEach(function (k) { if (k !== 'id' && !same(old[k], rec[k])) { p[k] = rec[k]; n++; } }); if (n) tx.put(t, p, v); return n; }
  function clean(d, numf) {
    var o = {}; Object.keys(d).forEach(function (k) { var v = typeof d[k] === 'string' ? d[k].trim() : d[k]; if (v === '') v = null;
      if (v !== null && numf && numf.indexOf(k) >= 0) { var n = A.parseNum(v); if (n === null) throw new Error('Поле «' + k + '»: потрібне число'); v = n; } o[k] = v; });
    return o;
  }
  function actionsBar(cancel, label) { return '<div class="form-actions"><a class="btn plain" href="' + cancel + '">Скасувати</a><button class="btn gold">' + esc(label || 'Зберегти') + '</button></div>'; }

  // ================================================================ пули
  A.poolAssets = function (p) { return (A.indexes.poolAssets[p.id] || []).filter(A.inScope); };
  A.poolSummary = function (p) {
    var as = A.indexes.poolAssets[p.id] || [], area = 0, ha = 0, val = 0, regions = {}, cats = {};
    as.forEach(function (a) { var d = a.details || {}; area += Number(d.area_sqm) || 0; ha += Number(d.area_ha) || 0; val += a.val_amount || 0; if (a.region) regions[a.region] = 1; cats[a.category] = (cats[a.category] || 0) + 1; });
    return {count: as.length, area: area, ha: ha, val: val, regions: Object.keys(regions), cats: cats};
  };
  A.on(/^\/pools$/, function (f) {
    var w = words(f.q), list = A.T('pools').filter(function (p) {
      if (w.length && !match([p.code, p.name, p.description, p.region, p.prozorro_id, p.court_basis].join(' '), w)) return false;
      if (f.dept && (f.dept === '__none__' ? p.dept_code : p.dept_code !== f.dept)) return false;
      if (f.publish === '1' && !p.publish) return false; if (f.publish === '0' && p.publish) return false;
      if (f.way && p.transfer_way !== f.way) return false; if (f.category && p.category !== f.category) return false;
      return true;
    }).sort(function (a, b) { return (b.created_at || '').localeCompare(a.created_at || '') || b.id - a.id; });
    var pg = A.pageOf(list, f), q = Object.assign({}, f); delete q.page;
    var h = '<form class="filters" data-act="filter" data-base="/pools"><input name="q" value="' + esc(f.q || '') + '" placeholder="Код, назва, опис, область, Prozorro" style="flex:1;min-width:260px">' +
      A.sel('dept', D.DMA.concat([['__none__', 'Не закріплено']]), f.dept, 'Усі відділи ДМА') + A.sel('category', A.OPT.CAT, f.category, 'Усі категорії') + A.sel('way', D.TRANSFER_WAYS, f.way, 'Спосіб передачі') +
      A.sel('publish', [['1', 'Опубліковані'], ['0', 'Не опубліковані']], f.publish, 'Публікація') + '<button class="btn">Знайти</button><button type="button" class="btn plain" data-click="reset" data-base="/pools">Скинути все</button></form>' +
      A.pager(list.length, pg.page, '/pools', q) + '<div class="wrap-tbl"><table><thead><tr><th>Код</th><th>Назва</th><th class="num">Активів</th><th>Відділ ДМА</th><th>Спосіб передачі</th><th class="num">Оцінка</th><th>План дій</th><th>Сайт</th></tr></thead><tbody>' +
      pg.rows.map(function (p) { var n = (A.indexes.poolAssets[p.id] || []).length, pl = A.plansOf('pool', p.id).filter(function (x) { return x.status === 'active'; })[0];
        return '<tr><td class="nowrap"><a class="id" href="#/pool/' + p.id + '">' + esc(p.code) + '</a></td><td style="max-width:420px"><span class="clip" title="' + esc(p.name) + '">' + esc(p.name || '') + '</span><span class="sub">' + esc(N.CAT[p.category] || '') + (p.region ? ' · ' + esc(p.region) : '') + '</span></td><td class="num">' + n + '</td>' +
          '<td class="mini">' + esc(N.DMA_SHORT[p.dept_code] || '—') + (p.dma_manager ? '<br>' + esc(p.dma_manager) : '') + '</td><td class="mini">' + esc(N.WAY[p.transfer_way] || '—') + '</td><td class="num">' + (p.val_amount ? A.money(p.val_amount) : '—') + '</td>' +
          '<td class="mini">' + (pl ? esc(N.PROC[pl.process]) : '—') + '</td><td>' + (p.publish ? '<span class="tag t-gold">опубліковано</span>' : '') + (p.prozorro_id ? ' ' + A.prozorroBtn(p) : '') + '</td></tr>'; }).join('') +
      (list.length ? '' : '<tr><td colspan="8"><div class="empty">Пулів не знайдено.</div></td></tr>') + '</tbody></table></div>' + A.pager(list.length, pg.page, '/pools', q);
    A.render(A.shell('Пули активів', 'Об’єднання активів для спільної оцінки, плану дій і публікації', A.can('manage_pools') ? '<a class="btn gold" href="#/pool/new">+ Новий пул</a>' : '', h), A.keep);
  });
  function poolForm(p, isNew, ids) {
    var F = A.field, S2 = A.fsel, mg = A.users(function (u) { return u.dept_code; });
    return '<form data-act="pool-save" data-id="' + (p.id || '') + '" data-ids="' + esc((ids || []).join(',')) + '"><fieldset><legend>Пул</legend><div class="form-grid">' +
      F('Код пулу', 'code', p.code, 'text', 1, 'наприклад, П-2026-015') + F('Назва', 'name', p.name, 'text', 1, '', 'wide') + S2('Складність', 'complexity', D.COMPLEXITY, p.complexity || 'pool') + S2(A.KIND_LABEL, 'report_kind', D.REPORT_KINDS, p.report_kind, 0, A.KIND_HINT) +
      S2('Категорія', 'category', A.OPT.CAT, p.category) + S2('Область', 'region', D.REGIONS, p.region) + S2('Відділ ДМА', 'dept_code', D.DMA, p.dept_code) +
      S2('Менеджер-куратор', 'dma_manager_id', mg.map(function (u) { return [u.id, u.full_name + ' — ' + (N.DMA_SHORT[u.dept_code] || '')]; }), p.dma_manager_id) + S2('Спосіб передачі', 'transfer_way', D.TRANSFER_WAYS, p.transfer_way) +
      S2('Інвестиційна привабливість', 'invest_grade', D.INVEST_GRADES, p.invest_grade) + F('Підстава (судове рішення)', 'court_basis', p.court_basis, 'text', 0, '', 'wide') + F('Опис пулу', 'description', p.description, 'textarea', 0, '', 'wide') +
      F('Очікуваний дохід / міс., грн', 'expected_income_month', p.expected_income_month) + F('Очікуваний дохід / рік, грн', 'expected_income_year', p.expected_income_year) + F('Стан орієнтовного плану управління', 'mgmt_plan_status', p.mgmt_plan_status, 'text', 0, 'напр., Розробляється / Погоджено / Затверджено') +
      F('Дата плану управління', 'mgmt_plan_date', p.mgmt_plan_date, 'date') + F('Закупівля / конкурс', 'procurement_info', p.procurement_info) + F('Договір управління', 'mgmt_contract', p.mgmt_contract) + F('Статус пулу', 'status', p.status) +
      F('Ідентифікатор лоту Prozorro', 'prozorro_id', p.prozorro_id) + F('Посилання на лот Prozorro', 'prozorro_url', p.prozorro_url, 'url', 0, '', 'wide') + '</div></fieldset>' +
      '<fieldset' + (A.can('manage_public') ? '' : ' disabled') + '><legend>Публічний сайт — зведена картка пулу</legend><p class="mini" style="margin-top:0">На сайті публікується пул як єдиний лот: характеристики, фото активів і контакти. Окремі активи пулу на сайті не показуються.</p><div class="form-grid">' +
      F('Заголовок на сайті', 'public_title', p.public_title, 'text', 0, '', 'wide') + F('Опис на сайті', 'public_description', p.public_description, 'textarea', 0, 'без персональних даних', 'wide') +
      F('Підрозділ для звернень', 'public_dept', p.public_dept) + F('Телефон', 'public_phone', p.public_phone) + F('E-mail', 'public_email', p.public_email, 'email') + S2('Опублікувати', 'publish', [['0', 'Ні'], ['1', 'Так']], p.publish ? '1' : '0', 0, '', '', '', null) + '</div></fieldset>' +
      (isNew ? '<fieldset><legend>Активи пулу</legend><div class="form-grid">' + F('Номери активів у Реєстрі', 'asset_nos', '', 'textarea', 0, 'Через кому, пробіл або з нового рядка' + (ids && ids.length ? '. Обрано в реєстрі: ' + ids.length : ''), 'wide') + '</div></fieldset>' : '') +
      actionsBar(isNew ? '#/pools' : '#/pool/' + p.id, isNew ? 'Створити пул' : 'Зберегти') + '</form>';
  }
  A.on(/^\/pool\/new$/, function (f) {
    if (!A.can('manage_pools')) return A.deny();
    var ids = (f.ids || '').split(',').filter(Boolean).map(Number), y = new Date().getFullYear(), n = A.T('pools').filter(function (p) { return (p.code || '').indexOf('П-' + y) === 0; }).length + 1;
    var first = ids.length && A.get('assets', ids[0]);
    A.render(A.shell('Новий пул активів', ids.length ? 'З обраних у реєстрі активів: ' + ids.length : '', '', poolForm({code: 'П-' + y + '-' + ('00' + n).slice(-3), complexity: 'pool', dept_code: (first && first.dept_code) || (S.user && S.user.dept_code), category: first && first.category, region: first && first.region}, true, ids)));
  });
  A.on(/^\/pool\/(\d+)\/edit$/, function (id) { var p = A.get('pools', +id); if (!p) return A.notFound(); if (!A.can('manage_pools') && !A.can('manage_public')) return A.deny(); A.render(A.shell('Редагування пулу ' + p.code, p.name || '', '', poolForm(p, false))); });
  A.ACT['pool-save'] = function (form, d) {
    var isNew = !form.dataset.id, old = isNew ? {} : A.get('pools', +form.dataset.id), rec = clean(d, ['expected_income_month', 'expected_income_year']), assetNos = rec.asset_nos; delete rec.asset_nos;
    if (!rec.code || !rec.name) throw new Error('Вкажіть код і назву пулу');
    if (A.T('pools').some(function (p) { return p.code === rec.code && p.id !== old.id; })) throw new Error('Пул з кодом ' + rec.code + ' уже існує');
    if ('dma_manager_id' in rec) { rec.dma_manager_id = rec.dma_manager_id ? +rec.dma_manager_id : null; var u = rec.dma_manager_id && A.get('users', rec.dma_manager_id); rec.dma_manager = u ? u.full_name : null; }
    if ('publish' in rec) rec.publish = +rec.publish || 0;
    var tx = A.tx(), pid;
    if (isNew) { pid = A.tmpId(); rec.id = pid; rec.source = 'Створено в системі'; tx.put('pools', rec); }
    else { pid = old.id; diffPut(tx, 'pools', old, rec); }
    var ids = (form.dataset.ids || '').split(',').filter(Boolean).map(Number), miss = [];
    nos(assetNos).forEach(function (no) { var a = A.indexes.byNo[no]; if (a) ids.push(a.id); else miss.push(no); });
    var seen = {}; ids.forEach(function (i) { if (seen[i]) return; seen[i] = 1; var a = A.get('assets', i); if (a && a.pool_id !== pid) tx.put('assets', {id: a.id, pool_id: pid, complexity: 'pool'}, a.updated_at); });
    tx.log(isNew ? 'Створено пул' : 'Змінено пул', 'pool', isNew ? null : pid, {code: rec.code, assets: Object.keys(seen).length});
    return tx.commit().then(function (r) { if (miss.length) A.toast('Не знайдено активів: ' + miss.join(', '), 'err'); if (isNew) A.basket.set([]); A.toast(isNew ? 'Пул створено' : 'Пул збережено'); A.go('#/pool/' + r.id('pools', pid)); });
  };
  A.on(/^\/pool\/(\d+)$/, function (id) {
    var p = A.get('pools', +id); if (!p) return A.notFound();
    A.loadMedia();
    var as = A.poolAssets(p), ed = A.can('manage_pools'), sm = A.poolSummary(p), lg = A.grp(as, 'legal_status');
    var act = (ed || A.can('manage_public') ? '<a class="btn gold" href="#/pool/' + p.id + '/edit">Редагувати пул</a>' : '') + (A.can('edit_valuations') ? '<a class="btn" href="' + A.link('/valuation/new', {tt: 'pool', tid: p.id}) + '">+ Оцінка пулу</a>' : '') +
      (A.can('export') ? '<a class="btn" href="#" data-click="xlsx-assets" data-q="' + esc(JSON.stringify({pool: String(p.id)})) + '">XLSX активів пулу</a>' : '') + (A.can('delete_records') ? '<button class="btn danger" data-click="pool-del" data-id="' + p.id + '" data-confirm="Видалити пул? Активи залишаться в реєстрі без пулу.">Видалити</button>' : '') + '<a class="btn plain" href="#/pools">До пулів</a>';
    var h = '<div class="grid g4">' + A.kpi('Активів у пулі', A.num(sm.count), lg.map(function (x) { return (N.LS[x[0]] || x[0]) + ': ' + x[1]; }).join(' · ')) +
      A.kpi('Оцінка пулу', p.val_amount ? A.money(p.val_amount) : '—', p.val_date ? 'станом на ' + A.dt(p.val_date) : 'оцінки немає') + A.kpi('Очікуваний дохід', p.expected_income_year ? A.money(p.expected_income_year) : '—', 'на рік') +
      A.kpi('Орієнтовний план управління', esc(p.mgmt_plan_status || 'Не розроблено'), p.mgmt_plan_date ? A.dt(p.mgmt_plan_date) : '') + '</div>';
    h += '<div class="tabs" data-tabbar="pool" style="margin-top:14px"><a href="#" data-tab="p-info">Відомості</a><a href="#" data-tab="p-assets">Активи <span class="pill">' + as.length + '</span></a><a href="#" data-tab="p-plan">План дій</a><a href="#" data-tab="p-val">Оцінки</a><a href="#" data-tab="p-docs">Документи</a><a href="#" data-tab="p-pub">Публікація</a></div>';
    h += '<div class="tabpane" id="p-info" data-group="pool"><div class="panel"><dl class="kv">' + dd('Код пулу', '<span class="mono">' + esc(p.code) + '</span>', true) + dd('Назва', p.name) +
      dd('Категорія / вид', [N.CAT[p.category], N.KIND[p.report_kind], N.CX[p.complexity]].filter(Boolean).join(' · ')) + dd('Область', p.region || sm.regions.join(', ')) + dd('Відділ ДМА', N.DMA[p.dept_code] || 'Не закріплено') + dd('Менеджер-куратор', p.dma_manager || '—') +
      dd('Інвестиційна привабливість', A.invest(p.invest_grade), true) + dd('Спосіб передачі', N.WAY[p.transfer_way] || '—') + dd('Підстава (судове рішення)', p.court_basis || '—') + dd('Опис', p.description || '—') +
      dd('Закупівля / конкурс', p.procurement_info) + dd('Договір управління', p.mgmt_contract) + dd('Prozorro.Продажі', A.prozorroBtn(p), true) + dd('Джерело', (p.source || '—') + ' · створено ' + (p.created_at || '—') + (p.created_by ? ' · ' + p.created_by : '')) + '</dl></div></div>';
    h += '<div class="tabpane" id="p-assets" data-group="pool"><form data-act="pool-assets" data-id="' + p.id + '"><div class="wrap-tbl"><table><thead><tr>' + (ed ? '<th style="width:26px"></th>' : '') + '<th>№ активу</th><th>Найменування</th><th>Регіон / МТУ</th><th>Правовий стан</th><th class="num">Оцінка</th><th class="num">Фото</th></tr></thead><tbody>' +
      as.map(function (a) { return '<tr>' + (ed ? '<td><input type="checkbox" name="rm" value="' + a.id + '" style="width:auto"></td>' : '') + '<td class="nowrap"><a class="id" href="#/asset/' + a.id + '">' + esc(a.asset_no) + '</a><span class="sub">' + A.zone(a.zone, true) + '</span></td><td><span class="clip" title="' + esc(a.name) + '">' + esc(a.name || '') + '</span><span class="sub">' + esc(N.CAT[a.category] || '') + '</span></td>' +
        '<td class="mini">' + esc(a.region || '—') + '<br>' + esc(N.MTU[a.mtu_code] || '') + '</td><td>' + A.legal(a.legal_status) + '</td><td class="num">' + (a.val_amount ? A.money(a.val_amount) : '—') + '</td><td class="num">' + (a.photo_count || '—') + '</td></tr>'; }).join('') +
      (as.length ? '' : '<tr><td colspan="7"><div class="empty">У пулі немає активів (або вони поза вашою зоною видимості).</div></td></tr>') + '</tbody></table></div>' +
      (ed ? '<div class="sel-bar"><input name="asset_nos" placeholder="Додати за номерами: 123/0102/2024, …" style="flex:1;min-width:260px"><button class="btn" name="do" value="add">Додати</button><button class="btn danger" name="do" value="remove">Вилучити позначені</button></div>' : '') + '</form></div>';
    h += '<div class="tabpane" id="p-plan" data-group="pool">' + A.planBlock('pool', p.id, ed || A.can('crm_edit'), p.dept_code) + '</div>';
    h += '<div class="tabpane" id="p-val" data-group="pool"><div class="panel"><h3>Оцінки пулу</h3>' + A.valTable(A.valRows('pool', p.id)) + '</div></div>';
    h += '<div class="tabpane" id="p-docs" data-group="pool">' + A.docsBlock('pool', p.id, ed, ['mgmt_plan', 'valuation_report', 'mgmt_contract', 'lease_contract', 'storage_contract', 'court_scan', 'registry_extract', 'ident_conclusion', 'other']) + '<div style="margin-top:12px">' + A.photosBlock('pool', p.id, ed) + '</div></div>';
    var cats = Object.keys(sm.cats).map(function (c) { return (N.CAT[c] || c) + ': ' + sm.cats[c]; }).join(', '), photos = as.reduce(function (s, a) { return s + (a.photo_count || 0); }, 0) + A.filesOf('pool', p.id).filter(function (l) { return l.doc_type === 'photo'; }).length;
    h += '<div class="tabpane" id="p-pub" data-group="pool"><div class="panel"><h3>Зведена картка пулу для публічного сайту ' + (p.publish ? '<span class="tag t-gold">опубліковано</span>' : '<span class="tag t-unk">не опубліковано</span>') + '</h3><dl class="kv">' +
      dd('Заголовок', p.public_title || p.name) + dd('Опис', p.public_description || p.description) + dd('Склад', sm.count + ' активів · ' + cats) + (sm.area ? dd('Загальна площа будівель', A.num(sm.area, 1) + ' м²') : '') + (sm.ha ? dd('Площа земельних ділянок', A.num(sm.ha, 4) + ' га') : '') +
      dd('Області', sm.regions.join(', ')) + dd('Фото для сайту', photos + ' (фото пулу та фото активів у складі)') + dd('Контакти', [p.public_dept, p.public_phone, p.public_email].filter(Boolean).join(' · ') || 'не вказано — будуть загальні контакти АРМА') + dd('Prozorro', A.prozorroBtn(p), true) + '</dl>' +
      (A.can('manage_public') ? '<p><button class="btn ' + (p.publish ? 'plain' : 'gold') + '" data-click="pool-publish" data-id="' + p.id + '" data-v="' + (p.publish ? 0 : 1) + '">' + (p.publish ? 'Зняти з публікації' : 'Опублікувати пул') + '</button></p>' : '') + '</div></div>';
    A.render(A.shell('Пул ' + p.code, p.name || '', act, h), A.keep);
  });
  A.ACT['pool-assets'] = function (f, d, btn) {
    var p = A.get('pools', +f.dataset.id), tx = A.tx(), n = 0;
    if (d.do === 'add') { nos(d.asset_nos).forEach(function (no) { var a = A.indexes.byNo[no]; if (a && a.pool_id !== p.id) { tx.put('assets', {id: a.id, pool_id: p.id}, a.updated_at); n++; } }); }
    else A.arr(d.rm).forEach(function (i) { var a = A.get('assets', +i); if (a) { tx.put('assets', {id: a.id, pool_id: null}, a.updated_at); n++; } });
    if (!n) return A.toast('Немає змін (перевірте номери або позначки)', 'err');
    tx.log(d.do === 'add' ? 'Додано активи до пулу' : 'Вилучено активи з пулу', 'pool', p.id, {count: n});
    return tx.commit().then(function () { A.toast('Оновлено активів: ' + n); A.route(true); });
  };
  A.CLICK['pool-publish'] = function (t) { var p = A.get('pools', +t.dataset.id), tx = A.tx(); tx.put('pools', {id: p.id, publish: +t.dataset.v}); tx.log(+t.dataset.v ? 'Пул опубліковано' : 'Пул знято з публікації', 'pool', p.id); return tx.commit().then(function () { A.route(true); }); };
  A.CLICK['pool-del'] = function (t) { var tx = A.tx(); tx.del('pools', +t.dataset.id); tx.log('Видалено пул', 'pool', +t.dataset.id); return tx.commit().then(function () { A.go('#/pools'); }); };

  // ================================================================ плани дій
  A.targetOf = function (tt, id) {
    if (tt === 'asset') { var a = A.get('assets', id); return a ? {href: '#/asset/' + a.id, code: a.asset_no, name: a.name, rec: a} : null; }
    if (tt === 'pool') { var p = A.get('pools', id); return p ? {href: '#/pool/' + p.id, code: p.code, name: p.name, rec: p} : null; }
    if (tt === 'ident') { var r = A.get('ident_records', id); return r ? {href: '#/ident/' + r.id, code: 'Ідент. ' + (r.row_no ? 'р. ' + r.row_no : '#' + r.id), name: r.asset_desc, rec: r} : null; }
    if (tt === 'ident_group') { var g = A.get('ident_groups', id); return g ? {href: '#/ident/group/' + g.id, code: g.code, name: g.name, rec: g} : null; }
    return null;
  };
  A.on(/^\/plans$/, function (f) {
    var t = A.today(), rows = [];
    A.T('plans').forEach(function (p) {
      if (f.process && p.process !== f.process) return; if (f.dept && p.dept_code !== f.dept) return; if ((f.status || 'active') !== 'all' && p.status !== (f.status || 'active')) return;
      var tg = A.targetOf(p.target_type, p.target_id); if (!tg) return; if (p.target_type === 'asset' && !A.inScope(tg.rec)) return;
      if (f.mine && !(S.user && (p.manager_id === S.user.id || p.created_by === S.user.login))) return;
      var steps = A.indexes.stepsByPlan[p.id] || [], cur = steps.filter(function (s) { return s.status === 'active' || s.status === 'review'; });
      if (f.step && !cur.some(function (s) { return String(s.ord) === f.step; })) return;
      var over = cur.some(function (s) { return s.due_date && s.due_date < t; }), rev = cur.some(function (s) { return s.status === 'review'; });
      if (f.state === 'overdue' && !over) return; if (f.state === 'review' && !rev) return;
      rows.push({p: p, tg: tg, cur: cur, over: over, done: steps.filter(function (s) { return s.status === 'done' || s.status === 'skipped'; }).length, total: steps.length});
    });
    rows.sort(function (a, b) { return (b.over - a.over) || (b.p.id - a.p.id); });
    var pg = A.pageOf(rows, f), q = Object.assign({}, f); delete q.page;
    var h = '<form class="filters" data-act="filter" data-base="/plans">' + A.sel('process', D.PROCESSES.map(function (p) { return [p[0], p[1]]; }), f.process, 'Усі процеси') + A.sel('dept', D.DMA, f.dept, 'Усі відділи') +
      A.sel('state', [['overdue', 'Є прострочені кроки'], ['review', 'Очікують підтвердження']], f.state, 'Стан кроків') + A.sel('status', [['active', 'Діючі'], ['done', 'Завершені'], ['cancelled', 'Скасовані'], ['all', 'Усі']], f.status || 'active', null) +
      A.sel('mine', [['1', 'Мої плани']], f.mine, 'Усі менеджери') + (f.step ? '<input type="hidden" name="step" value="' + esc(f.step) + '">' : '') + '<button class="btn">Показати</button><button type="button" class="btn plain" data-click="reset" data-base="/plans">Скинути все</button></form>' +
      (f.step && f.process ? '<div class="flash info">Крок ' + esc(f.step) + ': ' + esc(((N.STEPS[f.process] || [])[+f.step - 1] || [])[0] || '') + '</div>' : '') + A.pager(rows.length, pg.page, '/plans', q) +
      '<div class="wrap-tbl"><table><thead><tr><th>Об’єкт</th><th>Процес</th><th>Поточні кроки</th><th>Строк</th><th>Прогрес</th><th>Відповідальні</th></tr></thead><tbody>' + pg.rows.map(function (r) {
        return '<tr><td style="max-width:320px"><a class="id" href="' + r.tg.href + '">' + esc(r.tg.code) + '</a><span class="sub clip" title="' + esc(r.tg.name) + '">' + esc((r.tg.name || '').slice(0, 90)) + '</span></td><td class="mini">' + esc(N.PROC[r.p.process]) + '</td>' +
          '<td class="mini">' + r.cur.map(function (s) { return s.ord + '. ' + esc(s.name) + (s.status === 'review' ? ' <span class="tag t-unk">на підтвердженні</span>' : ''); }).join('<br>') + (r.p.status !== 'active' ? esc({done: 'завершено', cancelled: 'скасовано'}[r.p.status] || '') : '') + '</td>' +
          '<td class="mini ' + (r.over ? 'overdue' : '') + '">' + r.cur.map(function (s) { return s.due_date ? A.dt(s.due_date) : ''; }).join('<br>') + '</td><td><div class="prog" style="width:90px"><div style="width:' + (r.total ? r.done * 100 / r.total : 0) + '%"></div></div><span class="mini">' + r.done + '/' + r.total + '</span></td>' +
          '<td class="mini">' + esc(r.p.manager || '—') + '<br>' + esc(N.DMA_SHORT[r.p.dept_code] || '') + '</td></tr>'; }).join('') + (rows.length ? '' : '<tr><td colspan="6"><div class="empty">Планів не знайдено.</div></td></tr>') + '</tbody></table></div>';
    A.render(A.shell('Плани дій (CRM)', 'Етапи робіт за бізнес-процесами; паралельні кроки виконуються одночасно', '', h), A.keep);
  });

  // ================================================================ судові рішення
  A.on(/^\/decisions$/, function (f) {
    var w = words(f.q), list = A.T('decisions').filter(function (d) {
      if (w.length && !match([d.case_no, d.proceeding_no, d.court, d.summary, d.assets_text, A.can('view_internal') ? d.erdr_no : ''].join(' '), w)) return false;
      if (f.dtype && d.dtype !== f.dtype) return false; if (f.effect && (d.effect || N.DECEFF[d.dtype]) !== f.effect) return false;
      if (f.from && (d.decision_date || '') < f.from) return false; if (f.to && (d.decision_date || '') > f.to) return false;
      if (f.nolink && (A.indexes.assetsByDec[d.id] || []).length) return false;
      return true;
    }).sort(function (a, b) { return (b.decision_date || '').localeCompare(a.decision_date || '') || b.id - a.id; });
    var pg = A.pageOf(list, f), q = Object.assign({}, f); delete q.page;
    var h = '<form class="filters" data-act="filter" data-base="/decisions"><input name="q" value="' + esc(f.q || '') + '" placeholder="№ справи, провадження, суд, текст" style="flex:1;min-width:240px">' + A.sel('dtype', D.DECISION_TYPES.map(function (x) { return [x[0], x[1]]; }), f.dtype, 'Усі види рішень') +
      A.sel('effect', Object.keys(D.EFFECT_NAME).map(function (k) { return [k, D.EFFECT_NAME[k]]; }), f.effect, 'Наслідок') + '<input type="date" name="from" value="' + esc(f.from || '') + '" title="Дата рішення з"><input type="date" name="to" value="' + esc(f.to || '') + '" title="по">' +
      A.sel('nolink', [['1', 'Не пов’язані з активами']], f.nolink, 'Зв’язок') + '<button class="btn">Знайти</button><button type="button" class="btn plain" data-click="reset" data-base="/decisions">Скинути все</button></form>' + A.pager(list.length, pg.page, '/decisions', q) +
      '<div class="wrap-tbl"><table><thead><tr><th>Дата</th><th>Вид рішення</th><th>Суд / справа</th><th>Активи</th><th>Виконання</th><th></th></tr></thead><tbody>' + pg.rows.map(function (d) { var ls = A.indexes.assetsByDec[d.id] || [];
        return '<tr><td class="nowrap">' + A.dt(d.decision_date) + '</td><td><a href="#/decision/' + d.id + '">' + esc(N.DEC[d.dtype] || d.dtype) + '</a><span class="sub">' + esc(N.EFF[d.effect || N.DECEFF[d.dtype]] || '') + '</span></td><td class="mini">' + esc(d.court || '') + (d.case_no ? '<br>справа ' + esc(d.case_no) : '') + '</td>' +
          '<td class="mini">' + ls.slice(0, 3).map(function (l) { var a = A.get('assets', l.asset_id); return a ? '<a href="#/asset/' + a.id + '">' + esc(a.asset_no) + '</a>' : ''; }).join(', ') + (ls.length > 3 ? ' +' + (ls.length - 3) : '') + (ls.length ? '' : '<span class="tag t-lim">не пов’язано</span>') + '</td><td class="mini">' + esc(d.execution || '') + '</td>' +
          '<td class="nowrap">' + (A.can('edit_decisions') ? '<a class="btn sm" href="#/decision/' + d.id + '/edit">Редагувати</a>' : '') + '</td></tr>'; }).join('') + (list.length ? '' : '<tr><td colspan="6"><div class="empty">Рішень не знайдено.</div></td></tr>') + '</tbody></table></div>';
    A.render(A.shell('Судові рішення', 'Реєстр ухвал і рішень; правовий стан активів визначається за хронологією', A.can('edit_decisions') ? '<a class="btn gold" href="#/decision/new">+ Судове рішення</a>' : '', h), A.keep);
  });
  A.on(/^\/decision\/(\d+)$/, function (id) {
    var d = A.get('decisions', +id); if (!d) return A.notFound();
    var ls = (A.indexes.assetsByDec[d.id] || []).map(function (l) { return [l, A.get('assets', l.asset_id)]; }).filter(function (x) { return x[1] && A.inScope(x[1]); });
    var act = (A.can('edit_decisions') ? '<a class="btn gold" href="#/decision/' + d.id + '/edit">Редагувати</a>' : '') + (A.can('delete_records') ? '<button class="btn danger" data-click="dec-del" data-id="' + d.id + '" data-confirm="Видалити судове рішення? Правовий стан пов’язаних активів буде перераховано.">Видалити</button>' : '') + '<a class="btn plain" href="#" data-click="back">Назад</a>';
    var h = '<div class="panel"><dl class="kv">' + dd('Вид рішення', N.DEC[d.dtype] || d.dtype) + dd('Наслідок для управління', N.EFF[d.effect || N.DECEFF[d.dtype]]) + dd('Обсяг арешту', N.SCOPE[d.arrest_scope]) + dd('Суд', d.court) + dd('Інстанція', d.instance) +
      dd('№ справи', d.case_no) + dd('№ провадження', d.proceeding_no) + (A.can('view_internal') ? dd('№ ЄРДР', d.erdr_no) : '') + dd('Дата рішення', A.dt(d.decision_date), true) + dd('Набрало законної сили', A.dt(d.effective_date), true) + dd('Надійшло до АРМА', A.dt(d.received_date), true) +
      dd('Вхідний №', d.inbox_no) + dd('Виконання', d.execution) + dd('Виконавець', d.executor) + dd('Орган прокуратури', d.prosecutor_body) + dd('Короткий зміст', d.summary) + dd('Активи (текст рішення)', d.assets_text) +
      (d.edrsr_url ? dd('ЄДРСР', '<a href="' + esc(d.edrsr_url) + '" target="_blank" rel="noopener">відкрити рішення</a>', true) : '') + dd('Примітка', d.note) + dd('Джерело', (d.source || '—') + (d.created_by ? ' · ' + d.created_by : '') + (d.created_at ? ' · ' + d.created_at : '')) + '</dl></div>' +
      '<h2>Пов’язані активи <span class="pill">' + ls.length + '</span></h2><div class="wrap-tbl"><table><thead><tr><th>№ активу</th><th>Найменування</th><th>Наслідок для активу</th><th>Правовий стан зараз</th></tr></thead><tbody>' + ls.map(function (x) { var a = x[1];
        return '<tr><td><a class="id" href="#/asset/' + a.id + '">' + esc(a.asset_no) + '</a></td><td><span class="clip">' + esc(a.name || '') + '</span></td><td class="mini">' + esc(N.EFF[x[0].effect || d.effect || N.DECEFF[d.dtype]] || '') + '</td><td>' + A.legal(a.legal_status) + '</td></tr>'; }).join('') + (ls.length ? '' : '<tr><td colspan="4"><div class="empty">Не пов’язано з активами.</div></td></tr>') + '</tbody></table></div>';
    A.render(A.shell(N.DEC[d.dtype] || 'Судове рішення', [A.dt(d.decision_date), d.court, d.case_no].filter(Boolean).join(' · '), act, h));
  });
  function decForm(d, aNos, back) {
    var F = A.field, S2 = A.fsel;
    return '<form data-act="dec-save" data-id="' + (d.id || '') + '" data-back="' + esc(back) + '"><fieldset><legend>Судове рішення</legend><div class="form-grid">' +
      S2('Вид рішення', 'dtype', D.DECISION_TYPES.map(function (x) { return [x[0], x[1]]; }), d.dtype, 1, '', 'wide') +
      S2('Наслідок для управління', 'effect', Object.keys(D.EFFECT_NAME).map(function (k) { return [k, D.EFFECT_NAME[k]]; }), d.effect, 0, 'Порожньо — за видом рішення', '', '', 'За видом рішення') + S2('Обсяг арешту', 'arrest_scope', D.ARREST_SCOPES, d.arrest_scope) +
      F('Суд', 'court', d.court) + F('Інстанція', 'instance', d.instance) + F('№ справи', 'case_no', d.case_no) + F('№ провадження', 'proceeding_no', d.proceeding_no) + (A.can('view_internal') ? F('№ ЄРДР', 'erdr_no', d.erdr_no) : '') +
      F('Дата рішення', 'decision_date', d.decision_date, 'date', 1) + F('Набрало законної сили', 'effective_date', d.effective_date, 'date') + F('Надійшло до АРМА', 'received_date', d.received_date, 'date') + F('Вхідний №', 'inbox_no', d.inbox_no) +
      S2('Виконання', 'execution', D.EXECUTION, d.execution) + F('Виконавець', 'executor', d.executor) + F('Орган прокуратури', 'prosecutor_body', d.prosecutor_body) + F('Посилання на ЄДРСР', 'edrsr_url', d.edrsr_url, 'url', 0, '', 'wide') +
      F('Короткий зміст', 'summary', d.summary, 'textarea', 0, '', 'wide') + F('Активи (як у тексті рішення)', 'assets_text', d.assets_text, 'textarea', 0, '', 'wide') + F('Примітка', 'note', d.note, 'textarea', 0, '', 'wide') + '</div></fieldset>' +
      '<fieldset><legend>Пов’язані активи</legend><div class="form-grid">' + F('Номери активів у Реєстрі', 'asset_nos', aNos.join('\n'), 'textarea', 0, 'По одному в рядку або через кому. Після збереження правовий стан цих активів буде перераховано за хронологією рішень.', 'wide') + '</div></fieldset>' +
      actionsBar(back, d.id ? 'Зберегти рішення' : 'Додати рішення') + '</form>';
  }
  A.on(/^\/decision\/new$/, function (f) {
    if (!A.can('edit_decisions')) return A.deny();
    var a = f.asset && A.get('assets', +f.asset);
    A.render(A.shell('Нове судове рішення', a ? 'для активу ' + a.asset_no : '', '', decForm({}, a ? [a.asset_no] : [], a ? '#/asset/' + a.id : '#/decisions')));
  });
  A.on(/^\/decision\/(\d+)\/edit$/, function (id, f) {
    if (!A.can('edit_decisions')) return A.deny(); var d = A.get('decisions', +id); if (!d) return A.notFound();
    var nosL = (A.indexes.assetsByDec[d.id] || []).map(function (l) { var a = A.get('assets', l.asset_id); return a && a.asset_no; }).filter(Boolean);
    A.render(A.shell('Редагування судового рішення', [A.dt(d.decision_date), d.court].filter(Boolean).join(' · '), '', decForm(d, nosL, f.back && /^\/asset\/\d+$/.test(f.back) ? '#' + f.back : '#/decision/' + d.id)));
  });
  A.ACT['dec-save'] = function (form, d) {
    var isNew = !form.dataset.id, old = isNew ? {} : A.get('decisions', +form.dataset.id), rec = clean(d), list = nos(rec.asset_nos); delete rec.asset_nos;
    if (!rec.dtype || !rec.decision_date) throw new Error('Вкажіть вид і дату рішення');
    var want = {}, miss = [], linkedByNo = {};
    if (!isNew) (A.indexes.assetsByDec[old.id] || []).forEach(function (l) { var la = A.get('assets', l.asset_id); if (la) linkedByNo[la.asset_no] = la; });
    // номер, уже пов’язаний з рішенням, лишається за тим самим активом (у Реєстрі бувають повтори номерів)
    list.forEach(function (no) { var a = linkedByNo[no] || A.indexes.byNo[no]; if (a) want[a.id] = 1; else miss.push(no); });
    if (miss.length && !confirm('Не знайдено в Реєстрі: ' + miss.join(', ') + '. Зберегти без них?')) return;
    var tx = A.tx(), did, links = isNew ? [] : (A.indexes.assetsByDec[old.id] || []), have = {}, affected = {};
    if (isNew) { did = A.tmpId(); rec.id = did; rec.source = 'Внесено вручну'; tx.put('decisions', rec); } else { did = old.id; diffPut(tx, 'decisions', old, rec); }
    links.forEach(function (l) { have[l.asset_id] = 1; affected[l.asset_id] = 1; if (!want[l.asset_id]) tx.del('decision_assets', l.id); });
    Object.keys(want).forEach(function (aid) { affected[aid] = 1; if (!have[aid]) tx.put('decision_assets', {id: A.tmpId(), decision_id: did, asset_id: +aid}); });
    tx.log(isNew ? 'Додано судове рішення' : 'Змінено судове рішення', 'decision', isNew ? null : did, {dtype: rec.dtype, assets: Object.keys(want).length});
    if (!tx.size()) { A.toast('Змін немає', 'info'); return A.go(form.dataset.back); }
    return tx.commit().then(function (r) { form.classList.remove('dirty'); return A.recalcLegal(Object.keys(affected).map(Number)).then(function (n) {
      A.toast('Рішення збережено' + (n ? '; правовий стан змінено для активів: ' + n : '')); A.go(isNew && !/asset/.test(form.dataset.back) ? '#/decision/' + r.id('decisions', did) : form.dataset.back); }); });
  };

  // ================================================================ оцінки
  A.valTarget = function (v) {
    if (v.target_type === 'group') return {href: '#/valuation/' + v.id, code: 'Групова', name: (A.indexes.vaByVal[v.id] || []).length + ' активів'};
    return A.targetOf(v.target_type, v.target_id) || {href: '#/valuation/' + v.id, code: v.asset_nos || '—', name: v.lot_name || ''};
  };
  A.on(/^\/valuations$/, function (f) {
    var w = words(f.q), list = A.T('valuations').filter(function (v) {
      if (w.length && !match([v.asset_nos, v.lot_name, v.procurement_id, v.report_no, v.appraiser, v.winner, v.executor_name].join(' '), w)) return false;
      if (f.status && v.status !== f.status) return false; if (f.cur === '1' && !v.is_current) return false; if (f.cur === '0' && v.is_current) return false;
      if (f.state && A.valState(v.value_date) !== f.state) return false; if (f.tt && (f.tt === 'none' ? v.target_type : v.target_type !== f.tt)) return false;
      if (f.src === 'inv' && !/^Інвентаризація/.test(v.source || '')) return false; if (f.src === 'rep' && /^Інвентаризація/.test(v.source || '')) return false;
      return true;
    }).sort(function (a, b) { return (b.value_date || b.procurement_date || '').localeCompare(a.value_date || a.procurement_date || '') || b.id - a.id; });
    var inv = function (v) { return /^Інвентаризація/.test(v.source || ''); }, cur = list.filter(function (v) { return v.is_current && v.value_uah; });
    var tot = cur.filter(function (v) { return !inv(v); }).reduce(function (s, v) { return s + v.value_uah; }, 0), totInv = cur.filter(inv).reduce(function (s, v) { return s + v.value_uah; }, 0), pg = A.pageOf(list, f), q = Object.assign({}, f); delete q.page;
    var h = '<div class="grid g5">' + A.kpi('Оцінок за фільтром', A.num(list.length), 'усього записів') + A.kpi('Портфель за актуальними оцінками', A.num(tot, 2) + ' ₴', 'звіти про оцінку (модуль оцінок); те саме значення — на «Огляді портфеля»') +
      A.kpi('Вартість з інвентаризації', A.num(totInv, 2) + ' ₴', 'довідково: суми з колонки оцінки в інвентаризації; у підсумок портфеля не входять, щоб не рахувати ті самі активи двічі', A.link('/valuations', {src: 'inv'})) +
      A.kpi('Чинні (до 6 міс.)', A.num(list.filter(function (v) { return A.valState(v.value_date) === 'valid'; }).length), 'звіт не старший 6 місяців', A.link('/valuations', {state: 'valid'})) +
      A.kpi('Прострочені', A.num(list.filter(function (v) { return A.valState(v.value_date) === 'expired'; }).length), 'потрібна нова оцінка', A.link('/valuations', {state: 'expired'}), 'overdue') + '</div>' +
      '<form class="filters" data-act="filter" data-base="/valuations" style="margin-top:14px"><input name="q" value="' + esc(f.q || '') + '" placeholder="№ активів, лот, закупівля, звіт, оцінювач" style="flex:1;min-width:240px">' + A.sel('status', D.VALUATION_STATUS, f.status, 'Статус') +
      A.sel('tt', [['asset', 'Актив'], ['pool', 'Пул'], ['group', 'Групова'], ['none', 'Не прив’язані до об’єкта']], f.tt, 'Об’єкт оцінки') + A.sel('cur', [['1', 'Актуальні'], ['0', 'Попередні']], f.cur, 'Актуальність') + A.sel('state', [['valid', 'Чинні'], ['expired', 'Понад 6 міс.'], ['none', 'Без дати']], f.state, 'Строк') + A.sel('src', [['rep', 'Звіти про оцінку'], ['inv', 'З інвентаризації (довідково)']], f.src, 'Джерело') +
      '<button class="btn">Знайти</button><button type="button" class="btn plain" data-click="reset" data-base="/valuations">Скинути все</button></form>' + A.pager(list.length, pg.page, '/valuations', q) +
      '<div class="wrap-tbl"><table><thead><tr><th>Об’єкт</th><th>Дата оцінки</th><th class="num">Вартість</th><th>Закупівля / лот</th><th>Звіт</th><th>Статус</th><th></th></tr></thead><tbody>' + pg.rows.map(function (v) { var tg = A.valTarget(v), st = A.valState(v.value_date);
        return '<tr><td style="max-width:300px"><a class="id" href="' + tg.href + '">' + esc(tg.code) + '</a><span class="sub clip">' + esc((tg.name || '').slice(0, 80)) + '</span></td><td class="nowrap">' + A.dt(v.value_date) + (st === 'expired' ? '<span class="sub overdue">понад 6 міс.</span>' : '') + '</td>' +
          '<td class="num nowrap">' + (v.value_uah ? A.money(v.value_uah, true) : '—') + '</td><td class="mini">' + esc(v.procurement_id || '') + (v.lot_no ? ' · лот ' + esc(v.lot_no) : '') + '<br>' + esc((v.lot_name || '').slice(0, 60)) + '</td><td class="mini">' + esc(v.report_no || '') + '<br>' + esc(v.appraiser || '') + '</td>' +
          '<td class="mini">' + esc(v.status || '') + (v.is_current ? ' <span class="tag t-ok">актуальна</span>' : '') + '</td><td class="nowrap"><a class="btn sm plain" href="#/valuation/' + v.id + '">Відкрити</a>' + (A.can('edit_valuations') ? ' <a class="btn sm" href="#/valuation/' + v.id + '/edit">Ред.</a>' : '') + '</td></tr>'; }).join('') +
      (list.length ? '' : '<tr><td colspan="7"><div class="empty">Оцінок не знайдено.</div></td></tr>') + '</tbody></table></div>';
    A.render(A.shell('Оцінки', 'Закупівлі послуг з оцінки, звіти, актуальна вартість активів і пулів', A.can('edit_valuations') ? '<a class="btn gold" href="#/valuation/new">+ Оцінка</a>' : '', h), A.keep);
  });
  A.on(/^\/valuation\/(\d+)$/, function (id) {
    var v = A.get('valuations', +id); if (!v) return A.notFound(); var tg = A.valTarget(v), st = A.valState(v.value_date);
    var grp = (A.indexes.vaByVal[v.id] || []).map(function (l) { return A.get('assets', l.asset_id); }).filter(function (a) { return a && A.inScope(a); });
    var act = (A.can('edit_valuations') ? '<a class="btn gold" href="#/valuation/' + v.id + '/edit">Редагувати</a>' : '') + (A.can('edit_valuations') || A.can('delete_records') ? '<button class="btn danger" data-click="val-del" data-id="' + v.id + '" data-confirm="Видалити оцінку?">Видалити</button>' : '') + '<a class="btn plain" href="#" data-click="back">Назад</a>';
    var h = '<div class="grid g3">' + A.kpi('Вартість', v.value_uah ? A.money(v.value_uah, true) : '—', v.value_date ? 'станом на ' + A.dt(v.value_date) : '') + A.kpi('Строк дії', st === 'valid' ? 'Чинна' : st === 'expired' ? 'Понад 6 міс.' : '—', 'звіт не старший 6 місяців', null, st === 'expired' ? 'overdue' : '') +
      A.kpi('Об’єкт', '<a href="' + tg.href + '">' + esc(tg.code) + '</a>', tg.name || '') + '</div><div class="panel" style="margin-top:14px"><dl class="kv">' + dd('Статус', (v.status || '—') + (v.is_current ? ' · актуальна' : ' · попередня')) + dd('Номери активів', v.asset_nos) + dd('Лот', [v.lot_no, v.lot_name].filter(Boolean).join(' · ')) +
      dd('Ідентифікатор закупівлі', v.procurement_id) + dd('Інформація про закупівлю', v.procurement_info) + dd('Дата закупівлі', A.dt(v.procurement_date), true) + dd('Учасники', v.participants) + dd('Виконавець закупівлі', v.executor_name) +
      dd('Очікувана вартість послуг', v.expected_cost ? A.money(v.expected_cost, true) : '') + dd('Вартість договору', v.contract_cost ? A.money(v.contract_cost, true) : '') + dd('Переможець', v.winner) + (A.can('view_internal') ? dd('Контакти переможця', v.winner_contacts) : '') + dd('Реквізити договору', v.contract_req) +
      dd('Дата рішення', A.dt(v.decision_date), true) + dd('Попередня оцінка', v.prev_value ? A.money(v.prev_value, true) + (v.prev_date ? ' на ' + A.dt(v.prev_date) : '') : '') + dd('№ звіту', v.report_no) + dd('Дата затвердження', A.dt(v.approved_date), true) + dd('Строк надання послуг', v.service_term) +
      dd('Оцінювач', v.appraiser) + dd('Примітка', v.note) + dd('Джерело', v.source) + '</dl></div>';
    if (v.target_type === 'group') h += '<h2>Активи групової оцінки <span class="pill">' + grp.length + '</span></h2>' + A.assetTable(grp);
    A.render(A.shell('Оцінка · ' + tg.code, v.lot_name || '', act, h));
  });
  function valForm(v, back) {
    var F = A.field, S2 = A.fsel, tgt = v.target_type === 'pool' ? (A.get('pools', v.target_id) || {}).code : v.target_type === 'asset' ? (A.get('assets', v.target_id) || {}).asset_no : '';
    var grpNos = (A.indexes.vaByVal[v.id] || []).map(function (l) { var a = A.get('assets', l.asset_id); return a && a.asset_no; }).filter(Boolean);
    return '<form data-act="val-save" data-id="' + (v.id || '') + '" data-back="' + esc(back) + '"><fieldset><legend>Об’єкт оцінки</legend><div class="form-grid">' +
      S2('Тип об’єкта', 'target_type', [['asset', 'Актив'], ['pool', 'Пул активів'], ['group', 'Групова оцінка (кілька активів)']], v.target_type || 'asset', 1) + F('№ активу або код пулу', 'target_code', tgt, 'text', 0, 'для активу або пулу') +
      F('Номери активів (групова оцінка)', 'group_nos', grpNos.join('\n'), 'textarea', 0, 'для групової оцінки — по одному в рядку', 'wide') + '</div></fieldset>' +
      '<fieldset><legend>Закупівля послуг з оцінки</legend><div class="form-grid">' + F('№ лоту', 'lot_no', v.lot_no) + F('Назва лоту', 'lot_name', v.lot_name, 'text', 0, '', 'wide') + F('Ідентифікатор закупівлі', 'procurement_id', v.procurement_id) + F('Дата закупівлі', 'procurement_date', v.procurement_date, 'date') +
      F('Інформація про закупівлю', 'procurement_info', v.procurement_info, 'text', 0, '', 'wide') + F('Учасники', 'participants', v.participants, 'textarea', 0, '', 'wide') + F('Виконавець закупівлі', 'executor_name', v.executor_name) + F('Очікувана вартість послуг, грн', 'expected_cost', v.expected_cost) +
      F('Вартість договору, грн', 'contract_cost', v.contract_cost) + F('Переможець', 'winner', v.winner) + (A.can('view_internal') ? F('Контакти переможця', 'winner_contacts', v.winner_contacts) : '') + F('Реквізити договору', 'contract_req', v.contract_req) + F('Строк надання послуг', 'service_term', v.service_term) + '</div></fieldset>' +
      '<fieldset><legend>Результат оцінки</legend><div class="form-grid">' + F('Вартість за звітом, грн', 'value_uah', v.value_uah, 'text', 0, '', '', 'inputmode="decimal"') + F('Дата оцінки', 'value_date', v.value_date, 'date') + F('№ звіту', 'report_no', v.report_no) + F('Дата затвердження', 'approved_date', v.approved_date, 'date') +
      F('Оцінювач', 'appraiser', v.appraiser) + F('Дата рішення', 'decision_date', v.decision_date, 'date') + F('Попередня вартість, грн', 'prev_value', v.prev_value) + F('Дата попередньої оцінки', 'prev_date', v.prev_date, 'date') + S2('Статус', 'status', D.VALUATION_STATUS, v.status) +
      S2('Актуальна оцінка', 'is_current', [['1', 'Так — використовувати як поточну вартість'], ['0', 'Ні — попередня / довідкова']], v.is_current === 0 ? '0' : '1', 0, '', '', '', null) + F('Примітка', 'note', v.note, 'textarea', 0, '', 'wide') + '</div></fieldset>' +
      actionsBar(back, v.id ? 'Зберегти оцінку' : 'Додати оцінку') + '</form>';
  }
  A.on(/^\/valuation\/new$/, function (f) {
    if (!A.can('edit_valuations')) return A.deny();
    var v = {target_type: f.tt || 'asset', target_id: f.tid ? +f.tid : null, is_current: 1}, back = f.tt === 'pool' ? '#/pool/' + f.tid : f.tt === 'asset' ? '#/asset/' + f.tid : '#/valuations';
    A.render(A.shell('Нова оцінка', '', '', valForm(v, back)));
  });
  A.on(/^\/valuation\/(\d+)\/edit$/, function (id) { if (!A.can('edit_valuations')) return A.deny(); var v = A.get('valuations', +id); if (!v) return A.notFound(); A.render(A.shell('Редагування оцінки', v.lot_name || '', '', valForm(v, '#/valuation/' + v.id))); });
  A.ACT['val-save'] = function (form, d) {
    var isNew = !form.dataset.id, old = isNew ? {} : A.get('valuations', +form.dataset.id), rec = clean(d, ['value_uah', 'expected_cost', 'contract_cost', 'prev_value']);
    var code = rec.target_code, gn = nos(rec.group_nos); delete rec.target_code; delete rec.group_nos; rec.is_current = +rec.is_current;
    var tt = rec.target_type, tid = null, ids = [];
    if (tt === 'asset') { var a = A.indexes.byNo[code]; if (!a) throw new Error('Актив «' + (code || '') + '» не знайдено'); tid = a.id; rec.asset_nos = a.asset_no; }
    else if (tt === 'pool') { var p = A.T('pools').filter(function (x) { return x.code === code; })[0]; if (!p) throw new Error('Пул «' + (code || '') + '» не знайдено'); tid = p.id; }
    else { gn.forEach(function (no) { var x = A.indexes.byNo[no]; if (x) ids.push(x.id); }); if (!ids.length) throw new Error('Вкажіть номери активів групової оцінки'); rec.asset_nos = gn.join(', '); rec.assets_count = ids.length; }
    rec.target_id = tid;
    var tx = A.tx(), vid;
    if (isNew) { vid = A.tmpId(); rec.id = vid; rec.source = 'Внесено вручну'; tx.put('valuations', rec); } else { vid = old.id; diffPut(tx, 'valuations', old, rec); }
    if (rec.is_current && tt !== 'group') A.T('valuations').forEach(function (x) { if (x.id !== old.id && x.target_type === tt && x.target_id === tid && x.is_current && rec.value_uah) tx.put('valuations', {id: x.id, is_current: 0}); });
    var affected = {}; if (tt === 'group' || old.target_type === 'group') {
      var cur = {}; (A.indexes.vaByVal[old.id] || []).forEach(function (l) { cur[l.asset_id] = l; affected[l.asset_id] = 1; });
      ids.forEach(function (i) { affected[i] = 1; if (!cur[i]) tx.put('valuation_assets', {id: A.tmpId(), valuation_id: vid, asset_id: i}); else delete cur[i]; });
      Object.keys(cur).forEach(function (k) { tx.del('valuation_assets', cur[k].id); });
    }
    tx.log(isNew ? 'Додано оцінку' : 'Змінено оцінку', 'valuation', isNew ? null : vid, {value: rec.value_uah});
    return tx.commit().then(function (r) {
      form.classList.remove('dirty');
      var jobs = [A.refreshValCache(tt, tid)]; if (old.target_type && (old.target_type !== tt || old.target_id !== tid)) jobs.push(A.refreshValCache(old.target_type, old.target_id));
      Object.keys(affected).forEach(function (i) { jobs.push(A.refreshValCache('asset', +i)); });
      return jobs.reduce(function (p, j) { return p.then(function () { return j; }); }, Promise.resolve()).then(function () { A.toast('Оцінку збережено'); A.go(isNew && form.dataset.back === '#/valuations' ? '#/valuation/' + r.id('valuations', vid) : form.dataset.back); });
    });
  };

  // ================================================================ товариства (корпоративні права)
  var CS_CSS = D.COMPANY_STATUS_CSS || {};
  A.companyStatus = function (s) { return s ? '<span class="tag t-' + (CS_CSS[s] || 'unk') + '">' + esc(s) + '</span>' : '<span class="tag t-unk">Не визначено</span>'; };
  function companyAssets(code) { return A.T('assets').filter(function (a) { return (a.company_code === code || a.owner_code === code) && A.inScope(a); }); }
  A.on(/^\/companies$/, function (f) {
    var cnt = {}; A.T('assets').forEach(function (a) { if (a.company_code && A.inScope(a)) cnt[a.company_code] = (cnt[a.company_code] || 0) + 1; });
    var list = A.T('companies').slice(), have = {}; list.forEach(function (c) { have[c.edrpou] = 1; });
    Object.keys(cnt).forEach(function (k) { if (!have[k]) { var a = A.T('assets').filter(function (x) { return x.company_code === k; })[0]; list.push({id: null, edrpou: k, name: (a.details || {}).company_name || a.name, status: null}); } });
    var w = words(f.q);
    list = list.filter(function (c) { if (w.length && !match([c.edrpou, c.name, c.kved, c.kved_name, c.director, c.address].join(' '), w)) return false;
      if (f.dup && !(c.share_total > 100.01)) return false;
      if (f.cstatus && (c.status || 'Не визначено') !== f.cstatus) return false; if (f.dept && c.dept_code !== f.dept) return false; if (f.kved && (c.kved || '').slice(0, 2) !== f.kved) return false; return true; })
      .sort(function (a, b) { return (cnt[b.edrpou] || 0) - (cnt[a.edrpou] || 0) || (a.name || '').localeCompare(b.name || ''); });
    var pg = A.pageOf(list, f), q = Object.assign({}, f), divs = A.json(S.settings.kved_divisions); delete q.page;
    var h = '<form class="filters" data-act="filter" data-base="/companies"><input name="q" value="' + esc(f.q || '') + '" placeholder="ЄДРПОУ, назва, КВЕД, керівник, адреса" style="flex:1;min-width:240px">' + A.sel('cstatus', D.COMPANY_STATUS, f.cstatus, 'Стан юридичної особи') + A.sel('dept', D.DMA, f.dept, 'Відділ ДМА') + A.sel('dup', [['1', 'Сума часток > 100 % (задвоєння)']], f.dup, 'Перевірка часток') +
      (f.kved ? '<input type="hidden" name="kved" value="' + esc(f.kved) + '">' : '') + '<button class="btn">Знайти</button><button type="button" class="btn plain" data-click="reset" data-base="/companies">Скинути все</button></form>' + A.pager(list.length, pg.page, '/companies', q) +
      '<div class="wrap-tbl"><table><thead><tr><th>ЄДРПОУ</th><th>Найменування</th><th>Стан</th><th>КВЕД</th><th class="num">Частка АРМА</th><th class="num">Активів</th><th>Відділ ДМА</th></tr></thead><tbody>' + pg.rows.map(function (c) {
        return '<tr><td class="mono"><a href="#/company/' + esc(c.edrpou) + '">' + esc(c.edrpou) + '</a></td><td><span class="clip" title="' + esc(c.name) + '">' + esc(c.name || '') + '</span>' + (c.foreign_country ? '<span class="sub">' + esc(c.foreign_country) + '</span>' : '') + '</td><td>' + A.companyStatus(c.status) + '</td>' +
          '<td class="mini">' + esc(c.kved || '') + (c.kved_name ? '<br>' + esc(c.kved_name) : c.kved ? '<br>' + esc(divs[(c.kved || '').slice(0, 2)] || '') : '') + '</td><td class="num">' + (c.share_total ? A.num(c.share_total, 2) + ' %' : '—') + (c.share_total > 100.01 ? '<span class="sub"><span class="tag t-lost" title="Сума часток за записами Реєстру перевищує 100 % — ймовірне задвоєння записів">перевірити</span></span>' : '') + '</td><td class="num"><a href="' + A.link('/assets', {company: c.edrpou}) + '">' + (cnt[c.edrpou] || 0) + '</a></td><td class="mini">' + esc(N.DMA_SHORT[c.dept_code] || '—') + '</td></tr>'; }).join('') +
      (list.length ? '' : '<tr><td colspan="7"><div class="empty">Товариств не знайдено.</div></td></tr>') + '</tbody></table></div>';
    A.render(A.shell('Товариства (корпоративні права)', 'Картки юридичних осіб, частки в яких передано АРМА', '', h), A.keep);
  });
  A.on(/^\/company\/([^/]+)$/, function (code) {
    code = decodeURIComponent(code); var c = A.indexes.comp[code], as = companyAssets(code);
    if (!c && !as.length) return A.notFound(); c = c || {edrpou: code, name: ((as[0] || {}).details || {}).company_name || (as[0] || {}).name};
    var ed = A.can('edit_corp_extra'), divs = A.json(S.settings.kved_divisions), share = as.reduce(function (s, a) { return s + (Number((a.details || {}).share_pct) || 0); }, 0);
    var act = (ed ? '<a class="btn gold" href="#/company/' + esc(code) + '/edit">Редагувати картку</a>' : '') + '<a class="btn" href="' + esc(D.YOUCONTROL_URL.replace('{}', code)) + '" target="_blank" rel="noopener">YouControl</a><a class="btn plain" href="#/companies">До переліку</a>';
    var h = '<div class="grid g4">' + A.kpi('Стан юридичної особи', A.companyStatus(c.status), 'вноситься вручну за даними ЄДР / YouControl') + A.kpi('Частка АРМА', (c.share_total || share) > 100.01 ? '<span class="overdue">' + A.num(c.share_total || share, 2) + ' %</span>' : c.share_total ? A.num(c.share_total, 2) + ' %' : share ? A.num(share, 2) + ' %' : '—', (c.share_total || share) > 100.01 ? 'сума за записами перевищує 100 % — ймовірне задвоєння записів, перевірте перелік нижче' : 'у статутному капіталі') +
      A.kpi('Статутний капітал', c.capital ? A.money(c.capital, true) : '—', '') + A.kpi('Активів у Реєстрі', A.num(as.length), 'корпоративні права та інше майно товариства') + '</div>' +
      '<div class="grid g2" style="margin-top:14px"><div class="panel"><h3>Реєстраційні відомості</h3><dl class="kv">' + dd('Код ЄДРПОУ', '<span class="mono">' + esc(code) + '</span>', true) + dd('Найменування', c.name) + dd('Організаційно-правова форма', c.legal_form) + dd('Дата реєстрації', A.dt(c.reg_date), true) +
      dd('Статутний капітал', c.capital ? A.money(c.capital, true) : '') + dd('Основний КВЕД', [c.kved, c.kved_name || divs[(c.kved || '').slice(0, 2)]].filter(Boolean).join(' — ')) + dd('Види діяльності', c.activities) + dd('Юридична адреса', c.address) + dd('Країна (для нерезидентів)', c.foreign_country) + '</dl></div>' +
      '<div class="panel"><h3>Управління і контроль</h3><dl class="kv">' + dd('Керівник', c.director) + dd('Кінцеві бенефіціари', c.beneficiaries) + dd('Кількість працівників', c.employees) + dd('Фінансові показники', c.finance) + dd('Ризики', c.risks) +
      dd('Відділ ДМА', N.DMA[c.dept_code] || 'Не закріплено') + dd('Аналітична довідка', c.analytics_note) + dd('Додатково', c.extra) + dd('Оновлено', (c.updated_at || '—') + (c.updated_by ? ' · ' + c.updated_by : '')) + '</dl></div></div>' +
      '<h2>Активи цієї компанії в Реєстрі <span class="pill">' + as.length + '</span></h2>' + A.assetTable(as.slice(0, 200)) + (as.length > 200 ? '<p><a href="' + A.link('/assets', {company: code}) + '">Усі ' + as.length + ' активів →</a></p>' : '') +
      (c.id ? '<div style="margin-top:14px">' + A.docsBlock('company', c.id, ed, ['registry_extract', 'mgmt_contract', 'valuation_report', 'other']) + '</div>' : '');
    A.render(A.shell(c.name || code, 'ЄДРПОУ ' + code, act, h));
  });
  A.on(/^\/company\/([^/]+)\/edit$/, function (code) {
    if (!A.can('edit_corp_extra')) return A.deny(); code = decodeURIComponent(code); var c = A.indexes.comp[code] || {edrpou: code, name: ((companyAssets(code)[0] || {}).details || {}).company_name};
    var F = A.field, S2 = A.fsel;
    var h = '<form data-act="company-save" data-code="' + esc(code) + '"><fieldset><legend>Реєстраційні відомості</legend><div class="form-grid">' + F('Найменування', 'name', c.name, 'text', 1, '', 'wide') + S2('Стан юридичної особи', 'status', D.COMPANY_STATUS, c.status, 0, 'діюча / в стані припинення / банкрутство / припинено') +
      F('Організаційно-правова форма', 'legal_form', c.legal_form) + F('Дата реєстрації', 'reg_date', c.reg_date, 'date') + F('Статутний капітал, грн', 'capital', c.capital) + F('Частка АРМА, %', 'share_total', c.share_total) + F('Основний КВЕД (код)', 'kved', c.kved, 'text', 0, 'напр., 68.20') +
      F('Назва КВЕД', 'kved_name', c.kved_name) + F('Види діяльності', 'activities', c.activities, 'textarea', 0, '', 'wide') + F('Юридична адреса', 'address', c.address, 'text', 0, '', 'wide') + F('Країна (для нерезидентів)', 'foreign_country', c.foreign_country) + '</div></fieldset>' +
      '<fieldset><legend>Управління і контроль</legend><div class="form-grid">' + F('Керівник', 'director', c.director) + F('Кінцеві бенефіціари', 'beneficiaries', c.beneficiaries, 'textarea', 0, '', 'wide') + F('Кількість працівників', 'employees', c.employees) + S2('Відділ ДМА', 'dept_code', D.DMA, c.dept_code) +
      F('Фінансові показники', 'finance', c.finance, 'textarea', 0, '', 'wide') + F('Ризики', 'risks', c.risks, 'textarea', 0, '', 'wide') + F('Аналітична довідка', 'analytics_note', c.analytics_note, 'textarea', 0, '', 'wide big') + F('Додатково', 'extra', c.extra, 'textarea', 0, '', 'wide') + '</div></fieldset>' +
      actionsBar('#/company/' + esc(code), 'Зберегти картку') + '</form>';
    A.render(A.shell('Картка товариства', 'ЄДРПОУ ' + code, '', h));
  });
  A.ACT['company-save'] = function (form, d) {
    var code = form.dataset.code, c = A.indexes.comp[code], rec = clean(d, ['capital', 'share_total']), tx = A.tx();
    rec.updated_by = S.user && S.user.login; rec.updated_at = A.nowS();
    if (c) diffPut(tx, 'companies', c, rec); else { rec.id = A.tmpId(); rec.edrpou = code; tx.put('companies', rec); }
    tx.log('Змінено картку товариства', 'company', code);
    return tx.commit().then(function () { form.classList.remove('dirty'); A.toast('Картку збережено'); A.go('#/company/' + encodeURIComponent(code)); });
  };
})();
