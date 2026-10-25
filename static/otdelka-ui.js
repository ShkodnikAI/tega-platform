/* Смета отделки: интерфейс и печатные формы. Ядро расчёта в otdelka.js. */
(function () {
  'use strict';
  var T = window.TegaOtd, el = document.getElementById('otd');
  if (!T || !el) return;
  var fmt = T.fmt, num = T.num, esc = T.esc, M = T.M;
  var S = load(), fc = 0;

  function load() {
    try { var s = JSON.parse(localStorage.getItem(T.KEY)); if (s && s.rooms && s.rooms.length) return s; } catch (e) { /* пусто */ }
    return T.newState();
  }
  function save() { try { localStorage.setItem(T.KEY, JSON.stringify(S)); } catch (e) { /* приватный режим */ } }
  function commit() {
    save();
    setTimeout(function () {
      var a = document.activeElement, fid = a && a.getAttribute ? a.getAttribute('data-fid') : null;
      render();
      if (fid) { var n = el.querySelector('[data-fid="' + fid + '"]'); if (n) { n.focus(); try { if (n.type !== 'checkbox' && n.select) n.select(); } catch (e) { /* ничего */ } } }
    }, 0);
  }

  // ─── мелкие конструкторы
  function h(tag, a, kids) {
    var e = document.createElement(tag);
    if (a) Object.keys(a).forEach(function (k) {
      if (k === 'class') e.className = a[k]; else if (k === 'text') e.textContent = a[k]; else if (k === 'html') e.innerHTML = a[k];
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), a[k]); else if (a[k] !== false && a[k] != null) e.setAttribute(k, a[k]);
    });
    (kids || []).forEach(function (c) { if (c == null) return; e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function fid(e) { e.setAttribute('data-fid', ++fc); return e; }
  function nIn(val, cb, unit, opt) {
    opt = opt || {};
    var i = fid(h('input', { inputmode: 'decimal', autocomplete: 'off', value: val == null ? '' : String(typeof val === 'number' ? Math.round(val * 1000) / 1000 : val).replace('.', ','), 'aria-label': opt.label || null }));
    i.addEventListener('change', function () { cb(num(i.value, 0)); commit(); });
    return h('div', { class: 'o-in' }, [i, unit ? h('span', { class: 'u', text: unit }) : null]);
  }
  function tIn(val, cb, label) {
    var i = fid(h('input', { autocomplete: 'off', value: val || '', 'aria-label': label || null }));
    i.addEventListener('change', function () { cb(i.value); commit(); });
    return h('div', { class: 'o-in wide' }, [i]);
  }
  function sel(val, opts, cb, label) {
    var s = fid(h('select', { 'aria-label': label || null }, opts.map(function (o) { return h('option', { value: o[0], text: o[1], selected: String(o[0]) === String(val) ? 'selected' : false }); })));
    s.value = String(val);
    s.addEventListener('change', function () { cb(s.value); commit(); });
    return h('div', { class: 'o-in' }, [s]);
  }
  function chk(label, val, cb) {
    var i = fid(h('input', { type: 'checkbox', checked: val ? 'checked' : false }));
    i.addEventListener('change', function () { cb(i.checked ? 1 : 0); commit(); });
    return h('label', { class: 'o-chk' }, [i, h('span', { text: label })]);
  }
  function lab(label, ctl, cls) { return h('div', { class: 'o-f' + (cls ? ' ' + cls : '') }, [h('label', { text: label }), ctl]); }
  function btn(text, cb, cls) { return h('button', { type: 'button', class: 'o-btn' + (cls ? ' ' + cls : ''), text: text, onclick: cb }); }
  function card(title, kids, note) { return h('section', { class: 'o-card' }, [h('h3', { text: title })].concat(kids, note ? [h('p', { class: 'e-note', text: note })] : [])); }
  function tbl(head, rows, cls) {
    var t = h('table', { class: 'e-tbl o-tbl' + (cls ? ' ' + cls : '') });
    t.appendChild(h('thead', null, [h('tr', null, head.map(function (c) { return h('th', { text: c, class: /^[›]/.test(c) ? 'r' : '' }); }))]));
    var tb = h('tbody'); rows.forEach(function (r) {
      var tr = h('tr', { class: r.cls || '' }); r.c.forEach(function (c, i) { var td = h('td', { class: (r.r && r.r.indexOf(i) >= 0 ? 'r m' : '') }); if (c != null) { if (typeof c === 'string') td.textContent = c; else td.appendChild(c); } tr.appendChild(td); }); tb.appendChild(tr);
    });
    t.appendChild(tb); return h('div', { class: 'e-scroll' }, [t]);
  }

  // ─── шаги
  var STEPS = [['rooms', '1', 'Помещения'], ['sheet', '2', 'Ведомость отделки'], ['est', '3', 'Смета'], ['price', '4', 'Цена'], ['rep', '5', 'Отчёты']];
  function stepper() {
    return h('div', { class: 'e-sub o-steps', role: 'tablist' }, STEPS.map(function (s) {
      return h('a', { href: '#' + s[0], class: S.step === s[0] ? 'on' : '', onclick: function (ev) { ev.preventDefault(); S.step = s[0]; save(); render(); window.scrollTo(0, el.offsetTop - 80); } }, [s[1] + ' · ' + s[2]]);
    }));
  }
  function nav(prev, next) {
    var b = h('div', { class: 'o-nav' });
    if (prev) b.appendChild(btn('← ' + STEPS.filter(function (x) { return x[0] === prev; })[0][2], function () { S.step = prev; save(); render(); window.scrollTo(0, el.offsetTop - 80); }));
    if (next) b.appendChild(btn(STEPS.filter(function (x) { return x[0] === next; })[0][2] + ' →', function () { S.step = next; save(); render(); window.scrollTo(0, el.offsetTop - 80); }, 'pri'));
    return b;
  }
  function roomTabs(onAdd) {
    var w = h('div', { class: 'e-sub o-rooms' });
    S.rooms.forEach(function (r, i) {
      w.appendChild(h('a', { href: '#r' + i, class: S.active === i ? 'on' : '', onclick: function (ev) { ev.preventDefault(); S.active = i; save(); render(); } }, [String(i + 1).padStart(2, '0') + ' ' + r.name]));
    });
    if (onAdd) w.appendChild(btn('+ Добавить помещение', onAdd));
    return w;
  }
  function addRoom() { var r = T.newRoom('Помещение ' + (S.rooms.length + 1)); S.rooms.push(r); S.active = S.rooms.length - 1; commit(); }

  // ─── шаг 1: объект и помещения
  function stepRooms() {
    var o = S.obj, w = S.works, box = h('div', { class: 'o-body' });
    box.appendChild(card('Объект', [
      h('div', { class: 'o-grid' }, [
        lab('Название объекта', tIn(o.name, function (v) { o.name = v; }, 'Название объекта'), 'w2'),
        lab('№ расчёта', tIn(o.no, function (v) { o.no = v; })), lab('Дата', tIn(o.date, function (v) { o.date = v; })),
        lab('Заказчик', tIn(o.customer, function (v) { o.customer = v; }), 'w2'),
        lab('Тип объекта', sel(o.kind, [['live', 'Жильё'], ['nolive', 'Не жильё (с НДС)']], function (v) { o.kind = v; }))
      ]),
      h('p', { class: 'o-sub', text: 'Какие работы считаем' }),
      h('div', { class: 'o-chks' }, T.SURF_ORDER.map(function (s) { return chk(T.SURF[s], w[s], function (v) { w[s] = !!v; }); })),
      h('p', { class: 'e-note', text: 'Смета всегда общая: материалы подбираются под выбранные виды работ. Без работ материалы не считаются.' })
    ]));
    box.appendChild(roomTabs(addRoom));
    var rm = S.rooms[S.active], g = T.geo(rm);
    var del = S.rooms.length > 1 ? btn('Удалить помещение', function () { S.rooms.splice(S.active, 1); S.active = Math.max(0, S.active - 1); commit(); }, 'danger') : null;
    box.appendChild(card('Помещение: ' + rm.name, [
      h('div', { class: 'o-grid' }, [
        lab('Название', tIn(rm.name, function (v) { rm.name = v || 'Помещение'; }), 'w2'),
        lab('Длина', nIn(rm.L, function (v) { rm.L = v; }, 'м')), lab('Ширина', nIn(rm.W, function (v) { rm.W = v; }, 'м')), lab('Высота', nIn(rm.H, function (v) { rm.H = v; }, 'м'))
      ]),
      h('div', { class: 'o-kv' }, [kv('Периметр', fmt(g.P, 1) + ' м'), kv('Пол', fmt(g.floor, 1) + ' м²'), kv('Стены / без проёмов', fmt(g.gross, 1) + ' / ' + fmt(g.walls, 1) + ' м²'), kv('Откосы', fmt(g.slLen, 1) + ' м.п. · ' + fmt(g.slArea, 2) + ' м²')]),
      openings(rm, 'windows', 'Окна', 'ОК'), openings(rm, 'doors', 'Двери', 'Д'),
      h('p', { class: 'e-note', text: 'Откос — ширина той части проёма, которую нужно отделать (для окна обычно толщина стены минус наружный откос и минус окно). Если откосов нет, поставьте 0. Откос считается по периметру проёма: 2 × высота + ширина.' }),
      del
    ]));
    box.appendChild(h('div', { class: 'o-nav' }, [btn('Загрузить пример', loadExample), btn('Очистить всё', function () { if (confirm('Удалить все введённые данные?')) { S = T.newState(); commit(); } }, 'danger'), btn('Ведомость отделки →', function () { S.step = 'sheet'; save(); render(); }, 'pri')]));
    return box;
  }
  function kv(k, v) { return h('div', { class: 'o-k' }, [h('span', { text: k }), h('b', { text: v })]); }
  function openings(rm, key, title, pre) {
    var rows = (rm[key] || []).map(function (o, i) {
      return { c: [o.name, nIn(o.w, function (v) { o.w = v; }, null, { label: 'Ширина' }), nIn(o.h, function (v) { o.h = v; }, null, { label: 'Высота' }), nIn(o.rev, function (v) { o.rev = v; }, null, { label: 'Откос' }), nIn(o.qty, function (v) { o.qty = v; }, null, { label: 'Шт.' }), btn('×', function () { rm[key].splice(i, 1); commit(); }, 'x')] };
    });
    var wrap = h('div', { class: 'o-open' }, [h('div', { class: 'o-oh' }, [h('b', { text: title }), btn('+ ' + title.slice(0, -1), function () {
      var c = key === 'windows' ? 'w' : 'd'; S.nOpen[c] = (S.nOpen[c] || 0) + 1;
      rm[key].push(key === 'windows' ? { id: T.nid(), name: pre + '-' + S.nOpen[c], w: 1400, h: 1500, rev: 240, qty: 1 } : { id: T.nid(), name: pre + '-' + S.nOpen[c], w: 900, h: 2100, rev: 100, qty: 1 }); commit();
    })])]);
    if (rows.length) wrap.appendChild(tbl(['Обозн.', 'Ширина, мм', 'Высота, мм', 'Откос, мм', 'Шт.', ''], rows));
    return wrap;
  }
  function loadExample() {
    S = T.newState(); S.obj.name = 'Офис, 120 м²'; S.obj.kind = 'nolive'; S.obj.customer = 'ООО «Пример»'; S.works.ceiling = false;
    var a = T.newRoom('Кабинет 1'); a.L = 5; a.W = 4; a.H = 2.7;
    a.windows.push({ id: T.nid(), name: 'ОК-1', w: 1400, h: 1500, rev: 240, qty: 1 }); a.doors.push({ id: T.nid(), name: 'Д-1', w: 900, h: 2100, rev: 100, qty: 1 });
    var b = T.newRoom('Переговорная'); b.L = 4; b.W = 3; b.H = 2.7;
    b.windows.push({ id: T.nid(), name: 'ОК-2', w: 1400, h: 1500, rev: 240, qty: 1 }); b.doors.push({ id: T.nid(), name: 'Д-2', w: 900, h: 2100, rev: 100, qty: 1 });
    var c = T.newRoom('Коридор'); c.L = 6; c.W = 1.5; c.H = 2.7; c.doors.push({ id: T.nid(), name: 'Д-3', w: 900, h: 2100, rev: 100, qty: 2 });
    S.nOpen = { w: 2, d: 3 }; S.rooms = [a, b, c]; S.active = 0; S.step = 'rooms';
    // у кабинета: часть стены под плитку, часть пола под плитку
    var g = T.geo(a), z2 = T.newZone('walls'); z2.spec.fin = 'tile'; z2.spec.tile.cutOn = 1; z2.spec.tile.cut45 = 6.8; z2.spec.tile.cornerOn = 1; z2.spec.tile.corner = 2;
    a.sheet.walls[0].area = Math.round((g.walls - 13.6) * 10) / 10; z2.area = 13.6; a.sheet.walls.push(z2);
    a.sheet.walls[0].spec.plaster = 'cem';
    var f2 = T.newZone('floor'); f2.spec.cover = 'tile'; f2.spec.hydro = 1; f2.spec.tile.w = 600; f2.spec.tile.h = 600; f2.spec.plinth = 0; f2.area = 5; a.sheet.floor[0].area = 15; a.sheet.floor.push(f2);
    commit();
  }

  // ─── шаг 2: ведомость отделки
  function stepSheet() {
    var box = h('div', { class: 'o-body' }), rm = S.rooms[S.active], g = T.geo(rm);
    box.appendChild(h('p', { class: 'e-lead2', text: 'Для каждой поверхности выберите технологию. В одном помещении можно задать несколько участков с разной отделкой, например стена под окраску и участок под плитку. Объёмы берутся из размеров помещения.' }));
    box.appendChild(roomTabs());
    box.appendChild(h('div', { class: 'o-nav' }, [btn('← Размеры помещения', function () { S.step = 'rooms'; save(); render(); }), btn('Применить выбор ко всем помещениям', applyAll)]));
    var any = false;
    T.SURF_ORDER.forEach(function (s) {
      if (!S.works[s]) return; any = true;
      if (s === 'slopes' && !(g.slLen > 0)) { box.appendChild(card('Откосы', [h('p', { class: 'e-note', text: 'В этом помещении нет проёмов с откосами.' })])); return; }
      box.appendChild(surfaceCard(rm, s, g));
    });
    if (!any) box.appendChild(card('Нет видов работ', [h('p', { text: 'На первом шаге включите хотя бы один вид работ.' })]));
    box.appendChild(nav('rooms', 'est'));
    return box;
  }
  function applyAll() {
    var src = S.rooms[S.active], sg = T.geo(src);
    S.rooms.forEach(function (r) {
      if (r === src) return; var g = T.geo(r);
      T.SURF_ORDER.forEach(function (s) {
        var zs = src.sheet[s], tot = T.surfTotal(sg, s), nt = T.surfTotal(g, s), k = tot > 0 ? nt / tot : 0;
        r.sheet[s] = JSON.parse(JSON.stringify(zs)).map(function (z) { z.id = T.nid(); z.area = zs.length > 1 ? Math.round(z.area * k * 10) / 10 : 0; return z; });
      });
    }); commit();
  }
  function surfaceCard(rm, s, g) {
    var zs = rm.sheet[s], tot = T.surfTotal(g, s), unit = 'м²', areas = T.zoneAreas(rm, s, g), sum = areas.reduce(function (a, b) { return a + b; }, 0);
    var c = h('section', { class: 'o-card o-surf' });
    c.appendChild(h('div', { class: 'o-sh' }, [h('h3', { text: T.SURF[s] }), h('span', { class: 'o-tot', text: fmt(tot, 1) + ' м²' + (s === 'slopes' ? ' · ' + fmt(g.slLen, 1) + ' м.п.' : '') })]));
    if (zs.length > 1) c.appendChild(h('p', { class: 'o-alloc' + (Math.abs(sum - tot) > 0.05 ? ' bad' : ''), text: 'Распределено ' + areas.map(function (a) { return fmt(a, 1); }).join(' + ') + ' = ' + fmt(sum, 1) + ' из ' + fmt(tot, 1) + ' м²' }));
    zs.forEach(function (z, i) {
      var zc = h('div', { class: 'o-zone' });
      var head = h('div', { class: 'o-zh' }, [h('b', { text: 'Участок ' + (i + 1) + ' · ' + zoneName(s, z.spec) })]);
      if (zs.length > 1) head.appendChild(h('div', { class: 'o-za' }, [nIn(z.area, function (v) { z.area = v; }, 'м²', { label: 'Площадь участка' }), btn('Удалить участок', function () { zs.splice(i, 1); commit(); }, 'x')]));
      zc.appendChild(head);
      zc.appendChild(s === 'floor' ? floorEditor(z.spec) : wallEditor(s, z.spec));
      c.appendChild(zc);
    });
    if (s !== 'slopes') c.appendChild(btn('+ Добавить участок с другой отделкой', function () {
      var z = T.newZone(s); if (zs.length === 1) { zs[0].area = Math.round(tot / 2 * 10) / 10; z.area = Math.round((tot - zs[0].area) * 10) / 10; } else z.area = Math.max(0, Math.round((tot - sum) * 10) / 10);
      zs.push(z); commit();
    }));
    return c;
  }
  function zoneName(s, sp) {
    if (s === 'floor') return { tile: 'плитка', parquet: 'паркет', laminate: 'ламинат', lino: 'линолеум', none: 'без покрытия' }[sp.cover] || '';
    if (s === 'ceiling' && sp.constr === 'stretch') return 'натяжной потолок';
    return { paint: 'окраска', wallpaper: 'обои', glass: 'стеклообои', decor: 'декор', tile: 'плитка', none: 'без отделки' }[sp.fin];
  }
  function row(kids) { return h('div', { class: 'o-grid' }, kids); }
  function tileEditor(t) {
    var k = T.tileK(t.w, t.h);
    return h('div', { class: 'o-tile' }, [
      row([lab('Ширина плитки', nIn(t.w, function (v) { t.w = v; }, 'мм')), lab('Высота плитки', nIn(t.h, function (v) { t.h = v; }, 'мм')), lab('Ширина шва', nIn(t.joint, function (v) { t.joint = v; }, 'мм')), lab('Цена плитки', nIn(t.price, function (v) { t.price = v; }, 'руб./м²'))]),
      h('p', { class: 'e-note', text: 'Коэффициент к цене работ по размеру плитки (по большей стороне): меньше 150 — 2,0; до 600 — 1,0 (базовый); до 1200 — 1,5; больше 1200 — 2,0. Для плитки ' + num(t.w) + '×' + num(t.h) + ': к = ' + String(k).replace('.', ',') + '.' }),
      h('p', { class: 'e-note', text: 'СВП и крестики считаются от размера плитки и ширины шва, отключить их нельзя.' }),
      h('div', { class: 'o-chks' }, [chk('Фугование швов', t.grout, function (v) { t.grout = v; }), chk('Грунтование перед облицовкой', t.prime, function (v) { t.prime = v; })]),
      row([chk('Подрезка кромок под 45°', t.cutOn, function (v) { t.cutOn = v; }), t.cutOn ? lab('Длина подрезки', nIn(t.cut45, function (v) { t.cut45 = v; }, 'м.п.')) : null,
        chk('Защитные уголки', t.cornerOn, function (v) { t.cornerOn = v; }), t.cornerOn ? lab('Длина уголков', nIn(t.corner, function (v) { t.corner = v; }, 'м.п.')) : null])
    ]);
  }
  function wallEditor(s, sp) {
    var box = h('div', { class: 'o-ed' }), G = Object.keys(T.GRUNT).map(function (k) { return [k, T.GRUNT[k][0]]; });
    var constr = s === 'ceiling' ? [['base', 'По основанию'], ['gklk', 'ГКЛ на каркасе'], ['stretch', 'Натяжной потолок']] : s === 'walls' ? [['base', 'По основанию'], ['gklg', 'ГКЛ на клею'], ['gklk', 'ГКЛ на каркасе']] : null;
    box.appendChild(h('p', { class: 'o-sub', text: '1 · Конструкция и грунт' }));
    var r1 = []; if (constr) r1.push(lab('Конструкция', sel(sp.constr, constr, function (v) { sp.constr = v; })));
    r1.push(lab('Грунт (выбирается вручную)', sel(sp.grunt, G, function (v) { sp.grunt = v; }))); box.appendChild(row(r1));
    if (s === 'ceiling' && sp.constr === 'stretch') { box.appendChild(h('p', { class: 'e-note', text: 'Для натяжного потолка шаги 2–4 не нужны.' })); return box; }
    var fins = s === 'slopes' ? [['paint', 'Окраска'], ['wallpaper', 'Обои'], ['decor', 'Декор'], ['none', 'Без отделки']] : s === 'walls' ? [['paint', 'Окраска'], ['wallpaper', 'Обои'], ['glass', 'Стеклообои'], ['decor', 'Декор'], ['tile', 'Облицовка плиткой'], ['none', 'Без отделки']] : [['paint', 'Окраска'], ['wallpaper', 'Обои'], ['glass', 'Стеклообои'], ['decor', 'Декор'], ['none', 'Без отделки']];
    if (sp.fin !== 'tile') {
      box.appendChild(h('p', { class: 'o-sub', text: '2 · Штукатурка' }));
      box.appendChild(row([lab('Состав', sel(sp.plaster, [['none', 'Не нужна'], ['cem', 'Цементная'], ['gips', 'Гипсовая']], function (v) { sp.plaster = v; })),
        sp.plaster !== 'none' ? chk('Дополнительный слой при больших отклонениях', sp.plExtra, function (v) { sp.plExtra = v; }) : null, sp.plaster !== 'none' ? chk('Грунтование перед слоем', sp.plPrime, function (v) { sp.plPrime = v; }) : null]));
      box.appendChild(h('p', { class: 'o-sub', text: '3 · Шпатлёвка' }));
      var cnt = [['0', 'Не нужна'], ['1', '1 раз'], ['2', '2 раза']];
      box.appendChild(row([lab('Выравнивающая', sel(String(sp.pe), cnt, function (v) { sp.pe = +v; })), lab('Финишная', sel(String(sp.pf), cnt, function (v) { sp.pf = +v; })),
        s !== 'slopes' ? chk('Дополнительный слой при больших отклонениях', sp.pExtra, function (v) { sp.pExtra = v; }) : null, s !== 'slopes' ? chk('Грунтование перед слоем', sp.pPrime, function (v) { sp.pPrime = v; }) : null]));
    }
    box.appendChild(h('p', { class: 'o-sub', text: sp.fin === 'tile' ? '2 · Облицовка плиткой' : '4 · Финиш' }));
    box.appendChild(row([lab('Вид финиша', sel(sp.fin, fins, function (v) { sp.fin = v; }))]));
    if (sp.fin === 'paint') {
      var P = Object.keys(T.PAINT).map(function (k) { return [k, T.PAINT[k][0]]; });
      box.appendChild(row([lab('Состав', sel(sp.paint, P, function (v) { sp.paint = v; })), lab('Слоёв', sel(String(sp.layers), [['1', '1'], ['2', '2'], ['3', '3']], function (v) { sp.layers = +v; })), s !== 'slopes' ? chk('Грунтование перед окраской', sp.finPrime, function (v) { sp.finPrime = v; }) : null]));
    }
    if (sp.fin === 'wallpaper') box.appendChild(row([lab('Обои', sel(sp.wp, Object.keys(T.WP).map(function (k) { return [k, T.WP[k][0]]; }), function (v) { sp.wp = v; })), s !== 'slopes' ? chk('Грунтование перед оклейкой', sp.finPrime, function (v) { sp.finPrime = v; }) : null]));
    if (sp.fin === 'glass') box.appendChild(row([chk('Грунтование перед оклейкой', sp.finPrime, function (v) { sp.finPrime = v; }), chk('Окраска стеклообоев после оклейки', sp.glPaint, function (v) { sp.glPaint = v; })]));
    if (sp.fin === 'decor') box.appendChild(row([lab('Вид декора', sel(sp.decor, Object.keys(T.DECOR).map(function (k) { return [k, T.DECOR[k][0]]; }), function (v) { sp.decor = v; })), h('p', { class: 'e-note', text: 'Материалы без цены: считаются только работы.' })]));
    if (sp.fin === 'tile') box.appendChild(tileEditor(sp.tile));
    return box;
  }
  function floorEditor(sp) {
    var box = h('div', { class: 'o-ed' });
    box.appendChild(h('p', { class: 'o-sub', text: '1 · Основание' }));
    box.appendChild(row([lab('Стяжка', sel(sp.screed, [['none', 'Без выравнивания'], ['semi', 'Полусухая стяжка'], ['self', 'Самонивелирующийся пол']], function (v) { sp.screed = v; })), chk('Грунтование основания', sp.prime, function (v) { sp.prime = v; })]));
    box.appendChild(h('p', { class: 'o-sub', text: '2 · Гидроизоляция' }));
    box.appendChild(row([chk('Нужна (во влажных помещениях)', sp.hydro, function (v) { sp.hydro = v; })]));
    box.appendChild(h('p', { class: 'o-sub', text: '3 · Покрытие' }));
    box.appendChild(row([lab('Вид покрытия', sel(sp.cover, [['tile', 'Облицовка плиткой'], ['parquet', 'Паркет'], ['laminate', 'Ламинат'], ['lino', 'Линолеум'], ['none', 'Без покрытия']], function (v) { sp.cover = v; })),
      (sp.cover === 'laminate' || sp.cover === 'parquet') ? chk('Подложка', sp.underlay, function (v) { sp.underlay = v; }) : null]));
    if (sp.cover === 'tile') box.appendChild(tileEditor(sp.tile));
    box.appendChild(h('p', { class: 'o-sub', text: '4 · Плинтус' }));
    box.appendChild(row([chk('Установить плинтус', sp.plinth, function (v) { sp.plinth = v; })]));
    return box;
  }

  // ─── расчёт, общий для шагов 3–5
  function run() { var C = T.calc(S), SP = T.specs(S, C), P = T.price(S, C, SP); return { C: C, SP: SP, P: P }; }
  function money(x) { return fmt(x, 2); }
  function share(P) { return P.p2.sub > 0 ? fmt(P.p2.profit / P.p2.sub * 100, 1) : '0,0'; }

  // ─── шаг 3: смета
  function stepEst() {
    var box = h('div', { class: 'o-body' }), R = run(), C = R.C, SP = R.SP, P = R.P;
    if (!(C.hours > 0)) { box.appendChild(card('Смета пока пуста', [h('p', { text: 'Нет работ для расчёта: проверьте размеры помещений и ведомость отделки.' })])); box.appendChild(nav('sheet', null)); return box; }
    box.appendChild(h('div', { class: 'o-kv big' }, [kv('Трудозатраты', fmt(C.hours, 1) + ' чел.-ч'), kv('Материалы с НДС', money(SP.total) + ' руб.'), kv('Помещений', String(S.rooms.length))]));
    box.appendChild(card('1. Свод по помещениям', [tbl(['Помещение', 'Пол, м²', 'Труд., чел.-ч', 'Оплата труда, руб.', 'Материалы, руб.'], P.rooms.map(function (r, i) { return { c: [r.room.no + ' ' + r.room.name, fmt(r.room.geo.floor, 1), fmt(r.hours, 1), money(r.ot), money(SP.perRoom[i].cost)], r: [1, 2, 3, 4] }; }).concat([{ cls: 'tot', c: ['Итого', fmt(P.rooms.reduce(function (s, r) { return s + r.room.geo.floor; }, 0), 1), fmt(C.hours, 1), money(P.p1.ot), money(SP.roomSum)], r: [1, 2, 3, 4] }]))],
      'Оплата труда: трудозатраты × стоимость чел.-часа. Материалы по помещениям до округления до упаковок.'));
    C.rooms.forEach(function (Rm, i) {
      var d = h('details', { class: 'o-det' }, [h('summary', { text: '2.' + (i + 1) + ' Работы: ' + Rm.name + ' · ' + fmt(Rm.hours, 1) + ' чел.-ч' })]);
      d.appendChild(tbl(['Вид', 'Операция', 'Объём', 'Норма, чел.-ч', 'Труд., чел.-ч'], Rm.lines.map(function (l) { return { c: [l.surf === 'common' ? 'Общие' : T.SURF[l.surf], l.name, fmt(l.qty, 1) + ' ' + l.unit, fmt(l.norm, 2), fmt(l.hours, 2)], r: [2, 3, 4] }; })));
      box.appendChild(d);
    });
    C.rooms.forEach(function (Rm, i) {
      var pr = SP.perRoom[i], d = h('details', { class: 'o-det' }, [h('summary', { text: '3.' + (i + 1) + ' Материалы: ' + Rm.name + ' · ' + money(pr.cost) + ' руб.' })]);
      d.appendChild(tbl(['Материал', 'Нужно с запасом 10 %', 'Стоимость, руб.'], pr.list.map(function (m) { return { c: [m.name, fmt(m.need, 1) + ' ' + m.unit, money(m.cost)], r: [1, 2] }; })));
      box.appendChild(d);
    });
    var prRows = SP.rows.map(function (m) {
      return { c: [m.name, fmt(m.need, 1) + ' ' + m.unit, m.packTxt, String(m.n), nIn(m.price, function (v) { S.prices[m.id] = v; }, null, { label: 'Цена за упаковку ' + m.name }), money(m.sum)], r: [1, 3, 5] };
    });
    prRows.push({ cls: 'tot', c: ['Итого материалов с НДС', '', '', '', '', money(SP.total)], r: [5] });
    box.appendChild(card('4. Сводная спецификация материалов', [tbl(['Материал', 'Нужно с запасом', 'Фасовка', 'Купить, шт.', 'Цена за упаковку, руб.', 'Сумма, руб.'], prRows),
      btn('Вернуть цены по умолчанию', function () { S.prices = {}; commit(); })],
      'Цены ориентировочные: подставлены для проверки и меняются в таблице. В рабочем расчёте цены и названия берутся средними по нескольким поставщикам. Декор считается без материалов.'));
    box.appendChild(nav('sheet', 'price'));
    return box;
  }

  // ─── шаг 4: цена
  function stepPrice() {
    var box = h('div', { class: 'o-body' }), R = run(), P = R.P, p1 = P.p1, p2 = P.p2, rt = S.rate;
    box.appendChild(card('Исходные данные', [h('div', { class: 'o-grid' }, [
      lab('Стоимость чел.-часа', nIn(rt.hh, function (v) { rt.hh = v; }, 'руб.')), lab('Транспорт материалов', nIn(rt.trM, function (v) { rt.trM = v; }, 'руб.')),
      lab('Транспорт работников', nIn(rt.trW, function (v) { rt.trW = v; }, 'руб.')), lab('Погрузка и разгрузка', nIn(rt.load, function (v) { rt.load = v; }, 'руб.')),
      lab('Сбор и утилизация отходов', nIn(rt.waste, function (v) { rt.waste = v; }, 'руб.')),
      lab('Объект', sel(S.obj.kind, [['live', 'Жильё'], ['nolive', 'Не жильё (с НДС)']], function (v) { S.obj.kind = v; }))])],
      'Стоимость чел.-часа задаётся вручную. Трудозатраты: ' + fmt(P.hours, 1) + ' чел.-ч.'));
    var A = [
      ['Оплата труда', fmt(P.hours, 1) + ' ч × ' + money(P.hh), p1.ot, p2.ot], ['Налог самозанятых 10 % (ОТ ÷ 0,9 − ОТ)', '', p1.npd, null],
      ['Взносы в ФСЗН 34 %', '', null, p2.fszn], ['Страхование от несчастных случаев 1,5 %', '', null, p2.ins], ['Накладные расходы (ОХР) 80 % от ОТ', '', p1.ohr, p2.ohr],
      ['Материалы (цена 1: с НДС, цена 2: без НДС)', '', p1.mat, p2.mat], ['Транспорт материалов', '', p1.trM, p2.trM], ['Транспорт работников', '', p1.trW, p2.trW],
      ['Погрузка и разгрузка', '', p1.load, p2.load], ['Сбор и утилизация строительных отходов', '', p1.waste, p2.waste], ['Плановая прибыль: ' + share(P) + ' % от цены без НДС (60 % от оплаты труда)', '', null, p2.profit]];
    var rows = A.map(function (a) { return { c: [a[0], a[1], a[2] == null ? '—' : money(a[2]), a[3] == null ? '—' : money(a[3])], r: [2, 3] }; });
    rows.push({ cls: 'tot', c: ['Итого без НДС', '', money(p1.total), money(p2.sub)], r: [2, 3] });
    rows.push({ c: [P.live ? 'НДС (жильё: не начисляется)' : 'НДС 20 %', '', '—', money(p2.vat)], r: [2, 3] });
    rows.push({ cls: 'tot', c: ['ИТОГО К ОПЛАТЕ', '', money(p1.total), money(p2.total)], r: [2, 3] });
    box.appendChild(card('Расчёт цены', [tbl(['Статья', 'База', 'Цена 1: бригада заказчика, руб.', 'Цена 2: работает организация, руб.'], rows)],
      'Цена 1: заказчик приглашает бригаду и руководит работами. Цена 2: работы выполняет организация, добавляются отчисления с зарплаты, плановая прибыль и НДС для объектов не жилья. Ставки ОХР 80 % и плановой прибыли 60 % считаются только от оплаты труда: в цене 2 прибыль составляет ' + share(P) + ' % от цены без НДС.'));
    box.appendChild(h('section', { class: 'o-card o-warn' }, [h('h3', { text: 'Как читать этот расчёт' }),
      h('p', { text: 'Расчёт предварительный и укрупнённый. Он не учитывает детали объекта и проектные решения. Нормы трудозатрат и цены материалов ориентировочные. Точная стоимость определяется после осмотра объекта и изучения проекта.' })]));
    box.appendChild(nav('est', 'rep'));
    return box;
  }

  // ─── шаг 5: отчёты
  var FORMS = [['1', 'Общая смета', ''], ['2', 'Смета по помещениям', 'land'], ['3', 'Спецификация (общая)', ''], ['4', 'Спецификация по помещениям', ''], ['5', 'Заявка на материалы', ''], ['6', 'Ведомость состава работ', '']];
  function stepRep() {
    var box = h('div', { class: 'o-body' });
    var tabs = h('div', { class: 'e-sub o-forms' }, FORMS.map(function (f) { return h('a', { href: '#f' + f[0], class: String(S.form || '1') === f[0] ? 'on' : '', onclick: function (ev) { ev.preventDefault(); S.form = f[0]; save(); render(); } }, ['Форма ' + f[0] + ' · ' + f[1]]); }));
    box.appendChild(tabs);
    var cur = String(S.form || '1'), f = FORMS.filter(function (x) { return x[0] === cur; })[0];
    box.appendChild(h('div', { class: 'o-nav' }, [btn('Печать / сохранить в PDF', function () { printForm(); }, 'pri'), h('a', { class: 'o-link', href: pathPrefix() + '/raschet-smet/formy', text: 'Образцы форм' })]));
    var R = run(), sheet = h('div', { class: 'o-sheetwrap' }, [h('div', { class: 'rp-sheet on' + (f[2] ? ' land' : ''), html: formHtml(cur, R) })]);
    box.appendChild(sheet);
    Array.prototype.forEach.call(sheet.querySelectorAll('col[data-w]'), function (c) { c.style.width = c.getAttribute('data-w'); });
    box.appendChild(h('p', { class: 'e-note', text: 'В окне печати выберите «Сохранить как PDF» и отключите колонтитулы браузера. Форма 2 печатается на альбомном листе.' }));
    box.appendChild(nav('price', null));
    return box;
  }
  function pathPrefix() { var m = location.pathname.match(/^\/(be|en)\//); return m ? '/' + m[1] : ''; }
  function printForm() {
    document.body.classList.add('rp-print'); window.print();
    setTimeout(function () { document.body.classList.remove('rp-print'); }, 500);
  }

  // ─── печатные формы
  function head(code, name) { return '<div class="rp-hd"><div class="rp-logo">ТЭГА<span> +</span></div><div class="rp-fc">Форма ' + code + '<br>' + esc(name) + '</div></div>'; }
  function info(items) { return '<div class="rp-info">' + items.map(function (i) { return '<div><span>' + esc(i[0]) + '</span><b>' + esc(i[1] || '____________________') + '</b></div>'; }).join('') + '</div>'; }
  function stdInfo() { return info([['Объект', S.obj.name], ['№ расчёта', S.obj.no], ['Заказчик', S.obj.customer], ['Дата расчёта', S.obj.date]]); }
  function rtable(cols, rows, al, wd) {
    var o = '<table class="rp-t"><colgroup>' + wd.map(function (w) { return '<col data-w="' + w + '">'; }).join('') + '</colgroup><thead><tr>' + cols.map(function (c, i) { return '<th class="' + (al[i] === 'r' ? 'r' : '') + '">' + c + '</th>'; }).join('') + '</tr></thead><tbody>';
    rows.forEach(function (r) {
      if (r.grp) { o += '<tr class="grp"><td colspan="' + cols.length + '">' + esc(r.grp) + '</td></tr>'; return; }
      o += '<tr class="' + (r.k || '') + '">' + r.c.map(function (c, i) { return '<td class="' + (al[i] === 'r' ? 'r n' : '') + '">' + c + '</td>'; }).join('') + '</tr>';
    });
    return o + '</tbody></table>';
  }
  function foot(code) { return '<div class="rp-ft"><span>Предварительный укрупнённый расчёт: не учитывает детали объекта и проектные решения.</span><span class="rp-mono">Форма ' + code + ' · tega.plus</span></div>'; }
  function wrap(code, inner) { return '<div class="rp-pg"><div class="rp-wm" aria-hidden="true">tega.plus</div>' + inner + foot(code) + '</div>'; }
  function sig(a, b) { return '<div class="rp-sig"><div>' + a + '</div><div>' + b + '</div></div>'; }

  function formHtml(n, R) {
    var C = R.C, SP = R.SP, P = R.P, p1 = P.p1, p2 = P.p2, m = money;
    if (!(C.hours > 0)) return wrap(n, head(n, 'Нет данных') + '<h1>Нет данных для отчёта</h1><p class="rp-note">Заполните помещения и ведомость отделки.</p>');
    if (n === '1') {
      var rows = [
        { c: ['1', 'Оплата труда: ' + fmt(P.hours, 1) + ' чел.-ч × ' + m(P.hh), fmt(P.hours, 1) + ' ч', '—', m(p1.ot), m(p2.ot)] }, { c: ['2', 'Налог самозанятых', m(p1.ot), '10 %', m(p1.npd), '—'] },
        { c: ['3', 'Взносы в ФСЗН', m(p1.ot), '34 %', '—', m(p2.fszn)] }, { c: ['4', 'Страхование от несчастных случаев', m(p1.ot), '1,5 %', '—', m(p2.ins)] },
        { c: ['5', 'Накладные расходы (ОХР)', m(p1.ot), '80 %', m(p1.ohr), m(p2.ohr)] }, { c: ['6', 'Материалы<small>Цена 1 с НДС магазина, цена 2 без НДС</small>', '', '', m(p1.mat), m(p2.mat)] },
        { c: ['7', 'Транспорт материалов', '', '', m(p1.trM), m(p2.trM)] }, { c: ['8', 'Транспорт работников', '', '', m(p1.trW), m(p2.trW)] }, { c: ['9', 'Погрузка и разгрузка', '', '', m(p1.load), m(p2.load)] },
        { c: ['10', 'Сбор и утилизация строительных отходов', '', '', m(p1.waste), m(p2.waste)] }, { c: ['11', 'Плановая прибыль<small>' + share(P) + ' % от цены без НДС; ставка 60 % считается от оплаты труда</small>', m(p1.ot), '60 % от ОТ', '—', m(p2.profit)] },
        { k: 'sub', c: ['', 'Итого без НДС', '', '', m(p1.total), m(p2.sub)] }, { c: ['12', P.live ? 'НДС (жильё: не начисляется)' : 'НДС (объект не жильё)', P.live ? '' : m(p2.sub), P.live ? '' : '20 %', '—', m(p2.vat)] },
        { k: 'tot', c: ['', 'ИТОГО К ОПЛАТЕ', '', '', m(p1.total), m(p2.total)] }];
      return wrap(n, head(n, 'Общая смета') + '<div><h1>Общая смета</h1><p class="rp-sub">Сводный расчёт стоимости работ и материалов по объекту</p></div>' + stdInfo() +
        rtable(['№', 'Статья затрат', 'База, руб.', 'Ставка', 'Цена 1: бригада заказчика, руб.', 'Цена 2: работает организация, руб.'], rows, ['l', 'l', 'r', 'r', 'r', 'r'], ['5%', '37%', '14%', '8%', '18%', '18%']) +
        '<p class="rp-note"><b>Цена 1.</b> Заказчик приглашает бригаду и руководит работами: плановая прибыль и НДС не начисляются. <b>Цена 2.</b> Работы выполняет организация: добавляются отчисления с зарплаты, плановая прибыль и НДС для объектов, не являющихся жильём.</p>' + sig('Составил (ФИО, подпись)', 'Заказчик (ФИО, подпись)'));
    }
    if (n === '2') {
      var rr = P.rooms.map(function (r) { return { c: [r.room.no + ' ' + esc(r.room.name), fmt(r.room.geo.floor, 1), fmt(r.hours, 1), m(r.ot), m(r.fi), m(r.ohr), m(r.mat), m(r.profit), m(r.sub)] }; });
      var s = P.sums, fl = P.rooms.reduce(function (a, r) { return a + r.room.geo.floor; }, 0), e = ['', '', '', '', '', '', '', ''];
      rr.push({ k: 'sub', c: ['Итого по помещениям', fmt(fl, 1), fmt(s.hours, 1), m(s.ot), m(s.fi), m(s.ohr), m(s.mat), m(s.profit), m(s.sub)] });
      rr.push({ c: ['Округление материалов до упаковок', '', '', '', '', '', m(P.roundMat), '', m(P.roundMat)] });
      rr.push({ c: ['Транспорт материалов'].concat(e.slice(0, 7), [m(p2.trM)]) }); rr.push({ c: ['Транспорт работников'].concat(e.slice(0, 7), [m(p2.trW)]) });
      rr.push({ c: ['Погрузка и разгрузка'].concat(e.slice(0, 7), [m(p2.load)]) }); rr.push({ c: ['Сбор и утилизация строительных отходов'].concat(e.slice(0, 7), [m(p2.waste)]) });
      rr.push({ k: 'sub', c: ['Итого без НДС'].concat(e.slice(0, 7), [m(p2.sub)]) }); rr.push({ c: [P.live ? 'НДС (жильё: не начисляется)' : 'НДС 20 % (объект не жильё)'].concat(e.slice(0, 7), [m(p2.vat)]) });
      rr.push({ k: 'tot', c: ['ИТОГО К ОПЛАТЕ (цена 2)'].concat(e.slice(0, 7), [m(p2.total)]) });
      return wrap(n, head(n, 'Общая смета по помещениям') + '<div><h1>Общая смета по помещениям</h1><p class="rp-sub">Цена 2: работает организация. Расчёт в разрезе помещений, затраты по объекту в целом показаны отдельными строками.</p></div>' + stdInfo() +
        rtable(['Помещение / статья', 'Пол, м²', 'Труд., чел.-ч', 'Оплата труда, руб.', 'ФСЗН и страхование, руб.', 'ОХР, руб.', 'Материалы без НДС, руб.', 'Плановая прибыль, руб.', 'Итого без НДС, руб.'], rr, ['l', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r'], ['24%', '6%', '8%', '10%', '10%', '9%', '10%', '10%', '13%']) +
        '<p class="rp-note">Отчисления: ФСЗН 34 % и страхование 1,5 % от оплаты труда. ОХР 80 % и плановая прибыль 60 % считаются от оплаты труда; прибыль составляет ' + share(P) + ' % от цены без НДС. Материалы по помещениям даны без НДС (цены с НДС ÷ 1,2) до округления до упаковок.</p>');
    }
    if (n === '3') {
      var sr = SP.rows.map(function (r, i) { return { c: [String(i + 1), esc(r.name), r.unit, fmt(r.need, 1), r.packTxt, r.n + ' шт.', m(r.price), m(r.sum)] }; });
      sr.push({ k: 'tot', c: ['', 'ИТОГО МАТЕРИАЛОВ', '', '', '', '', '', m(SP.total)] });
      return wrap(n, head(n, 'Спецификация материалов (общая)') + '<div><h1>Спецификация материалов</h1><p class="rp-sub">Общая по объекту: количества по помещениям сложены, округление до упаковок сделано один раз</p></div>' + stdInfo() +
        rtable(['№', 'Наименование', 'Ед.', 'Нужно с запасом 10 %', 'Фасовка', 'Купить', 'Цена за упаковку, руб.', 'Сумма, руб.'], sr, ['l', 'l', 'l', 'r', 'l', 'r', 'r', 'r'], ['5%', '26%', '6%', '12%', '16%', '9%', '13%', '13%']) +
        '<p class="rp-note">Цены ориентировочные, с НДС. Покупка упаковками целиком. Декор считается без материалов.</p>');
    }
    if (n === '4') {
      var body = SP.perRoom.map(function (pr) {
        return '<div class="rp-rm"><div class="rp-h3"><b>' + pr.room.no + ' ' + esc(pr.room.name) + '</b><span>' + m(pr.cost) + ' руб.</span></div><div class="rp-note">Пол ' + fmt(pr.room.geo.floor, 1) + ' м² · стены ' + fmt(pr.room.geo.walls, 1) + ' м² · откосы ' + fmt(pr.room.geo.slLen, 1) + ' м.п.</div>' +
          rtable(['Материал', 'Нужно с запасом', 'Стоимость, руб.'], pr.list.map(function (x) { return { c: [esc(x.name), fmt(x.need, 1) + ' ' + x.unit, m(x.cost)] }; }), ['l', 'r', 'r'], ['52%', '26%', '22%']) + '</div>';
      }).join('');
      var tot = rtable(['Итого по материалам', '', ''], [{ c: ['Стоимость по помещениям', '', m(SP.roomSum)] }, { c: ['Округление до упаковок', '', m(SP.rounding)] }, { k: 'tot', c: ['ИТОГО МАТЕРИАЛОВ, руб.', '', m(SP.total)] }], ['l', 'r', 'r'], ['62%', '10%', '28%']);
      return wrap(n, head(n, 'Спецификация материалов по помещениям') + '<div><h1>Спецификация материалов по помещениям</h1><p class="rp-sub">Потребность в каждом помещении с запасом 10 %, до округления до упаковок</p></div>' + stdInfo() + body + tot);
    }
    if (n === '5') {
      var zr = SP.rows.map(function (r, i) { return { c: [String(i + 1), esc(r.name), r.packTxt, String(r.n), 'шт.', m(r.sum)] }; });
      zr.push({ k: 'tot', c: ['', 'ИТОГО (ориентировочно)', '', '', '', m(SP.total)] });
      return wrap(n, head(n, 'Заявка на материалы') + '<div><h1>Заявка на материалы</h1><p class="rp-sub">Прошу поставить материалы по списку ниже. Количество указано в упаковках.</p></div>' +
        info([['Кому (поставщик)', ''], ['Заявка №', 'З-' + esc(S.obj.no)], ['От кого', 'ООО «ТЭГА ПЛЮС», г. Минск'], ['Дата заявки', S.obj.date], ['Объект / адрес доставки', S.obj.name], ['Желаемая дата поставки', ''], ['Контактное лицо на объекте', ''], ['Телефон', '']]) +
        rtable(['№', 'Наименование', 'Фасовка', 'Количество', 'Ед.', 'Ориентировочная сумма, руб.'], zr, ['l', 'l', 'l', 'r', 'l', 'r'], ['5%', '33%', '20%', '12%', '7%', '23%']) +
        '<p class="rp-note"><b>Условия.</b> Цены окончательные подтверждает поставщик. Разгрузка: ____________. Подъём на этаж: ____________. Документы: накладная и сертификаты на материалы.</p>' + sig('Заявку составил (ФИО, подпись)', 'Поставщик принял (ФИО, подпись)'));
    }
    var G = T.worksByObject(S, C), wr = [], gi = 0, tot6 = 0;
    ['walls', 'slopes', 'ceiling', 'floor', 'common'].forEach(function (sf) {
      var g = G[sf]; if (!g) return; gi++; var sub = 0, k = 0;
      var tt = sf === 'common' ? 'Общие работы' : T.SURF[sf] + ' · ' + fmt(sf === 'slopes' ? C.rooms.reduce(function (a, r) { return a + r.geo.slLen; }, 0) : C.rooms.reduce(function (a, r) { return a + T.surfTotal(r.geo, sf); }, 0), 1) + (sf === 'slopes' ? ' м.п.' : ' м²');
      wr.push({ grp: tt });
      g.order.forEach(function (key) { var it = g.items[key]; k++; sub += it.hours; wr.push({ c: [gi + '.' + k, esc(it.name), it.unit, fmt(it.qty, 1), fmt(it.hours / it.qty, 2), fmt(it.hours, 2)] }); });
      if (sf !== 'common') wr.push({ k: 'sub', c: ['', 'Итого: ' + T.SURF[sf].toLowerCase(), '', '', '', fmt(sub, 2)] }); tot6 += sub;
    });
    wr.push({ k: 'tot', c: ['', 'ВСЕГО ТРУДОЗАТРАТ, чел.-ч', '', '', '', fmt(tot6, 2)] });
    return wrap(n, head(n, 'Ведомость состава работ') + '<div><h1>Ведомость состава работ</h1><p class="rp-sub">Операции по каждому виду работ с трудозатратами. Оплата труда при ' + m(P.hh) + ' руб./ч: ' + m(p1.ot) + ' руб.</p></div>' +
      info([['Объект', S.obj.name], ['№ расчёта', S.obj.no], ['Стоимость ч/ч', m(P.hh) + ' руб.'], ['Дата расчёта', S.obj.date]]) +
      rtable(['№', 'Операция', 'Ед.', 'Объём', 'Норма, чел.-ч на ед.', 'Трудозатраты, чел.-ч'], wr, ['l', 'l', 'l', 'r', 'r', 'r'], ['7%', '41%', '9%', '11%', '16%', '16%']) +
      '<p class="rp-note">Состав работ принят по ведомости отделки. Нормы трудозатрат ориентировочные: в рабочем расчёте применяются нормы сборников НРР-2022 с коэффициентами (например, по размеру плитки).</p>');
  }

  // ─── отрисовка
  function render() {
    fc = 0; el.textContent = '';
    el.appendChild(stepper());
    var b = S.step === 'sheet' ? stepSheet() : S.step === 'est' ? stepEst() : S.step === 'price' ? stepPrice() : S.step === 'rep' ? stepRep() : stepRooms();
    el.appendChild(b);
  }
  render();
})();
