/* Бассейн: интерфейс калькулятора. Модель расчёта в pool-model.js, зона регенерации биопула в pond-model.js.
   Ориентировочный расчёт, не проект. */
(function () {
  'use strict';
  var M = window.TegaPool;
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
  function table(host, head, rows) {
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
  var TYPES = { skim: 'Скиммерный', over: 'Переливной', bio: 'Биопул', frame: 'Каркасный сезонный' };
  var PRESETS = {
    skim: { type: 'skim', L: 8, W: 4, d: 1.5, place: 'out', months: 4, cover: 'slat', heat: 'hp', disinf: 'elecuv', H: 10, bathers: 4 },
    bio: { type: 'bio', L: 10, W: 5, d: 1.4, place: 'pav', months: 5, cover: 'none', heat: 'hp', disinf: 'none', H: 2.5, bathers: 4 },
    poly: { type: 'skim', L: 6, W: 3, d: 1.4, place: 'out', months: 4, cover: 'slat', heat: 'hp', disinf: 'dose', H: 10, bathers: 4 },
    frame: { type: 'frame', L: 5, W: 3, d: 1, place: 'out', months: 3, cover: 'bubble', heat: 'none', disinf: 'chl', H: 10, bathers: 3 }
  };

  function cfg() {
    return {
      type: val('pb-type'), L: num('pb-L'), W: num('pb-W'), d: num('pb-d'), place: val('pb-place'), months: num('pb-months'), tTarget: num('pb-tt'), tStart: num('pb-ts'),
      source: val('pb-src'), cover: val('pb-cover'), heat: val('pb-heat'), disinf: val('pb-dis'), bathers: num('pb-bath'), budget: val('pb-bud'), cop: num('pb-cop'),
      H: num('pb-H'), pumpHours: num('pb-ph'), t0: num('pb-t0'), border: num('pb-bd'), drain: val('pb-drain'), winter: val('pb-win'), safety: val('pb-safe'), reg: num('pb-reg')
    };
  }
  function valid(c) {
    return c.L > 0 && c.W > 0 && c.d > 0 && c.months > 0 && c.months <= 12 && c.tTarget > 0 && isFinite(c.tStart) && c.bathers >= 0 && c.H > 0 && c.pumpHours > 0 && c.pumpHours <= 24 && c.t0 > 0 &&
      c.border >= 0 && (c.heat !== 'hp' || c.cop > 0) && (c.type !== 'bio' || (c.reg >= 0 && c.reg <= 90));
  }
  var IDS = ['pb-s', 'pb-v', 'pb-k', 'pb-q', 'pb-pump', 'pb-filt', 'pb-pipes', 'pb-emb', 'pb-dis-o', 'pb-wash', 'pb-fresh', 'pb-loss', 'pb-p0', 'pb-hp', 'pb-eh', 'pb-ee', 'pb-cost', 'pb-cmp', 'pb-day', 'pb-seas',
    'pb-bio-r', 'pb-bio-g', 'pb-bio-p', 'pb-bio-n'];

  function calc() {
    var c = cfg();
    if (!valid(c)) {
      last = null; IDS.forEach(function (i) { set(i, '—'); });
      verdict('pb-verdict', 'Введите размеры, глубину, сезон и параметры системы.', true);
      ['pb-v1', 'pb-v2', 'pb-v3'].forEach(function (i) { verdict(i, '', false); });
      ['pb-ch', 'pb-pt', 'pb-bt'].forEach(function (i) { var n = $(i); if (n) clearNode(n); });
      set('pb-chn', ''); return;
    }
    var r = M.calc(c);
    last = { c: c, r: r };
    var bio = c.type === 'bio';
    set('pb-s', fmt(r.S, 1) + ' м²');
    set('pb-v', fmt(r.V, 1) + ' м³');
    set('pb-k', TYPES[c.type] + ', полный оборот ' + (bio ? 'около ' + fmt(60 * r.tH, 0) + ' мин (1,5 об/ч)' : fmt(r.tH, 1) + ' ч'));
    var red = r.warns.filter(function (w) { return w.level === 'red'; }), yel = r.warns.filter(function (w) { return w.level === 'yellow'; });
    var txt = '';
    if (red.length) txt += 'Красные: ' + red.map(function (w) { return w.text; }).join(' ') + ' ';
    if (yel.length) txt += 'Обратите внимание: ' + yel.map(function (w) { return w.text; }).join(' ') + ' ';
    if (!txt) txt = 'Критичных замечаний нет. ';
    verdict('pb-verdict', txt, red.length > 0);

    /* циркуляция и вода */
    set('pb-q', fmt(r.Q, 1) + ' м³/ч (V / время оборота), напор ' + fmt(r.H, 1) + ' м');
    set('pb-pump', (r.pump.n > 1 ? r.pump.n + ' × ' : '') + 'класс ' + r.pump.cls.name + ' (паспортно ' + r.pump.cls.w + '); по формуле при КПД ' + fmt(r.eta, 2) + ' около ' + fmt(r.Pel * 1000, 0) + ' Вт' + (r.variable ? ', регулируемый насос' : ', нерегулируемый'));
    set('pb-filt', bio ? 'bog-фильтр на зоне регенерации (см. вкладку «Биопул»)' : r.cartridge ? 'картриджный фильтр (объём до 20 м³), поток ' + fmt(r.Q, 1) + ' м³/ч' : (r.filt.n > 1 ? r.filt.n + ' × ' : '') + 'песочный или AFM Ø' + r.filt.d + ' мм, загрузка около ' + fmt(r.sand, 0) + ' кг, нагрузка ' + fmt(r.Q / r.filtArea, 0) + ' м³/ч на м²');
    set('pb-pipes', 'всас Ø' + r.suc.d + ' мм (' + fmt(r.suc.v, 1) + ' м/с), напор Ø' + r.prs.d + ' мм (' + fmt(r.prs.v, 1) + ' м/с)' + (r.Q > 100 ? '; при таком потоке лучше несколько линий' : ''));
    set('pb-emb', bio ? 'приёмные устройства и форсунки по проекту зоны регенерации' : (c.type === 'over' ? 'переливной лоток около ' + fmt(r.gutter, 0) + ' м, балансировочный бак около ' + fmt(r.tank, 1) + ' м³' : r.skim + ' скиммера') + (r.noz ? ', ' + r.noz + ' форсунок' : '') + ', донный слив');
    var dis = [];
    if (r.cellG) dis.push('ячейка электролиза около ' + r.cellG + ' г/ч, соль около ' + fmt(r.salt, 0) + ' кг на заполнение (по паспорту ячейки)');
    if (r.uv) dis.push((r.uv.n > 1 ? r.uv.n + ' × ' : '') + 'УФ ' + r.uv.w + ' Вт в байпасе');
    if (c.disinf === 'chl') dis.push('хлор вручную');
    if (c.disinf === 'dose') dis.push('хлор с дозаторами pH и ORP');
    if (r.doser && c.disinf !== 'dose') dis.push('дозаторы pH и ORP');
    if (c.disinf === 'none') dis.push('без обеззараживания, вода чистится растениями');
    set('pb-dis-o', dis.join('; ') || '—');
    set('pb-wash', bio ? 'у bog-фильтра нет промывки песка' : 'промывка фильтра около ' + fmt(r.wash, 1) + ' м³ воды за раз: нужен дренаж или канализация');
    set('pb-fresh', 'около ' + fmt(r.fresh, 2) + ' м³/сут свежей воды при ' + fmt(c.bathers, 0) + ' купающихся (допущение 30 л на человека)');
    var cv = 'Все диапазоны оборота, нагрузки на фильтр, УФ и электролиза это ориентиры практики, точные значения даёт паспорт оборудования. ';
    if (r.Q > 30 && !bio) cv += 'Класс насоса по расходу, напор проверяйте по характеристике. ';
    verdict('pb-v1', cv + 'Трассу и закладные считают по проекту.', false);

    /* нагрев и энергия */
    var tar = num('pb-tar');
    set('pb-loss', fmt(r.en.loss, 1) + ' кВт потерь (' + fmt(r.S, 0) + ' м² × 0,25 кВт/м² × коэффициенты места и покрытия)');
    set('pb-p0', c.heat === 'none' ? 'без нагрева' : fmt(r.p0, 1) + ' кВт при нагреве за ' + fmt(c.t0, 0) + ' ч (ΔT = ' + fmt(r.en.dT, 0) + ' °С), всего ' + fmt(r.en.e0, 0) + ' кВт·ч');
    set('pb-hp', r.hp ? (r.hp.n > 1 ? r.hp.n + ' × ' : '') + fmt(r.hp.kw, 0) + ' кВт (тепловая), первичный нагрев около ' + fmt(r.hpHours / 24, 1) + ' сут; на старт сезона помогает ТЭН или котёл' : c.heat === 'none' ? '—' : 'не используется');
    set('pb-eh', c.heat === 'none' ? '—' : fmt(r.en.eHeat, 0) + ' кВт·ч тепла за ' + fmt(c.months, 0) + ' мес');
    set('pb-ee', c.heat === 'boiler' ? 'топливо около ' + fmt(r.eFuel, 0) + ' кВт·ч (КПД 0,9), цена топлива за ваш счёт' : c.heat === 'none' ? '—' : fmt(r.eEl, 0) + ' кВт·ч' + (c.heat === 'hp' ? ' (COP ' + fmt(c.cop, 1) + ')' : ' (ТЭН)'));
    set('pb-cost', c.heat === 'boiler' || c.heat === 'none' ? '—' : isFinite(tar) ? fmt(r.eEl * tar, 0) + ' BYN за сезон на нагрев' : 'введите тариф');
    if (c.cover !== 'none' && c.heat !== 'none' && c.heat !== 'boiler') {
      var o = c.heat === 'hp' ? r.eElOpen : r.eElOpen;
      set('pb-cmp', 'без покрытия ' + fmt(o, 0) + ' кВт·ч, с покрытием ' + fmt(r.eEl, 0) + ' кВт·ч (экономия ' + fmt((1 - r.eEl / o) * 100, 0) + ' %)');
    } else set('pb-cmp', c.cover === 'none' ? 'покрытие не выбрано' : '—');
    set('pb-day', fmt(r.kwhDay, 1) + ' кВт·ч в сутки (насос ' + fmt(r.kwhPump, 1) + (r.uv ? ', УФ ' + fmt(r.kwhUV, 1) : '') + (r.cellG ? ', ячейка ' + fmt(r.kwhCell, 1) : '') + ')');
    set('pb-seas', fmt(r.kwhSeason, 0) + ' кВт·ч' + (isFinite(tar) ? ', около ' + fmt(r.kwhSeason * tar, 0) + ' BYN' : '') + ' за сезон: нагрев, насос, УФ и ячейка');
    var ev = 'Потери и COP это допущения, а не замеры: зимой и в холодные месяцы потери больше. Тепловой насос подбирают по паспорту при расчётной температуре воздуха. Котёл считается по теплу, цену топлива введите самостоятельно.';
    verdict('pb-v2', ev, false);

    /* биопул */
    if (bio && r.bio) {
      var b = r.bio;
      set('pb-bio-r', fmt(b.Sreg, 1) + ' м² зоны регенерации (' + fmt(c.reg, 0) + ' % площади), плавательная зона ' + fmt(b.Swim, 1) + ' м²');
      set('pb-bio-g', 'щебень 20–40 мм около ' + fmt(b.bog.gravel, 1) + ' м³ (слой 0,3 м)');
      set('pb-bio-p', 'расход ' + fmt(r.Q, 0) + ' м³/ч, напор ' + fmt(c.H, 1) + ' м, ' + (r.pump.n > 1 ? r.pump.n + ' × ' : '') + 'класс ' + (r.pump.cls ? r.pump.cls.name : '—'));
      set('pb-bio-n', fmt(b.plTotal, 0) + ' шт по расчёту (' + fmt(b.plBuy, 0) + ' шт упаковками)');
      var rows = b.plants.map(function (p) { return { cells: [p.zone, fmt(p.area, 1) + ' м²', p.name, String(p.n), String(p.buy)] }; });
      rows.push({ cls: 'tot', cells: ['Всего', '', '', String(b.plTotal), String(b.plBuy)] });
      table($('pb-pt'), ['Зона', 'Площадь', 'Вид (зимостойкие в Беларуси)', 'По расчёту, шт', 'К покупке, шт'], rows);
      verdict('pb-v3', 'Растения только зимостойкие, из питомников, посадка весной при прогреве воды выше примерно 10 °С. Камыш и рогоз держите в контейнерах. Приёмка: дно видно по всей глубине (диск Секки не менее 1,5 м), без хлора.', false);
    } else {
      ['pb-bio-r', 'pb-bio-g', 'pb-bio-p', 'pb-bio-n'].forEach(function (i) { set(i, '—'); });
      clearNode($('pb-pt'));
      verdict('pb-v3', 'Эта вкладка работает для типа «Биопул». Выберите его на первой вкладке или в готовых примерах.', false);
    }
    drawSection(); budget();
  }

  /* ───────── количества и ваши цены ───────── */
  function budget() {
    if (!last) return;
    var r = last.r, c = last.c, bio = c.type === 'bio';
    var wall = r.S + 2 * (c.L + c.W) * c.d;
    var items = [
      ['Чаша', r.V, 'м³', 'bowl'],
      ['Отделка (дно и стены)', wall, 'м²', 'fin'],
      ['Насос (класс ' + (r.pump.cls ? r.pump.cls.name : '') + ')', r.pump.n, 'шт', 'pump'],
      ['Фильтр' + (bio ? ' (bog, щебень)' : r.cartridge ? ' картриджный' : ' Ø' + (r.filt ? r.filt.d : '')), bio ? r.bio.bog.gravel : (r.filt ? r.filt.n : 1), bio ? 'м³' : 'шт', bio ? 'grav' : 'filt'],
      ['Скиммеры', r.skim, 'шт', 'skim'],
      ['Форсунки', r.noz, 'шт', 'noz'],
      ['Ячейка электролиза', r.cellG ? 1 : 0, 'шт', 'cell'],
      ['УФ-установка', r.uv ? r.uv.n : 0, 'шт', 'uv'],
      ['Дозатор pH и ORP', r.doser ? 1 : 0, 'компл.', 'dos'],
      ['Тепловой насос', r.hp ? r.hp.n : 0, 'шт', 'hp'],
      ['Покрытие', c.cover === 'none' ? 0 : r.S * 1.1, 'м²', 'cov'],
      ['Ограждение 1,2 м', c.safety === 'fence' ? 2 * (c.L + c.W) + 4 : 0, 'м', 'fence'],
      ['Датчик падения в воду', c.safety === 'alarm' ? 1 : 0, 'шт', 'alarm'],
      ['Растения биопула', bio ? r.bio.plBuy : 0, 'шт', 'plant']
    ];
    var sum = 0, priced = 0, total = 0, rows = [];
    items.forEach(function (it) {
      if (!(it[1] > 0)) return;
      total++;
      var p = num('pb-p-' + it[3]), line = isFinite(p) && p >= 0 ? p * it[1] : NaN;
      if (isFinite(line)) { sum += line; priced++; }
      rows.push({ cells: [it[0], fmt(it[1], it[2] === 'шт' || it[2] === 'компл.' ? 0 : 1) + ' ' + it[2], isFinite(p) ? fmt(p, 2) : '—', isFinite(line) ? fmt(line, 2) : '—'] });
    });
    rows.push({ cls: 'tot', cells: ['Итого по позициям с ценой', '', '', priced ? fmt(sum, 2) : '—'] });
    table($('pb-bt'), ['Позиция', 'Количество', 'Цена, BYN за ед.', 'Сумма, BYN'], rows);
    set('pb-b-n', priced + ' из ' + total);
    set('pb-b-sum', priced ? fmt(sum, 2) + ' BYN' + (priced < total ? ' (без позиций без цены)' : '') : '—');
    verdict('pb-b-verdict', 'Цены в калькулятор не заложены: они зависят от материала, поставщика и сезона. Введите цены за единицу из ваших предложений, сумма пересчитается. Электрика, техпомещение, земляные работы вне чаши, ограждение территории и пусконаладка сюда не входят полностью, добавьте их отдельно.', false);
  }

  /* ───────── схема разреза ───────── */
  function drawSection() {
    var host = $('pb-ch'); if (!host || !last) return;
    clearNode(host);
    var c = last.c, r = last.r, W = 760, H = 250, x0 = 40, x1 = 560, gy = 50, depth = 120;
    var el = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Схема чаши и техпомещения' });
    var yb = gy + depth;
    el.appendChild(svg('line', { x1: 10, y1: gy, x2: 750, y2: gy, stroke: MUT, 'stroke-width': 2 }));
    el.appendChild(svg('polyline', { points: x0 + ',' + gy + ' ' + x0 + ',' + yb + ' ' + x1 + ',' + yb + ' ' + x1 + ',' + gy, fill: 'none', stroke: INK, 'stroke-width': 4 }));
    el.appendChild(svg('rect', { x: x0 + 2, y: gy + 8, width: x1 - x0 - 4, height: depth - 10, fill: '#eef2f6' }));
    function lab(x, y, s, a, w, fill) { el.appendChild(svg('text', { x: x, y: y, 'font-size': 12, fill: fill || INK, 'text-anchor': a || 'start', 'font-weight': w || '400' }, s)); }
    lab(x0 + 8, gy - 8, 'уровень воды', 'start', '400', MUT);
    el.appendChild(svg('rect', { x: x0 - 6, y: gy + 8, width: 12, height: 18, fill: G1 })); lab(x0 + 14, gy + 24, 'скиммер на 5–10 см ниже зеркала', 'start', '700');
    el.appendChild(svg('rect', { x: x1 - 6, y: gy + 50, width: 12, height: 8, fill: G1 })); lab(x1 - 14, gy + 46, 'форсунка', 'end', '700');
    el.appendChild(svg('rect', { x: (x0 + x1) / 2 - 10, y: yb - 6, width: 20, height: 6, fill: G1 })); lab((x0 + x1) / 2, yb - 12, 'донный слив', 'middle', '700');
    lab((x0 + x1) / 2, gy + 62, 'глубина ' + fmt(c.d, 1) + ' м, ' + fmt(r.V, 0) + ' м³', 'middle', '700');
    el.appendChild(svg('rect', { x: 600, y: gy + 20, width: 140, height: 110, fill: '#f6f6f7', stroke: G3, 'stroke-width': 1 }));
    lab(670, gy + 44, 'техпомещение', 'middle', '700');
    lab(670, gy + 64, 'трап и приямок', 'middle'); lab(670, gy + 82, 'вентиляция, УЗО', 'middle'); lab(670, gy + 100, 'не дальше 10–15 м', 'middle');
    el.appendChild(svg('line', { x1: x1, y1: gy + 54, x2: 600, y2: gy + 54, stroke: RED, 'stroke-width': 2, 'stroke-dasharray': '6 4' }));
    lab(x0, yb + 40, 'Утепление чаши в грунте и дренаж по периметру при высоком уровне грунтовых вод; закладные до бетонирования. Масштаб условный.', 'start', '400', MUT);
    set('pb-chn', 'Схема условная: закладные и техпомещение закладываются до бетона, трассы с уклоном и испытанием давлением.');
    host.appendChild(el);
  }

  function apply(k) {
    var p = PRESETS[k]; if (!p) return;
    var m = { 'pb-type': p.type, 'pb-L': p.L, 'pb-W': p.W, 'pb-d': p.d, 'pb-place': p.place, 'pb-months': p.months, 'pb-cover': p.cover, 'pb-heat': p.heat, 'pb-dis': p.disinf, 'pb-H': p.H, 'pb-bath': p.bathers };
    for (var id in m) { var el = $(id); if (el) el.value = String(m[id]).replace('.', ','); }
    calc();
  }

  function init() {
    var root = $('e-pb'); if (!root) return;
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
      if (el.id === 'pb-preset') { el.addEventListener('change', function () { apply(el.value); }); return; }
      el.addEventListener('input', calc); el.addEventListener('change', calc);
    });
    var rs = $('pb-p-reset');
    if (rs) rs.addEventListener('click', function () { Array.prototype.forEach.call(root.querySelectorAll('input[id^="pb-p-"]'), function (e) { e.value = ''; }); calc(); });
    calc();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
