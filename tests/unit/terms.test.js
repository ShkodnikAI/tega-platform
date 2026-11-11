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

// эффективность бригады
assert.strictEqual(T.eff(1, 0.1, 0.4), 1);
assert(Math.abs(T.eff(8, 0.1, 0.4) - 1 / 1.7) < 1e-9);
assert.strictEqual(T.eff(50, 0.1, 0.4), 0.4);
assert.strictEqual(T.eff(5, 0, 0), 1);

const G = { k: 1, shifts: 1, a: 0.1, floor: 0.4 };
// пример: 80 м², 8 м² на человека в смену
let r = T.stage({ vol: 80, rate: 8, workers: 1 }, G);
assert.strictEqual(r.days, 10); assert.strictEqual(r.naive, 10);
r = T.stage({ vol: 80, rate: 8, workers: 8 }, G);
assert.strictEqual(r.naive, 1.25);          // «логика обывателя»
assert(r.days >= 2 && r.days <= 4, 'реальный срок больше наивного: ' + r.days);
assert(r.effWorkers < 8 && r.effWorkers > 3);
// подготовка добавляет время
assert.strictEqual(T.stage({ vol: 80, rate: 8, workers: 1, prep: 1 }, G).days, 11);
// фронт ограничивает: 80 м² при минимум 20 м² на человека — работают не больше 4
r = T.stage({ vol: 80, rate: 8, workers: 8, front: 20 }, G);
assert.strictEqual(r.use, 4); assert.strictEqual(r.idle, 4); assert.strictEqual(r.maxN, 4);
assert.strictEqual(T.stage({ vol: 80, rate: 8, workers: 8, front: 20 }, G).days, T.stage({ vol: 80, rate: 8, workers: 4, front: 20 }, G).days);
// коэффициент и смены
assert.strictEqual(T.stage({ vol: 80, rate: 8, workers: 1 }, { k: 1.25, shifts: 1, a: 0, floor: 0 }).days, 8);
assert.strictEqual(T.stage({ vol: 80, rate: 8, workers: 1 }, { k: 1, shifts: 2, a: 0, floor: 0 }).days, 5);
// без потерь результат совпадает с наивным
assert.strictEqual(T.stage({ vol: 80, rate: 8, workers: 8 }, { k: 1, shifts: 1, a: 0, floor: 0 }).days, 2);
// ошибки
assert(T.stage({ vol: 0, rate: 8, workers: 1 }, G).error);
assert(T.stage({ vol: 1, rate: 0, workers: 1 }, G).error);
assert(T.stage({ vol: 1, rate: 1, workers: 0 }, G).error);
assert(T.stage({ vol: 1, rate: 1, workers: 1 }, { k: 0, shifts: 1 }).error);

// кривая: дни не растут с ростом бригады, эффект убывает
const c = T.curve({ vol: 80, rate: 8, workers: 1 }, G, 12);
assert.strictEqual(c.rows[0].days, 10);
for (let i = 1; i < c.rows.length; i++) assert(c.rows[i].days <= c.rows[i - 1].days);
assert(c.best > 1 && c.best < 12);
assert(c.rows[7].days > Math.ceil(c.rows[7].naive), 'у 8 рабочих реальный срок больше наивного');
assert(c.rows[11].use === 12);
// подбор бригады под срок
const s0 = { vol: 80, rate: 8, workers: 1 };
const n5 = T.need(s0, G, 5);
assert(n5 >= 2 && T.stage({ vol: 80, rate: 8, workers: n5 }, G).days <= 5);
assert(T.stage({ vol: 80, rate: 8, workers: n5 - 1 }, G).days > 5);
assert.strictEqual(T.need({ vol: 80, rate: 8, workers: 1, prep: 3 }, G, 2), null);
assert.strictEqual(T.need({ vol: 80, rate: 8, workers: 1, front: 40 }, G, 1), null);

// график: 2 этапа подряд с перерывом в 1 календарный день; 02.03.2026 — понедельник
const A = T.stage({ vol: 40, rate: 8, workers: 1 }, { k: 1, shifts: 1, a: 0, floor: 0 });   // 5 дней
const B = T.stage({ vol: 16, rate: 8, workers: 1, pause: 0 }, { k: 1, shifts: 1, a: 0, floor: 0 }); // 2 дня
A.pause = 1;
let sc = T.schedule(d('02.03.2026'), [A, B], { mode: '5' });
assert.strictEqual(T.ru(sc.rows[0].start), '02.03.2026'); assert.strictEqual(T.ru(sc.rows[0].end), '06.03.2026');
assert.strictEqual(T.ru(sc.rows[1].start), '09.03.2026'); // пт + 1 + пауза 1 = вс → первый рабочий пн
assert.strictEqual(T.ru(sc.end), '10.03.2026');
A.pause = 3;
sc = T.schedule(d('02.03.2026'), [A, B], { mode: '5' });
assert.strictEqual(T.ru(sc.rows[1].start), '10.03.2026'); assert.strictEqual(T.ru(sc.end), '11.03.2026');
// параллельный этап стартует вместе с предыдущим
B.par = true; A.pause = 0;
sc = T.schedule(d('02.03.2026'), [A, B], { mode: '5' });
assert.strictEqual(T.ru(sc.rows[1].start), '02.03.2026'); assert.strictEqual(T.ru(sc.rows[1].end), '03.03.2026'); assert.strictEqual(T.ru(sc.end), '06.03.2026');
// праздник сдвигает окончание
sc = T.schedule(d('02.03.2026'), [A], { mode: '5', off: { '2026-03-04': 1 } });
assert.strictEqual(T.ru(sc.end), '09.03.2026');
// старт в выходной: первый день — понедельник
sc = T.schedule(d('07.03.2026'), [A], { mode: '5' });
assert.strictEqual(T.ru(sc.rows[0].start), '09.03.2026'); assert.strictEqual(T.ru(sc.end), '13.03.2026');
assert.strictEqual(T.num('1 234,5'), 1234.5);
assert(Number.isNaN(T.num('')));
console.log('terms: ok');
