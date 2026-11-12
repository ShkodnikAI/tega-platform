/* Сроки работ: связывает поля страницы с расчётом из terms-core.js. Всё считается в браузере и никуда не отправляется. */
(function () {
  'use strict';
  var T = window.TegaTerms, root = document.getElementById('terms');
  if (!T || !root) return;
  var KEY = 'tega.terms.v2';
  var $ = function (id) { return document.getElementById(id); };
  /* Стартовый пример: облицовка санузла 80 м², 8 м² на рабочего за смену. */
  var st = { stages: [{ name: 'Облицовка плиткой', vol: '80', unit: 'м²', rate: '8', workers: '8', front: '10', prep: '0,5', pause: '1', par: false }] };
  var IDS = ['tm-k', 'tm-shifts', 'tm-a', 'tm-floor', 'tm-start', 'tm-mode', 'tm-extra', 'tm-dog', 'tm-off', 'tm-on', 'tm-pick', 'tm-target'];
  var PICKS = []; // норма НРР-2022: {id, label, per, unit, labor_h}, подбирается curated-списком на сервере
  var SHIFT_H = 8; // продолжительность смены для перевода чел.-ч в выработку; РБ, стандартная 8-часовая смена

  function load() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!v) return;
      if (Array.isArray(v.stages) && v.stages.length) st.stages = v.stages.slice(0, 40);
      IDS.forEach(function (id) { if (v.f && v.f[id] != null && $(id) && id !== 'tm-pick') $(id).value = v.f[id]; });
    } catch (e) { /* хранилище недоступно */ }
  }
  function save() {
    try {
      var f = {}; IDS.forEach(function (id) { f[id] = $(id).value; });
      localStorage.setItem(KEY, JSON.stringify({ stages: st.stages, f: f }));
    } catch (e) { /* хранилище недоступно */ }
  }
  function put(id, text) { $(id).textContent = text; }
  function verdict(n, text, bad) { var v = $('tm' + n + '-v'); v.textContent = text || ''; v.className = 'verdict' + (bad ? ' bad' : ''); }
  function dateOf(id) { var s = $(id).value; return s ? T.parseDate(s) : null; }
  function plural(n, a, b, c) { var m = Math.abs(n) % 100, k = m % 10; return m > 10 && m < 20 ? c : k > 1 && k < 5 ? b : k === 1 ? a : c; }
  function dn(n) { return n + ' ' + plural(n, 'день', 'дня', 'дней'); }
  function f1(x) { return (Math.round(x * 10) / 10).toLocaleString('ru-RU'); }
  function pct(x) { return Math.round(x * 100) + ' %'; }
  function glob() { return { k: T.num($('tm-k').value), shifts: T.num($('tm-shifts').value), a: (T.num($('tm-a').value) || 0) / 100, floor: (T.num($('tm-floor').value) || 0) / 100 }; }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  /* ---- панель 1: этапы ---- */
  function field(s, i, cls, lab, key, mode, ph, unit) {
    var w = el('div', 'e-f ' + cls), l = el('label', '', lab), d = el('div', 'e-in'), x = document.createElement('input');
    x.id = 'tm-s' + key + i; l.htmlFor = x.id; x.value = s[key] || ''; x.autocomplete = 'off';
    if (mode) x.inputMode = mode; if (ph) x.placeholder = ph;
    x.addEventListener('input', function () { s[key] = x.value; calc(); });
    d.appendChild(x); if (unit) d.appendChild(el('span', 'u', unit)); w.appendChild(l); w.appendChild(d); return w;
  }
  /* Норма НРР-2022 для этапа: список options + подстановка выработки при выборе. */
  function normField(s, i) {
    var w = el('div', 'e-f wide'), l = el('label', '', 'Норма НРР-2022'), d = el('div', 'e-in'), x = document.createElement('select');
    x.id = 'tm-snorm' + i; l.htmlFor = x.id;
    var o0 = el('option', '', 'Своя выработка (ввести вручную)'); o0.value = ''; x.appendChild(o0);
    PICKS.forEach(function (p) {
      var o = el('option', '', p.label + ' (' + p.per + ' ' + p.unit + ' — ' + p.labor_h + ' чел.-ч)');
      o.value = p.id; x.appendChild(o);
    });
    x.value = s.normId && PICKS.some(function (p) { return p.id === s.normId; }) ? s.normId : '';
    x.addEventListener('change', function () {
      s.normId = x.value;
      var p = PICKS.filter(function (p) { return p.id === x.value; })[0];
      if (p) {
        var r = T.laborRate(p.per, p.labor_h, SHIFT_H);
        if (r) { s.rate = String(Math.round(r * 100) / 100); var ri = $('tm-srate' + i); if (ri) ri.value = s.rate; s.unit = s.unit || p.unit; var ui = $('tm-sunit' + i); if (ui && !ui.value) ui.value = p.unit; }
      }
    });
    d.appendChild(x); w.appendChild(l); w.appendChild(d); return w;
  }
  function drawStages() {
    var box = $('tm-stages'); box.textContent = '';
    st.stages.forEach(function (s, i) {
      var row = el('div', 'tm-st');
      row.appendChild(field(s, i, 'wide', 'Этап', 'name', '', 'Название'));
      row.appendChild(field(s, i, '', 'Объём', 'vol', 'decimal'));
      row.appendChild(field(s, i, 'u', 'Единица', 'unit', '', 'м²'));
      if (PICKS.length) row.appendChild(normField(s, i));
      row.appendChild(field(s, i, '', 'Выработка 1 рабочего за смену', 'rate', 'decimal'));
      row.appendChild(field(s, i, '', 'Рабочих', 'workers', 'numeric'));
      row.appendChild(field(s, i, '', 'Мин. фронта на 1 рабочего', 'front', 'decimal', 'без ограничения'));
      row.appendChild(field(s, i, '', 'Подготовка, дней', 'prep', 'decimal'));
      row.appendChild(field(s, i, '', 'Перерыв после, календ. дн.', 'pause', 'numeric'));
      var lab = el('label', 'tm-chk'), c = document.createElement('input');
      c.type = 'checkbox'; c.checked = !!s.par && i > 0; c.disabled = i === 0;
      c.addEventListener('change', function () { s.par = c.checked; calc(); });
      lab.appendChild(c); lab.appendChild(document.createTextNode(' параллельно предыдущему')); row.appendChild(lab);
      if (st.stages.length > 1) {
        var b = el('button', 'btn-s ghost', 'Удалить'); b.type = 'button'; b.setAttribute('aria-label', 'Удалить этап ' + (i + 1));
        b.addEventListener('click', function () { st.stages.splice(i, 1); drawStages(); calc(); });
        row.appendChild(b);
      }
      var info = el('p', 'tm-info'); info.id = 'tm-i' + i; info.setAttribute('role', 'status'); row.appendChild(info);
      box.appendChild(row);
    });
    var pick = $('tm-pick'), cur = pick.value;
    pick.textContent = '';
    st.stages.forEach(function (s, i) { var o = el('option', '', (i + 1) + '. ' + (s.name || 'Этап')); o.value = String(i); pick.appendChild(o); });
    pick.value = st.stages[+cur] ? cur : '0';
  }

  var rs = [], g = null;
  function calc1() {
    g = glob(); rs = []; var naive = 0, total = 0, bad = null, blocks = 0, last = 0;
    st.stages.forEach(function (s, i) {
      var r = T.stage(s, g), info = $('tm-i' + i);
      rs.push(r);
      if (r.error) { info.textContent = r.error; info.className = 'tm-info bad'; if (!bad) bad = 'Этап ' + (i + 1) + ': ' + r.error; return; }
      var u = s.unit || 'ед.', msg = 'Реально ' + dn(r.days) + ' (в деле ' + r.use + ' из ' + r.N + ', эффективность ' + pct(r.e) + ', работа ' + f1(r.work) + ' дн. + подготовка ' + f1(r.prep) + '). По простой арифметике ' + f1(r.naive) + ' дн.';
      if (r.idle > 0) msg += ' Рабочих сверх фронта: ' + r.idle + ', они работу не ускоряют.';
      info.textContent = msg; info.className = 'tm-info';
      if (s.par && i > 0) { last = Math.max(last, r.days); } else { total += last; last = r.days; }
      if (s.par && i > 0) { naive = naive; }
      blocks += (s.par && i > 0) ? 0 : 1;
    });
    total += last;
    if (bad) { put('tm1-d', '—'); put('tm1-n', '—'); put('tm1-x', '—'); put('tm1-b', '—'); verdict(1, bad, true); return; }
    /* простая арифметика: тот же порядок блоков, но без потерь, подготовки и фронта */
    var nv = 0, nl = 0;
    rs.forEach(function (r, i) { var d = Math.ceil(r.naive - 1e-9) || 1; if (st.stages[i].par && i > 0) nl = Math.max(nl, d); else { nv += nl; nl = d; } });
    nv += nl;
    put('tm1-d', dn(total)); put('tm1-n', dn(nv)); put('tm1-x', (total >= nv ? '+' : '') + (total - nv) + ' дн.'); put('tm1-b', String(blocks));
    verdict(1, total > nv ? 'Реальный срок больше простого: поправки на бригаду, фронт и подготовку добавили ' + dn(total - nv) + '.' : 'Поправки срок не изменили: бригада небольшая и фронт свободный.');
  }

  /* ---- панель 2: график ---- */
  function calc2() {
    ['tm2-end', 'tm2-cal', 'tm2-off', 'tm2-gap'].forEach(function (id) { put(id, '—'); });
    $('tm-sched').textContent = '';
    var start = dateOf('tm-start'), extra = Math.max(0, Math.ceil(T.num($('tm-extra').value) || 0));
    var off = T.parseOff($('tm-off').value), on = T.parseOff($('tm-on').value), warn = [];
    if (off.bad.length) warn.push('Не распознано в нерабочих днях: ' + off.bad.join('; ') + '.');
    if (on.bad.length) warn.push('Не распознано в рабочих днях вместо выходных: ' + on.bad.join('; ') + '.');
    if (rs.some(function (r) { return r.error; })) { verdict(2, warn.concat('Сначала исправьте этапы в расчёте 1.').join(' '), true); return; }
    if (!start) { verdict(2, warn.concat('Укажите дату начала работ.').join(' '), warn.length > 0); return; }
    var opt = { mode: $('tm-mode').value, off: off.set, on: on.set };
    var list = rs.map(function (r, i) { return { days: r.days, pause: r.pause, par: st.stages[i].par }; });
    var sc = T.schedule(start, list, opt);
    if (sc.error) { verdict(2, sc.error, true); return; }
    sc.rows.forEach(function (r, i) {
      var tr = document.createElement('tr');
      [(i + 1) + '. ' + (st.stages[i].name || 'Этап') + (r.par ? ' (параллельно)' : ''), T.ru(r.start), T.ru(r.end), String(r.days), r.pause ? dn(r.pause) : '—'].forEach(function (t) { tr.appendChild(el('td', '', t)); });
      $('tm-sched').appendChild(tr);
    });
    var end = sc.end;
    if (extra > 0) { end = T.endDate(T.addDays(sc.end, 1), extra, { mode: opt.mode, off: off.set, on: on.set, startCounts: true }) || end; }
    put('tm2-end', T.ru(end));
    var cal = T.diffDays(sc.first, end) + 1;
    put('tm2-cal', dn(cal));
    var nw = cal - T.workDaysBetween(sc.first, end, opt);
    put('tm2-off', dn(nw));
    var dog = dateOf('tm-dog'), bad = off.bad.length || on.bad.length;
    if (dog) {
      var gap = T.diffDays(end, dog);
      put('tm2-gap', gap >= 0 ? 'запас ' + dn(gap) : 'просрочка ' + dn(-gap));
      if (gap < 0) { warn.push('Расчётный срок позже договорного. Основания для пересмотра — п. 66 Правил; без согласованного изменения договора срок не сдвигается.'); bad = true; }
    }
    if (!T.isWork(start, opt.mode, off.set, on.set)) warn.push('День начала нерабочий: этап начнётся с ближайшего рабочего дня.');
    verdict(2, (warn.length ? warn.join(' ') + ' ' : '') + (extra > 0 ? 'В срок включено ' + dn(extra) + ' на пересмотр.' : ''), bad);
  }

  /* ---- панель 3: подбор бригады ---- */
  function calc3() {
    var i = +$('tm-pick').value, s = st.stages[i], body = $('tm-curve');
    body.textContent = ''; put('tm3-best', '—'); put('tm3-need', '—'); put('tm3-now', '—');
    if (!s || !rs[i] || rs[i].error) { verdict(3, 'Исправьте данные этапа.', true); return; }
    var max = Math.min(24, Math.max(rs[i].maxN === Infinity ? 24 : rs[i].maxN + 2, 12));
    var c = T.curve(s, g, max);
    if (c.error) { verdict(3, c.error, true); return; }
    c.rows.forEach(function (r) {
      var tr = document.createElement('tr');
      if (r.n === c.best) tr.className = 'tm-hl';
      [String(r.n), String(r.days), f1(r.naive) + ' дн.', pct(r.e) + (r.use < r.n ? ', в деле ' + r.use : ''), '×' + f1(r.speedup)].forEach(function (t) { tr.appendChild(el('td', '', t)); });
      body.appendChild(tr);
    });
    put('tm3-best', c.best + ' ' + plural(c.best, 'рабочий', 'рабочих', 'рабочих'));
    put('tm3-now', dn(rs[i].days) + ' при ' + rs[i].N);
    var target = T.num($('tm-target').value), msg = 'Выделена строка, после которой каждый следующий рабочий экономит меньше целого дня.';
    if (target >= 1) {
      var n = T.need(s, g, Math.floor(target));
      if (n === null) { put('tm3-need', 'не получится'); msg = 'За ' + dn(Math.floor(target)) + ' этап не закончить даже при полном фронте: подготовка и поправки занимают больше. Увеличьте срок или сократите подготовку.'; }
      else { put('tm3-need', n + ' ' + plural(n, 'рабочий', 'рабочих', 'рабочих')); }
    }
    verdict(3, msg);
  }

  function calc() { calc1(); calc2(); calc3(); save(); }

  /* Подсказки по выработке для некоторых видов работ, из подключённой базы НРР-2022 (curated-список,
     не поиск по всей базе — см. docs/norms-library.md). Если файла нет, норма просто не показывается. */
  function loadPicks() {
    if (typeof fetch !== 'function') return;
    fetch('/static/norms/terms-picks.json').then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j && Array.isArray(j.items) && j.items.length) { PICKS = j.items; drawStages(); calc(); } })
      .catch(function () { /* норм нет в сборке — калькулятор работает как раньше, вручную */ });
  }

  load();
  drawStages();
  loadPicks();
  $('tm-add').addEventListener('click', function () {
    if (st.stages.length >= 40) return;
    st.stages.push({ name: 'Этап ' + (st.stages.length + 1), vol: '', unit: '', rate: '', workers: '1', front: '', prep: '0', pause: '0', par: false }); drawStages(); calc();
  });
  root.addEventListener('input', calc);
  root.addEventListener('change', calc);
  calc();
})();
