/* Сроки работ: чистые функции расчёта (без доступа к странице), чтобы их можно было проверить тестами.
   Здесь нет таблиц норм продолжительности и нет календаря праздников: их нет в подключённой базе, пользователь вводит их сам. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TegaTerms = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var DAY = 86400000;

  function num(s) {
    if (typeof s === 'number') return s;
    var v = parseFloat(String(s == null ? '' : s).replace(/\s/g, '').replace(',', '.'));
    return isFinite(v) ? v : NaN;
  }
  /* Даты хранятся как UTC-полночь, чтобы переход на летнее время ничего не сдвигал. */
  function mk(y, m, d) { return new Date(Date.UTC(y, m - 1, d)); }
  function iso(dt) { return dt.getUTCFullYear() + '-' + ('0' + (dt.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + dt.getUTCDate()).slice(-2); }
  function ru(dt) { return ('0' + dt.getUTCDate()).slice(-2) + '.' + ('0' + (dt.getUTCMonth() + 1)).slice(-2) + '.' + dt.getUTCFullYear(); }
  /* «дд.мм.гггг» или «гггг-мм-дд»; несуществующая дата (31.02) отбрасывается */
  function parseDate(s) {
    s = String(s || '').trim();
    var m = /^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})$/.exec(s), y, mo, d;
    if (m) { d = +m[1]; mo = +m[2]; y = +m[3]; }
    else if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s))) { y = +m[1]; mo = +m[2]; d = +m[3]; }
    else return null;
    var dt = mk(y, mo, d);
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d ? dt : null;
  }
  function addDays(dt, n) { return new Date(dt.getTime() + n * DAY); }
  function diffDays(a, b) { return Math.round((b.getTime() - a.getTime()) / DAY); }
  /* прибавить годы; 29 февраля в невисокосный год переходит на 28 февраля */
  function addYears(dt, n) {
    var y = dt.getUTCFullYear() + n, m = dt.getUTCMonth(), d = dt.getUTCDate();
    var r = new Date(Date.UTC(y, m, d));
    if (r.getUTCMonth() !== m) r = new Date(Date.UTC(y, m + 1, 0));
    return r;
  }

  /* Список нерабочих дней: через запятую, точку с запятой или с новой строки; диапазон «дата–дата». */
  function parseOff(text) {
    var set = {}, bad = [], count = 0;
    String(text || '').split(/[;,\n]+/).forEach(function (part) {
      part = part.trim();
      if (!part) return;
      var rg = part.split(/\s*[–—]\s*|\s+-\s+|\s+по\s+/);
      if (rg.length === 2) {
        var a = parseDate(rg[0]), b = parseDate(rg[1]);
        if (!a || !b || b < a || diffDays(a, b) > 400) { bad.push(part); return; }
        for (var t = a; t <= b; t = addDays(t, 1)) { if (!set[iso(t)]) count++; set[iso(t)] = 1; }
        return;
      }
      var d = parseDate(part);
      if (!d) { bad.push(part); return; }
      if (!set[iso(d)]) count++;
      set[iso(d)] = 1;
    });
    return { set: set, bad: bad, count: count };
  }

  /* Рабочий ли день. mode: '5' пятидневка (сб, вс выходные), '6' шестидневка (вс выходной), '7' без выходных.
     Даты из off считаются нерабочими в любом режиме; on — рабочие дни, назначенные вместо выходных (переносы). */
  function isWork(dt, mode, off, on) {
    var k = iso(dt), w = dt.getUTCDay();
    if (on && on[k]) return true;
    if (off && off[k]) return false;
    if (mode === '7') return true;
    if (mode === '6') return w !== 0;
    return w !== 0 && w !== 6;
  }

  /* Дата окончания: n рабочих дней, начиная со start. startCounts — считать ли день start первым днём. */
  function endDate(start, n, opt) {
    opt = opt || {};
    var n0 = Math.ceil(n);
    if (!(n0 >= 1)) return null;
    var cur = opt.startCounts === false ? addDays(start, 1) : start, cnt = 0, guard = 0;
    for (;;) {
      if (isWork(cur, opt.mode || '5', opt.off, opt.on)) { cnt++; if (cnt === n0) return cur; }
      cur = addDays(cur, 1);
      if (++guard > 20000) return null;
    }
  }
  /* Сколько рабочих дней между датами включительно */
  function workDaysBetween(a, b, opt) {
    opt = opt || {};
    var cnt = 0;
    for (var t = a; t <= b; t = addDays(t, 1)) if (isWork(t, opt.mode || '5', opt.off, opt.on)) cnt++;
    return cnt;
  }

  /* Эффективность бригады из n человек: каждый добавленный рабочий мешает остальным (общий фронт, подача материала, очередь к инструменту).
     e(n) = 1 / (1 + a × (n − 1)), не ниже floor. Коэффициенты a и floor задаёт пользователь: в подключённой базе их нет, это не норма. */
  function eff(n, a, floor) {
    n = Math.max(1, n);
    return Math.max(floor > 0 ? floor : 0, 1 / (1 + (a > 0 ? a : 0) * (n - 1)));
  }

  /* Один этап. s: { vol, rate (выработка 1 рабочего за смену), workers, front (минимум объёма на 1 рабочего; пусто = без ограничения), prep (дней подготовки), pause (календарных дней перерыва после этапа) }.
     g: { k (выполнение норм), shifts, a (потеря на каждого добавленного), floor (нижний предел эффективности) }.
     Рабочие сверх фронта в работе не участвуют. Дни этапа = подготовка + объём / (выработка × рабочие × эффективность × k × смены), округление вверх. */
  function stage(s, g) {
    var vol = num(s.vol), rate = num(s.rate), N = Math.floor(num(s.workers)), k = num(g.k), sh = num(g.shifts);
    var prep = num(s.prep); if (!(prep >= 0)) prep = 0;
    var pause = num(s.pause); if (!(pause >= 0)) pause = 0;
    var front = num(s.front);
    if (!(vol > 0)) return { error: 'Объём больше нуля.' };
    if (!(rate > 0)) return { error: 'Выработка на рабочего больше нуля.' };
    if (!(N >= 1)) return { error: 'Рабочих не меньше одного.' };
    if (!(k > 0) || !(sh > 0)) return { error: 'Коэффициент и число смен больше нуля.' };
    var maxN = front > 0 ? Math.max(1, Math.floor(vol / front + 1e-9)) : Infinity;
    var use = Math.min(N, maxN), e = eff(use, num(g.a), num(g.floor));
    var perDay = rate * use * e * k * sh;
    var naive = vol / (rate * N * k * sh);
    var work = vol / perDay;
    return { vol: vol, N: N, use: use, idle: N - use, maxN: maxN, e: e, effWorkers: use * e, perDay: perDay, naive: naive, work: work, prep: prep,
             days: Math.max(1, Math.ceil(prep + work - 1e-9)), pause: Math.ceil(pause - 1e-9) };
  }

  /* Дни этапа при другом числе рабочих (для таблицы подбора). */
  function daysFor(s, g, n) {
    var t = {}; for (var k in s) t[k] = s[k]; t.workers = n;
    var r = stage(t, g); return r.error ? null : r;
  }
  /* Таблица 1…max рабочих; best — наименьшее число рабочих, после которого каждый следующий экономит меньше целого дня. */
  function curve(s, g, max) {
    var rows = [], i, base = null;
    for (i = 1; i <= max; i++) {
      var r = daysFor(s, g, i); if (!r) return { error: 'Проверьте данные этапа.' };
      if (base === null) base = r.days;
      rows.push({ n: i, days: r.days, use: r.use, e: r.e, effWorkers: r.effWorkers, naive: r.naive, speedup: base / r.days });
    }
    var best = rows[rows.length - 1].n;
    for (i = 0; i < rows.length - 1; i++) if (rows[i].days - rows[i + 1].days < 1) { best = rows[i].n; break; }
    return { rows: rows, best: best };
  }
  /* Минимум рабочих, чтобы уложиться в target рабочих дней. null — не получится даже с полным фронтом. */
  function need(s, g, target) {
    var vol = num(s.vol), front = num(s.front), cap = front > 0 ? Math.max(1, Math.floor(vol / front + 1e-9)) : 200;
    for (var n = 1; n <= cap; n++) { var r = daysFor(s, g, n); if (r && r.days <= target) return n; }
    return null;
  }

  /* График. list — этапы с готовыми days и pause (результат stage) и флагом par (параллельно предыдущему).
     Этап начинается после окончания предыдущего блока и его технологического перерыва (календарные дни). */
  function schedule(start, list, opt) {
    var rows = [], blocks = [], i, cur = start, last = null;
    for (i = 0; i < list.length; i++) {
      var s = list[i], par = !!s.par && i > 0, bs, b;
      if (par) { b = blocks[blocks.length - 1]; bs = b.start; }
      else {
        bs = last ? T_addDays(last.end, 1 + last.pause) : cur;
        b = { start: bs, end: null, pause: 0 }; blocks.push(b);
      }
      var end = endDate(bs, s.days, { mode: opt.mode, off: opt.off, on: opt.on, startCounts: true });
      if (!end) return { error: 'Не удалось найти дату окончания: проверьте нерабочие дни.' };
      var real = firstWork(bs, opt);
      rows.push({ idx: i, par: par, start: real, end: end, days: s.days, pause: s.pause });
      if (!b.end || end > b.end) b.end = end;
      if (s.pause > b.pause) b.pause = s.pause;
      if (!par) last = b; else last = b;
    }
    var fin = blocks.length ? blocks[blocks.length - 1].end : null;
    return { rows: rows, end: fin, first: rows.length ? rows[0].start : null };
  }
  function T_addDays(d, n) { return addDays(d, n); }
  function firstWork(d, opt) { for (var g = 0; g < 400; g++, d = addDays(d, 1)) if (isWork(d, opt.mode || '5', opt.off, opt.on)) return d; return d; }

  /* Выработка 1 рабочего за смену из нормы трудозатрат НРР-2022: за смену (shiftH часов) один
     рабочий делает per × shiftH ÷ labor_h единиц, где labor_h — чел.-ч на per единиц измерения.
     Выполнение норм и число смен в сутки сюда не входят: их задаёт пользователь в панели 1. */
  function laborRate(per, laborH, shiftH) {
    per = num(per); laborH = num(laborH); shiftH = num(shiftH);
    if (!(per > 0) || !(laborH > 0) || !(shiftH > 0)) return null;
    return per * shiftH / laborH;
  }

  return { num: num, parseDate: parseDate, iso: iso, ru: ru, addDays: addDays, addYears: addYears, diffDays: diffDays, parseOff: parseOff, isWork: isWork, endDate: endDate, workDaysBetween: workDaysBetween, firstWork: firstWork, eff: eff, stage: stage, curve: curve, need: need, schedule: schedule, laborRate: laborRate };
});
