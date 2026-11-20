/* Проверка облегчённой модели калькулятора перекрытий и покрытий. Запуск: node tests/unit/perekr-model.test.js */
const assert = require('assert');
const P = require('../../static/perekr-model.js');
const near = (a, b, t, m) => assert(Math.abs(a - b) <= t, m + ': ' + a + ' vs ' + b);

/* перекрытие: монолитная плита, 80 м² */
let r = P.calcPerekrytie({ sysId: 'monolit', area: 80 });
assert.strictEqual(r.budgetTotal, 80 * 160);
near(r.laborTotal, 80 * 4.0, 1e-9, 'labor');
near(r.days, (80 * 4.0) / 24, 1e-9, 'days');
near(r.weightTotal, 80 * 515, 1e-9, 'weight');

/* дерево, дефолтная бригада 3 чел */
r = P.calcPerekrytie({ sysId: 'derevo', area: 40 });
assert.strictEqual(r.crew, 3);
assert.strictEqual(r.budgetPerM2, 80);
assert.strictEqual(P.calcPerekrytie({ sysId: 'nope', area: 10 }), null);
assert.strictEqual(P.calcPerekrytie({ sysId: 'derevo', area: 0 }), null);

/* покрытие: металлочерепица, уклон 30° — проходит */
r = P.calcPokrytie({ sysId: 'metallocherepica', area: 120, uklon: 30 });
assert.strictEqual(r.uklonOk, true);
assert.strictEqual(r.budgetTotal, 120 * 159);
near(r.weightTotal, 120 * 5.25, 1e-9, 'weight');

/* уклон ниже минимума — не проходит */
r = P.calcPokrytie({ sysId: 'metallocherepica', area: 120, uklon: 10 });
assert.strictEqual(r.uklonOk, false);

/* керамика: 16° — не проходит базовый уклон (22°), но проходит со спецмерами (16°) */
r = P.calcPokrytie({ sysId: 'keramika', area: 100, uklon: 16 });
assert.strictEqual(r.uklonOk, 'special');
r = P.calcPokrytie({ sysId: 'keramika', area: 100, uklon: 22 });
assert.strictEqual(r.uklonOk, true);
r = P.calcPokrytie({ sysId: 'keramika', area: 100, uklon: 10 });
assert.strictEqual(r.uklonOk, false);

/* без уклона — uklonOk остаётся null, расчёт не падает */
r = P.calcPokrytie({ sysId: 'falc', area: 50 });
assert.strictEqual(r.uklonOk, null);
assert.strictEqual(r.weightTotal, 50 * 4.5);

/* система без заданного веса (инверсионная) */
r = P.calcPokrytie({ sysId: 'inversionnaya', area: 60, uklon: 2 });
assert.strictEqual(r.weightTotal, null);

assert.strictEqual(P.calcPokrytie({ sysId: 'nope', area: 10 }), null);

/* тепловые потери: формула 24×ГСОП/R, контрольные значения из Табл.9 статьи (Минск, ГСОП 4360) */
r = P.calcHeatLoss({ regionId: 'minsk', r: 0.4, area: 1, normKey: 'cherdak' });
near(r.perM2Season, 262, 0.5, 'без утепления');
r = P.calcHeatLoss({ regionId: 'minsk', r: 3.0, area: 1, normKey: 'cherdak' });
near(r.perM2Season, 35, 0.5, 'норматив');
r = P.calcHeatLoss({ regionId: 'minsk', r: 5.2, area: 1, normKey: 'cherdak' });
near(r.perM2Season, 20, 0.5, 'вата 200');
r = P.calcHeatLoss({ regionId: 'minsk', r: 6.5, area: 1, normKey: 'cherdak' });
near(r.perM2Season, 16, 0.5, 'вата 250');
near(r.total30y, r.perM2Season * 30, 1e-9, 'total30y');
near(r.normRatio, 6.5 / 3.0, 1e-9, 'normRatio');

assert.strictEqual(P.calcHeatLoss({ regionId: 'minsk', r: 0, area: 1 }), null);
assert.strictEqual(P.calcHeatLoss({ regionId: 'unknown', r: 3, area: 1 }), null);

assert.strictEqual(P.PEREKRYTIE.length, 7);
assert.strictEqual(P.POKRYTIE.length, 7);
assert.strictEqual(P.REGIONS.length, 6);

console.log('perekr-model: ok');
