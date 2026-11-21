/* Тепловые насосы: интерфейс калькулятора. Модель расчёта в tn-model.js.
   Четыре панели: теплопотери и годовое тепло, мощность ТН и электричество, экономика, грунтовый
   контур. Ориентировочный расчёт (±15–20%), не проект отопления по ТКП 45-4.02-182. */
(function () {
  'use strict';
  var M = window.TegaTN;
  if (!M) return;
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

  var lastLoss = null, lastPower = null;

  function calcTnLoss() {
    var ids = ['tl-qd', 'tl-m2', 'tl-ot', 'tl-gvs', 'tl-total'];
    var inp = {
      regionId: val('tl-region'), s: num('tl-s'), h: num('tl-h'),
      wallArea: num('tl-wall'), wallR: num('tl-wallr'), winArea: num('tl-win'), winR: num('tl-winr'), doorArea: num('tl-door'),
      topR: num('tl-topr'), botR: num('tl-botr'), airChange: num('tl-air'), recupEff: num('tl-recup') / 100,
      occupants: num('tl-occ'), dhwPerPerson: num('tl-dhw'), tGvs: num('tl-tgvs'), tCold: num('tl-tcold')
    };
    var r = M.calcLoss(inp);
    if (!r) {
      ids.forEach(function (i) { set(i, '—'); });
      verdict('tl-verdict', 'Проверьте площадь, сопротивления R и регион.', true);
      lastLoss = null;
      return;
    }
    lastLoss = r;
    set('tl-qd', fmt(r.qdKw, 2) + ' кВт');
    set('tl-m2', fmt(r.perM2, 0) + ' Вт/м²');
    set('tl-ot', fmt(r.qGodOt, 0) + ' кВт·ч/год');
    set('tl-gvs', fmt(r.qGvs, 0) + ' кВт·ч/год');
    set('tl-total', fmt(r.totalHeat, 0) + ' кВт·ч/год');
    verdict('tl-verdict', r.region.name + ', ГСОП ' + fmt(r.region.gsop, 0) + ': расчётные теплопотери ' + fmt(r.qdKw, 2) + ' кВт при ' + fmt(r.region.tn, 0) + ' °C. Используйте это значение во вкладке «Мощность и электричество».', false);
    syncFromLoss();
    calcTnPower();
  }

  function syncFromLoss() {
    if (!lastLoss) return;
    var qdEl = $('tp-qd'); if (qdEl && !qdEl.value) qdEl.placeholder = fmt(lastLoss.qdKw, 2);
  }

  function calcTnPower() {
    var ids = ['tp-scop', 'tp-scopgvs', 'tp-pbiv', 'tp-welec', 'tp-line'];
    var qd = num('tp-qd'); if (!isFinite(qd) || qd <= 0) qd = lastLoss ? lastLoss.qdKw : NaN;
    var qGodOt = lastLoss ? lastLoss.qGodOt : 0, qGvs = lastLoss ? lastLoss.qGvs : 0;
    var inp = {
      typeId: val('tp-type'), graphId: val('tp-graph'), equipClass: val('tp-equip'),
      pNom: num('tp-pnom'), bivalentT: num('tp-biv'), qdKw: qd, qGodOt: qGodOt, qGvs: qGvs
    };
    var r = M.calcPower(inp);
    if (!r) {
      ids.forEach(function (i) { set(i, '—'); });
      verdict('tp-verdict', 'Укажите теплопотери (вкладка «Теплопотери») и номинальную мощность ТН.', true);
      lastPower = null;
      return;
    }
    lastPower = r;
    set('tp-scop', fmt(r.scopOt, 2));
    set('tp-scopgvs', fmt(r.scopGvs, 2));
    set('tp-pbiv', fmt(r.pBiv, 2) + ' кВт при ' + fmt(r.bivalentT, 0) + ' °C' + (r.type.defrost ? '' : ' (не зависит от мороза)'));
    set('tp-welec', fmt(r.welec, 0) + ' кВт·ч/год');
    set('tp-line', r.line);
    if (r.ok) verdict('tp-verdict', r.type.name + ': мощности в точке бивалентности достаточно (≥ 0,8 от теплопотерь).', false);
    else verdict('tp-verdict', 'Мощности в точке бивалентности не хватает на ' + fmt(r.deficitPct, 0) + ' % — нужен ТЭН-добор, каскад или резервный котёл (раздел 6 статьи).', true);
    calcTnEcon();
    calcTnGround();
  }

  function calcTnEcon() {
    var ids = ['te-hp', 'te-eb', 'te-gas', 'te-pellet', 'te-wood'];
    var totalHeat = num('te-heat'); if (!isFinite(totalHeat) || totalHeat <= 0) totalHeat = lastLoss ? lastLoss.totalHeat : NaN;
    var scopOt = lastPower ? lastPower.scopOt : NaN;
    var inp = { totalHeat: totalHeat, scopOt: scopOt, tElec: num('te-elec'), tGas: num('te-gas-t'), tPellet: num('te-pellet-t'), tWood: num('te-wood-t') };
    var r = M.calcEconomics(inp);
    var host = $('te-table');
    if (!r) {
      ids.forEach(function (i) { set(i, '—'); });
      verdict('te-verdict', 'Заполните теплопотери и тип насоса на первых двух вкладках.', true);
      if (host) clearNode(host);
      return;
    }
    var byId = {}; r.rows.forEach(function (row) { byId[row.id] = row; });
    set('te-hp', fmt(byId.hp.cost, 0) + ' BYN/год');
    set('te-eb', fmt(byId.eb.cost, 0) + ' BYN/год');
    set('te-gas', isFinite(byId.gas.cost) ? fmt(byId.gas.cost, 0) + ' BYN/год' : '—');
    set('te-pellet', isFinite(byId.pellet.cost) ? fmt(byId.pellet.cost, 0) + ' BYN/год' : '—');
    set('te-wood', isFinite(byId.wood.cost) ? fmt(byId.wood.cost, 0) + ' BYN/год' : '—');
    verdict('te-verdict', 'Экономия против электрокотла: ' + fmt(byId.hp.savingsVsEb, 0) + ' %. Это ориентир для разговора с подрядчиком, тарифы меняются — сверяйте с действующим счётом.', false);
    if (host) {
      table(host, ['Источник', 'BYN/год', 'Экономия к электрокотлу'], r.rows.map(function (row) {
        return { cls: row.id === 'hp' ? 'hl' : '', cells: [row.name, isFinite(row.cost) ? fmt(row.cost, 0) : '—', isFinite(row.savingsVsEb) ? fmt(row.savingsVsEb, 0) + ' %' : '—'] };
      }));
    }
  }

  function calcTnGround() {
    var ids = ['tg-area', 'tg-pipe', 'tg-len', 'tg-bore', 'tg-glycol', 'tg-tank', 'tg-flow'];
    var pTn = lastPower ? lastPower.pNom : NaN, scop = lastPower ? lastPower.scopOt : NaN;
    var inp = { soilId: val('tg-soil'), pTn: pTn, scop: scop, siteArea: num('tg-site'), boreDepth: num('tg-depth'), stepM: num('tg-step'), linesM: num('tg-lines') };
    var r = M.calcGround(inp);
    if (!r) {
      ids.forEach(function (i) { set(i, '—'); });
      verdict('tg-verdict', 'Заполните мощность и SCOP ТН на вкладке «Мощность и электричество».', true);
      return;
    }
    set('tg-area', fmt(r.horizontal.areaNeeded, 0) + ' м²' + (r.horizontal.siteOk === false ? ' — больше вашего участка' : ''));
    set('tg-pipe', fmt(r.horizontal.pipeLen, 0) + ' м трубы');
    set('tg-len', fmt(r.vertical.totalLen, 0) + ' м суммарно');
    set('tg-bore', r.vertical.boreholes + ' скважины по ' + fmt(r.vertical.perBore, 0) + ' м');
    set('tg-glycol', fmt(r.vertical.glycolL, 0) + ' л, бак ≥ ' + fmt(r.vertical.tankL, 0) + ' л');
    set('tg-flow', fmt(r.water.gFlow, 2) + ' м³/ч, нужен дебит ≥ ' + fmt(r.water.minDebit, 2) + ' м³/ч');
    var msg = 'Отбор из грунта/воды: ' + fmt(r.pOtbW / 1000, 2) + ' кВт. ';
    var bad = r.horizontal.siteOk === false;
    if (bad) msg += 'Площади участка не хватает для горизонтального коллектора — переходите на вертикальные зонды.';
    else msg += 'Шаг скважин — не менее 6–8 м, опрессовка контура 1,25× рабочего давления (раздел 3 статьи).';
    verdict('tg-verdict', msg, bad);
  }

  function init() {
    var root = $('e-tn'); if (!root) return;
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
    Array.prototype.forEach.call(root.querySelectorAll('#tnloss input, #tnloss select'), function (el) { el.addEventListener('input', calcTnLoss); el.addEventListener('change', calcTnLoss); });
    Array.prototype.forEach.call(root.querySelectorAll('#tnpower input, #tnpower select'), function (el) { el.addEventListener('input', calcTnPower); el.addEventListener('change', calcTnPower); });
    Array.prototype.forEach.call(root.querySelectorAll('#tnecon input, #tnecon select'), function (el) { el.addEventListener('input', calcTnEcon); el.addEventListener('change', calcTnEcon); });
    Array.prototype.forEach.call(root.querySelectorAll('#tnground input, #tnground select'), function (el) { el.addEventListener('input', calcTnGround); el.addEventListener('change', calcTnGround); });
    calcTnLoss();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
