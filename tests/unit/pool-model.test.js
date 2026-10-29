/* Проверка модели бассейна: три сценария и граничные значения предупреждений.  Запуск: node tests/unit/pool-model.test.js */
const assert = require('assert');
global.TegaPond = require('../../static/pond-model.js');
const P = require('../../static/pool-model.js');
const base = { type: 'skim', L: 8, W: 4, d: 1.5, place: 'out', months: 4, tTarget: 26, tStart: 15, source: 'tap', cover: 'slat', heat: 'hp', disinf: 'elecuv', bathers: 4,
  budget: 'std', cop: 4.5, H: 10, pumpHours: 12, t0: 24, border: 5, drain: 'own', winter: 'cons', safety: 'cover', reg: 30 };
const mk = o => Object.assign({}, base, o);
const near = (a, b, t, m) => assert(Math.abs(a - b) <= t, m + ': ' + a + ' vs ' + b);
const cnt = (r, l) => r.warns.filter(w => w.level === l).length;

/* A: скиммерный 8×4×1,5 */
let r = P.calc(mk({}));
near(r.V, 48, 1e-9, 'V'); near(r.Q, 9.6, 1e-9, 'Q'); assert.strictEqual(r.pump.cls.qmax, 12);
assert.strictEqual(r.filt.d, 600); near(r.en.loss, 3.6, 1e-9, 'потери'); near(r.en.hours, 2880, 1e-9, 'часы');
near(r.en.eHeat, 3.6 * 2880 + 48 * 1.163 * 11, 1e-6, 'E тепл'); near(r.eEl, r.en.eHeat / 4.5, 1e-6, 'E эл');
assert.strictEqual(r.cellG, 24); assert.strictEqual(r.uv.w, 75); assert.strictEqual(r.skim, 2);
assert(r.eElOpen > 2 * r.eEl, 'без покрытия больше вдвое');
assert.strictEqual(cnt(r, 'red'), 0);

/* B: биопул 10×5×1,4, павильон */
r = P.calc(mk({ type: 'bio', L: 10, W: 5, d: 1.4, place: 'pav', cover: 'none', disinf: 'none', H: 2.5 }));
near(r.V, 70, 1e-9, 'V'); near(r.Q, 105, 1e-9, 'Q'); assert.strictEqual(r.pump.cls.qmax, 110);
near(r.bio.Sreg, 15, 1e-9, 'Sрег'); assert.strictEqual(r.bio.plTotal, 120); assert.strictEqual(r.filt, null);
assert.strictEqual(cnt(P.calc(mk({ type: 'bio', L: 10, W: 5, d: 1.4, disinf: 'elec' })), 'red'), 1, 'хлор в биопуле');

/* C: каркасный 5×3×1 */
r = P.calc(mk({ type: 'frame', L: 5, W: 3, d: 1, cover: 'bubble', heat: 'none', disinf: 'chl' }));
near(r.V, 15, 1e-9, 'V'); near(r.Q, 3, 1e-9, 'Q'); assert.strictEqual(r.cartridge, true); assert.strictEqual(r.eEl, 0);

/* границы предупреждений */
const bio = o => P.calc(mk(Object.assign({ type: 'bio', L: 10, W: 5, d: 1.4, disinf: 'none' }, o)));
assert.strictEqual(cnt(bio({ reg: 29 }), 'red'), 1); assert.strictEqual(cnt(bio({ reg: 30 }), 'red'), 0);
assert.strictEqual(cnt(P.calc(mk({ place: 'in', cover: 'none' })), 'red'), 1); assert.strictEqual(cnt(P.calc(mk({ place: 'in', cover: 'slat' })), 'red'), 0);
assert.strictEqual(P.calc(mk({ border: 2.9 })).warns.some(w => /3 м до границы/.test(w.text)), true);
assert.strictEqual(P.calc(mk({ border: 3 })).warns.some(w => /3 м до границы/.test(w.text)), false);
assert.strictEqual(cnt(P.calc(mk({ drain: 'relief' })), 'red'), 1);
assert.strictEqual(cnt(P.calc(mk({ disinf: 'none' })), 'red'), 1);
console.log('pool-model: ok');
