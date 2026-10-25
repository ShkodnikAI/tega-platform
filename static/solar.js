/* Солнечная генерация: интерфейс калькулятора. Модель — в solar-model.js.
   Ориентировочный расчёт для разговора с проектировщиком, не проект и не оферта. */
(function () {
  'use strict';
  var S = window.TegaSolar;
  if (!S) return;
  var NS = 'http://www.w3.org/2000/svg';
  var INK = '#1d1f23', RED = '#e3000f', MUT = '#4a4d55', G1 = '#7d8089', G3 = '#c6c8cd', GRID = '#e4e5e8';
  function $(id) { return document.getElementById(id); }
  function num(id) {
    var el = $(id); if (!el) return NaN;
    var n = parseFloat(String(el.value).replace(/\s/g, '').replace(',', '.').replace(/−/g, '-'));
    return isFinite(n) ? n : NaN;
  }
  function val(id) { var el = $(id); return el ? el.value : ''; }
  function radio(name) { var el = document.querySelector('input[name="' + name + '"]:checked'); return el ? el.value : ''; }
  function fmt(x, d) {
    if (!isFinite(x)) return '—';
    var s = Math.abs(x).toFixed(d), p = s.split('.');
    p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return (x < 0 ? '−' : '') + p.join(',');
  }
  function set(id, v) { var el = $(id); if (el) el.textContent = v; }
  function svg(name, attrs, text) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }
  function T(parent, x, y, s, size, fill, anchor, weight) {
    parent.appendChild(svg('text', { x: x, y: y, 'font-size': size || 12, fill: fill || INK, 'text-anchor': anchor || 'start', 'font-weight': weight || '400' }, s));
  }
  function clearNode(n) { while (n.firstChild) n.removeChild(n.firstChild); }

  var PRICE_LABELS = {
    mod_w: 'Модули, USD за Вт', mount_roof_w: 'Крепление на кровле, USD за Вт', mount_fence_w: 'Каркас забора под модули, USD за Вт (доплата к ограждению)',
    inv_hyb_kw: 'Гибридный инвертор, USD за кВт', inv_grid_kw: 'Сетевой инвертор, USD за кВт', bat_kwh: 'Накопитель LFP, USD за кВт·ч',
    cab_dc_m: 'Кабель PV1-F 6 мм², USD за м', mc4: 'Разъёмы MC4, USD за пару', spd_dc: 'УЗИП II DC, USD', spd_ac: 'УЗИП II AC, USD', dcsw: 'DC-разъединитель, USD',
    acbrk: 'Автомат AC, USD', rcd: 'УЗО, USD', eps_box: 'Щит резервной группы, USD', meter: 'Двунаправленный счётчик, USD', logger: 'Логгер и мониторинг, USD',
    ground: 'Заземление, USD', ac_cab_m: 'Кабель AC (база 6 мм²), USD за м', labor_w: 'Монтаж и наладка, USD за Вт', design: 'Проект и аудит тени, USD', rate: 'Курс, BYN за 1 USD'
  };
  var PRESETS = {
    p5: { load: 5000, profile: 'evening', season: 'usual', shift: 0, phases: '1', tariff: 'a', scheme: 'one', bat: 0, a: [[9, 'm550', 35, 0, 0], [0, 'm550', 35, 0, 0], [0, 'b580', 90, 90, 0]] },
    p10: { load: 9000, profile: 'home', season: 'usual', shift: 0, phases: '1', tariff: 'a', scheme: 'two', bat: 10, a: [[18, 'm550', 35, 0, 0], [0, 'm550', 35, 0, 0], [0, 'b580', 90, 90, 0]] },
    pfence: { load: 9000, profile: 'home', season: 'heat', shift: 0, phases: '3', tariff: 'a', scheme: 'two', bat: 10, a: [[12, 'm550', 35, 0, 0], [0, 'm550', 35, 0, 0], [10, 'b580', 90, 90, 0]] },
    p30: { load: 40000, profile: 'day', season: 'flat', shift: 0, phases: '3', tariff: 'b', scheme: 'one', bat: 0, who: 'jur', a: [[54, 'm550', 30, 0, 0], [0, 'm550', 35, 0, 0], [0, 'b580', 90, 90, 0]] }
  };

  function readPrices() {
    var P = {};
    Object.keys(PRICE_LABELS).forEach(function (k) { var v = num('sg-pr-' + k); if (isFinite(v) && v >= 0) P[k] = v; });
    return P;
  }
  function readCustom() {
    var p = num('sg-cm-p'), voc = num('sg-cm-voc'), vmp = num('sg-cm-vmp'), isc = num('sg-cm-isc'), imp = num('sg-cm-imp');
    var tp = num('sg-cm-tp'), tv = num('sg-cm-tv'), bif = num('sg-cm-bif');
    var ok = p > 0 && voc > 0 && vmp > 0 && isc > 0 && imp > 0 && vmp < voc && imp < isc;
    if (!ok) return null;
    var m = S.MODULES.custom;
    m.name = 'Свой модуль ' + fmt(p, 0) + ' Вт'; m.p = p; m.voc = voc; m.vmp = vmp; m.isc = isc; m.imp = imp;
    m.tp = -Math.abs(isFinite(tp) ? tp : 0.30) / 100; m.tv = -Math.abs(isFinite(tv) ? tv : 0.25) / 100;
    m.bif = clamp(bif, 0, 0.95, 0);
    return m;
  }
  function readCfg() {
    var arrays = [];
    for (var i = 1; i <= 3; i++) {
      arrays.push({ n: Math.max(0, Math.round(num('sg-a' + i + '-n')) || 0), type: val('sg-a' + i + '-type') || 'm550', tilt: clamp(num('sg-a' + i + '-tilt'), 0, 90, 35), az: clamp(num('sg-a' + i + '-az'), -180, 180, 0), tight: val('sg-a' + i + '-tight') === '1' });
    }
    return {
      arrays: arrays, load: num('sg-load'), profile: val('sg-profile'), season: val('sg-season'), shift: clamp(num('sg-shift'), 0, 60, 0) / 100,
      phases: parseInt(radio('sg-ph'), 10) || 1, tariff: val('sg-tariff'), scheme: radio('sg-scheme') || 'one', tariffK: 1 + clamp(num('sg-tk'), -50, 200, 0) / 100,
      buyback: clamp(num('sg-buy'), 0, 5, 0.1), growth: clamp(num('sg-growth'), -10, 30, 6) / 100, disc: clamp(num('sg-disc'), 0, 30, 8) / 100,
      battery: Math.max(0, num('sg-bat') || 0), reserve: clamp(num('sg-rsv'), 0, 90, 20) / 100,
      shade: clamp(num('sg-shade'), 0, 60, 3) / 100, tmin: clamp(num('sg-tmin'), -45, 0, -25), dist: clamp(num('sg-dist'), 1, 200, 15), distAc: clamp(num('sg-distac'), 1, 100, 10),
      dcLoss: 0.03, dcac: 1.25, who: val('sg-who') || 'phys', crit: clamp(num('sg-crit'), 0, 50, 1)
    };
  }
  function clamp(x, a, b, d) { if (!isFinite(x)) return d; return Math.max(a, Math.min(b, x)); }

  var last = null;
  function calc() {
    var cfg = readCfg();
    var arrs = cfg.arrays.filter(function (a) { return a.n > 0; });
    var ids = ['sg-kwp', 'sg-inv', 'sg-gen', 'sg-yield', 'sg-self', 'sg-cover', 'sg-exp', 'sg-imp', 'sg-sav', 'sg-capex', 'sg-pay', 'sg-npv', 'sg-bw'];
    if (!isFinite(cfg.load) || cfg.load <= 0 || !arrs.length) {
      last = null; ids.forEach(function (i) { set(i, '—'); });
      verdict('Укажите годовое потребление и число модулей хотя бы в одном массиве.', true);
      ['sg-ch-year', 'sg-ch-day', 'sg-ch-cash'].forEach(function (i) { var n = $(i); if (n) clearNode(n); });
      return;
    }
    var customUsed = arrs.some(function (a) { return a.type === 'custom'; });
    if (customUsed && !readCustom()) {
      last = null; ids.forEach(function (i) { set(i, '—'); });
      verdict('Свой модуль: заполните Pmax, Voc, Vmp, Isc, Imp (Vmp меньше Voc, Imp меньше Isc).', true);
      return;
    }
    if (!customUsed) readCustom();
    var prices = readPrices();
    var r = S.configure(cfg, prices);
    last = { cfg: cfg, r: r, prices: prices };
    var s = r.sim, e = r.econ, b = r.bom, pk = r.pick;
    set('sg-kwp', fmt(s.kwp, 2) + ' кВтп (' + arrs.reduce(function (t, a) { return t + a.n; }, 0) + ' мод.)');
    set('sg-inv', (pk.count > 1 ? pk.count + ' × ' : '') + pk.inv.name);
    set('sg-gen', fmt(s.genY, 0) + ' кВт·ч/год');
    set('sg-yield', fmt(s.genY / s.kwp, 0) + ' кВт·ч/кВтп');
    set('sg-self', fmt(s.selfY / s.genY * 100, 0) + ' % выработки');
    set('sg-cover', fmt(s.selfY / s.loadY * 100, 0) + ' % потребления');
    set('sg-exp', fmt(s.expY, 0) + ' кВт·ч (' + fmt(s.expY / s.genY * 100, 0) + ' %)');
    set('sg-imp', fmt(s.impY, 0) + ' кВт·ч');
    set('sg-sav', fmt(s.savings, 0) + ' BYN/год');
    set('sg-capex', fmt(b.byn, 0) + ' BYN (' + fmt(b.usd, 0) + ' USD)');
    set('sg-pay', e.pay ? fmt(e.pay, 1) + ' лет' : 'не окупается за 25 лет');
    set('sg-npv', fmt(e.npv, 0) + ' BYN (IRR ' + (e.irr == null ? '—' : fmt(e.irr * 100, 1) + ' %') + ')');
    var bw = '—';
    if (cfg.battery > 0) {
      var c0 = Object.assign({}, cfg, { battery: 0 }), r0 = S.configure(c0, prices);
      var d = e.npv - r0.econ.npv;
      bw = (d >= 0 ? '+' : '−') + fmt(Math.abs(d), 0) + ' BYN к NPV · ' + fmt(s.cycles, 0) + ' циклов/год';
      last.noBat = r0;
    } else last.noBat = null;
    set('sg-bw', bw);
    var notes = [], bad = false;
    if (customUsed) {
      var cm = S.MODULES.custom, dev = Math.abs(cm.vmp * cm.imp / cm.p - 1);
      if (dev > 0.06) { notes.push('у своего модуля Vmp·Imp = ' + fmt(cm.vmp * cm.imp, 0) + ' Вт при Pmax ' + fmt(cm.p, 0) + ' Вт: проверьте данные паспорта'); bad = true; }
    }
    if (s.kwp > 15 && cfg.who === 'phys') { notes.push('мощность больше 15 кВт: для частного лица это уже не микрогенерация, условия подключения нужно уточнять в энергоснабжающей организации'); bad = true; }
    if (s.expY / s.genY > 0.3) { notes.push('в сеть уходит ' + fmt(s.expY / s.genY * 100, 0) + ' % выработки по низкому тарифу: сдвиньте нагрузку на день или уменьшите мощность'); bad = true; }
    pk.lays.forEach(function (l, i) { if (!l.ok) { notes.push('массив ' + (i + 1) + ': ' + (l.why || 'не получается собрать строки')); bad = true; } else if (l.extra > 0) notes.push('массив ' + (i + 1) + ': для целых строк добавлено ' + l.extra + ' мод.'); });
    if (pk.multi) { notes.push('нужно несколько инверторов (' + pk.count + ' шт.)'); }
    if (pk.ratio > 1.4) { notes.push('DC/AC ' + fmt(pk.ratio, 2) + ' выше 1,4: заметный клиппинг'); bad = true; }
    if (s.clip > 0.02 * s.genY) { notes.push('срезается ' + fmt(s.clip, 0) + ' кВт·ч в год на пределе мощности инвертора'); }
    if (cfg.battery > 0 && last.noBat && e.npv < last.noBat.econ.npv) notes.push('батарея в этом сценарии не окупается: она нужна под резерв или зонный тариф, а не «для экономии»');
    if (cfg.battery > 0 && cfg.crit > 0) {
      notes.push('резерв: при нагрузке ' + fmt(cfg.crit, 1) + ' кВт батареи хватит примерно на ' + fmt(cfg.battery * (1 - Math.max(cfg.reserve, 0.1)) * 0.96 / cfg.crit, 1) + ' ч без солнца');
    }
    if (!notes.length) notes.push('расчёт сходится, замечаний нет');
    verdict('Оценка по часам для Минска, юг, средний год. ' + notes.join('; ') + '.', bad);
    drawYear(); drawDay(); renderBom(); drawCash(); sens();
  }
  function verdict(t, bad) { var el = $('sg-verdict'); if (!el) return; el.textContent = t; el.className = 'verdict' + (bad ? ' bad' : ''); }

  /* ───────── графики ───────── */
  function axes(g, x0, y0, w, h, ymax, unit, ticks) {
    for (var i = 0; i <= ticks; i++) {
      var y = y0 + h - h * i / ticks;
      g.appendChild(svg('line', { x1: x0, y1: y, x2: x0 + w, y2: y, stroke: GRID }));
      T(g, x0 - 6, y + 4, fmt(ymax * i / ticks, ymax < 10 ? 1 : 0), 11, MUT, 'end');
    }
    if (unit) T(g, x0 - 36, y0 - 14, unit, 11, MUT, 'start');
  }
  function drawYear() {
    var host = $('sg-ch-year'), tb = $('sg-tb-year'); if (!host || !last) return;
    clearNode(host); clearNode(tb);
    var s = last.r.sim, W = 760, H = 330, x0 = 54, y0 = 28, w = W - x0 - 14, h = H - y0 - 60;
    var mx = 0, m; for (m = 0; m < 12; m++) mx = Math.max(mx, s.gen[m], s.load[m]);
    var step = mx > 4000 ? 1000 : mx > 1500 ? 500 : mx > 600 ? 200 : mx > 250 ? 100 : 50, ymax = Math.ceil(mx * 1.08 / step) * step;
    var el = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Выработка и потребление по месяцам' });
    axes(el, x0, y0, w, h, ymax, 'кВт·ч за месяц', Math.round(ymax / step));
    var bw = w / 12;
    for (m = 0; m < 12; m++) {
      var bx = x0 + m * bw + bw * 0.16, ww = bw * 0.68, direct = s.self[m], exp = s.exp[m];
      var h1 = h * direct / ymax, h2 = h * exp / ymax;
      el.appendChild(svg('rect', { x: bx, y: y0 + h - h1, width: ww, height: h1, fill: INK }));
      el.appendChild(svg('rect', { x: bx, y: y0 + h - h1 - h2, width: ww, height: h2, fill: RED }));
      T(el, bx + ww / 2, y0 + h + 16, S.MONTHS[m], 12, MUT, 'middle');
      var ly = y0 + h - h * s.load[m] / ymax;
      el.appendChild(svg('line', { x1: bx - 3, y1: ly, x2: bx + ww + 3, y2: ly, stroke: G1, 'stroke-width': 3 }));
    }
    var ly2 = H - 18;
    el.appendChild(svg('rect', { x: x0, y: ly2 - 10, width: 12, height: 12, fill: INK })); T(el, x0 + 18, ly2, 'своё потребление (напрямую и через АКБ)', 12, INK);
    el.appendChild(svg('rect', { x: x0 + 330, y: ly2 - 10, width: 12, height: 12, fill: RED })); T(el, x0 + 348, ly2, 'в сеть', 12, INK);
    el.appendChild(svg('line', { x1: x0 + 420, y1: ly2 - 4, x2: x0 + 442, y2: ly2 - 4, stroke: G1, 'stroke-width': 3 })); T(el, x0 + 448, ly2, 'потребление дома', 12, INK);
    host.appendChild(el);
    var rows = [], tot = [0, 0, 0, 0, 0];
    for (m = 0; m < 12; m++) {
      rows.push([S.MONTHS[m], s.gen[m], s.load[m], s.self[m], s.exp[m], s.imp[m]]);
      tot[0] += s.gen[m]; tot[1] += s.load[m]; tot[2] += s.self[m]; tot[3] += s.exp[m]; tot[4] += s.imp[m];
    }
    rows.push(['Год', tot[0], tot[1], tot[2], tot[3], tot[4]]);
    var th = document.createElement('thead'), trh = document.createElement('tr');
    ['Месяц', 'Выработка', 'Потребление', 'Своё', 'В сеть', 'Из сети'].forEach(function (t) { var c = document.createElement('th'); c.textContent = t + (t === 'Месяц' ? '' : ', кВт·ч'); trh.appendChild(c); });
    th.appendChild(trh); tb.appendChild(th);
    var body = document.createElement('tbody');
    rows.forEach(function (r) {
      var tr = document.createElement('tr');
      r.forEach(function (v, i) { var td = document.createElement('td'); td.textContent = i ? fmt(v, 0) : v; tr.appendChild(td); });
      body.appendChild(tr);
    });
    tb.appendChild(body);
  }
  function drawDay() {
    var host = $('sg-ch-day'); if (!host || !last) return;
    clearNode(host);
    var m = parseInt(val('sg-day-m'), 10); if (!(m >= 0 && m < 12)) m = 6;
    var rec = last.r.sim.day[m], W = 760, H = 320, x0 = 54, y0 = 28, w = W - x0 - 54, h = H - y0 - 62, mx = 0, i;
    for (i = 0; i < 24; i++) mx = Math.max(mx, rec[i].pv, rec[i].load);
    var step = mx > 8 ? 2 : mx > 3 ? 1 : mx > 1.2 ? 0.5 : 0.2, ymax = Math.ceil(mx * 1.1 / step) * step;
    var el = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Типовые сутки' });
    axes(el, x0, y0, w, h, ymax, 'кВт', Math.round(ymax / step));
    var bw = w / 24, C = last.cfg.battery;
    for (i = 0; i < 24; i++) {
      var r = rec[i], bx = x0 + i * bw;
      var hp = h * r.pv / ymax;
      el.appendChild(svg('rect', { x: bx + 1, y: y0 + h - hp, width: bw - 2, height: hp, fill: G3 }));
      if (i % 3 === 0) T(el, bx + bw / 2, y0 + h + 16, String(i), 11, MUT, 'middle');
    }
    var pts = [];
    for (i = 0; i < 24; i++) pts.push((x0 + (i + 0.5) * bw).toFixed(1) + ',' + (y0 + h - h * rec[i].load / ymax).toFixed(1));
    el.appendChild(svg('polyline', { points: pts.join(' '), fill: 'none', stroke: INK, 'stroke-width': 3 }));
    if (C > 0) {
      var sp = [];
      for (i = 0; i < 24; i++) sp.push((x0 + (i + 0.5) * bw).toFixed(1) + ',' + (y0 + h - h * rec[i].soc / C).toFixed(1));
      el.appendChild(svg('polyline', { points: sp.join(' '), fill: 'none', stroke: RED, 'stroke-width': 2.5, 'stroke-dasharray': '6 4' }));
      T(el, x0 + w + 6, y0 + 8, '100 %', 11, RED); T(el, x0 + w + 6, y0 + h + 4, '0 %', 11, RED);
      T(el, x0 + w + 6, y0 + h / 2, 'заряд АКБ', 11, RED);
    }
    var ly2 = H - 16;
    el.appendChild(svg('rect', { x: x0, y: ly2 - 10, width: 12, height: 12, fill: G3 })); T(el, x0 + 18, ly2, 'выработка', 12, INK);
    el.appendChild(svg('line', { x1: x0 + 110, y1: ly2 - 4, x2: x0 + 134, y2: ly2 - 4, stroke: INK, 'stroke-width': 3 })); T(el, x0 + 140, ly2, 'нагрузка дома', 12, INK);
    if (C > 0) { el.appendChild(svg('line', { x1: x0 + 260, y1: ly2 - 4, x2: x0 + 284, y2: ly2 - 4, stroke: RED, 'stroke-width': 2.5, 'stroke-dasharray': '6 4' })); T(el, x0 + 290, ly2, 'заряд батареи', 12, INK); }
    T(el, x0 + w, ly2, 'час суток', 11, MUT, 'end');
    host.appendChild(el);
    var gp = 0, ld = 0, ex = 0, im = 0;
    rec.forEach(function (r) { gp += r.pv; ld += r.load; ex += r.ex; im += r.im; });
    set('sg-day-sum', S.MONTHS[m] + ', средний день: выработка ' + fmt(gp, 1) + ' кВт·ч, потребление ' + fmt(ld, 1) + ' кВт·ч, в сеть ' + fmt(ex, 1) + ' кВт·ч, из сети ' + fmt(im, 1) + ' кВт·ч.');
  }
  function drawCash() {
    var host = $('sg-ch-cash'); if (!host || !last) return;
    clearNode(host);
    var e = last.r.econ, cfg0 = Object.assign({}, last.cfg, { growth: 0 }), e0 = S.econ(cfg0, last.r.sim, last.r.bom.byn, last.r.bom.invUsd * last.r.bom.rate, last.r.bom.batUsd * last.r.bom.rate);
    var W = 760, H = 330, x0 = 66, y0 = 24, w = W - x0 - 16, h = H - y0 - 62;
    var mn = Math.min.apply(null, e.cum.concat(e0.cum)), mx = Math.max.apply(null, e.cum.concat(e0.cum));
    var span = mx - mn, step = Math.pow(10, Math.floor(Math.log(span / 5) / Math.LN10)); var f = span / 5 / step; step *= f > 5 ? 10 : f > 2 ? 5 : f > 1 ? 2 : 1;
    var lo = Math.floor(mn / step) * step, hi = Math.ceil(mx / step) * step, n = Math.round((hi - lo) / step);
    var el = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Накопленный денежный поток' });
    var Y = function (v) { return y0 + h - h * (v - lo) / (hi - lo); }, X = function (t) { return x0 + w * t / 25; };
    for (var i = 0; i <= n; i++) { var v = lo + i * step; el.appendChild(svg('line', { x1: x0, y1: Y(v), x2: x0 + w, y2: Y(v), stroke: v === 0 ? INK : GRID, 'stroke-width': v === 0 ? 1.5 : 1 })); T(el, x0 - 6, Y(v) + 4, fmt(v, 0), 11, MUT, 'end'); }
    T(el, x0 - 60, y0 - 10, 'BYN, накопленно', 11, MUT);
    [0, 5, 10, 15, 20, 25].forEach(function (t) { T(el, X(t), y0 + h + 16, String(t), 11, MUT, 'middle'); });
    T(el, x0 + w, y0 + h + 34, 'годы', 11, MUT, 'end');
    var line = function (c, col, wd, dash) { var p = c.map(function (v, t) { return X(t).toFixed(1) + ',' + Y(v).toFixed(1); }); el.appendChild(svg('polyline', { points: p.join(' '), fill: 'none', stroke: col, 'stroke-width': wd, 'stroke-dasharray': dash || '0' })); };
    line(e0.cum, G1, 2.5, '6 4'); line(e.cum, RED, 3.5);
    if (e.pay) { el.appendChild(svg('circle', { cx: X(e.pay), cy: Y(0), r: 5, fill: '#fff', stroke: INK, 'stroke-width': 2.5 })); T(el, X(e.pay), Y(0) - 12, fmt(e.pay, 1) + ' лет', 12, INK, 'middle', '700'); }
    var ly2 = H - 16;
    el.appendChild(svg('line', { x1: x0, y1: ly2 - 4, x2: x0 + 24, y2: ly2 - 4, stroke: RED, 'stroke-width': 3.5 })); T(el, x0 + 30, ly2, 'тариф растёт на ' + fmt(last.cfg.growth * 100, 0) + ' % в год', 12, INK);
    el.appendChild(svg('line', { x1: x0 + 240, y1: ly2 - 4, x2: x0 + 264, y2: ly2 - 4, stroke: G1, 'stroke-width': 2.5, 'stroke-dasharray': '6 4' })); T(el, x0 + 270, ly2, 'тариф не растёт', 12, INK);
    host.appendChild(el);
    set('sg-cash-note', 'В расчёт заложены: деградация модулей 0,4 % в год, обслуживание 0,5 % затрат в год, замена инвертора на 13-й год' + (last.cfg.battery > 0 ? ' и батареи на ' + (e.batLife + 1) + '-й год' : '') + ', дисконт ' + fmt(last.cfg.disc * 100, 0) + ' %.');
  }
  function sens() {
    var tb = $('sg-tb-sens'); if (!tb || !last) return; clearNode(tb);
    var gs = [0, 0.03, 0.06, 0.09, 0.12], cs = [-0.2, 0, 0.2], r = last.r;
    var th = document.createElement('thead'), tr = document.createElement('tr'), c = document.createElement('th'); c.textContent = 'Затраты ↓ / рост тарифа →'; tr.appendChild(c);
    gs.forEach(function (g) { var x = document.createElement('th'); x.textContent = fmt(g * 100, 0) + ' %'; tr.appendChild(x); });
    th.appendChild(tr); tb.appendChild(th);
    var body = document.createElement('tbody');
    cs.forEach(function (d) {
      var row = document.createElement('tr'), h = document.createElement('td'); h.textContent = (d > 0 ? '+' : d < 0 ? '−' : '') + Math.abs(d * 100) + ' %' + (d === 0 ? ' (базовые)' : ''); row.appendChild(h);
      gs.forEach(function (g) {
        var e = S.econ(Object.assign({}, last.cfg, { growth: g }), r.sim, r.bom.byn * (1 + d), r.bom.invUsd * r.bom.rate, r.bom.batUsd * r.bom.rate), td = document.createElement('td');
        td.textContent = e.pay ? fmt(e.pay, 1) + ' лет' : '25+ лет'; row.appendChild(td);
      });
      body.appendChild(row);
    });
    tb.appendChild(body);
  }

  /* ───────── спецификация ───────── */
  function renderBom() {
    var host = $('sg-bom'); if (!host || !last) return;
    clearNode(host);
    var r = last.r, b = r.bom, pk = r.pick;
    // схема строк
    var tbl = document.createElement('table'); tbl.className = 'e-tbl';
    var thd = '<thead><tr><th>Массив</th><th>Модулей</th><th>Строк × модулей в строке</th><th>Напряжение строки, В (холод −' + Math.abs(last.cfg.tmin) + ' °С / жара)</th><th>MPPT занято</th></tr></thead>';
    var rowsH = '';
    pk.arrs.forEach(function (a, i) {
      var l = pk.lays[i], mod = S.MODULES[a.type];
      if (!l.ok) { rowsH += '<tr><td>' + (i + 1) + '</td><td>' + a.n + '</td><td colspan="3">не собирается: ' + (l.why || '') + '</td></tr>'; return; }
      rowsH += '<tr><td>' + (i + 1) + ' · ' + (a.tilt >= 75 ? 'забор' : 'кровля') + ' ' + a.tilt + '°, азимут ' + a.az + '°</td><td>' + (pk.multi ? a.n : l.tot) + '</td><td>' + l.s + ' × ' + l.n + '</td><td>Voc ' + fmt(l.n * l.range.vocCold, 0) + ' (предел ' + pk.inv.vmax + ') / Vmp ' + fmt(l.n * l.range.vmpHot, 0) + ' (от ' + pk.inv.vlo + ')</td><td>' + l.mp + ' из ' + pk.inv.mppt + '</td></tr>';
    });
    tbl.innerHTML = thd + '<tbody>' + rowsH + '</tbody>';
    var sc = document.createElement('div'); sc.className = 'e-scroll'; sc.appendChild(tbl);
    var h1 = document.createElement('h4'); h1.className = 'e-h4'; h1.textContent = 'Инвертор и строки'; host.appendChild(h1);
    var p = document.createElement('p'); p.className = 'e-note';
    p.textContent = (pk.count > 1 ? pk.count + ' × ' : '') + pk.inv.name + '. DC/AC ' + fmt(pk.ratio, 2) + '. Напряжение холостого хода считается на морозе −' + Math.abs(last.cfg.tmin) + ' °С, рабочее на нижней границе MPPT при +70 °С на ячейке: строка обязана укладываться в оба предела.';
    host.appendChild(p); host.appendChild(sc);
    var h2 = document.createElement('h4'); h2.className = 'e-h4'; h2.textContent = 'Спецификация'; host.appendChild(h2);
    var t2 = document.createElement('table'); t2.className = 'e-tbl';
    var html = '<thead><tr><th>Позиция</th><th>Кол-во</th><th>Цена, USD</th><th>Сумма, USD</th></tr></thead><tbody>', grp = '';
    b.lines.forEach(function (l) {
      if (l.grp !== grp) { grp = l.grp; html += '<tr><td colspan="4"><b>' + grp + '</b></td></tr>'; }
      html += '<tr><td>' + esc(l.name) + (l.note ? '<br><small>' + esc(l.note) + '</small>' : '') + '</td><td>' + fmt(l.qty, 0) + ' ' + l.unit + '</td><td>' + fmt(l.price, l.price < 10 ? 2 : 0) + '</td><td>' + fmt(l.sum, 0) + '</td></tr>';
    });
    html += '<tr><td colspan="3"><b>Итого, USD</b></td><td><b>' + fmt(b.usd, 0) + '</b></td></tr><tr><td colspan="3"><b>Итого, BYN по курсу ' + fmt(b.rate, 2) + '</b></td><td><b>' + fmt(b.byn, 0) + '</b></td></tr></tbody>';
    t2.innerHTML = html;
    var sc2 = document.createElement('div'); sc2.className = 'e-scroll'; sc2.appendChild(t2); host.appendChild(sc2);
    var n = document.createElement('p'); n.className = 'e-note';
    n.textContent = 'Цены розничные ориентировочные (Минск, 2025–2026) и меняются в блоке ниже. НДС включён. Модели инверторов и батарей даны классами: Deye, Growatt, Solis, GoodWe, Huawei, Pylontech, BYD, Sungrow выбирают по наличию, сервису и совместимости (HV или LV).';
    host.appendChild(n);
    // перечень защит
    var h3 = document.createElement('h4'); h3.className = 'e-h4'; h3.textContent = 'Что обязательно в проекте'; host.appendChild(h3);
    var ul = document.createElement('ul'); ul.className = 'e-ul';
    ['УЗИП II класса на DC и AC, заземление и уравнивание потенциалов; в схеме подписать строки (' + b.strings + ') и DC-разъединители (' + b.mppts + ').',
      'AC-автомат около ' + fmt(b.iac * 1.25, 0) + ' А и УЗО, кабель AC медь ' + b.sec + ' мм² (потеря не более 1,5 %).',
      'Кабель DC только солнечный PV1-F, разъёмы MC4 одного производителя, трассы вне стяжек и с защитой от УФ.',
      'Видимый разрыв DC для пожарных и маркировка трасс; для крыши с людьми под ней рассмотрите rapid shutdown.',
      'Анти-остров и сетевые защиты: сертификат инвертора для приёмки микрогенерации.',
      last.cfg.battery > 0 ? 'Батарея: BMS с подогревом или запретом заряда ниже 0 °С, резервная группа через EPS, сценарии EMS (заряд от избытка, резерв ' + fmt(last.cfg.reserve * 100, 0) + ' %).' : 'Если батарея понадобится позже, берите гибридный инвертор с портом АКБ сразу.'
    ].forEach(function (t) { var li = document.createElement('li'); li.textContent = t; ul.appendChild(li); });
    host.appendChild(ul);
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  /* ───────── подбор мощности и батареи ───────── */
  function optimize() {
    if (!last) return;
    var cfg = last.cfg, out = [], nMax = cfg.who === 'phys' ? 15 : 60, mod = S.MODULES[cfg.arrays[0].type], bats = [0, 5, 10, 15, 20];
    var base = cfg.arrays.slice(1).reduce(function (s, a) { return s + a.n * S.MODULES[a.type].p / 1000; }, 0);
    for (var n = 4; n <= 120; n += 2) {
      var kwp = n * mod.p / 1000 + base;
      if (kwp > nMax + 0.01) break;
      bats.forEach(function (bt) {
        var c = Object.assign({}, cfg, { battery: bt, arrays: [Object.assign({}, cfg.arrays[0], { n: n }), cfg.arrays[1], cfg.arrays[2]] });
        var r = S.configure(c, last.prices);
        out.push({ n: n, bat: bt, kwp: r.sim.kwp, self: r.sim.selfY / r.sim.genY, pay: r.econ.pay, npv: r.econ.npv, irr: r.econ.irr, capex: r.bom.byn, exp: r.sim.expY / r.sim.genY });
      });
    }
    out.sort(function (a, b) { return b.npv - a.npv; });
    var host = $('sg-opt'); clearNode(host);
    var t = document.createElement('table'); t.className = 'e-tbl';
    var html = '<thead><tr><th>Кровля, модулей</th><th>Всего, кВтп</th><th>АКБ, кВт·ч</th><th>Своё, % выработки</th><th>Окупаемость</th><th>NPV, BYN</th><th></th></tr></thead><tbody>';
    out.slice(0, 6).forEach(function (o, i) {
      html += '<tr><td>' + o.n + '</td><td>' + fmt(o.kwp, 1) + '</td><td>' + o.bat + '</td><td>' + fmt(o.self * 100, 0) + '</td><td>' + (o.pay ? fmt(o.pay, 1) + ' лет' : '25+ лет') + '</td><td>' + fmt(o.npv, 0) + '</td><td><button class="e-btn sm" type="button" data-n="' + o.n + '" data-b="' + o.bat + '">Применить</button></td></tr>';
    });
    t.innerHTML = html + '</tbody>';
    var sc = document.createElement('div'); sc.className = 'e-scroll'; sc.appendChild(t); host.appendChild(sc);
    var pbest = out.filter(function (o) { return o.pay; }).sort(function (a, b) { return a.pay - b.pay; })[0];
    var p = document.createElement('p'); p.className = 'e-note';
    p.textContent = 'Перебор мощности кровельного массива от 4 модулей' + (cfg.who === 'phys' ? ' до предела 15 кВт' : '') + ' и батареи 0–20 кВт·ч при ваших нагрузке, тарифе и ценах. Лучшие варианты по NPV за 25 лет.' + (pbest ? ' Самая короткая окупаемость: ' + fmt(pbest.pay, 1) + ' лет (' + fmt(pbest.kwp, 1) + ' кВтп, АКБ ' + pbest.bat + ' кВт·ч).' : '') + ' Продажа излишков тоже добавляет NPV, если выкуп растёт вместе с тарифом: если нет, выбирайте меньшую мощность. Правило для проверки: P ≈ годовое потребление ÷ 1100 и батарея под вечернюю нагрузку, а не под всё сразу.';
    host.appendChild(p);
    Array.prototype.forEach.call(host.querySelectorAll('button[data-n]'), function (bt) {
      bt.addEventListener('click', function () { $('sg-a1-n').value = bt.getAttribute('data-n'); $('sg-bat').value = bt.getAttribute('data-b'); calc(); });
    });
  }

  function applyPreset(key) {
    var p = PRESETS[key]; if (!p) return;
    $('sg-load').value = String(p.load).replace('.', ','); $('sg-profile').value = p.profile; $('sg-season').value = p.season; $('sg-shift').value = p.shift;
    $('sg-tariff').value = p.tariff; $('sg-bat').value = p.bat; if ($('sg-who')) $('sg-who').value = p.who || 'phys';
    var r = document.querySelector('input[name="sg-ph"][value="' + p.phases + '"]'); if (r) r.checked = true;
    r = document.querySelector('input[name="sg-scheme"][value="' + p.scheme + '"]'); if (r) r.checked = true;
    p.a.forEach(function (a, i) { var k = i + 1; $('sg-a' + k + '-n').value = a[0]; $('sg-a' + k + '-type').value = a[1]; $('sg-a' + k + '-tilt').value = a[2]; $('sg-a' + k + '-az').value = a[3]; $('sg-a' + k + '-tight').value = String(a[4]); });
    calc();
  }
  function savePrices() { try { localStorage.setItem('tega-solar-prices', JSON.stringify(readPrices())); } catch (e) { /* без хранилища работаем в памяти */ } }
  function loadPrices() {
    var P = {}; try { P = JSON.parse(localStorage.getItem('tega-solar-prices') || '{}') || {}; } catch (e) { P = {}; }
    Object.keys(PRICE_LABELS).forEach(function (k) { var el = $('sg-pr-' + k); if (el) el.value = String(P[k] != null ? P[k] : S.DEF_PRICES[k]).replace('.', ','); });
  }

  /* ───────── вкладки ───────── */
  function init() {
    var root = $('e-solar'); if (!root) return;
    var panels = [];
    Array.prototype.forEach.call(root.querySelectorAll('.e-panel'), function (p) { panels.push(p.id); });
    root.classList.add('js');
    function show(id) {
      if (panels.indexOf(id) < 0) id = panels[0];
      Array.prototype.forEach.call(root.querySelectorAll('.e-panel'), function (p) { p.classList.toggle('on', p.id === id); });
      Array.prototype.forEach.call(document.querySelectorAll('.e-sub a'), function (a) {
        var on = a.getAttribute('data-sub') === id; a.classList.toggle('on', on);
        if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      });
    }
    function fromHash() { show((location.hash || '').replace('#', '')); }
    fromHash(); window.addEventListener('hashchange', fromHash);
    Array.prototype.forEach.call(document.querySelectorAll('.e-sub a'), function (a) {
      a.addEventListener('click', function (ev) { ev.preventDefault(); var id = a.getAttribute('data-sub'); try { history.replaceState(null, '', '#' + id); } catch (e) { location.hash = id; } show(id); });
    });
    loadPrices();
    Array.prototype.forEach.call(root.querySelectorAll('[id^="sg-"], input[name^="sg-"]'), function (el) {
      if (el.id === 'sg-preset') { el.addEventListener('change', function () { applyPreset(el.value); }); return; }
      if (el.id === 'sg-day-m') { el.addEventListener('change', drawDay); return; }
      if (el.tagName === 'INPUT' || el.tagName === 'SELECT') {
        var pr = el.id && el.id.indexOf('sg-pr-') === 0;
        el.addEventListener('input', function () { if (pr) savePrices(); calc(); }); el.addEventListener('change', function () { if (pr) savePrices(); calc(); });
      }
    });
    var ob = $('sg-opt-btn'); if (ob) ob.addEventListener('click', optimize);
    var rb = $('sg-pr-reset'); if (rb) rb.addEventListener('click', function () { try { localStorage.removeItem('tega-solar-prices'); } catch (e) { /* нет хранилища */ } loadPrices(); calc(); });
    calc();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
