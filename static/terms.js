/* Сроки работ: связывает поля страницы с расчётом из terms-core.js. Всё считается в браузере и никуда не отправляется. */
(function () {
  'use strict';
  var T = window.TegaTerms, root = document.getElementById('terms');
  if (!T || !root) return;
  var KEY = 'tega.terms.v1';
  var $ = function (id) { return document.getElementById(id); };
  var st = { stages: [{ name: 'Этап 1', hours: '160', workers: '4', par: false }] };
  var IDS = ['tm-shift', 'tm-k', 'tm-shifts', 'tm-start', 'tm-mode', 'tm-sc', 'tm-days', 'tm-extra', 'tm-dog', 'tm-off', 'tm-on', 'tm-ready', 'tm-acc', 'tm-short', 'tm-sign', 'tm-appr', 'tm-kind', 'tm-yrs', 'tm-pk', 'tm-pb', 'tm-pd', 'tm-pr'];

  function load() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!v) return;
      if (Array.isArray(v.stages) && v.stages.length) st.stages = v.stages.slice(0, 40);
      IDS.forEach(function (id) { if (v.f && v.f[id] != null && $(id)) $(id).value = v.f[id]; });
      if (v.link != null) $('tm-link').checked = !!v.link;
    } catch (e) { /* хранилище недоступно */ }
  }
  function save() {
    try {
      var f = {}; IDS.forEach(function (id) { f[id] = $(id).value; });
      localStorage.setItem(KEY, JSON.stringify({ stages: st.stages, f: f, link: $('tm-link').checked }));
    } catch (e) { /* хранилище недоступно */ }
  }
  function put(id, text) { $(id).textContent = text; }
  function verdict(n, text, bad) {
    var v = $('tm' + n + '-v'); v.textContent = text || ''; v.className = 'verdict' + (bad ? ' bad' : '');
  }
  function dateOf(id) { var s = $(id).value; return s ? T.parseDate(s) : null; }
  function rub(x) { return x.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' руб.'; }
  function plural(n, a, b, c) { var m = Math.abs(n) % 100, k = m % 10; return m > 10 && m < 20 ? c : k > 1 && k < 5 ? b : k === 1 ? a : c; }
  function dn(n) { return n + ' ' + plural(n, 'день', 'дня', 'дней'); }

  /* ---- панель 1: этапы ---- */
  function drawStages() {
    var box = $('tm-stages'); box.textContent = '';
    st.stages.forEach(function (s, i) {
      var row = document.createElement('div'); row.className = 'tm-st';
      function inp(cls, lab, key, mode, ph) {
        var w = document.createElement('div'); w.className = 'e-f ' + cls;
        var l = document.createElement('label'); l.textContent = lab; l.htmlFor = 'tm-s' + key + i;
        var d = document.createElement('div'); d.className = 'e-in';
        var x = document.createElement('input'); x.id = 'tm-s' + key + i; x.value = s[key] || ''; x.autocomplete = 'off';
        if (mode) x.inputMode = mode; if (ph) x.placeholder = ph;
        x.addEventListener('input', function () { s[key] = x.value; calc(); });
        d.appendChild(x); w.appendChild(l); w.appendChild(d); return w;
      }
      row.appendChild(inp('wide', 'Этап', 'name', '', 'Название'));
      row.appendChild(inp('', 'Трудозатраты, чел.-ч', 'hours', 'decimal'));
      row.appendChild(inp('', 'Рабочих', 'workers', 'decimal'));
      var lab = document.createElement('label'); lab.className = 'tm-chk';
      var c = document.createElement('input'); c.type = 'checkbox'; c.checked = !!s.par && i > 0; c.disabled = i === 0;
      c.addEventListener('change', function () { s.par = c.checked; calc(); });
      lab.appendChild(c); lab.appendChild(document.createTextNode(' параллельно предыдущему'));
      row.appendChild(lab);
      if (st.stages.length > 1) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'btn-s ghost'; b.textContent = 'Удалить';
        b.setAttribute('aria-label', 'Удалить этап ' + (i + 1));
        b.addEventListener('click', function () { st.stages.splice(i, 1); drawStages(); calc(); });
        row.appendChild(b);
      }
      box.appendChild(row);
    });
  }

  var res1 = null;
  function calc1() {
    var r = T.stages(st.stages, { shift: $('tm-shift').value, k: $('tm-k').value, shifts: $('tm-shifts').value });
    res1 = r.error ? null : r;
    if (r.error) { put('tm1-h', '—'); put('tm1-d', '—'); put('tm1-b', '—'); verdict(1, r.error, true); return; }
    put('tm1-h', Math.round(r.hours * 100) / 100 + ' чел.-ч');
    put('tm1-d', dn(r.total));
    put('tm1-b', String(r.blocks.length));
    verdict(1, 'Дни этапов: ' + r.rows.map(function (x) { return x.days; }).join(' + ') + '. Частичные дни округлены вверх.');
  }

  /* ---- панель 2: календарь ---- */
  function calc2() {
    var link = $('tm-link').checked;
    $('tm-days').disabled = link;
    if (link && res1) $('tm-days').value = String(res1.total);
    var start = dateOf('tm-start'), days = T.num($('tm-days').value), extra = T.num($('tm-extra').value) || 0;
    var off = T.parseOff($('tm-off').value), on = T.parseOff($('tm-on').value);
    ['tm2-end', 'tm2-cal', 'tm2-off', 'tm2-gap'].forEach(function (id) { put(id, '—'); });
    var warn = [];
    if (off.bad.length) warn.push('Не распознано в нерабочих днях: ' + off.bad.join('; ') + '.');
    if (on.bad.length) warn.push('Не распознано в рабочих днях вместо выходных: ' + on.bad.join('; ') + '.');
    if (!start) { verdict(2, warn.concat('Укажите дату начала работ.').join(' ')); return; }
    if (!(days >= 1)) { verdict(2, warn.concat('Укажите число рабочих дней (не меньше 1).').join(' ')); return; }
    var total = Math.ceil(days) + Math.max(0, Math.ceil(extra));
    var opt = { mode: $('tm-mode').value, off: off.set, on: on.set, startCounts: $('tm-sc').value === '1' };
    var end = T.endDate(start, total, opt);
    if (!end) { verdict(2, 'Не удалось найти дату окончания: проверьте нерабочие дни.', true); return; }
    put('tm2-end', T.ru(end));
    var first = opt.startCounts ? start : T.addDays(start, 1);
    var cal = T.diffDays(start, end) + 1;
    put('tm2-cal', dn(cal));
    var nw = cal - T.workDaysBetween(start, end, { mode: opt.mode, off: off.set, on: on.set });
    put('tm2-off', dn(nw));
    var dog = dateOf('tm-dog');
    if (dog) {
      var g = T.diffDays(end, dog);
      put('tm2-gap', g >= 0 ? 'запас ' + dn(g) : 'просрочка ' + dn(-g));
      if (g < 0) warn.push('Расчётный срок позже договорного. Основания для пересмотра — п. 66 Правил; без согласованного изменения договора срок не сдвигается.');
    }
    if (first && T.isWork(first, opt.mode, off.set, on.set) === false && opt.startCounts) warn.push('День начала нерабочий: считать начнём с ближайшего рабочего.');
    verdict(2, (warn.length ? warn.join(' ') + ' ' : '') + 'Итого рабочих дней: ' + total + (extra > 0 ? ' (в том числе ' + Math.ceil(extra) + ' на пересмотр).' : '.'), g_bad(warn));
  }
  function g_bad(w) { return w.some(function (x) { return x.indexOf('Не распознано') === 0 || x.indexOf('Расчётный срок позже') === 0; }); }

  /* ---- панель 3: приёмка ---- */
  function calc3() {
    var kind = $('tm-kind').value;
    $('tm-yrs').disabled = kind !== 'own';
    var yrs = kind === 'own' ? T.num($('tm-yrs').value) : null;
    ['tm3-c', 'tm3-a', 'tm3-u', 'tm3-w', 'tm3-e'].forEach(function (id) { put(id, '—'); });
    if (kind === 'own' && !(yrs >= 1)) { verdict(3, 'Свой гарантийный срок указывают в годах, не меньше 1.', true); return; }
    var h = T.handover({ ready: dateOf('tm-ready'), accStart: dateOf('tm-acc'), short: $('tm-short').value === '1', signed: dateOf('tm-sign'), approved: dateOf('tm-appr'), kind: kind, years: yrs });
    if (h.commissionBy) put('tm3-c', T.ru(h.commissionBy));
    if (h.appointBy) put('tm3-a', T.ru(h.appointBy));
    if (h.approveBy) put('tm3-u', T.ru(h.approveBy));
    if (h.warrantyFrom) put('tm3-w', T.ru(h.warrantyFrom));
    else if (h.warrantyFromLatest) put('tm3-w', 'не позже ' + T.ru(h.warrantyFromLatest));
    if (h.warrantyTo) put('tm3-e', T.ru(h.warrantyTo) + (h.warrantyFrom ? '' : ' (при утверждении в последний день)'));
    var notes = [];
    if (kind === 'obj') notes.push('Гарантия не менее 5 лет (п. 57); для оборудования и материалов срок устанавливает изготовитель.');
    if (kind === 'repair') notes.push('Для текущего ремонта и пусконаладки не менее 2 лет (п. 57).');
    if (h.appointBy && dateOf('tm-ready') && h.appointBy < dateOf('tm-ready')) notes.push('Назначить комиссию «за 30 дней до приёмки» уже поздно относительно уведомления: проверьте сроки.');
    if (!h.commissionBy && !h.appointBy && !h.approveBy && !h.warrantyTo) notes.push('Заполните хотя бы одну дату.');
    verdict(3, notes.join(' '));
  }

  /* ---- панель 4: неустойка ---- */
  function calc4() {
    var k = $('tm-pk').value, p = T.PEN[k];
    put('tm4-r', '—'); put('tm4-d', '—'); put('tm4-a', '—'); put('tm4-c', '—'); put('tm4-s', '—');
    $('tm-pbn').textContent = p.p + ': ' + p.t + '. База: ' + p.b + '. Предел: ' + p.c + '.';
    var base = T.num($('tm-pb').value), days = T.num($('tm-pd').value), rate = T.num($('tm-pr').value);
    if (!(base >= 0) || !(days >= 0)) { verdict(4, 'Введите базу расчёта и дни просрочки.'); return; }
    var r = T.penalty(k, base, days, isNaN(rate) ? null : rate);
    if (r.error) { verdict(4, r.error, true); return; }
    put('tm4-r', String(r.rate).replace('.', ',') + ' % в день' + (isNaN(rate) || !(rate > 0) ? '' : ' (по договору)'));
    put('tm4-d', rub(r.perDay));
    put('tm4-a', rub(r.accrued));
    put('tm4-c', rub(r.cap));
    put('tm4-s', rub(r.sum));
    verdict(4, r.capped ? 'Начисление упёрлось в предел' + (isNaN(rate) || !(rate > 0) ? ' (п. ' + p.p.replace('п. ', '') + ')' : ' (предел взят по правилам; договор может устанавливать иной)') + ': он достигается на ' + dn(r.daysToCap) + ' просрочки.' : 'До предела: ' + rub(r.cap - r.sum) + '. Убытки сверх неустойки возмещаются отдельно (п. 77).');
  }

  function calc() { calc1(); calc2(); calc3(); calc4(); save(); }

  load();
  drawStages();
  $('tm-add').addEventListener('click', function () {
    if (st.stages.length >= 40) return;
    st.stages.push({ name: 'Этап ' + (st.stages.length + 1), hours: '', workers: '1', par: false }); drawStages(); calc();
  });
  root.addEventListener('input', calc);
  root.addEventListener('change', calc);
  calc();
})();
