/* Фундаменты: интерфейс калькулятора (MVP — лента МЗЛФ и плита). Модель расчёта в found-model.js.
   Ориентировочный расчёт, не проект. */
(function () {
  'use strict';
  var M = window.TegaFound;
  if (!M) return;
  function $(id) { return document.getElementById(id); }
  function num(id) {
    var el = $(id); if (!el) return NaN;
    var n = parseFloat(String(el.value).replace(/\s/g, '').replace(',', '.').replace(/−/g, '-'));
    return isFinite(n) ? n : NaN;
  }
  function val(id) { var el = $(id); return el ? el.value : ''; }
  function checked(id) { var el = $(id); return el ? el.checked : false; }
  function fmt(x, d) {
    if (!isFinite(x)) return '—';
    var s = Math.abs(x).toFixed(d), p = s.split('.');
    p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return (x < 0 ? '−' : '') + p.join(',');
  }
  function set(id, v) { var el = $(id); if (el) el.textContent = v; }
  function verdict(id, t, bad) { var el = $(id); if (!el) return; el.textContent = t; el.className = 'verdict' + (bad ? ' bad' : ''); }
  function clearNode(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function table(host, head, rows) {
    clearNode(host);
    var t = document.createElement('table'); t.className = 'e-tbl';
    var tr = document.createElement('tr');
    head.forEach(function (h) { var th = document.createElement('th'); th.textContent = h; tr.appendChild(th); });
    var thead = document.createElement('thead'); thead.appendChild(tr); t.appendChild(thead);
    var tb = document.createElement('tbody');
    rows.forEach(function (r) {
      var row = document.createElement('tr'); if (r.cls) row.className = r.cls;
      r.cells.forEach(function (c, i) { var td = document.createElement('td'); td.textContent = c; if (i > 0) td.className = 'm'; row.appendChild(td); });
      tb.appendChild(row);
    });
    t.appendChild(tb);
    var sc = document.createElement('div'); sc.className = 'e-scroll'; sc.appendChild(t); host.appendChild(sc);
  }

  var SOIL_NAMES = M.SOIL_NAME || {};
  var last = null;

  function sys() {
    var el = document.querySelector('input[name="fd-sys"]:checked');
    return el ? el.value : 'lenta';
  }

  function toggleSys() {
    var s = sys();
    Array.prototype.forEach.call(document.querySelectorAll('.fd-only-lenta'), function (n) { n.style.display = s === 'lenta' ? '' : 'none'; });
    Array.prototype.forEach.call(document.querySelectorAll('.fd-only-plita'), function (n) { n.style.display = s === 'plita' ? '' : 'none'; });
  }

  function cfg() {
    var s = sys();
    var c = {
      sys: s, L: num('fd-L'), W: num('fd-W'), floors: num('fd-floors'), wall: val('fd-wall'),
      soil: val('fd-soil'), R: num('fd-R'), ugv: num('fd-ugv'), pucin: checked('fd-pucin')
    };
    if (s === 'lenta') {
      c.perim = num('fd-perim'); c.shallow = checked('fd-shallow'); c.F = num('fd-F');
      c.h = num('fd-h'); c.dLong = num('fd-dLong'); c.nLong = num('fd-nLong'); c.dStirrup = num('fd-dStirrup'); c.step = num('fd-step');
    } else {
      c.ribLen = num('fd-ribLen'); c.t = num('fd-t'); c.dMesh = num('fd-dMesh'); c.step = num('fd-mstep'); c.ribW = num('fd-ribW'); c.ribH = num('fd-ribH');
    }
    return c;
  }

  function valid(c) {
    return c.L > 0 && c.W > 0 && c.floors > 0;
  }

  function priority() {
    var el = document.querySelector('input[name="fd-priority"]:checked');
    return el ? el.value : 'balance';
  }

  function types() {
    var host = $('fd-types'); if (!host) return;
    var c = { soil: val('fd-soil'), floors: num('fd-floors'), wall: val('fd-wall'), ugv: num('fd-ugv'), pucin: checked('fd-pucin'), priority: priority() };
    if (!c.soil) { clearNode(host); return; }
    var ranked = M.rankTypes(c);
    var best = ranked.length ? ranked[0].score : 0;
    var rows = ranked.map(function (it, i) {
      var t = it.type;
      return {
        cls: i === 0 && it.score >= best - 1e-9 ? 'tot' : '',
        cells: [
          (i === 0 ? '★ ' : '') + t.name, fmt(t.cost[0], 0) + '–' + fmt(t.cost[1], 0), t.labor, t.term,
          it.reasons.length ? t.risk + '. ' + it.reasons.join('; ') : t.risk
        ]
      };
    });
    table(host, ['Система', 'у.е./м²', 'Трудозатраты', 'Срок', 'Риск и замечания'], rows);
    verdict('fd-vtype', 'Рекомендация — по справочным ориентирам практики (статья «Фундаменты», раздел 3), не проектное решение. Точный расчёт сечения и армирования MVP считает дальше только для ленты МЗЛФ и плиты.', false);
  }

  function budget() {
    var host = $('fd-bt'); if (!host) return;
    if (!last) { clearNode(host); set('fd-b1', '—'); set('fd-b2', '—'); set('fd-b3', '—'); verdict('fd-bverdict', '', false); return; }
    var r = last.r;
    var mix = M.siteMix((r.concrete || 0) + (r.pad || 0));
    var diy = checked('fd-p-diy');
    var excavQty = diy ? 0 : r.excavVol;

    var common = [
      ['Арматура', r.steelMass, 'кг', 'rebar'],
      ['Опалубка', r.formworkArea, 'м²', 'form'],
      ['Экскавация и вывоз грунта', excavQty, 'м³', 'excav'],
    ];
    var rmx = [
      ['Товарный бетон несущий В22,5', r.concrete, 'м³', 'rmxB225'],
      ['Товарный бетон подбетонка В15', r.pad, 'м³', 'rmxB15'],
    ];
    var site = [
      ['Цемент (на месте)', mix.cementBags, 'мешков', 'cement'],
      ['Песок (на месте)', mix.sandM3, 'м³', 'sand'],
      ['Щебень (на месте)', mix.gravelM3, 'м³', 'gravel'],
    ];

    function lineOf(it) {
      var p = num('fd-p-' + it[3]), line = isFinite(p) && p >= 0 && it[1] > 0 ? p * it[1] : NaN;
      return { row: { cells: [it[0], fmt(it[1], 1) + ' ' + it[2], isFinite(p) ? fmt(p, 2) : '—', isFinite(line) ? fmt(line, 2) : '—'] }, line: line };
    }

    var rows = [], sumCommon = 0;
    common.forEach(function (it) { var o = lineOf(it); rows.push(o.row); if (isFinite(o.line)) sumCommon += o.line; });
    var sumRmx = 0;
    rmx.forEach(function (it) { var o = lineOf(it); rows.push(o.row); if (isFinite(o.line)) sumRmx += o.line; });
    var sumSite = 0;
    site.forEach(function (it) { var o = lineOf(it); rows.push(o.row); if (isFinite(o.line)) sumSite += o.line; });
    var rig = num('fd-p-rig');
    if (isFinite(rig) && rig >= 0) { rows.push({ cells: ['Миксер, доставка сыпучих и логистика', '1', 'компл.', fmt(rig, 2)] }); sumSite += rig; }

    var totalRmx = sumCommon + sumRmx, totalSite = sumCommon + sumSite;
    rows.push({ cls: 'tot', cells: ['Итого: товарный бетон', '', '', fmt(totalRmx, 2)] });
    rows.push({ cls: 'tot', cells: ['Итого: бетон на месте', '', '', fmt(totalSite, 2)] });
    table(host, ['Позиция', 'Количество', 'Цена, BYN за ед.', 'Сумма, BYN'], rows);

    set('fd-b1', fmt(totalRmx, 2) + ' BYN');
    set('fd-b2', fmt(totalSite, 2) + ' BYN');
    var diff = totalSite - totalRmx;
    set('fd-b3', (diff >= 0 ? 'на месте дороже на ' : 'на месте дешевле на ') + fmt(Math.abs(diff), 2) + ' BYN');
    verdict('fd-bverdict', 'Цены не заложены: введите свои за единицу, суммы пересчитаются. Расход цемента/песка/щебня на месте — справочный ориентир (ГОСТ 7473-2010, практика), фактическую рецептуру уточняет лаборатория бетонного узла. Электрика, доставка арматуры и прочие позиции сметы сюда не входят.', false);
  }

  function calc() {
    var c = cfg();
    types();
    if (!valid(c)) {
      last = null;
      verdict('fd-verdict', 'Укажите длину, ширину и число этажей дома.', true);
      verdict('fd-v1', '', false);
      budget();
      return;
    }
    var r = M.calc(c);
    last = { c: c, r: r };
    var lenta = r.sys === 'lenta';
    set('fd-g1', lenta ? 'Лента МЗЛФ' : 'Плита');
    set('fd-g2', 'суглинок/грунт: ' + (SOIL_NAMES[c.soil] || c.soil) + ', dfn ' + (lenta ? fmt(r.dfn, 2) : '—') + ' м');
    set('fd-g3', lenta ? 'F ≈ ' + fmt(r.F, 0) + ' кН/м' : 'площадь ' + fmt(r.S, 1) + ' м²');
    set('fd-g4', lenta ? 'лента ' + fmt(r.b * 1000, 0) + '×' + fmt(r.h * 1000, 0) + ' мм' : 'плита ' + fmt(r.t * 1000, 0) + ' мм + рёбра ' + fmt(r.ribW * 1000, 0) + '×' + fmt(r.ribH * 1000, 0) + ' мм');
    var red = (r.warns || []).filter(function (w) { return w.level === 'red'; });
    var yel = (r.warns || []).filter(function (w) { return w.level === 'yellow'; });
    var info = (r.warns || []).filter(function (w) { return w.level === 'info'; });
    var txt = '';
    if (red.length) txt += 'Красные: ' + red.map(function (w) { return w.text; }).join(' ') + ' ';
    if (yel.length) txt += 'Обратите внимание: ' + yel.map(function (w) { return w.text; }).join(' ') + ' ';
    txt += info.map(function (w) { return w.text; }).join(' ');
    verdict('fd-verdict', txt, red.length > 0);

    if (lenta) {
      set('fd-c1', fmt(r.b * 1000, 0) + ' × ' + fmt(r.h * 1000, 0) + ' мм (требуется ≥ ' + fmt(r.bReq * 1000, 0) + ' мм)');
      set('fd-c2', r.nLong + 'Ø' + r.dLong + ' А500С, ' + fmt(r.longLen, 1) + ' пог. м');
      set('fd-c3', 'хомуты Ø' + r.dStirrup + ' шаг ' + fmt(r.step, 0) + ' мм, ' + r.stirrupCount + ' шт, ' + fmt(r.stirrupTotalLen, 1) + ' пог. м');
      set('fd-c4', fmt(r.steelMass, 0) + ' кг (' + fmt(r.longMass, 0) + ' + ' + fmt(r.stirrupMass, 0) + ')');
      set('fd-c5', 'вертикально ' + fmt(r.epsVert, 1) + ' м² + под отмосткой ' + fmt(r.epsOtm, 1) + ' м² ≈ ' + fmt(r.epsTotal, 0) + ' м²');
    } else {
      set('fd-c1', fmt(r.t * 1000, 0) + ' мм (+ рёбра ' + fmt(r.ribLen, 0) + ' пог. м)');
      set('fd-c2', '2 сетки Ø' + r.dMesh + ' шаг ' + fmt(r.step, 0) + ' мм, ' + fmt(r.longLen, 0) + ' пог. м');
      set('fd-c3', 'П-образные шпильки по краю: ' + r.studCount + ' шт, ' + fmt(r.studLen, 0) + ' пог. м');
      set('fd-c4', fmt(r.steelMass, 0) + ' кг (сетки ' + fmt(r.steelMassGrids, 0) + ' + шпильки ' + fmt(r.studMass, 0) + ')');
      set('fd-c5', 'ЭППС под плитой ' + fmt(r.eps, 0) + ' м² (ориентир 200–300 мм)');
    }
    set('fd-c6', r.concreteClass + ' (подбетонка ' + r.padClass + ')');
    verdict('fd-v1', 'Защитный слой, нахлёст и минимальный коэффициент армирования — по СП 5.03.01-2020. Марка бетона — ориентир практики. Окончательную схему армирования и сечение проверяет проектировщик по расчёту на несущую способность.', false);
    budget();
  }

  function apply() {
    var m = { 'fd-L': '10', 'fd-W': '10', 'fd-floors': '2', 'fd-wall': 'gas', 'fd-soil': 'loam', 'fd-R': '220', 'fd-ugv': '1,8', 'fd-perim': '56', 'fd-F': '62', 'fd-h': '0,6', 'fd-dLong': '12', 'fd-nLong': '4', 'fd-dStirrup': '8', 'fd-step': '350' };
    for (var id in m) { var el = $(id); if (el) el.value = m[id]; }
  }

  function init() {
    var root = $('e-fd'); if (!root) return;
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
    Array.prototype.forEach.call(root.querySelectorAll('input[name="fd-sys"]'), function (el) {
      el.addEventListener('change', function () { toggleSys(); calc(); });
    });
    Array.prototype.forEach.call(root.querySelectorAll('input, select'), function (el) {
      if (!el.id && el.type !== 'radio') return;
      if (el.name === 'fd-sys') return;
      el.addEventListener('input', calc); el.addEventListener('change', calc);
    });
    var rs = $('fd-p-reset');
    if (rs) rs.addEventListener('click', function () {
      Array.prototype.forEach.call(root.querySelectorAll('input[id^="fd-p-"]'), function (e) { if (e.type === 'checkbox') e.checked = false; else e.value = ''; });
      calc();
    });
    apply(); toggleSys(); calc();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
