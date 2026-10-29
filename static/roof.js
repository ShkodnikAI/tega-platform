/* Кровли: интерфейс калькулятора. Модель расчёта в roof-model.js, данные покрытий в roof-data.js.
   Ориентировочный расчёт, не проект. */
(function () {
  'use strict';
  var M = window.TegaRoof, D = window.TegaRoofData;
  if (!M || !D) return;
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
  function lab(x, y, text, anchor, w, col, size) { return svg('text', { x: x, y: y, 'text-anchor': anchor || 'start', 'font-size': size || 12, 'font-weight': w || '400', fill: col || INK, 'font-family': 'inherit' }, text); }
  function table(host, head, rows) {
    clearNode(host);
    var t = document.createElement('table'); t.className = 'e-tbl';
    var tr = document.createElement('tr');
    head.forEach(function (h) { var th = document.createElement('th'); th.textContent = h; tr.appendChild(th); });
    var thead = document.createElement('thead'); thead.appendChild(tr); t.appendChild(thead);
    var tb = document.createElement('tbody');
    rows.forEach(function (r) {
      var row = document.createElement('tr'); if (r.cls) row.className = r.cls;
      r.cells.forEach(function (c, i) { var td = document.createElement('td'); td.textContent = c; if (i > 0 && /^[\d−,\s—%]+$/.test(c)) td.className = 'm'; row.appendChild(td); });
      tb.appendChild(row);
    });
    t.appendChild(tb);
    var sc = document.createElement('div'); sc.className = 'e-scroll'; sc.appendChild(t); host.appendChild(sc);
  }

  var FORMS = { gable: 'двускатная', hip: 'вальмовая', mono: 'односкатная', flat: 'плоская' };
  var AZ = { s: 'юг', d: 'юго-восток или юго-запад', ew: 'восток или запад', n: 'север' };
  var last = null;
  var PRESETS = {
    house: { form: 'gable', L: 10, W: 8, ov: 0.5, alpha: 30, mat: 'metal_tile', insT: 200 },
    soft: { form: 'hip', L: 11, W: 9, ov: 0.6, alpha: 25, mat: 'soft', insT: 200 },
    garage: { form: 'mono', L: 6, W: 4, ov: 0.3, alpha: 12, mat: 'profil', insT: 0 },
    flat: { form: 'flat', L: 8, W: 6, ov: 0.2, alpha: 2, mat: 'pvc', insT: 150 }
  };

  function prices() {
    var p = {};
    D.forEach(function (m) { p[m.id] = num('rf-p-' + m.id); });
    return p;
  }
  function cfg() {
    var c = {
      form: val('rf-form'), L: num('rf-L'), W: num('rf-W'), ov: num('rf-ov'), alpha: num('rf-a'), valleys: num('rf-vl'), eaveH: num('rf-eh'),
      mat: val('rf-mat'), insT: num('rf-ins'), lifeMode: val('rf-life'),
      sk: num('rf-sk'), ce: num('rf-ce'), ct: num('rf-ct'), gOther: num('rf-go'), span: num('rf-sp'), step: num('rf-st'), b: num('rf-b'), h: num('rf-h'), grade: val('rf-gr'),
      gutter: val('rf-gut'), horizon: num('rf-hor'), priceBase: num('rf-pb'), priceDemol: num('rf-pd'), az: val('rf-az'), pvShare: num('rf-pv'),
      pie: val('rf-pie'), insKind: val('rf-ik'), rNorm: num('rf-rn'), cross: val('rf-cr') === 'yes', ventOk: val('rf-vo'), struct: val('rf-str'), crew: num('rf-cw'), laborCover: num('rf-lc'), pvScheme: val('rf-ps'), pvVent: val('rf-pvv')
    };
    c.prices = prices(); c.priceCover = c.prices[c.mat];
    return c;
  }
  function valid(c) {
    return c.L >= 2 && c.L <= 60 && c.W >= 2 && c.W <= 40 && c.ov >= 0 && c.ov <= 2 && c.alpha >= 0.5 && c.alpha <= 75 && c.valleys >= 0 && c.eaveH >= 1 && c.eaveH <= 20 && c.insT >= 0 && c.insT <= 500 &&
      c.sk > 0 && c.sk <= 6 && c.ce > 0 && c.ce <= 2 && c.ct > 0 && c.ct <= 1.5 && c.gOther >= 0 && c.span >= 1 && c.span <= 8 && c.step >= 0.3 && c.step <= 1.5 && c.b >= 30 && c.b <= 200 && c.h >= 75 && c.h <= 400 &&
      c.horizon >= 10 && c.horizon <= 150 && c.pvShare >= 0 && c.pvShare <= 100 && c.rNorm >= 0 && c.rNorm <= 10 && c.crew >= 1 && c.crew <= 30 && c.laborCover >= 0;
  }
  var IDS = ['rf-g1', 'rf-g2', 'rf-g3', 'rf-g4', 'rf-m1', 'rf-m2', 'rf-m3', 'rf-m4', 'rf-l1', 'rf-l2', 'rf-l3', 'rf-l4', 'rf-l5', 'rf-w1', 'rf-w2', 'rf-w3', 'rf-w4', 'rf-c1', 'rf-c2', 'rf-c3', 'rf-c4', 'rf-s1', 'rf-s2', 'rf-s3', 'rf-s4', 'rf-h1', 'rf-h2', 'rf-h3', 'rf-k1', 'rf-k2', 'rf-k3', 'rf-k4'];

  /* пригодность всех покрытий к уклону */
  function drawPitch(c) {
    var host = $('rf-ch'); if (!host) return; clearNode(host);
    var mats = D.slice().sort(function (a, b) { return a.special - b.special || a.min - b.min; });
    var ox = 190, oy = 22, w = 440, rh = 20, xmax = 45, H = oy + rh * mats.length + 40;
    var X = function (a) { return ox + Math.min(a, xmax) / xmax * w; };
    var el = svg('svg', { viewBox: '0 0 700 ' + H, width: '100%', role: 'img', 'aria-label': 'Пригодность покрытий к уклону вашей кровли' });
    el.appendChild(svg('rect', { x: ox, y: oy - 6, width: w, height: rh * mats.length + 6, fill: '#f4f5f6', stroke: G3 }));
    for (var a = 0; a <= 45; a += 5) {
      el.appendChild(svg('line', { x1: X(a), x2: X(a), y1: oy - 6, y2: oy + rh * mats.length, stroke: G3, 'stroke-dasharray': '3 4' }));
      el.appendChild(lab(X(a), oy + rh * mats.length + 16, a + '°', 'middle', '400', MUT, 11));
    }
    mats.forEach(function (m, i) {
      var y = oy + i * rh, f = M.fit(m, c.alpha), sel = m.id === c.mat;
      el.appendChild(lab(ox - 8, y + 14, m.short, 'end', sel ? '700' : '400', sel ? RED : INK, 11.5));
      el.appendChild(svg('rect', { x: X(m.special), y: y + 3, width: X(m.min) - X(m.special), height: 13, fill: G3, stroke: G1 }));
      el.appendChild(svg('rect', { x: X(m.min), y: y + 3, width: X(Math.min(m.steep, xmax)) - X(m.min), height: 13, fill: f === 'ok' ? INK : G1 }));
      el.appendChild(lab(ox + w + 10, y + 14, f === 'ok' ? 'подходит' : f === 'special' ? 'со спецмерами' : 'не подходит', 'start', f === 'no' ? '700' : '400', f === 'no' ? RED : MUT, 11));
    });
    var ax = X(c.alpha);
    el.appendChild(svg('line', { x1: ax, x2: ax, y1: oy - 10, y2: oy + rh * mats.length, stroke: RED, 'stroke-width': 2.5 }));
    el.appendChild(lab(Math.min(ax + 4, ox + w - 80), oy - 12, 'ваш уклон ' + fmt(c.alpha, 1) + '°', 'start', '700', RED, 12));
    host.appendChild(el);
    set('rf-chn', 'Светло-серое: только со спецмерами. Тёмное: стандартная укладка до уклона, выше которого нужна дополнительная фиксация. Красная линия ваш уклон, красная подпись выбранное покрытие.');
  }

  function aiSpec(c, r) {
    if (!window.TegaAI) return;
    var m = r.m, g = r.geo, q = r.q, n1 = fmt, flat = c.form === 'flat';
    var obj = [['Кровля', FORMS[c.form] + ', уклон ' + n1(c.alpha, 1) + '° (' + n1(g.pct, 0) + ' %), площадь покрытия ' + n1(g.area, 0) + ' м²'], ['План дома', n1(c.L, 1) + '×' + n1(c.W, 1) + ' м, свесы ' + n1(c.ov, 1) + ' м'],
      ['Выбранное покрытие', m.name], ['Снеговая нагрузка', 'расчётное значение на кровле ' + n1(r.S, 2) + ' кПа (sₖ ' + n1(c.sk, 2) + ' кПа)'], ['Горизонт сравнения', n1(c.horizon, 0) + ' лет']];
    var items = [{ name: m.name, qty: n1(q.cover, 0) + ' м² с запасом на раскрой ' + n1((m.waste - 1) * 100, 0) + ' %', req: 'применимо при уклоне ' + n1(c.alpha, 1) + '° по паспорту системы, сертификат и паспорт на русском языке, гарантия на материал и на монтаж отдельно' }];
    if (flat) items.push({ name: 'Пароизоляция и утеплитель плоской кровли', qty: n1(q.vapour, 0) + ' м² пароизоляции, утеплитель ' + n1(c.insT, 0) + ' мм', req: 'утеплитель с уклонообразующим слоем, несущая способность по пешеходной нагрузке' },
      { name: 'Кровельные воронки с обогревом и аварийным переливом', qty: r.outlets + ' шт', req: 'Ø и пропускная способность по расчёту, готовые манжеты для мембраны' });
    else {
      items.push({ name: 'Подкровельная гидроизоляционная мембрана', qty: n1(q.membrane, 0) + ' м²', req: 'паропроницаемая, с проклеиваемыми стыками, для кровель с вентзазором' });
      if (q.sheath) items.push({ name: 'Сплошной настил (влагостойкая фанера или OSB)', qty: n1(q.sheath, 0) + ' м²', req: 'толщина по шагу стропил и покрытию, влагостойкий класс' });
      if (q.battens) items.push({ name: 'Обрешётка', qty: n1(q.battens, 0) + ' м.п., шаг ' + n1(m.step * 1000, 0) + ' мм', req: 'антисептированная сухая доска, сечение по шагу стропил' });
      items.push({ name: 'Контробрешётка (вентзазор)', qty: n1(q.counter, 0) + ' м.п.', req: 'высота зазора не менее 50 мм' });
      if (c.insT > 0) items.push({ name: 'Утеплитель и пароизоляция', qty: n1(q.insul, 1) + ' м³ утеплителя ' + n1(c.insT, 0) + ' мм (λ около ' + n1(r.lam, 3) + (r.hasR ? ', R не менее ' + n1(c.rNorm, 2) + ' м²·°C/Вт' : '') + '), пароизоляция ' + n1(q.vapour, 0) + ' м²', req: 'негорючий утеплитель, пароизоляция с проклейкой стыков, ' + (c.cross ? 'второй слой перекрёстно' : 'мостики холода стропил закрыть') });
      items.push({ name: 'Коньковые, торцевые и карнизные планки, ендовы', qty: 'конёк и рёбра ' + n1(q.ridgeLen, 0) + ' м.п., торцы ' + n1(q.verge, 0) + ' м.п., ендовы ' + n1(q.valleys, 0) + ' м.п.', req: 'от того же производителя и цвета, что покрытие' });
      items.push({ name: 'Водосточная система', qty: 'жёлоб ' + n1(r.gutterLen, 0) + ' м.п., труб ' + r.pipes + ' шт по ' + n1(c.eaveH, 1) + ' м', req: r.gutter.name + ', стальная с полимерным покрытием или пластик с морозостойкостью до −40 °C' });
      if (r.guardLen) items.push({ name: 'Снегозадержатели', qty: n1(r.guardLen, 0) + ' м.п.', req: 'трубчатые или решётчатые, совместимые с покрытием, крепёж к обрешётке или стропилам по паспорту' });
    }
    items.push({ name: 'Крепёж, герметики, проходки кровельные', qty: 'комплект', req: 'саморезы и гвозди с покрытием для кровли, манжеты для труб и вентиляции' });
    if (c.pvShare > 0) items.push({ name: 'Солнечные модули на кровле', qty: n1(r.pvKw, 1) + ' кВт пиковой мощности', req: 'схема: ' + ({ on: 'на кронштейнах над кровлей', in: 'вместо покрытия с вентзазором 60–100 мм', bipv: 'фотоэлектрическая кровля', ballast: 'балластные рамы' }[c.pvScheme]) + ', расчёт нагрузки на стропила, ориентация ' + AZ[c.az] });
    var notes = r.warns.map(function (w) { return w.text; });
    notes.push('Числа кровельных покрытий ориентиры практики: сверить пределы уклона и нагрузки с паспортом системы. Подобрать покрытия трёх ценовых классов, подходящие по уклону и нагрузке.');
    window.TegaAI.update({ title: 'Кровля: ' + m.short, object: obj, items: items, notes: notes });
  }

  function calc() {
    var c = cfg();
    if (!valid(c)) {
      last = null; IDS.forEach(function (i) { set(i, '—'); });
      verdict('rf-verdict', 'Проверьте данные: размеры дома 2–60 × 2–40 м, свес 0–2 м, уклон 0,5–75°, снег 0–6 кПа, пролёт стропила 1–8 м, шаг 0,3–1,5 м, сечение 30–200 × 75–400 мм.', true);
      ['rf-v1', 'rf-v2', 'rf-v3', 'rf-v4', 'rf-v6', 'rf-v7'].forEach(function (i) { verdict(i, '', false); });
      ['rf-ch', 'rf-qt', 'rf-ct'].forEach(function (i) { var n = $(i); if (n) clearNode(n); }); set('rf-chn', '');
      if (window.TegaAI) window.TegaAI.update(null); return;
    }
    var r = M.calc(c), m = r.m, g = r.geo, q = r.q;
    last = { c: c, r: r };
    var red = r.warns.filter(function (w) { return w.level === 'red'; }), yel = r.warns.filter(function (w) { return w.level === 'yellow'; });
    set('rf-g1', fmt(g.area, 1) + ' м² покрытия (план со свесами ' + fmt(g.Lo, 1) + '×' + fmt(g.Wo, 1) + ' м = ' + fmt(g.planArea, 1) + ' м²)');
    set('rf-g2', 'карниз ' + fmt(g.eaves, 1) + ' м, конёк и рёбра ' + fmt(g.ridge + g.hips, 1) + ' м, торцы ' + fmt(g.verge, 1) + ' м, ендовы ' + fmt(g.valleys, 1) + ' м');
    set('rf-g3', fmt(c.alpha, 1) + '° = ' + fmt(g.pct, 0) + ' %' + (c.form === 'flat' ? ' (для плоской 1,5–3 % практика)' : ''));
    set('rf-g4', 'длина ската ' + fmt(g.slopeLen, 2) + ' м, подъём ' + fmt(g.rise, 2) + ' м');
    var txt = 'Покрытие «' + m.short + '» при уклоне ' + fmt(c.alpha, 1) + '°: ' + (r.fit === 'ok' ? 'подходит по стандартной укладке. ' : r.fit === 'special' ? 'только со спецмерами. ' : 'не подходит. ');
    if (red.length) txt += 'Красные: ' + red.map(function (w) { return w.text; }).join(' ') + ' ';
    if (yel.length) txt += 'Обратите внимание: ' + yel.map(function (w) { return w.text; }).join(' ') + ' ';
    if (!red.length && !yel.length) txt += 'Критичных замечаний нет. ';
    verdict('rf-verdict', txt, red.length > 0);

    /* покрытие */
    set('rf-m1', m.name + (c.alpha > m.steep ? '; выше ' + m.steep + '° нужна фиксация' : '') + '; предел уклона от ' + fmt(m.min, 0) + '° (со спецмерами от ' + fmt(m.special, 1) + '°)');
    set('rf-m2', 'масса ' + fmt(m.mass, 1) + ' кг/м² (' + fmt(m.mass * g.area, 0) + ' кг на кровлю), срок службы ' + fmt(m.lifeLo, 0) + '–' + fmt(m.lifeHi, 0) + ' лет, обслуживание ' + fmt(m.maint, 1) + ' % в год');
    set('rf-m3', 'ценовой класс ' + m.cls + ' из 5, шум дождя ' + m.noise + ' из 5, ремонтопригодность ' + m.repair + ' из 5, сложность монтажа ' + m.install + ' из 5');
    set('rf-m4', 'покрытие ' + fmt(q.cover, 0) + ' м² (запас ' + fmt((m.waste - 1) * 100, 0) + ' %)' + (q.sheath ? ', настил ' + fmt(q.sheath, 0) + ' м²' : '') + (q.battens ? ', обрешётка ' + fmt(q.battens, 0) + ' м.п.' : ''));
    var rows = [['Покрытие', fmt(q.cover, 0), 'м²'], ['Подкровельная мембрана или пароизоляция', fmt(q.membrane, 0), 'м²'],
      ['Сплошной настил', q.sheath ? fmt(q.sheath, 0) : '—', 'м²'], ['Обрешётка', q.battens ? fmt(q.battens, 0) : '—', 'м.п.'], ['Контробрешётка', q.counter ? fmt(q.counter, 0) : '—', 'м.п.'],
      ['Утеплитель', q.insul ? fmt(q.insul, 1) : '—', 'м³'], ['Конёк и рёбра', fmt(g.ridge + g.hips, 1), 'м.п.'], ['Торцы', fmt(g.verge, 1), 'м.п.'], ['Ендовы', fmt(g.valleys, 1), 'м.п.'], ['Карнизные планки', fmt(g.eaves, 1), 'м.п.']];
    table($('rf-qt'), ['Позиция', 'Количество', 'Ед.'], rows.map(function (x) { return { cells: x }; }));

    /* нагрузки */
    set('rf-l1', 'μ = ' + fmt(r.mu, 2) + ', снег на кровле S = ' + fmt(r.S, 2) + ' кПа (' + fmt(r.S * 102, 0) + ' кг/м²)');
    set('rf-l2', 'постоянная ' + fmt(r.gk, 2) + ' кН/м² (покрытие ' + fmt(r.gCover, 2) + ' и прочее ' + fmt(c.gOther, 2) + ')');
    set('rf-l3', 'расчётная нагрузка на стропило ' + fmt(r.qd, 2) + ' кН/м, изгибающий момент ' + fmt(r.M, 2) + ' кН·м');
    set('rf-l4', 'использование ' + fmt(r.util * 100, 0) + ' % (изгиб ' + fmt(r.utilBend * 100, 0) + ' %, прогиб ' + fmt(r.utilDef * 100, 0) + ' %) для ' + fmt(c.b, 0) + '×' + fmt(c.h, 0) + ' мм ' + c.grade);
    set('rf-l5', 'по расчёту нужна высота около ' + fmt(r.hReq, 0) + ' мм, ближайшая доска ' + r.hStd + ' мм при ширине ' + fmt(c.b, 0) + ' мм');
    verdict('rf-v2', r.util > 1 ? 'Сечение не проходит предварительную проверку. Окончательно считает проектировщик.' : r.util > 0.85 ? 'Запас мал, это предварительная проверка.' : 'Предварительная проверка проходит. Окончательно считает проектировщик по СН.', r.util > 1);

    /* водоотвод */
    if (c.form === 'flat') {
      set('rf-w1', 'внутренние воронки ' + r.outlets + ' шт (не менее двух, не более 150 м² на воронку)');
      set('rf-w2', 'парапет и заход гидроизоляции не менее 150 мм'); set('rf-w3', '—'); set('rf-w4', 'уклон 1,5–3 % к воронкам, клиновой утеплитель');
    } else {
      set('rf-w1', 'водосточных труб: ' + r.pipes + ' (' + r.gutter.name + ')');
      set('rf-w2', 'жёлоб ' + fmt(r.gutterLen, 0) + ' м.п., трубы ' + fmt(r.pipeLen, 0) + ' м.п. при высоте карниза ' + fmt(c.eaveH, 1) + ' м');
      set('rf-w3', r.guardRows ? r.guardRows + ' ряд' + (r.guardRows > 1 ? 'а' : '') + ' по карнизу, ' + fmt(r.guardLen, 0) + ' м.п.' : 'не требуются при уклоне ниже 12° или на плоской кровле');
      set('rf-w4', 'трубы не реже чем через 12 м, желоб с уклоном 3–5 мм/м');
    }
    verdict('rf-v3', '', false);

    /* стоимость */
    var own = r.priceOk;
    set('rf-c1', own ? 'за ' + fmt(c.horizon, 0) + ' лет всего ' + fmt(r.total, 0) + ' BYN' : 'введите цену выбранного покрытия, BYN за м² с монтажом');
    set('rf-c2', own ? fmt(r.perYear, 0) + ' BYN в год, ' + fmt(r.perM2Year, 2) + ' BYN с м² в год' : '—');
    set('rf-c3', 'срок службы по выбранной оценке ' + fmt(r.life, 0) + ' лет, замен за горизонт ' + r.nRepl + ', остаток последней кровли ' + fmt(r.residual * 100, 0) + ' %');
    set('rf-c4', own ? 'старт ' + fmt(r.initial, 0) + ', замены ' + fmt(r.nRepl * r.replEach, 0) + ', обслуживание ' + fmt(r.maintTotal, 0) + ', остаток −' + fmt(r.residualVal, 0) + ' BYN' : '—');
    var costRows = r.costAll.slice().sort(function (a, b) { return (isFinite(a.perM2Year) ? a.perM2Year : 1e9) - (isFinite(b.perM2Year) ? b.perM2Year : 1e9); });
    var best = null; costRows.forEach(function (x) { if (!best && isFinite(x.perM2Year) && x.fit !== 'no') best = x.id; });
    var rowsC = costRows.map(function (x) {
      return { cls: x.id === best ? 'ok' : x.fit === 'no' ? 'bad' : '', cells: [x.name, x.fit === 'ok' ? 'да' : x.fit === 'special' ? 'спецмеры' : 'нет', fmt(x.life, 0), String(x.nRepl), isFinite(x.price) ? fmt(x.price, 0) : '—', isFinite(x.perM2Year) ? fmt(x.perM2Year, 2) : '—', isFinite(x.perYear) ? fmt(x.perYear, 0) : '—'] };
    });
    table($('rf-ct'), ['Покрытие', 'По уклону', 'Срок, лет', 'Замен', 'Цена, BYN/м²', 'BYN/м² в год', 'BYN в год'], rowsC);
    var cnt = costRows.filter(function (x) { return isFinite(x.perM2Year); }).length;
    verdict('rf-v4', cnt ? (best ? 'Самое выгодное из подходящих по уклону при ваших ценах: ' + (D.filter(function (m2) { return m2.id === best; })[0].short) + '. Цены вводите с монтажом.' : 'Ни одно покрытие с ценой не подходит по уклону.') : 'Введите цены покрытий с монтажом, и таблица покажет стоимость владения по каждому.', cnt > 0 && !best);

    /* солнце */
    set('rf-h1', 'R кровли ' + fmt(r.rFact, 2) + ' м²·°C/Вт (поверхности ' + fmt(r.rOther, 2) + ' + утеплитель ' + fmt(c.insT, 0) + ' мм / λ ' + fmt(r.lam, 3) + ')' + (r.hasR ? ', требуется ' + fmt(c.rNorm, 2) : ', норма не задана'));
    set('rf-h2', r.hasR ? 'нужно ' + fmt(r.tReq, 0) + ' мм, с округлением до 50 мм ' + fmt(r.tRound, 0) + ' мм' : 'на 1 м²·°C/Вт нужно ' + fmt(r.lam * 1000, 0) + ' мм этого утеплителя');
    set('rf-h3', r.ventArea ? 'отверстий не менее ' + fmt(r.ventArea * 1e4, 0) + ' см² в сумме: около ' + fmt(r.ventPerEave, 0) + ' см² на 1 м карниза и ' + fmt(r.ventPerRidge, 0) + ' см² на 1 м конька' : 'плоская кровля без вентиляционного зазора, воздух решают парогидроизоляцией и аэраторами');
    verdict('rf-v6', r.warns.filter(function (w) { return /Сопротивление|перекрёстн|Утепление только|вентилир/.test(w.text); }).map(function (w) { return w.text; }).join(' '), r.warns.some(function (w) { return w.level === 'red' && /Сопротивление|вентилир/.test(w.text); }));
    set('rf-k1', fmt(r.lab.total, 0) + ' чел·ч, ' + fmt(r.perM2Hours, 2) + ' чел·ч на м² (покрытие ' + fmt(r.laborRate, 2) + ')');
    set('rf-k2', 'бригада ' + r.crew + ' чел.: около ' + fmt(r.days, 0) + ' рабочих дней по 8 часов, без погодных простоев');
    set('rf-k3', 'стропила ' + fmt(r.lab.rafters, 0) + ', утепление ' + fmt(r.lab.pie, 0) + ', основание ' + fmt(r.lab.base, 0) + ', покрытие ' + fmt(r.lab.cover, 0) + ', водосток ' + fmt(r.lab.water, 0) + ' чел·ч');
    set('rf-k4', 'осмотр и чистка около ' + r.maintHours + ' чел·ч в год (ориентир практики)');
    verdict('rf-v7', '', false);
    set('rf-s1', 'пригодная площадь ' + fmt(r.pvArea, 0) + ' м², около ' + fmt(r.pvKw, 1) + ' кВт пиковой мощности');
    set('rf-s2', fmt(r.pvKwhNet, 0) + ' кВт·ч в год с потерями схемы ' + fmt(r.pvLoss * 100, 1) + ' % (без них ' + fmt(r.pvKwh, 0) + '; ориентация ' + AZ[c.az] + ', множитель уклона ' + fmt(r.pvTilt, 2) + ', ориентации ' + fmt(r.pvAz, 2) + ')');
    set('rf-s3', 'добавочная нагрузка около ' + fmt(r.pvMass, 0) + ' кг на кровлю (около 15 кг/м² модулей)');
    set('rf-s4', 'кровля по нижней оценке ' + fmt(m.lifeLo, 0) + ' лет против 25–30 лет у панелей');
    verdict('rf-v5', r.warns.filter(function (w) { return /анел|Снегозадерж|Балласт|Схема|Северн/.test(w.text); }).map(function (w) { return w.text; }).join(' '), r.warns.some(function (w) { return w.level === 'red' && /анел/.test(w.text); }));
    drawPitch(c); aiSpec(c, r);
  }

  function apply(k) {
    var p = PRESETS[k]; if (!p) return;
    var m = { 'rf-form': p.form, 'rf-L': p.L, 'rf-W': p.W, 'rf-ov': p.ov, 'rf-a': p.alpha, 'rf-mat': p.mat, 'rf-ins': p.insT };
    for (var id in m) { var el = $(id); if (el) el.value = String(m[id]).replace('.', ','); }
    calc();
  }

  function init() {
    var root = $('e-rf'); if (!root) return;
    var panels = [];
    Array.prototype.forEach.call(root.querySelectorAll('.e-panel'), function (p) { panels.push(p.id); });
    root.classList.add('js');
    function show(id) {
      if (panels.indexOf(id) < 0) id = panels[0];
      Array.prototype.forEach.call(root.querySelectorAll('.e-panel'), function (p) { p.classList.toggle('on', p.id === id); });
      Array.prototype.forEach.call(document.querySelectorAll('.e-sub a'), function (a) {
        var onn = a.getAttribute('data-sub') === id; a.classList.toggle('on', onn);
        if (onn) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
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
      if (el.id === 'rf-preset') { el.addEventListener('change', function () { apply(el.value); }); return; }
      el.addEventListener('input', calc); el.addEventListener('change', calc);
    });
    var rs = $('rf-p-reset');
    if (rs) rs.addEventListener('click', function () { Array.prototype.forEach.call(root.querySelectorAll('input[id^="rf-p-"]'), function (e) { e.value = ''; }); calc(); });
    calc();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
