/* Проверка расчёта сроков.  Запуск: node tests/unit/terms.test.js */
const assert = require('assert');
const T = require('../../static/terms-core.js');
const d = T.parseDate;

// даты
assert.strictEqual(T.iso(d('05.03.2026')), '2026-03-05');
assert.strictEqual(T.iso(d('2026-3-5')), '2026-03-05');
assert.strictEqual(d('31.02.2026'), null);
assert.strictEqual(d('мусор'), null);
assert.strictEqual(T.ru(T.addDays(d('28.02.2028'), 2)), '01.03.2028');
assert.strictEqual(T.ru(T.addYears(d('29.02.2028'), 5)), '28.02.2033');

// нерабочие дни
const off = T.parseOff('01.05.2026, 09.05.2026; 11.05.2026 – 13.05.2026\nxx');
assert.strictEqual(off.count, 5);
assert.deepStrictEqual(off.bad, ['xx']);
assert.strictEqual(T.parseOff('13.05.2026 - 11.05.2026').bad.length, 1);

// рабочие дни: 2026-03-02 понедельник
assert.strictEqual(T.isWork(d('02.03.2026'), '5'), true);
assert.strictEqual(T.isWork(d('07.03.2026'), '5'), false);
assert.strictEqual(T.isWork(d('07.03.2026'), '6'), true);
assert.strictEqual(T.isWork(d('08.03.2026'), '6'), false);
assert.strictEqual(T.isWork(d('08.03.2026'), '7'), true);
assert.strictEqual(T.isWork(d('02.03.2026'), '5', { '2026-03-02': 1 }), false);
assert.strictEqual(T.isWork(d('07.03.2026'), '5', {}, { '2026-03-07': 1 }), true);

// окончание: 5 рабочих дней с понедельника = пятница; 6-й день = следующий понедельник
assert.strictEqual(T.ru(T.endDate(d('02.03.2026'), 5, { mode: '5' })), '06.03.2026');
assert.strictEqual(T.ru(T.endDate(d('02.03.2026'), 6, { mode: '5' })), '09.03.2026');
assert.strictEqual(T.ru(T.endDate(d('02.03.2026'), 5, { mode: '5', startCounts: false })), '09.03.2026');
assert.strictEqual(T.ru(T.endDate(d('02.03.2026'), 10, { mode: '7' })), '11.03.2026');
// старт в субботу при пятидневке: первый рабочий день понедельник
assert.strictEqual(T.ru(T.endDate(d('07.03.2026'), 1, { mode: '5' })), '09.03.2026');
// праздник сдвигает окончание
assert.strictEqual(T.ru(T.endDate(d('02.03.2026'), 5, { mode: '5', off: { '2026-03-04': 1 } })), '09.03.2026');
// перенос рабочего дня на субботу
assert.strictEqual(T.ru(T.endDate(d('02.03.2026'), 6, { mode: '5', on: { '2026-03-07': 1 } })), '07.03.2026');
assert.strictEqual(T.endDate(d('02.03.2026'), 0, {}), null);
assert.strictEqual(T.workDaysBetween(d('02.03.2026'), d('08.03.2026'), { mode: '5' }), 5);

// трудозатраты
const st = T.stages([{ hours: 160, workers: 4 }, { hours: 80, workers: 2 }], { shift: 8, k: 1, shifts: 1 });
assert.strictEqual(st.total, 5 + 5);
assert.strictEqual(st.hours, 240);
// параллельный этап: берём наибольший
const sp = T.stages([{ hours: 160, workers: 4 }, { hours: 80, workers: 2, par: true }, { hours: 8, workers: 1 }], { shift: 8, k: 1, shifts: 1 });
assert.strictEqual(sp.total, 5 + 1);
// первый этап не может быть параллельным
assert.strictEqual(T.stages([{ hours: 8, workers: 1, par: true }], { shift: 8, k: 1, shifts: 1 }).total, 1);
// коэффициент и смены; дробные дни округляются вверх, но не из-за погрешности
assert.strictEqual(T.stages([{ hours: 100, workers: 5 }], { shift: 8, k: 1.25, shifts: 1 }).rows[0].days, 2);
assert.strictEqual(T.stages([{ hours: 0.3 * 8 * 10, workers: 1 }], { shift: 8, k: 1, shifts: 1 }).rows[0].days, 3);
assert.strictEqual(T.stages([{ hours: 160, workers: 4 }], { shift: 8, k: 1, shifts: 2 }).total, 3);
assert(T.stages([{ hours: 1, workers: 0 }], { shift: 8, k: 1, shifts: 1 }).error);
assert(T.stages([{ hours: 1, workers: 1 }], { shift: 0, k: 1, shifts: 1 }).error);
assert.strictEqual(T.num('1 234,5'), 1234.5);
assert(Number.isNaN(T.num('')));

// приёмка и гарантия
const h = T.handover({ ready: d('01.06.2026'), accStart: d('01.07.2026'), signed: d('10.07.2026'), kind: 'obj' });
assert.strictEqual(T.ru(h.commissionBy), '21.06.2026');
assert.strictEqual(T.ru(h.appointBy), '01.06.2026');
assert.strictEqual(T.ru(h.approveBy), '25.07.2026');
assert.strictEqual(h.warrantyFrom, null);
assert.strictEqual(T.ru(h.warrantyFromLatest), '25.07.2026');
assert.strictEqual(T.ru(h.warrantyTo), '25.07.2031');
assert.strictEqual(T.handover({ accStart: d('01.07.2026'), short: true }).appointBy.getTime(), d('16.06.2026').getTime());
const h2 = T.handover({ approved: d('20.07.2026'), kind: 'repair' });
assert.strictEqual(T.ru(h2.warrantyFrom), '20.07.2026');
assert.strictEqual(T.ru(h2.warrantyTo), '20.07.2028');
assert.strictEqual(T.handover({ approved: d('20.07.2026'), kind: 'obj', years: 7 }).years, 7);

// неустойка
let p = T.penalty('p76a', 100000, 10);
assert.strictEqual(p.sum, 2000); assert.strictEqual(p.capped, false); assert.strictEqual(p.cap, 20000);
p = T.penalty('p76a', 100000, 150);
assert.strictEqual(p.sum, 20000); assert.strictEqual(p.capped, true); assert.strictEqual(p.daysToCap, 100);
p = T.penalty('p76b', 1000, 60);
assert.strictEqual(p.sum, 1000); assert.strictEqual(p.capped, true); assert.strictEqual(p.daysToCap, 50);
assert.strictEqual(T.penalty('p75b', 5000, 3).sum, 30);
assert.strictEqual(T.penalty('p75a', 5000, 3, 0.1).sum, 15);
assert(T.penalty('x', 1, 1).error);
assert(T.penalty('p75a', -1, 1).error);
console.log('terms: ok');
