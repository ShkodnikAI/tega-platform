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

  /* Трудозатраты → продолжительность.
     stage: { hours (чел.-ч), workers, par (идёт параллельно с предыдущим этапом) }.
     opt: shift (ч), k (коэффициент выполнения норм), shifts (смен в сутки).
     Дни этапа = hours / (workers × shift × k × shifts), в итоге округляются вверх: часть дня остаётся днём. */
  function stages(list, opt) {
    var shift = num(opt.shift), k = num(opt.k), sh = num(opt.shifts), rows = [], blocks = [], total = 0, hours = 0, i;
    if (!(shift > 0) || !(k > 0) || !(sh > 0)) return { error: 'Смена, коэффициент и число смен должны быть больше нуля.' };
    for (i = 0; i < list.length; i++) {
      var s = list[i], h = num(s.hours), w = num(s.workers);
      if (!(h >= 0) || !(w > 0)) return { error: 'Этап ' + (i + 1) + ': трудозатраты не меньше нуля, рабочих больше нуля.' };
      var d = h / (w * shift * k * sh);
      var row = { name: s.name || '', hours: h, workers: w, raw: d, days: Math.ceil(d - 1e-9), par: !!s.par && i > 0 };
      rows.push(row);
      hours += h;
      if (row.par) { var b = blocks[blocks.length - 1]; b.days = Math.max(b.days, row.days); b.idx.push(i); }
      else blocks.push({ days: row.days, idx: [i] });
    }
    blocks.forEach(function (b) { total += b.days; });
    return { rows: rows, blocks: blocks, total: total, hours: hours };
  }

  /* Приёмка и гарантия.
     Кодекс № 289-З: ст. 104 п. 6 (20 календарных дней на создание комиссии и начало приёмки),
     ст. 106 п. 4 (комиссия назначается не позднее чем за 30 дней до начала приёмки; 15 дней при сроке строительства менее 30 дней),
     ст. 114 п. 4 и 8 (утверждение акта в течение 15 дней; дата утверждения — дата приёмки и начало гарантийного срока).
     Правила № 1450, п. 57 (гарантийный срок не менее 5 лет; для текущего ремонта и пусконаладки не менее 2 лет). */
  var WARR = { obj: { y: 5, t: 'объект и строительные работы по договору: не менее 5 лет' }, repair: { y: 2, t: 'текущий ремонт, пусконаладочные работы: не менее 2 лет' } };
  function handover(o) {
    var r = {};
    if (o.ready) {
      r.commissionBy = addDays(o.ready, 20);
    }
    if (o.accStart) r.appointBy = addDays(o.accStart, o.short ? -15 : -30);
    if (o.signed) { r.approveBy = addDays(o.signed, 15); }
    var from = o.approved || r.approveBy || null;
    r.warrantyFrom = o.approved || null;
    r.warrantyFromLatest = !o.approved && r.approveBy ? r.approveBy : null;
    var years = o.years != null ? o.years : (WARR[o.kind] || WARR.obj).y;
    r.years = years;
    if (from) r.warrantyTo = addYears(from, years);
    return r;
  }

  /* Неустойка по Правилам № 1450, п. 75 и 76.
     base — стоимость, от которой считается пеня (для кода p76a — стоимость невыполненных работ).
     cap: доля от base, на которой пеня останавливается. */
  var PEN = {
    p76a: { who: 'Подрядчик', rate: 0.2, cap: 0.2, p: 'п. 76, абз. 2', t: 'просрочка сроков выполнения работ, включая оформление документов', b: 'стоимость невыполненных работ', c: 'не более 20 % их стоимости' },
    p76b: { who: 'Подрядчик', rate: 2, cap: 1, p: 'п. 76, абз. 3', t: 'несвоевременное устранение дефектов из актов заказчика', b: 'стоимость работ по устранению дефектов', c: 'не более стоимости этих работ' },
    p75a: { who: 'Заказчик', rate: 0.2, cap: 1, p: 'п. 75, абз. 2', t: 'уклонение от приёмки работ и оформления документов', b: 'стоимость непринятых работ', c: 'не более стоимости этих работ' },
    p75b: { who: 'Заказчик', rate: 0.2, cap: 1, p: 'п. 75, абз. 3', t: 'несвоевременный расчёт за принятые работы', b: 'неперечисленная сумма', c: 'не более этой суммы, если иное не определено договором' },
    p75c: { who: 'Заказчик', rate: 0.2, cap: 1, p: 'п. 75, абз. 4', t: 'просрочка поставки материалов, которые по договору поставляет заказчик', b: 'стоимость недопоставленных материалов', c: 'не более фактической стоимости их приобретения, если иное не определено договором' }
  };
  function penalty(kind, base, days, rate) {
    var p = PEN[kind];
    if (!p) return { error: 'Неизвестный вид неустойки.' };
    if (!(base >= 0) || !(days >= 0)) return { error: 'Сумма и дни просрочки не могут быть отрицательными.' };
    var r = rate != null && rate > 0 ? rate : p.rate;
    var accrued = base * r / 100 * days, cap = base * p.cap, sum = Math.min(accrued, cap);
    var perDay = base * r / 100;
    return { rate: r, perDay: perDay, accrued: accrued, cap: cap, sum: sum, capped: accrued > cap, daysToCap: perDay > 0 ? Math.ceil(cap / perDay - 1e-9) : null };
  }

  return { num: num, parseDate: parseDate, iso: iso, ru: ru, addDays: addDays, addYears: addYears, diffDays: diffDays, parseOff: parseOff, isWork: isWork, endDate: endDate, workDaysBetween: workDaysBetween, stages: stages, handover: handover, penalty: penalty, PEN: PEN, WARR: WARR };
});
