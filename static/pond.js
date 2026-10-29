/* Пруд: интерфейс калькулятора. Модель расчёта в pond-model.js. Ориентировочный расчёт, не проект. */
(function () {
  'use strict';
  var M = window.TegaPond;
  if (!M) return;
  var NS = 'http://www.w3.org/2000/svg';
  var INK = '#1d1f23', RED = '#e3000f', MUT = '#4a4d55', G1 = '#7d8089', G3 = '#c6c8cd';
  function $(id) { return document.getElementById(id); }
  function num(id) {
    var el = $(id); if (!el) return NaN;
    var n = parseFloat(String(el.value).replace(/\s/g, '').replace(',', '.').replace(/−/g, '-'));
    return isFinite(n) ? n : NaN;
  }
  function val(id) { var el = $(id); return el ? el.value : ''; }
  function fmt(x, d) {
    if (!isFinite(x)) return '—';
    var s = Math.abs(x).toFixed(d), p = s.split('.');
    p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return (x < 0 ? '−' : '') + p.join(',');
  }
  function set(id, v) { var el = $(id); if (el) el.textContent = v; }
  function verdict(id, t, bad) { var el = $(id); if (!el) return; el.textContent = t; el.className = 'verdict' + (bad ? ' bad' : ''); }
  function clearNode(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function svg(name, attrs, text) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }
  function table(host, head, rows, cls) {
    clearNode(host);
    var t = document.createElement('table'); t.className = 'e-tbl';
    var tr = document.createElement('tr');
    head.forEach(function (h) { var th = document.createElement('th'); th.textContent = h; tr.appendChild(th); });
    var thead = document.createElement('thead'); thead.appendChild(tr); t.appendChild(thead);
    var tb = document.createElement('tbody');
    rows.forEach(function (r) {
      var row = document.createElement('tr'); if (r.cls) row.className = r.cls;
      r.cells.forEach(function (c, i) { var td = document.createElement('td'); td.textContent = c; if (i > 0 && /^[\d−,\s—]+$/.test(c)) td.className = 'm'; row.appendChild(td); });
      tb.appendChild(row);
    });
    t.appendChild(tb);
    var sc = document.createElement('div'); sc.className = 'e-scroll'; sc.appendChild(t); host.appendChild(sc);
  }

  var last = null;
  var TYPES = { decor: 'Декоративный биопруд', koi: 'Кой-пруд', bath: 'Пруд для купания (биопул)' };
  var PRESETS = {
    decor: { type: 'decor', L: 6, W: 4, da: 1.1, dp: 1.8, fish: 'mod', win: '1', lift: 1.2, tr: 8, tn: 2, reg: 30, bud: 'std' },
    koi: { type: 'koi', L: 7, W: 5, da: 1.6, dp: 2.2, fish: 'koi', win: '1', lift: 1.2, tr: 8, tn: 2, reg: 30, bud: 'std' },
    bath: { type: 'bath', L: 10, W: 5, da: 1.4, dp: 1.8, fish: 'none', win: '0', lift: 0.3, tr: 4, tn: 1, reg: 30, bud: 'std' }
  };

  function cfg() {
    return {
      type: val('pd-type'), L: num('pd-L'), W: num('pd-W'), dAvg: num('pd-da'), dPit: num('pd-dp'), fish: val('pd-fish'), winterFish: val('pd-win') === '1',
      power: val('pd-pw') === '1', ground: val('pd-gr'), budget: val('pd-bud'), plot: num('pd-plot'), border: num('pd-bd'), reg: num('pd-reg'),
      turn: num('pd-turn'), lift: num('pd-lift'), trace: num('pd-tr'), turns: num('pd-tn'),
      zBog: num('pd-zb'), zShal: num('pd-zs'), zDeep: num('pd-zd'), zFlt: num('pd-zf'), species: val('pd-sp')
    };
  }
  function valid(c) {
    return c.L > 0 && c.W > 0 && c.dAvg > 0 && c.dPit > 0 && c.border >= 0 && c.lift >= 0 && c.trace >= 0 && c.turns >= 0 &&
      c.zBog >= 0 && c.zShal >= 0 && c.zDeep >= 0 && c.zFlt >= 0 && (c.type !== 'bath' || (c.reg >= 0 && c.reg <= 90));
  }
  var IDS = ['pd-s', 'pd-v', 'pd-k', 'pd-zones', 'pd-q', 'pd-h', 'pd-pump', 'pd-filt', 'pd-uv', 'pd-skim', 'pd-drain', 'pd-air', 'pd-film', 'pd-geo', 'pd-ex', 'pd-kw1', 'pd-kw2', 'pd-cost',
    'pd-pl-n', 'pd-pl-buy', 'pd-pl-share', 'pd-pl-need'];

  function calc() {
    var c = cfg();
    if (!valid(c)) {
      last = null; IDS.forEach(function (i) { set(i, '—'); });
      verdict('pd-verdict', 'Введите длину, ширину и глубины.', true); verdict('pd-eq-verdict', '', false); verdict('pd-pl-verdict', '', false);
      ['pd-ch', 'pd-pt', 'pd-bt'].forEach(function (i) { var n = $(i); if (n) clearNode(n); });
      set('pd-chn', ''); return;
    }
    var r = M.calc(c);
    last = { c: c, r: r };
    var bath = c.type === 'bath';
    set('pd-s', fmt(r.S, 1) + ' м²');
    set('pd-v', fmt(r.V, 1) + ' м³');
    set('pd-k', TYPES[c.type] + ', оборот ' + fmt(r.k, 2) + ' об/ч');
    set('pd-zones', bath ? 'плавательная ' + fmt(r.Swim, 1) + ' м², регенерация ' + fmt(r.Sreg, 1) + ' м² (' + fmt(c.reg, 0) + ' %)' :
      'болотная ' + fmt(r.S * c.zBog / 100, 1) + ', мелководье ' + fmt(r.S * c.zShal / 100, 1) + ', глубоководная ' + fmt(r.S * c.zDeep / 100, 1) + ', плавающие ' + fmt(r.S * c.zFlt / 100, 1) + ' м²');
    var red = r.warns.filter(function (w) { return w.level === 'red'; }), yel = r.warns.filter(function (w) { return w.level === 'yellow'; });
    var txt = '';
    if (red.length) txt += 'Красные: ' + red.map(function (w) { return w.text; }).join(' ') + ' ';
    if (yel.length) txt += 'Обратите внимание: ' + yel.map(function (w) { return w.text; }).join(' ') + ' ';
    if (!txt) txt = 'Критичных замечаний нет. ';
    txt += 'Пределы по закону приведены по публикациям о Водном кодексе (Закон № 148-З, с 01.01.2027): сверьте с текстом закона и местной администрацией.';
    verdict('pd-verdict', txt, red.length > 0);

    /* оборудование */
    set('pd-q', fmt(r.Q, 1) + ' м³/ч (V × оборот)');
    set('pd-h', fmt(r.H, 1) + ' м (подъём + потери трассы и поворотов)');
    set('pd-pump', (r.pump.n > 1 ? r.pump.n + ' × ' : '') + 'класс ' + r.pump.cls.name + ' (паспортно ' + r.pump.cls.w + '); по формуле при КПД ' + fmt(r.eta, 2) + ' около ' + fmt(r.Pel, 0) + ' Вт' + (r.variable ? ', регулируемый: лето 100 %, межсезонье 50 %' : ''));
    set('pd-filt', r.bog ? 'bog-фильтр: щебень 20–40 мм около ' + fmt(r.bog.gravel, 1) + ' м³ (слой 0,3 м на ' + fmt(r.bog.area, 1) + ' м²)' : fmt(r.Vf, 1) + ' м³ загрузки; ' + r.filt);
    set('pd-uv', (r.uv.n > 1 ? r.uv.n + ' × ' : '') + r.uv.w + ' Вт (расчёт ' + fmt(r.uvW, 0) + ' Вт)' + (c.fish === 'none' && !bath ? '; без рыбы можно обойтись без УФ' : ''));
    set('pd-skim', r.nSkim + ' шт, ' + r.skimT);
    set('pd-drain', r.drain ? r.drain + ' шт (основной и резервный)' : 'по желанию, на ложе без рыбы можно без него');
    set('pd-air', (r.comp.n > 1 ? r.comp.n + ' × ' : '') + 'компрессор ' + r.comp.c.l + ' л/мин (нужно ' + fmt(r.A, 0) + ' л/мин)' + (r.compOpt ? ', опция' : '') + (r.deicer ? '; де-айсер 100–300 Вт' : ''));
    set('pd-film', fmt(r.Sp, 0) + ' м² EPDM ' + fmt(r.thick, 1) + ' мм (полотно ' + fmt(r.Lp, 1) + ' × ' + fmt(r.Wp, 1) + ' м с запасом 10 %)');
    set('pd-geo', fmt(r.geo, 0) + ' м² геотекстиля 300 г/м²');
    set('pd-ex', fmt(r.earth, 0) + ' м³ грунта (объём чаши с запасом 15 %)');
    var tar = num('pd-tar');
    set('pd-kw1', fmt(r.kwhSummer, 1) + ' кВт·ч в сутки летом (насос и УФ)');
    set('pd-kw2', fmt(r.kwhWinter, 1) + ' кВт·ч в сутки зимой (аэрация' + (r.deicer ? ' и де-айсер' : '') + ')');
    set('pd-cost', isFinite(tar) ? 'лето ' + fmt(r.kwhSummer * 30 * tar, 0) + ' BYN/мес, зима ' + fmt(r.kwhWinter * 30 * tar, 0) + ' BYN/мес' : 'введите тариф');
    var ev = 'Насос считается по обороту типа пруда, а не «про запас»: избыточный поток вымывает биоплёнку. ';
    ev += 'Плёнка посчитана для прямых стенок; террасы и пологие откосы требуют запаса больше 10 %, окончательно по раскрою. ';
    ev += 'Мощности из формулы с КПД ' + fmt(r.eta, 2) + ' консервативны, паспорт насоса обычно ниже. Электрику у воды делают через УЗО 30 мА по проекту.';
    verdict('pd-eq-verdict', ev, false);

    /* растения */
    set('pd-pl-n', fmt(r.plTotal, 0) + ' шт по расчёту');
    set('pd-pl-buy', fmt(r.plBuy, 0) + ' шт при закупке упаковками по 5 (кувшинки поштучно)');
    set('pd-pl-share', fmt(r.eff * 100, 0) + ' % площади' + (bath ? ' (зона регенерации)' : ' (болотная, мелководье, плавающие)'));
    set('pd-pl-need', 'около ' + fmt(r.need * 100, 0) + ' % при такой нагрузке по рыбе');
    var rows = r.plants.map(function (p) { return { cells: [p.zone, fmt(p.area, 1) + ' м²', p.name + (p.box && !/контейнер/.test(p.name) ? ' (в контейнере)' : ''), String(p.n), String(p.buy)] }; });
    rows.push({ cls: 'tot', cells: ['Всего', '', '', String(r.plTotal), String(r.plBuy)] });
    table($('pd-pt'), ['Зона', 'Площадь', 'Вид (зимостойкие в Беларуси)', 'По расчёту, шт', 'К покупке, шт'], rows);
    var pm = [];
    if (r.deficit > 0.05) pm.push('Растений мало: добавьте около ' + fmt(r.deficit, 1) + ' м² зоны растений.');
    else pm.push('Площади под растения достаточно для заданной нагрузки по рыбе.');
    pm.push('Покупайте растения в питомниках, а не в природных водоёмах. Высаживайте весной при прогреве воды выше примерно 10 °С. Камыш, мяту и рогоз держите только в контейнерах: они вытесняют остальные виды и рвут плёнку.');
    verdict('pd-pl-verdict', pm.join(' '), r.deficit > 0.05);

    drawProfile(); budget();
  }

  /* ───────── смета: количества и ваши цены ───────── */
  function budget() {
    if (!last) return;
    var r = last.r, c = last.c, bath = c.type === 'bath';
    var items = [
      ['Котлован и вывоз', r.earth, 'м³', 'ex'],
      ['Геотекстиль 300 г/м²', r.geo, 'м²', 'geo'],
      ['Мембрана EPDM ' + fmt(r.thick, 1) + ' мм с монтажом', r.Sp, 'м²', 'mem'],
      ['Насос (класс ' + r.pump.cls.name + ')', r.pump.n, 'шт', 'pump'],
      bath ? ['Щебень bog-фильтра 20–40 мм', r.bog.gravel, 'м³', 'grav'] : ['Биофильтр (загрузка ' + fmt(r.Vf, 1) + ' м³)', 1, 'компл.', 'filt'],
      ['УФ-стерилизатор ' + r.uv.w + ' Вт', r.uv.n, 'шт', 'uv'],
      ['Скиммер (' + r.skimT + ')', r.nSkim, 'шт', 'skim'],
      ['Донный сток', r.drain, 'шт', 'drain'],
      ['Компрессор ' + r.comp.c.l + ' л/мин' + (r.compOpt ? ' (опция)' : ''), r.compOpt ? 0 : r.comp.n, 'шт', 'comp'],
      ['Де-айсер', r.deicer, 'шт', 'deic'],
      ['Растения', r.plBuy, 'шт', 'plant']
    ];
    var sum = 0, priced = 0, total = 0, rows = [];
    items.forEach(function (it) {
      if (!(it[1] > 0)) return;
      total++;
      var p = num('pd-p-' + it[3]), line = isFinite(p) && p >= 0 ? p * it[1] : NaN;
      if (isFinite(line)) { sum += line; priced++; }
      rows.push({ cells: [it[0], fmt(it[1], it[2] === 'шт' || it[2] === 'компл.' ? 0 : 1) + ' ' + it[2], isFinite(p) ? fmt(p, 2) : '—', isFinite(line) ? fmt(line, 2) : '—'] });
    });
    rows.push({ cls: 'tot', cells: ['Итого по позициям с ценой', '', '', priced ? fmt(sum, 2) : '—'] });
    table($('pd-bt'), ['Позиция', 'Количество', 'Цена, BYN за ед.', 'Сумма, BYN'], rows);
    set('pd-b-n', priced + ' из ' + total);
    set('pd-b-sum', priced ? fmt(sum, 2) + ' BYN' + (priced < total ? ' (без позиций без цены)' : '') : '—');
    verdict('pd-b-verdict', 'Цены в калькулятор не заложены: они меняются и зависят от поставщика. Введите цены за единицу из ваших предложений, и сумма пересчитается. Работы по монтажу оборудования, электрика, ограждение и обслуживание сюда не входят.', false);
  }

  /* ───────── профиль чаши ───────── */
  function drawProfile() {
    var host = $('pd-ch'); if (!host || !last) return;
    clearNode(host);
    var c = last.c, r = last.r, W = 760, H = 300, x0 = 30, x1 = W - 30, gy = 50, sc = Math.min(160 / Math.max(c.dPit, 1), 90);
    var el = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Профиль чаши пруда' });
    function y(d) { return gy + d * sc; }
    el.appendChild(svg('line', { x1: x0, y1: gy, x2: x1, y2: gy, stroke: MUT, 'stroke-width': 2 }));
    el.appendChild(svg('text', { x: x1, y: gy - 10, 'font-size': 12, fill: MUT, 'text-anchor': 'end' }, 'уровень земли и воды'));
    var fy = y(1.0);
    el.appendChild(svg('line', { x1: x0, y1: fy, x2: x1, y2: fy, stroke: RED, 'stroke-width': 2, 'stroke-dasharray': '8 6' }));
    el.appendChild(svg('text', { x: x1, y: fy - 6, 'font-size': 12, fill: RED, 'text-anchor': 'end', 'font-weight': '700' }, 'промерзание около 1 м, по проекту'));
    var bath = c.type === 'bath';
    var tot = Math.max(1, c.zBog + c.zShal + c.zDeep + c.zFlt), wb = (bath ? 8 : c.zBog) / tot, ws = (bath ? 10 : c.zShal) / tot;
    var half = (x1 - x0) / 2 - 20, cx = (x0 + x1) / 2;
    var d1 = Math.min(0.1, c.dPit), d2 = Math.min(0.4, c.dPit), d3 = Math.min(0.8, c.dPit);
    var wBog = Math.max(30, half * wb * 1.6), wSh = Math.max(40, half * ws * 1.6);
    var pitW = Math.max(60, half * 0.45);
    var xa = x0 + 10, xb = xa + wBog, xc = xb + 14, xd = xc + wSh, xe = xd + 24, xf = cx - pitW / 2;
    if (xf < xe + 20) xf = xe + 20;
    var pts = [[xa, gy], [xb, y(d1)], [xc, y(d1)], [xd, y(d2)], [xe, y(d2)], [xf - 16, y(d3)], [xf, y(c.dPit)], [2 * cx - xf, y(c.dPit)], [2 * cx - xf + 16, y(d3)], [2 * cx - xe, y(d2)], [2 * cx - xd, y(d2)], [2 * cx - xc, y(d1)], [2 * cx - xb, y(d1)], [2 * cx - xa, gy]];
    el.appendChild(svg('polyline', { points: pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' '), fill: 'none', stroke: INK, 'stroke-width': 4, 'stroke-linejoin': 'round' }));
    function lab(x, yy, s, anchor, w) { el.appendChild(svg('text', { x: x, y: yy, 'font-size': 12, fill: INK, 'text-anchor': anchor || 'middle', 'font-weight': w || '700' }, s)); }
    lab(xa, y(d1) + 20, bath ? 'регенерация 0–10 см' : 'болотная 0–10 см', 'start');
    lab(xc, y(d2) + 20, 'мелководье 10–40 см', 'start');
    lab(cx, y(c.dPit) - 12, 'яма ' + fmt(c.dPit, 1) + ' м', 'middle');
    lab(cx, y(c.dPit) + 22, 'зеркало ' + fmt(r.S, 1) + ' м², объём ' + fmt(r.V, 1) + ' м³', 'middle', '400');
    set('pd-chn', 'Схема профиля чаши: террасы 0–10, 10–40 и 40–80 см и яма на заданную глубину. Масштаб условный.');
    host.appendChild(el);
  }

  function apply(k) {
    var p = PRESETS[k]; if (!p) return;
    var m = { 'pd-type': p.type, 'pd-L': p.L, 'pd-W': p.W, 'pd-da': p.da, 'pd-dp': p.dp, 'pd-fish': p.fish, 'pd-win': p.win, 'pd-lift': p.lift, 'pd-tr': p.tr, 'pd-tn': p.tn, 'pd-reg': p.reg, 'pd-bud': p.bud, 'pd-turn': '' };
    for (var id in m) { var el = $(id); if (el) el.value = String(m[id]).replace('.', ','); }
    calc();
  }

  function init() {
    var root = $('e-pd'); if (!root) return;
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
      a.addEventListener('click', function (ev) {
        ev.preventDefault(); var id = a.getAttribute('data-sub');
        try { history.replaceState(null, '', '#' + id); } catch (e) { location.hash = id; }
        show(id);
      });
    });
    Array.prototype.forEach.call(root.querySelectorAll('input, select'), function (el) {
      if (!el.id && el.type !== 'radio') return;
      if (el.id === 'pd-preset') { el.addEventListener('change', function () { apply(el.value); }); return; }
      el.addEventListener('input', calc); el.addEventListener('change', calc);
    });
    var rs = $('pd-p-reset');
    if (rs) rs.addEventListener('click', function () { Array.prototype.forEach.call(root.querySelectorAll('[id^="pd-p-"]'), function (e) { if (e.tagName === 'INPUT') e.value = ''; }); calc(); });
    calc();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
