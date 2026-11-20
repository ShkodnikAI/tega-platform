/* Стены: интерфейс облегчённого калькулятора. Модель расчёта в sten-model.js.
   Ориентировочный расчёт бюджета, трудозатрат и теплопотерь, не проект: подбора сечений и конструктива здесь нет. */
(function () {
  'use strict';
  var M = window.TegaSten;
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

  function calc() {
    var ids = ['st-budget', 'st-labor', 'st-days', 'st-r0', 'st-heat', 'st-heat30'];
    var area = num('st-area'), crew = num('st-crew');
    var r = M.calc({ sysId: val('st-sys'), regionId: val('st-region'), area: area, crew: crew });
    if (!r) {
      ids.forEach(function (i) { set(i, '—'); });
      verdict('st-verdict', 'Укажите площадь стен больше нуля.', true);
      var host = $('st-table'); if (host) clearNode(host);
      return;
    }
    set('st-budget', fmt(r.budgetTotal, 0) + ' BYN (' + fmt(r.budgetPerM2, 0) + ' BYN/м²)');
    set('st-labor', fmt(r.laborTotal, 0) + ' чел·ч');
    set('st-days', fmt(r.days, 1) + ' раб. дней бригадой ' + fmt(r.crew, 0) + ' чел.');
    set('st-r0', fmt(r.r0, 1) + ' м²·°C/Вт (' + (r.passesNorm ? 'норматив 2,8 пройден' : 'норматив 2,8 не пройден без доутепления') + ', ×' + fmt(r.normRatio, 2) + ' к нормативу)');
    set('st-heat', fmt(r.heatTotalSeason, 0) + ' кВт·ч (' + fmt(r.heatPerM2, 1) + ' кВт·ч/м²)');
    set('st-heat30', fmt(r.heatTotal30y, 0) + ' кВт·ч');
    verdict('st-verdict', r.sys.name + ', ' + r.region.name + ': бюджет ' + fmt(r.budgetTotal, 0) + ' BYN, срок бригады ' + fmt(r.days, 1) + ' дней. Ориентир для разговора с подрядчиком, не смета.', !r.passesNorm);

    var host = $('st-table');
    if (host) {
      table(host, ['Система', 'R0', 'Бюджет, BYN', 'Труд, чел·ч', 'Срок, дней'], M.SYSTEMS.map(function (sys) {
        var rr = M.calc({ sysId: sys.id, regionId: val('st-region'), area: area, crew: crew });
        return { cls: sys.id === r.sys.id ? 'hl' : '', cells: [sys.name, fmt(sys.r0, 1), rr ? fmt(rr.budgetTotal, 0) : '—', rr ? fmt(rr.laborTotal, 0) : '—', rr ? fmt(rr.days, 1) : '—'] };
      }));
    }
  }

  function init() {
    var root = $('e-st'); if (!root) return;
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
      el.addEventListener('input', calc); el.addEventListener('change', calc);
    });
    calc();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
