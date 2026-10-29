/* Проверка модели пруда: три сценария и граничные значения предупреждений.  Запуск: node tests/unit/pond-model.test.js */
const assert = require('assert');
const P = require('../../static/pond-model.js');
const base = { type: 'decor', L: 6, W: 4, dAvg: 1.1, dPit: 1.8, fish: 'mod', winterFish: true, power: true, ground: 'loam', budget: 'std',
  plot: 10, border: 5, reg: 30, turn: NaN, lift: 1.2, trace: 8, turns: 2, zBog: 15, zShal: 20, zDeep: 40, zFlt: 5, species: 'base' };
const mk = o => Object.assign({}, base, o);
const near = (a, b, t, m) => assert(Math.abs(a - b) <= t, m + ': ' + a + ' vs ' + b);
const cnt = (r, l) => r.warns.filter(w => w.level === l).length;

/* A: декоративный 6x4 */
let r = P.calc(mk({}));
near(r.S, 24, 1e-9, 'S'); near(r.V, 26.4, 1e-9, 'V'); near(r.Q, 19.8, 1e-6, 'Q'); near(r.H, 3.4, 1e-9, 'H');
assert.strictEqual(r.pump.cls.qmax, 25); assert.strictEqual(r.pump.n, 1);
near(r.Vf, 3.168, 1e-6, 'Vф'); assert.strictEqual(r.uv.w, 55); assert.strictEqual(r.nSkim, 1);
assert.strictEqual(r.comp.c.l, 250); assert.strictEqual(r.thick, 1);
near(r.Sp, 100.3, 0.1, 'плёнка'); near(r.geo, 115.3, 0.1, 'геотекстиль');
const z = n => r.plants.filter(p => p.zone.indexOf(n) === 0).reduce((a, p) => a + p.n, 0);
assert.strictEqual(z('Болотная'), 22); assert.strictEqual(z('Мелководье'), 20); assert.strictEqual(z('Глубоководная'), 5);
assert.strictEqual(cnt(r, 'red'), 0);

/* B: кой 7x5 */
r = P.calc(mk({ type: 'koi', L: 7, W: 5, dAvg: 1.6, dPit: 2.2, fish: 'koi' }));
near(r.V, 56, 1e-9, 'V'); near(r.Q, 168, 1e-9, 'Q'); assert.strictEqual(r.pump.n, 2);
near(r.Vf, 19.6, 1e-9, 'Vф'); assert.strictEqual(r.uv.w, 110); assert.strictEqual(r.nSkim, 2); assert.strictEqual(r.drain, 2);
assert.strictEqual(r.thick, 1.5);

/* C: биопул 10x5 */
r = P.calc(mk({ type: 'bath', L: 10, W: 5, dAvg: 1.4, fish: 'none', winterFish: false, lift: 0.3, trace: 4, turns: 1 }));
near(r.V, 70, 1e-9, 'V'); near(r.Q, 105, 1e-9, 'Q'); assert.strictEqual(r.pump.cls.qmax, 110);
near(r.Sreg, 15, 1e-9, 'Sрег'); assert.strictEqual(r.uv.w, 150); assert.strictEqual(r.nSkim, 2);
assert.strictEqual(r.plTotal, 120);

/* границы предупреждений */
assert.strictEqual(cnt(P.calc(mk({ dPit: 1.49, dAvg: 1.1 })), 'red'), 1);
assert.strictEqual(cnt(P.calc(mk({ dPit: 1.5 })), 'red'), 0);
const bath = o => P.calc(mk(Object.assign({ type: 'bath', fish: 'none', winterFish: false, dAvg: 1.4 }, o)));
assert.strictEqual(cnt(bath({ reg: 29 }), 'red'), 1); assert.strictEqual(cnt(bath({ reg: 30 }), 'red'), 0);
const area = s => P.calc(mk({ L: s, W: 1, dAvg: 1, plot: 1000 })).warns.some(w => /100 м²/.test(w.text));
assert.strictEqual(area(100), false); assert.strictEqual(area(100.1), true);
assert.strictEqual(cnt(P.calc(mk({ border: 2.9 })), 'red'), 1); assert.strictEqual(cnt(P.calc(mk({ border: 3 })), 'red'), 0);
assert.strictEqual(cnt(P.calc(mk({ type: 'koi', turn: 1.9, dAvg: 1.6, fish: 'koi' })), 'red'), 1);
console.log('pond-model: ok');
