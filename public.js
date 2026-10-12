/* Публічний сайт активів АРМА (маркетплейс): каталог за типами активів, пошук і фільтри, картка лота, пули як
   зведені лоти, вподобання, обране, кабінет відвідувача, запити на документи, зворотний зв’язок.
   Той самий файл працює на сервері (API /api/public/…) і в дзеркалі GitHub (data-public.json, дії — у браузері). */
(function () {
  'use strict';
  var MODE = window.ARMA_MODE || 'static', API = window.ARMA_API || '', CSRF = window.ARMA_CSRF || '', ST = window.ARMA_STATIC || '';
  var $ = document.getElementById('pub'), esc = function (s) { return s === null || s === undefined ? '' : String(s).replace(/[&<>"']/g, function (c) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]; }); };
  var CATS = [['realestate', 'Нерухомість', '🏢'], ['land', 'Земельні ділянки', '🌾'], ['transport', 'Транспорт і техніка', '🚚'], ['property', 'Рухоме майно', '📦'], ['corporate', 'Корпоративні права', '🏭'], ['pool', 'Комплекси і пули', '🧩']];
  var CN = {}; CATS.forEach(function (c) { CN[c[0]] = c; });
  var REGIONS = (window.D && window.D.REGIONS) || [];
  var DATA = null, ME = {user: null, likes: [], favorites: [], requests: []}, MEDIA = {thumbs: null, views: null};
  var PER = 24, LAST = null;
  function num(v, d) { if (v === null || v === undefined || v === '') return '—'; v = Number(v); if (isNaN(v)) return esc(v); var s = v.toFixed(d || 0).split('.'); s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' '); return s.join(','); }
  function money(v) { if (!v) return null; v = Number(v); if (v >= 1e9) return num(v / 1e9, 2) + ' млрд ₴'; if (v >= 1e6) return num(v / 1e6, 2) + ' млн ₴'; return num(v) + ' ₴'; }
  function dt(v) { var m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '.' + m[2] + '.' + m[1] : ''; }
  function toast(m) { var b = document.querySelector('.p-toast'); if (!b) { b = document.createElement('div'); b.className = 'p-toast'; document.body.appendChild(b); } var d = document.createElement('div'); d.textContent = m; b.appendChild(d); setTimeout(function () { d.remove(); }, 4500); }
  function params() { var q = location.hash.split('?')[1] || '', o = {}; q.split('&').forEach(function (kv) { if (!kv) return; var p = kv.split('='); o[decodeURIComponent(p[0])] = decodeURIComponent((p[1] || '').replace(/\+/g, ' ')); }); return o; }
  function link(path, o) { var p = []; for (var k in o) if (o[k] !== undefined && o[k] !== null && o[k] !== '') p.push(encodeURIComponent(k) + '=' + encodeURIComponent(o[k])); return '#' + path + (p.length ? '?' + p.join('&') : ''); }
  function setting(k, d) { return (DATA && DATA.settings && DATA.settings[k]) || d; }

  // ---------------------------------------------------------------- джерело даних (сервер / дзеркало)
  var LS = {get: function () { try { return JSON.parse(localStorage.getItem('arma-pub') || '{}'); } catch (e) { return {}; } }, set: function (o) { try { localStorage.setItem('arma-pub', JSON.stringify(o)); } catch (e) { /* приватний режим */ } }};
  var src = MODE === 'server' ? {
    catalog: function () { return fetch(API + '/api/public/catalog', {credentials: 'same-origin'}).then(function (r) { return r.json(); }); },
    me: function () { return fetch(API + '/api/public/me', {credentials: 'same-origin'}).then(function (r) { return r.json(); }); },
    post: function (p, b) { return fetch(API + '/api/public/' + p, {method: 'POST', credentials: 'same-origin', headers: {'Content-Type': 'application/json', 'X-CSRF': CSRF}, body: JSON.stringify(b || {})}).then(function (r) { return r.json().catch(function () { return {ok: false, error: 'Помилка ' + r.status}; }); }); },
    photo: function (id, v) { return API + '/api/public/photo/' + id + '/' + v; },
    doc: function (id) { return API + '/api/public/doc/' + id; }
  } : {
    catalog: function () { return fetch(ST + 'data-public.json', {cache: 'no-cache'}).then(function (r) { if (!r.ok) throw new Error('data-public.json'); return r.json(); }); },
    me: function () { var s = LS.get(); return Promise.resolve({user: s.user || null, likes: s.likes || [], favorites: s.user ? s.favorites || [] : [], requests: s.user ? s.requests || [] : []}); },
    post: function (p, b) {
      var s = LS.get(), k = function (x) { return x.item_type === b.type && x.item_id === b.id; };
      s.likes = s.likes || []; s.favorites = s.favorites || []; s.requests = s.requests || []; var res = {ok: true};
      if (p === 'like') { var had = s.likes.some(k); s.likes = had ? s.likes.filter(function (x) { return !k(x); }) : s.likes.concat([{item_type: b.type, item_id: b.id}]); res.liked = !had; var it = find(b.type, b.id); if (it) { it.likes = Math.max(0, (it.likes || 0) + (had ? -1 : 1)); res.likes = it.likes; } }
      else if (p === 'fav') { if (!s.user) return Promise.resolve({ok: false, error: 'Увійдіть до кабінету, щоб додавати лоти в обране'}); var hf = s.favorites.some(k); s.favorites = hf ? s.favorites.filter(function (x) { return !k(x); }) : s.favorites.concat([{item_type: b.type, item_id: b.id}]); res.fav = !hf; }
      else if (p === 'register' || p === 'login') { if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(b.email || '')) return Promise.resolve({ok: false, error: 'Вкажіть коректний e-mail'}); if (p === 'register' && !b.consent) return Promise.resolve({ok: false, error: 'Потрібна згода на обробку персональних даних'}); s.user = {email: b.email, name: b.name || (s.user || {}).name || '', org: b.org || '', phone: b.phone || ''}; }
      else if (p === 'logout') s.user = null;
      else if (p === 'request') { if (!s.user) return Promise.resolve({ok: false, error: 'Увійдіть до кабінету, щоб запросити документи'}); s.requests.unshift({id: Date.now(), item_type: b.type, item_id: b.id, message: b.message, status: 'new', created_at: new Date().toISOString().slice(0, 16).replace('T', ' ')}); }
      else if (p === 'feedback') { if (!b.consent) return Promise.resolve({ok: false, error: 'Потрібна згода на обробку персональних даних'}); res.mirror = true; }
      LS.set(s); return Promise.resolve(res);
    },
    photo: function (id, v) { var m = v === 'thumb' ? MEDIA.thumbs : MEDIA.views; return (m && m[id]) || (MEDIA.thumbs && MEDIA.thumbs[id]) || ''; },
    doc: function () { return null; }
  };
  function loadMedia() { if (MODE === 'server' || MEDIA.thumbs) return Promise.resolve(); var g = function (f) { return fetch(ST + f).then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }); };
    return Promise.all([g('data-thumbs.json'), g('data-views.json')]).then(function (r) { MEDIA.thumbs = r[0]; MEDIA.views = r[1]; }); }
  function find(t, id) { return (DATA.items || []).filter(function (x) { return x.type === t && x.id === id; })[0]; }
  function has(list, it) { return (list || []).some(function (x) { return x.item_type === it.type && x.item_id === it.id; }); }
  function refreshMe() { return src.me().then(function (m) { ME = m; }); }

  // ---------------------------------------------------------------- каркас
  function shell(content, cat) {
    var f = params(), u = ME.user, favN = (ME.favorites || []).length;
    return (MODE === 'static' ? '<div class="mirror-note">Дзеркало публічного сайту для перевірки. Дані знеособлено; реєстрація, обране і запити зберігаються лише у вашому браузері.' + (DATA && DATA.demo ? ' Лоти — демонстраційна вибірка з активів, публічних за критерієм (на робочому сайті показуються лише опубліковані адміністратором).' : '') + '</div>' : '') +
      '<header class="top"><div class="wrap"><a class="logo" href="#/"><img src="' + ST + 'logo.png" alt="АРМА"><span>Активи АРМА<small>Національне агентство з питань виявлення, розшуку та управління активами</small></span></a>' +
      '<form class="top-search" data-f="search"><input name="q" value="' + esc(f.q || '') + '" placeholder="Пошук: квартира Київ, автомобіль, земельна ділянка…"><button>Знайти</button></form><div class="top-act">' +
      '<a class="pbtn sm" href="#/cabinet?tab=fav" title="Обране">♥ <span class="cnt"' + (favN ? '' : ' style="display:none"') + '>' + favN + '</span></a>' +
      (u ? '<a class="pbtn sm" href="#/cabinet">👤 ' + esc((u.name || u.email).split(' ')[0]) + '</a>' : '<a class="pbtn sm main" href="#/login">Увійти</a>') + '</div></div></header>' +
      '<nav class="cats"><div class="wrap"><a href="#/" class="' + (!cat && /^#?\/?$/.test(location.hash.split('?')[0].replace('#', '')) ? 'on' : '') + '">Головна</a>' + CATS.map(function (c) { return '<a href="' + link('/search', {cat: c[0]}) + '" class="' + (cat === c[0] ? 'on' : '') + '">' + c[2] + ' ' + esc(c[1]) + '</a>'; }).join('') +
      '<a href="#/feedback">Зворотний зв’язок</a></div></nav><main>' + content + '</main>' +
      '<footer><div class="wrap"><div><b>Національне агентство з питань виявлення, розшуку та управління активами, одержаними від корупційних та інших злочинів (АРМА)</b><br>Каталог активів, переданих в управління АРМА' + (DATA && DATA.built ? ' · дані на ' + esc(DATA.built) : '') + '</div>' +
      '<div><a href="' + esc(setting('public_contacts_url', 'https://arma.gov.ua/contacts')) + '" target="_blank" rel="noopener">Контакти АРМА</a><br><a href="' + esc(setting('public_privacy_url', 'https://arma.gov.ua/page/obrobka-personalnih-danih-subektiv-dani-yakih-obroblyayutsya-v-arma')) + '" target="_blank" rel="noopener">Обробка персональних даних</a><br><a href="#/feedback">Форма зворотного зв’язку</a></div></div></footer>';
  }
  function render(h, cat) { $.innerHTML = shell(h, cat); window.scrollTo(0, 0); bind(); }
  function catOf(it) { return it.type === 'pool' ? 'pool' : it.category; }
  function photo(it, v) { var id = (it.photos || [])[0]; return id ? src.photo(id, v || 'thumb') : ''; }
  function card(it) {
    var c = CN[catOf(it)] || ['', '', '🏷'], ph = photo(it), pr = money(it.price), liked = has(ME.likes, it), fav = has(ME.favorites, it);
    var area = it.area_sqm ? num(it.area_sqm, 1) + ' м²' : it.area_ha ? num(it.area_ha, 4) + ' га' : it.count ? it.count + ' активів' : '';
    return '<a class="card" href="#/lot/' + it.type + '/' + it.id + '"><div class="ph">' + (ph ? '<img src="' + esc(ph) + '" alt="" loading="lazy">' : c[2]) + '<span class="badge ' + (it.type === 'pool' ? 'pool' : '') + '">' + esc(it.type === 'pool' ? 'Пул · ' + (it.count || '') + ' акт.' : c[1]) + '</span>' +
      '<button class="heart ' + (fav ? 'on' : '') + '" data-fav="' + it.type + ':' + it.id + '" title="В обране">' + (fav ? '♥' : '♡') + '</button>' + ((it.photos || []).length > 1 ? '<span class="nph">📷 ' + it.photos.length + '</span>' : '') + '</div>' +
      '<div class="bd"><div class="tt" title="' + esc(it.title) + '">' + esc(it.title) + '</div><div class="pl">📍 ' + esc(it.place || it.region || 'Україна') + '</div>' + (area || it.way ? '<div class="chips">' + (area ? '<span class="chip">' + area + '</span>' : '') + (it.way ? '<span class="chip">' + esc(it.way.replace(/\s*\(.*\)/, '')) + '</span>' : '') + '</div>' : '') +
      '<div class="pr">' + (pr ? pr + '<small>оціночна вартість' + (it.price_date ? ' на ' + dt(it.price_date) : '') + '</small>' : '<small>ціна — на Prozorro.Продажі</small>') + '</div><div class="meta"><span>👁 ' + (it.views || 0) + '</span><span>' + (liked ? '❤' : '🤍') + ' ' + (it.likes || 0) + '</span>' + (it.prozorro_id ? '<span>Prozorro</span>' : '') + '</div></div></a>';
  }
  function filterItems(f) {
    var w = (f.q || '').toLowerCase().split(/\s+/).filter(Boolean), favs = f.fav ? ME.favorites : null;
    var l = (DATA.items || []).filter(function (it) {
      if (f.cat && catOf(it) !== f.cat) return false; if (f.region && it.region !== f.region) return false; if (f.way && (it.way || '') .indexOf(f.way) < 0) return false;
      if (f.ph && !(it.photos || []).length) return false; if (f.pz && !it.prozorro_id) return false;
      if (f.pmin && (it.price || 0) < +f.pmin) return false; if (f.pmax && (!it.price || it.price > +f.pmax)) return false;
      if (f.amin && (it.area_sqm || (it.area_ha || 0) * 10000 || 0) < +f.amin) return false;
      if (favs && !has(favs, it)) return false;
      if (w.length) { var s = it._s || (it._s = [it.title, it.description, it.place, it.region, it.no, it.vid, (it.props || []).map(function (p) { return p.join(' '); }).join(' '), (CN[catOf(it)] || [])[1]].join(' ').toLowerCase()); if (!w.every(function (x) { return s.indexOf(x) >= 0; })) return false; }
      return true;
    });
    var s = f.sort || 'new';
    l.sort(function (a, b) { return s === 'price_asc' ? (a.price || 9e15) - (b.price || 9e15) : s === 'price_desc' ? (b.price || 0) - (a.price || 0) : s === 'popular' ? (b.views + b.likes * 5) - (a.views + a.likes * 5) : (b.updated || '').localeCompare(a.updated || '') || b.id - a.id; });
    return l;
  }

  // ---------------------------------------------------------------- сторінки
  function home() {
    var items = DATA.items || [], cnt = {}; items.forEach(function (it) { var c = catOf(it); cnt[c] = (cnt[c] || 0) + 1; });
    var withPh = items.filter(function (it) { return (it.photos || []).length; }), fresh = items.slice().sort(function (a, b) { return (b.updated || '').localeCompare(a.updated || ''); }).slice(0, 6);
    var pop = items.slice().sort(function (a, b) { return (b.views + b.likes * 5) - (a.views + a.likes * 5); }).slice(0, 6);
    var h = '<section class="hero"><div class="wrap"><h1>' + esc(setting('public_hero_title', 'Активи АРМА: оренда, управління, продаж')) + '</h1><p>' + esc(setting('public_hero_sub', 'Нерухомість, земельні ділянки, транспорт і майнові комплекси, передані в управління АРМА. Знайдіть лот, ознайомтеся з характеристиками та подайте заявку на Prozorro.Продажі.')) + '</p>' +
      '<form class="hero-search" data-f="search"><input name="q" placeholder="Що шукаєте? Наприклад: нежитлове приміщення Київ"><select name="cat"><option value="">Усі типи активів</option>' + CATS.map(function (c) { return '<option value="' + c[0] + '">' + esc(c[1]) + '</option>'; }).join('') + '</select>' +
      '<select name="region"><option value="">Уся Україна</option>' + REGIONS.map(function (r) { return '<option>' + esc(r) + '</option>'; }).join('') + '</select><button class="pbtn gold">Знайти</button></form>' +
      '<div class="hero-kpi"><div><b>' + num(items.length) + '</b><span>лотів у каталозі</span></div><div><b>' + num(cnt.pool || 0) + '</b><span>пулів і комплексів</span></div><div><b>' + num(withPh.length) + '</b><span>лотів з фото</span></div><div><b>' + num(items.filter(function (i) { return i.prozorro_id; }).length) + '</b><span>на Prozorro.Продажі</span></div></div></div></section>' +
      '<div class="wrap"><section class="blk"><h2>Типи активів</h2><div class="cat-tiles">' + CATS.map(function (c) { return '<a class="cat-tile" href="' + link('/search', {cat: c[0]}) + '"><i>' + c[2] + '</i><b>' + esc(c[1]) + '</b><span>' + num(cnt[c[0]] || 0) + ' лотів</span></a>'; }).join('') + '</div></section>';
    if (!items.length) h += '<div class="empty-p">Наразі опублікованих лотів немає. Загляньте пізніше.</div>';
    else h += '<section class="blk"><h2>Нові лоти <small><a href="' + link('/search', {sort: 'new'}) + '">усі →</a></small></h2><div class="cards">' + fresh.map(card).join('') + '</div></section>' +
      (pop.some(function (x) { return x.views || x.likes; }) ? '<section class="blk"><h2>Найпопулярніші <small><a href="' + link('/search', {sort: 'popular'}) + '">усі →</a></small></h2><div class="cards">' + pop.map(card).join('') + '</div></section>' : '');
    var ag = DATA.agg || {};
    if (ag.money || ag.crypto) {
      h += '<section class="blk"><h2>Фінансові активи в управлінні АРМА <small>узагальнені показники</small></h2><div class="agg">';
      if (ag.money) h += '<div class="box"><h3>Кошти, банківські метали, ОВДП</h3><div class="price">' + (money(ag.money.total) || '0 ₴') + '<small>гривневий еквівалент · записів ' + num(ag.money.count) + '</small></div><div class="kp">' + Object.keys(ag.money.by).map(function (k) { return '<div><b>' + (money(ag.money.by[k]) || '0 ₴') + '</b><span>' + esc(k) + '</span></div>'; }).join('') + '</div></div>';
      if (ag.crypto) h += '<div class="box"><h3>Криптоактиви</h3><div class="price">' + (money(ag.crypto.total) || num(ag.crypto.count) + ' записів') + '<small>' + (ag.crypto.total ? 'ринкова вартість' : 'вартість буде показано після внесення курсів') + ' · записів ' + num(ag.crypto.count) + '</small></div><div class="kp">' + Object.keys(ag.crypto.by).map(function (k) { return '<div><b>' + (money(ag.crypto.by[k]) || '0 ₴') + '</b><span>' + esc(k) + '</span></div>'; }).join('') + '</div></div>';
      h += '</div></section>';
    }
    render(h + '</div>');
  }
  function search(f) {
    var l = filterItems(f), page = Math.max(1, +f.page || 1), pages = Math.max(1, Math.ceil(l.length / PER)), rows = l.slice((page - 1) * PER, page * PER), c = CN[f.cat];
    var sel = function (n, opts, v, e) { return '<select name="' + n + '"><option value="">' + esc(e) + '</option>' + opts.map(function (o) { o = Array.isArray(o) ? o : [o, o]; return '<option value="' + esc(o[0]) + '"' + (String(v || '') === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>'; };
    var h = '<div class="wrap"><div class="crumbs"><a href="#/">Головна</a> › ' + esc(f.fav ? 'Обране' : c ? c[1] : 'Пошук') + '</div><div class="layout"><form class="side-f" data-f="filter"><h3>Фільтри</h3>' + (f.q ? '<input type="hidden" name="q" value="' + esc(f.q) + '">' : '') + (f.fav ? '<input type="hidden" name="fav" value="1">' : '') +
      '<label>Тип активу</label>' + sel('cat', CATS.map(function (x) { return [x[0], x[1]]; }), f.cat, 'Усі типи') + '<label>Область</label>' + sel('region', REGIONS, f.region, 'Уся Україна') +
      '<label>Спосіб передачі</label>' + sel('way', [['Пошук управителя', 'Пошук управителя (оренда / управління)'], ['Реалізація', 'Продаж (реалізація)'], ['Управління за договором', 'В управлінні']], f.way, 'Будь-який') +
      '<label>Оціночна вартість, ₴</label><div class="row2"><input name="pmin" value="' + esc(f.pmin || '') + '" placeholder="від" inputmode="numeric"><input name="pmax" value="' + esc(f.pmax || '') + '" placeholder="до" inputmode="numeric"></div>' +
      '<label>Площа від, м²</label><input name="amin" value="' + esc(f.amin || '') + '" inputmode="numeric">' +
      '<label><input type="checkbox" name="ph" value="1"' + (f.ph ? ' checked' : '') + ' style="width:auto"> лише з фото</label><label><input type="checkbox" name="pz" value="1"' + (f.pz ? ' checked' : '') + ' style="width:auto"> лише з лотом на Prozorro</label>' +
      '<div style="display:flex;gap:6px;margin-top:14px"><button class="pbtn main" style="flex:1">Показати</button><a class="pbtn" href="' + (f.fav ? '#/search?fav=1' : '#/search') + '">Скинути</a></div></form><div>' +
      '<div class="list-head"><b>' + (f.q ? 'За запитом «' + esc(f.q) + '»: ' : '') + num(l.length) + ' лотів</b>' + sel('sort', [['new', 'Спочатку нові'], ['price_asc', 'Дешевші'], ['price_desc', 'Дорожчі'], ['popular', 'Популярні']], f.sort || 'new', 'Сортування').replace('<select', '<select data-sort') + '</div>' +
      (rows.length ? '<div class="cards">' + rows.map(card).join('') + '</div>' : '<div class="empty-p">' + (f.fav ? 'В обраному поки немає лотів. Натискайте ♡ на картках.' : 'За умовами пошуку лотів не знайдено. Спробуйте змінити фільтри.') + '</div>');
    if (pages > 1) { h += '<div class="pager-p">'; for (var i = Math.max(1, page - 4); i <= Math.min(pages, page + 4); i++) h += i === page ? '<span>' + i + '</span>' : '<a href="' + link('/search', Object.assign({}, f, {page: i})) + '">' + i + '</a>'; h += '</div>'; }
    render(h + '</div></div></div>', f.cat);
  }
  function lot(t, id) {
    var it = find(t, +id); if (!it) return render('<div class="wrap"><div class="empty-p" style="margin-top:30px">Лот не знайдено або знято з публікації. <a href="#/">На головну</a></div></div>');
    src.post('view', {type: it.type, id: it.id}); LAST = location.hash;
    var c = CN[catOf(it)] || ['', '', '🏷'], phs = it.photos || [], liked = has(ME.likes, it), fav = has(ME.favorites, it), ct = it.contacts || {}, reqs = (ME.requests || []).filter(function (r) { return r.item_type === it.type && r.item_id === it.id; });
    var approved = reqs.some(function (r) { return r.status === 'approved'; });
    var h = '<div class="wrap"><div class="crumbs"><a href="#/">Головна</a> › <a href="' + link('/search', {cat: catOf(it)}) + '">' + esc(c[1]) + '</a> › ' + esc(it.no) + '</div><div class="lot"><div>' +
      '<div class="gal"><div class="main">' + (phs.length ? '<img id="gmain" src="' + esc(src.photo(phs[0], 'view')) + '" alt="">' : c[2]) + '</div>' + (phs.length > 1 ? '<div class="th">' + phs.map(function (p, i) { return '<img src="' + esc(src.photo(p, 'thumb')) + '" data-big="' + esc(src.photo(p, 'view')) + '" class="' + (i ? '' : 'on') + '" alt="">'; }).join('') + '</div>' : '') + '</div>' +
      '<div class="box" style="margin-top:14px"><h3>Характеристики</h3><div class="props"><div>Тип</div><div>' + esc(it.type === 'pool' ? 'Пул активів (продається / передається одним лотом)' : c[1]) + '</div>' + (it.vid ? '<div>Вид</div><div>' + esc(it.vid) + '</div>' : '') + '<div>Розташування</div><div>' + esc(it.place || it.region || '—') + '</div>' +
      (it.props || []).map(function (p) { return '<div>' + esc(p[0]) + '</div><div>' + esc(typeof p[1] === 'number' ? num(p[1], p[1] % 1 ? 2 : 0) : p[1]) + '</div>'; }).join('') + (it.way ? '<div>Спосіб передачі</div><div>' + esc(it.way) + '</div>' : '') + '<div>Номер лота в каталозі</div><div>' + esc(it.no) + '</div></div></div>' +
      (it.description ? '<div class="box"><h3>Опис</h3><div style="white-space:pre-wrap">' + esc(it.description) + '</div></div>' : '') +
      ((it.docs || []).length ? '<div class="box"><h3>Документи лота</h3><p style="color:var(--muted);font-size:14px;margin-top:0">Документи надаються після погодження запиту адміністратором.</p>' + it.docs.map(function (d) { var u = approved && src.doc(d.id); return '<div style="display:flex;justify-content:space-between;padding:8px 0;border-top:1px solid var(--line)"><span>📄 ' + esc(d.name) + '</span>' + (u ? '<a href="' + esc(u) + '" target="_blank" rel="noopener">Завантажити</a>' : '<span style="color:var(--muted)">за запитом</span>') + '</div>'; }).join('') + '</div>' : '') +
      '</div><aside><div class="box"><h1>' + esc(it.title) + '</h1><div style="color:var(--muted);margin-bottom:12px">📍 ' + esc(it.place || it.region || 'Україна') + '</div><div class="price">' + (money(it.price) || 'Ціна — на аукціоні') + '<small>' + (it.price ? 'оціночна вартість' + (it.price_date ? ' станом на ' + dt(it.price_date) : '') : 'стартова ціна визначається в оголошенні') + '</small></div>' +
      (it.prozorro_url ? '<p><a class="pbtn gold" style="width:100%;justify-content:center" href="' + esc(it.prozorro_url) + '" target="_blank" rel="noopener">Лот на Prozorro.Продажі →</a></p>' : '') +
      '<div style="display:flex;gap:8px;margin-top:10px"><button class="pbtn" data-like="' + it.type + ':' + it.id + '" style="flex:1;justify-content:center">' + (liked ? '❤' : '🤍') + ' <span>' + (it.likes || 0) + '</span></button><button class="pbtn" data-fav="' + it.type + ':' + it.id + '" style="flex:1;justify-content:center">' + (fav ? '♥ В обраному' : '♡ В обране') + '</button><button class="pbtn" data-share title="Скопіювати посилання">🔗</button></div>' +
      '<div style="color:var(--muted);font-size:13px;margin-top:10px">👁 ' + (it.views || 0) + ' переглядів' + (it.updated ? ' · оновлено ' + dt(it.updated) : '') + '</div></div>' +
      '<div class="box"><h3>Контакти щодо лота</h3><div><b>' + esc(ct.dept || 'АРМА') + '</b></div>' + (ct.phone ? '<div>☎ <a href="tel:' + esc(ct.phone.replace(/[^\d+]/g, '')) + '">' + esc(ct.phone) + '</a></div>' : '') + (ct.email ? '<div>✉ <a href="mailto:' + esc(ct.email) + '?subject=' + encodeURIComponent('Лот ' + it.no) + '">' + esc(ct.email) + '</a></div>' : '') +
      '<p style="margin-bottom:0"><a class="pbtn sm" href="' + link('/feedback', {item: it.no, t: it.type, id: it.id}) + '">Поставити запитання</a></p></div>' +
      '<div class="box"><h3>Документи і огляд</h3>' + (reqs.length ? reqs.map(function (r) { return '<div>Запит від ' + esc(r.created_at || '') + ': <span class="req-st ' + esc(r.status) + '">' + esc({new: 'на розгляді', approved: 'погоджено', rejected: 'відхилено'}[r.status] || r.status) + '</span>' + (r.admin_note ? '<div style="font-size:13px;color:var(--muted)">' + esc(r.admin_note) + '</div>' : '') + '</div>'; }).join('') : '<p style="color:var(--muted);font-size:14px;margin-top:0">Запросіть документи лота (акт огляду, техпаспорт, витяги, звіт про оцінку). Потрібен вхід до кабінету.</p>') +
      (reqs.some(function (r) { return r.status === 'new'; }) ? '' : '<button class="pbtn main" data-req="' + it.type + ':' + it.id + '" style="margin-top:8px">Запросити документи</button>') + '</div></aside></div>';
    var sim = (DATA.items || []).filter(function (x) { return x !== it && catOf(x) === catOf(it); }).sort(function (a, b) { return (a.region === it.region ? 0 : 1) - (b.region === it.region ? 0 : 1); }).slice(0, 3);
    if (sim.length) h += '<section class="blk"><h2>Схожі лоти</h2><div class="cards">' + sim.map(card).join('') + '</div></section>';
    render(h + '</div>', catOf(it));
    var g = document.getElementById('gmain'); document.querySelectorAll('.gal .th img').forEach(function (im) { im.addEventListener('click', function () { g.src = im.dataset.big; document.querySelectorAll('.gal .th img').forEach(function (x) { x.classList.toggle('on', x === im); }); }); });
  }
  function authPage(kind) {
    var reg = kind === 'register', priv = setting('public_privacy_url', 'https://arma.gov.ua/page/obrobka-personalnih-danih-subektiv-dani-yakih-obroblyayutsya-v-arma');
    render('<div class="wrap"><form class="form-p" data-f="' + kind + '"><h1>' + (reg ? 'Реєстрація в кабінеті' : 'Вхід до кабінету') + '</h1><div class="msg info">' + (reg ? 'Кабінет дає змогу зберігати обрані лоти, запитувати документи та стежити за відповіддю.' : 'Увійдіть, щоб додавати лоти в обране і запитувати документи.') + '</div>' +
      (reg ? '<label>Ім’я та прізвище</label><input name="name" required maxlength="120"><label>Організація (необов’язково)</label><input name="org" maxlength="200"><label>Телефон (необов’язково)</label><input name="phone" maxlength="40">' : '') +
      '<label>E-mail</label><input name="email" type="email" required autocomplete="email"><label>Пароль' + (reg ? ' (щонайменше 8 символів)' : '') + '</label><input name="password" type="password" required minlength="' + (reg ? 8 : 1) + '" autocomplete="' + (reg ? 'new-password' : 'current-password') + '">' +
      (reg ? '<label class="chk"><input type="checkbox" name="consent" value="1" required> <span>Надаю згоду на обробку персональних даних відповідно до <a href="' + esc(priv) + '" target="_blank" rel="noopener">порядку обробки персональних даних в АРМА</a></span></label>' : '') +
      '<div id="fmsg"></div><p><button class="pbtn main" style="width:100%;justify-content:center">' + (reg ? 'Зареєструватися' : 'Увійти') + '</button></p><p style="text-align:center;font-size:14px">' + (reg ? 'Уже маєте кабінет? <a href="#/login">Увійти</a>' : 'Ще немає кабінету? <a href="#/register">Зареєструватися</a>') + '</p></form></div>');
  }
  function feedback(f) {
    var priv = setting('public_privacy_url', 'https://arma.gov.ua/page/obrobka-personalnih-danih-subektiv-dani-yakih-obroblyayutsya-v-arma'), u = ME.user || {};
    render('<div class="wrap"><form class="form-p" data-f="feedback"' + (f.id ? ' data-id="' + esc(f.id) + '"' : '') + '><h1>Зворотний зв’язок</h1>' + (f.item ? '<div class="msg info">Запитання щодо лота ' + esc(f.item) + '</div><input type="hidden" name="item" value="Лот ' + esc(f.item) + '">' : '') +
      '<label>Ім’я</label><input name="name" value="' + esc(u.name || '') + '" maxlength="120"><label>E-mail для відповіді</label><input name="email" type="email" required value="' + esc(u.email || '') + '"><label>Звернення</label><textarea name="message" required minlength="5" maxlength="2500"></textarea>' +
      '<label class="chk"><input type="checkbox" name="consent" value="1" required> <span>Надаю згоду на обробку персональних даних відповідно до <a href="' + esc(priv) + '" target="_blank" rel="noopener">порядку обробки персональних даних в АРМА</a></span></label>' +
      '<div id="fmsg"></div><p><button class="pbtn main" style="width:100%;justify-content:center">Надіслати</button></p><p style="font-size:13px;color:var(--muted)">Інші способи зв’язку — на сторінці <a href="' + esc(setting('public_contacts_url', 'https://arma.gov.ua/contacts')) + '" target="_blank" rel="noopener">контактів АРМА</a>.</p></form></div>');
  }
  function cabinet(f) {
    if (!ME.user) return authPage('login');
    var tab = f.tab || 'fav', favs = (DATA.items || []).filter(function (it) { return has(ME.favorites, it); }), reqs = ME.requests || [];
    var h = '<div class="wrap"><div class="crumbs"><a href="#/">Головна</a> › Кабінет</div><section class="blk"><h2>Кабінет · ' + esc(ME.user.name || ME.user.email) + ' <small>' + esc(ME.user.email) + '</small> <button class="pbtn sm" data-logout style="margin-left:auto">Вийти</button></h2>' +
      '<nav class="cats" style="border:0;background:none"><div style="display:flex;gap:4px"><a href="#/cabinet?tab=fav" class="' + (tab === 'fav' ? 'on' : '') + '">♥ Обране (' + favs.length + ')</a><a href="#/cabinet?tab=req" class="' + (tab === 'req' ? 'on' : '') + '">📄 Запити на документи (' + reqs.length + ')</a></div></nav>';
    if (tab === 'fav') h += favs.length ? '<div class="cards" style="margin-top:12px">' + favs.map(card).join('') + '</div>' : '<div class="empty-p">В обраному поки немає лотів. Натискайте ♡ на картках лотів.</div>';
    else h += reqs.length ? '<div class="box" style="margin-top:12px">' + reqs.map(function (r) { var it = find(r.item_type, r.item_id);
      return '<div style="padding:10px 0;border-bottom:1px solid var(--line)"><div style="display:flex;gap:10px;justify-content:space-between"><a href="#/lot/' + r.item_type + '/' + r.item_id + '">' + esc(it ? it.title : 'Лот ' + r.item_id) + '</a><span class="req-st ' + esc(r.status) + '">' + esc({new: 'на розгляді', approved: 'погоджено', rejected: 'відхилено'}[r.status] || r.status) + '</span></div>' +
        '<div style="font-size:13px;color:var(--muted)">' + esc(r.created_at || '') + (r.message ? ' · ' + esc(r.message) : '') + (r.admin_note ? ' · відповідь: ' + esc(r.admin_note) : '') + '</div>' + (r.status === 'approved' && it && (it.docs || []).length ? '<div style="margin-top:6px">' + it.docs.map(function (d) { var u = src.doc(d.id); return u ? '<a class="pbtn sm" href="' + esc(u) + '" target="_blank" rel="noopener">📄 ' + esc(d.name) + '</a> ' : ''; }).join('') + '</div>' : '') + '</div>'; }).join('') + '</div>' : '<div class="empty-p">Запитів ще немає. Запросити документи можна на сторінці лота.</div>';
    render(h + '</section></div>');
  }
  function route() {
    var path = location.hash.replace(/^#/, '').split('?')[0] || '/', f = params(), m;
    if (path === '/' || path === '') return home();
    if (path === '/search') return search(f);
    if ((m = path.match(/^\/lot\/(asset|pool)\/(\d+)$/))) return lot(m[1], m[2]);
    if (path === '/login' || path === '/register') return authPage(path.slice(1));
    if (path === '/cabinet') return cabinet(f);
    if (path === '/feedback') return feedback(f);
    home();
  }

  // ---------------------------------------------------------------- події
  function ref(s) { var p = s.split(':'); return {type: p[0], id: +p[1]}; }
  function bind() {
    $.querySelectorAll('form[data-f]').forEach(function (fm) { fm.addEventListener('submit', function (e) { e.preventDefault(); var d = {}; new FormData(fm).forEach(function (v, k) { d[k] = typeof v === 'string' ? v.trim() : v; }); submit(fm, fm.dataset.f, d); }); });
    var so = $.querySelector('select[data-sort]'); if (so) so.addEventListener('change', function () { location.hash = link('/search', Object.assign({}, params(), {sort: so.value, page: ''})); });
    $.querySelectorAll('[data-fav]').forEach(function (b) { b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); var r = ref(b.dataset.fav);
      src.post('fav', r).then(function (x) { if (!x.ok) { toast(x.error || 'Помилка'); if (!ME.user) location.hash = '#/login'; return; } toast(x.fav ? 'Додано в обране' : 'Видалено з обраного'); refreshMe().then(route); }); }); });
    $.querySelectorAll('[data-like]').forEach(function (b) { b.addEventListener('click', function () { var r = ref(b.dataset.like); src.post('like', r).then(function (x) { if (!x.ok) return toast(x.error || 'Помилка'); var it = find(r.type, r.id); if (it && x.likes !== undefined) it.likes = x.likes; refreshMe().then(route); }); }); });
    $.querySelectorAll('[data-req]').forEach(function (b) { b.addEventListener('click', function () { var r = ref(b.dataset.req); if (!ME.user) { toast('Увійдіть до кабінету, щоб запросити документи'); location.hash = '#/login'; return; }
      var msg = prompt('Мета запиту / коментар (необов’язково):', ''); if (msg === null) return; src.post('request', Object.assign(r, {message: msg})).then(function (x) { if (!x.ok) return toast(x.error || 'Помилка'); toast('Запит надіслано. Відповідь з’явиться в кабінеті.'); refreshMe().then(route); }); }); });
    var sh = $.querySelector('[data-share]'); if (sh) sh.addEventListener('click', function () { var u = location.href; if (navigator.clipboard) navigator.clipboard.writeText(u).then(function () { toast('Посилання скопійовано'); }); else prompt('Посилання на лот:', u); });
    var lo = $.querySelector('[data-logout]'); if (lo) lo.addEventListener('click', function () { src.post('logout').then(function () { refreshMe().then(function () { location.hash = '#/'; }); }); });
  }
  function submit(fm, kind, d) {
    var msg = fm.querySelector('#fmsg'), show = function (t, k) { if (msg) msg.innerHTML = '<div class="msg ' + (k || 'err') + '">' + esc(t) + '</div>'; };
    if (kind === 'search') { location.hash = link('/search', {q: d.q, cat: d.cat, region: d.region}); return; }
    if (kind === 'filter') { var o = {}; for (var k in d) if (d[k]) o[k] = d[k]; location.hash = link('/search', o); return; }
    if (kind === 'login' || kind === 'register') { d.consent = !!d.consent; src.post(kind, d).then(function (x) { if (!x.ok) return show(x.error || 'Помилка'); refreshMe().then(function () { toast(kind === 'register' ? 'Кабінет створено' : 'Вітаємо!'); location.hash = LAST || '#/cabinet'; }); }); return; }
    if (kind === 'feedback') { d.consent = !!d.consent; if (fm.dataset.id) d.id = +fm.dataset.id; src.post('feedback', d).then(function (x) { if (!x.ok) return show(x.error || 'Помилка'); fm.reset(); show(x.mirror ? 'У дзеркалі звернення не надсилається — на робочому сайті його отримає АРМА.' : 'Дякуємо! Звернення надіслано, відповідь надійде на вказаний e-mail.', 'ok'); }); }
  }
  // ---------------------------------------------------------------- запуск
  $.innerHTML = '<div style="padding:60px;text-align:center;color:#5F6B84">Завантаження каталогу…</div>';
  Promise.all([src.catalog(), refreshMe(), loadMedia()]).then(function (r) { DATA = r[0] || {items: []}; window.addEventListener('hashchange', route); route(); })
    .catch(function (e) { $.innerHTML = '<div style="padding:60px;text-align:center">Не вдалося завантажити каталог. ' + esc(e.message) + '</div>'; });
})();
