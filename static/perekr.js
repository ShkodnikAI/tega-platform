/* Перекрытия и покрытия: интерфейс облегчённого калькулятора. Модель расчёта в perekr-model.js.
   Ориентировочный расчёт бюджета, веса, трудозатрат и теплопотерь, не проект: подбора сечений балок,
   плит и стропил здесь нет. */
(function () {
  'use strict';
  var M = window.TegaPerekr;
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

  function calcPer() {
    var ids = ['pk-per-weight', 'pk-per-budget', 'pk-per-labor', 'pk-per-days'];
    var area = num('pk-per-area'), crew = num('pk-per-crew');
    var r = M.calcPerekrytie({ sysId: val('pk-per-sys'), area: area, crew: crew });
    if (!r) {
      ids.forEach(function (i) { set(i, '—'); });
      verdict('pk-per-verdict', 'Укажите площадь перекрытия больше нуля.', true);
      var host0 = $('pk-per-table'); if (host0) clearNode(host0);
      return;
    }
    set('pk-per-weight', fmt(r.weightTotal, 0) + ' кг (' + fmt(r.sys.weight, 0) + ' кг/м²)');
    set('pk-per-budget', fmt(r.budgetTotal, 0) + ' BYN (' + fmt(r.budgetPerM2, 0) + ' BYN/м²)');
    set('pk-per-labor', fmt(r.laborTotal, 0) + ' чел·ч');
    set('pk-per-days', fmt(r.days, 1) + ' раб. дней бригадой ' + fmt(r.crew, 0) + ' чел.');
    verdict('pk-per-verdict', r.sys.name + ': бюджет ' + fmt(r.budgetTotal, 0) + ' BYN, вес ' + fmt(r.weightTotal, 0) + ' кг. Ориентир для разговора с подрядчиком, не смета.', false);
    var host = $('pk-per-table');
    if (host) {
      table(host, ['Система', 'Вес, кг/м²', 'Бюджет, BYN', 'Труд, чел·ч', 'Срок, дней'], M.PEREKRYTIE.map(function (sys) {
        var rr = M.calcPerekrytie({ sysId: sys.id, area: area, crew: crew });
        return { cls: sys.id === r.sys.id ? 'hl' : '', cells: [sys.name, fmt(sys.weight, 0), rr ? fmt(rr.budgetTotal, 0) : '—', rr ? fmt(rr.laborTotal, 0) : '—', rr ? fmt(rr.days, 1) : '—'] };
      }));
    }
  }

  function calcPok() {
    var ids = ['pk-pok-uklon-v', 'pk-pok-weight', 'pk-pok-budget', 'pk-pok-labor', 'pk-pok-days'];
    var area = num('pk-pok-area'), crew = num('pk-pok-crew'), uklon = num('pk-pok-uklon');
    var r = M.calcPokrytie({ sysId: val('pk-pok-sys'), area: area, crew: crew, uklon: uklon });
    if (!r) {
      ids.forEach(function (i) { set(i, '—'); });
      verdict('pk-pok-verdict', 'Укажите площадь ската больше нуля.', true);
      var host0 = $('pk-pok-table'); if (host0) clearNode(host0);
      return;
    }
    var unit = r.sys.uklonUnit === 'pct' ? '%' : '°';
    set('pk-pok-uklon-v', (r.uklon == null ? 'не задан' : fmt(r.uklon, 1) + unit) + ', минимум ' + fmt(r.sys.minUklon, 1) + unit + (r.sys.minUklonSpecial != null ? ' (' + fmt(r.sys.minUklonSpecial, 1) + unit + ' со спецмерами)' : ''));
    set('pk-pok-weight', r.weightTotal == null ? 'зависит от балласта, не нормировано' : fmt(r.weightTotal, 0) + ' кг (' + fmt(r.sys.weight, 1) + ' кг/м²)');
    set('pk-pok-budget', fmt(r.budgetTotal, 0) + ' BYN (' + fmt(r.budgetPerM2, 0) + ' BYN/м²)');
    set('pk-pok-labor', fmt(r.laborTotal, 0) + ' чел·ч');
    set('pk-pok-days', fmt(r.days, 1) + ' раб. дней бригадой ' + fmt(r.crew, 0) + ' чел.');
    var bad = r.uklonOk === false;
    var msg = r.sys.name + ': бюджет ' + fmt(r.budgetTotal, 0) + ' BYN. ';
    if (r.uklonOk === false) msg += 'Уклон ниже минимума для этого покрытия — протечки по нахлёстам и карнизам.';
    else if (r.uklonOk === 'special') msg += 'Уклон допустим только со спецмерами (сплошная подкладка, усиленное снегозадержание).';
    else if (r.uklonOk === true) msg += 'Уклон проходит по минимуму покрытия.';
    else msg += 'Укажите уклон, чтобы проверить его по минимуму покрытия.';
    verdict('pk-pok-verdict', msg, bad);
    var host = $('pk-pok-table');
    if (host) {
      table(host, ['Покрытие', 'Мин. уклон', 'Бюджет, BYN', 'Труд, чел·ч', 'Срок, дней'], M.POKRYTIE.map(function (sys) {
        var rr = M.calcPokrytie({ sysId: sys.id, area: area, crew: crew, uklon: uklon });
        var u = sys.uklonUnit === 'pct' ? '%' : '°';
        return { cls: sys.id === r.sys.id ? 'hl' : '', cells: [sys.name, fmt(sys.minUklon, 1) + u, rr ? fmt(rr.budgetTotal, 0) : '—', rr ? fmt(rr.laborTotal, 0) : '—', rr ? fmt(rr.days, 1) : '—'] };
      }));
    }
  }

  function calcTep() {
    var ids = ['pk-tep-season', 'pk-tep-30', 'pk-tep-norm-v'];
    var r = M.calcHeatLoss({ regionId: val('pk-tep-region'), r: num('pk-tep-r'), area: num('pk-tep-area'), normKey: val('pk-tep-norm') });
    if (!r) { ids.forEach(function (i) { set(i, '—'); }); verdict('pk-tep-verdict', 'Укажите сопротивление теплопередаче R больше нуля.', true); return; }
    set('pk-tep-season', fmt(r.totalSeason, 0) + ' кВт·ч (' + fmt(r.perM2Season, 1) + ' кВт·ч/м²)');
    set('pk-tep-30', fmt(r.total30y, 0) + ' кВт·ч');
    set('pk-tep-norm-v', '×' + fmt(r.normRatio, 2) + ' к нормативу ' + fmt(r.norm, 1));
    verdict('pk-tep-verdict', r.region.name + ', ГСОП ' + fmt(r.region.gsop, 0) + ': потери ' + fmt(r.perM2Season, 1) + ' кВт·ч/м² за сезон. 24×ГСОП/R — та же формула, что в разделе 10 статьи.', r.normRatio < 1);
  }

  function init() {
    var root = $('e-pk'); if (!root) return;
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
    Array.prototype.forEach.call(root.querySelectorAll('#pkper input, #pkper select'), function (el) { el.addEventListener('input', calcPer); el.addEventListener('change', calcPer); });
    Array.prototype.forEach.call(root.querySelectorAll('#pkpok input, #pkpok select'), function (el) { el.addEventListener('input', calcPok); el.addEventListener('change', calcPok); });
    Array.prototype.forEach.call(root.querySelectorAll('#pktep input, #pktep select'), function (el) { el.addEventListener('input', calcTep); el.addEventListener('change', calcTep); });
    calcPer(); calcPok(); calcTep();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
