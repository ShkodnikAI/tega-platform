/* Проверка модели ветроустановки: выработка по кривой мощности, высота ступицы, зоны и границы предупреждений.  Запуск: node tests/unit/wind-model.test.js */
const assert = require('assert');
const W = require('../../static/wind-model.js');
const base = { type: 'hawt', v10: 4, h0: 10, alpha: 0.2, hub: 18, k: 2, Pr: 3, vr: 11, vci: 3, vco: 25, eff: 85, obstH: 0, obstDist: 500, mount: 'guy', boundary: 100, windowDist: 50,
  mode: 'grid', dcV: 48, dcLen: 10, consumption: 4000, autonomy: 2, peak: 3, self: 60, tariff: 0.3037, buyout: 0.1, cost: 10000 };
const mk = o => Object.assign({}, base, o);
const near = (a, b, t, m) => assert(Math.abs(a - b) <= t, m + ': ' + a + ' vs ' + b);
const has = (r, re, lvl) => r.warns.some(w => re.test(w.text) && (!lvl || w.level === lvl));
/* ступица и выработка при заданной скорости на ступице (v10 подбираем так, чтобы получить нужную) */
const atHub = v => W.calc(mk({ v10: v / Math.pow(1.8, 0.2) }));
let r = W.calc(mk({}));
near(r.vHub, 4 * Math.pow(1.8, 0.2), 1e-9, 'ступица');
[[4.0, 1720, 6.5], [5.5, 4504, 17.1], [7.0, 7712, 29.3]].forEach(([v, e, cf]) => {
  const x = atHub(v); near(x.eNet, e, e * 0.02, 'выработка ' + v); near(x.cf * 100, cf, 0.4, 'КИУМ ' + v);
});
near(W.power(5.5, { Pr: 3, vr: 11, vci: 3, vco: 25 }), 0.32, 0.02, 'мощность на 5,5');
assert.strictEqual(W.power(2.9, { Pr: 3, vr: 11, vci: 3, vco: 25 }), 0);
assert.strictEqual(W.power(12, { Pr: 3, vr: 11, vci: 3, vco: 25 }), 3);
assert.strictEqual(W.power(26, { Pr: 3, vr: 11, vci: 3, vco: 25 }), 0);
near(r.D, 3.5, 0.1, 'ротор');
near(W.gamma(1.5), 0.886227, 1e-5, 'гамма');
/* вердикт */
assert.strictEqual(atHub(4.4).verdict, 'solar'); assert.strictEqual(atHub(5).verdict, 'hybrid'); assert.strictEqual(atHub(6.5).verdict, 'wind');
/* выше мачта больше энергии */
assert(W.calc(mk({ hub: 24 })).eNet > r.eNet);
/* ветровая тень: нижняя точка ниже препятствия + 3 м */
assert.strictEqual(W.calc(mk({ obstH: 15, obstDist: 100 })).wake, true);
assert.strictEqual(W.calc(mk({ obstH: 15, obstDist: 200 })).wake, false);
assert.strictEqual(W.calc(mk({ obstH: 12, obstDist: 100 })).wake, false);
near(W.calc(mk({ obstH: 15, obstDist: 100 })).eNet, r.eNet * 0.7, r.eNet * 0.001, 'тень -30%');
/* зона падения и красные предупреждения */
assert(has(W.calc(mk({ boundary: 15 })), /Зона падения/, 'red'));
assert(!has(W.calc(mk({ boundary: 40 })), /Зона падения/));
assert(has(W.calc(mk({ mount: 'roof' })), /Крыша/, 'red'));
/* жёлтые */
assert(has(W.calc(mk({ windowDist: 20 })), /окон/, 'yellow'));
assert(has(W.calc(mk({ hub: 32, mount: 'free' })), /выше 30 м/, 'yellow'));
assert(has(W.calc(mk({ type: 'savonius' })), /Савониуса/, 'yellow'));
assert(has(W.calc(mk({ Pr: 20 })), /15 кВт/, 'yellow'));
assert(has(W.calc(mk({ mode: 'off', autonomy: 1 })), /Автономность/, 'yellow'));
/* АКБ автономного объекта */
near(W.calc(mk({ mode: 'off', consumption: 3650, autonomy: 2 })).batt, 10 * 2 / (0.8 * 0.9), 1e-9, 'АКБ');
/* DC-спуск: 3 кВт, 48 В, 62,5 А */
const d = W.calc(mk({ dcLen: 30 })); near(d.I, 62.5, 1e-9, 'ток'); assert(d.dcS * 1 >= d.dcNeed, 'сечение по условию 3%'); assert(d.dcLoss <= 0.03 + 1e-9);
/* экономика */
const g = atHub(5.5); near(g.saving, g.eSelf * 0.3037 + g.eExport * 0.1, 1e-6, 'экономия'); assert(g.payback > 0);
console.log('wind-model: ok');
