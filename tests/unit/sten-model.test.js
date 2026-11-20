/* Проверка облегчённой модели калькулятора стен. Запуск: node tests/unit/sten-model.test.js */
const assert = require('assert');
const S = require('../../static/sten-model.js');
const near = (a, b, t, m) => assert(Math.abs(a - b) <= t, m + ': ' + a + ' vs ' + b);

/* газобетон однослойный, Минск, 150 м² */
let r = S.calc({ sysId: 'gas1', regionId: 'minsk', area: 150 });
assert.strictEqual(r.budgetTotal, 150 * 128);
near(r.laborTotal, 150 * 2.1, 1e-9, 'labor');
near(r.days, (150 * 2.1) / 24, 1e-9, 'days');
near(r.normRatio, 3.2 / 2.8, 1e-9, 'normRatio');
assert.strictEqual(r.passesNorm, true);
near(r.heatPerM2, 24 * 4360 / 3.2 / 1000, 1e-9, 'heatPerM2');
near(r.heatPerM2, 32.7, 1e-6, 'heatPerM2 value');
near(r.heatTotalSeason, r.heatPerM2 * 150, 1e-9, 'heatTotalSeason');
near(r.heatTotal30y, r.heatTotalSeason * 30, 1e-9, 'heatTotal30y');

/* брус + вентфасад (не проходит норматив 2,8 на самом деле проходит: 3,6 > 2,8) */
r = S.calc({ sysId: 'brus', regionId: 'vitebsk', area: 100 });
near(r.heatPerM2, 24 * 4641 / 3.6 / 1000, 1e-9, 'brus heatPerM2');
assert.strictEqual(r.passesNorm, true);
assert.strictEqual(r.budgetPerM2, 186);

/* дефолтные параметры: без региона -> Минск; без бригады -> 3 человека */
r = S.calc({ sysId: 'nvf', area: 50 });
assert.strictEqual(r.region.id, 'minsk');
assert.strictEqual(r.crew, 3);

/* некорректный ввод */
assert.strictEqual(S.calc({ sysId: 'unknown', area: 10 }), null);
assert.strictEqual(S.calc({ sysId: 'gas1', area: 0 }), null);
assert.strictEqual(S.calc({ sysId: 'gas1', area: -5 }), null);
assert.strictEqual(S.calc({ sysId: 'gas1', area: NaN }), null);

assert.strictEqual(S.SYSTEMS.length, 8);
assert.strictEqual(S.REGIONS.length, 6);
assert.strictEqual(S.NORM_R0, 2.8);

console.log('sten-model: ok');
