/* Проверка модели бани: три сценария ТЗ (с поправками), таблица электрики и границы предупреждений.  Запуск: node tests/unit/bath-model.test.js */
const assert = require('assert');
const B = require('../../static/bath-model.js');
const base = { type: 'fin', L: 2.4, W: 2.0, H: 2.2, unheated: 1.8, supply: '380', limit: NaN, door: 'out', vent: 'yes', insul: 'wool', place: 'built', border: 5,
  chimney: 'yes', drain: 'yes', softener: 'yes', tariff: 0.3037, session: 1.5, pano: false, barrel: false, salt: false };
const mk = o => Object.assign({}, base, o);
const near = (a, b, t, m) => assert(Math.abs(a - b) <= t, m + ': ' + a + ' vs ' + b);
const cnt = (r, l) => r.warns.filter(w => w.level === l).length;

/* A: финская 2,4×2,0×2,2, стекло 1,8 м², 380 В */
let r = B.calc(mk({}));
near(r.V, 10.56, 1e-9, 'V'); near(r.Sw, 19.36, 1e-9, 'Sw'); near(r.Sfin, 22.56, 1e-9, 'Sобшивки');
near(r.P, 10.56 * 1.1 + 0.9, 1e-9, 'P'); assert.strictEqual(r.heater.kw, 13.5);
assert.strictEqual(r.lineMain.cable, '5×6'); assert.strictEqual(r.lineMain.brk, 25); assert(r.lineMain.brk >= r.lineMain.amp, 'автомат не меньше тока');
near(r.air.q, 52.8, 1e-9, 'Q'); assert.strictEqual(r.air.d, 100);
near(r.enc.foil, 22.56 * 1.1, 1e-9, 'фольга'); near(r.enc.board, 22.56 * 1.05, 1e-9, 'вагонка'); near(r.enc.battens, 22.56 / 0.6, 1e-9, 'брусок');
near(r.enc.tier1, 2.0, 1e-9, 'ярус 1'); near(r.enc.tier2, 1.6, 1e-9, 'ярус 2'); near(r.enc.slats, 18, 1e-9, 'планка');
near(r.stones.kg, 84.48, 1e-9, 'камни'); assert.strictEqual(r.stones.packs, 5);
near(r.kwh.e, 13.5 * 0.75 + 13.5 * 1.5 * 0.4, 1e-9, 'кВт·ч');
assert.strictEqual(cnt(r, 'red'), 0);

/* B: русская дровяная 3,0×2,5×2,3, отдельно стоящая */
r = B.calc(mk({ type: 'rus', L: 3, W: 2.5, H: 2.3, unheated: 0, place: 'sep' }));
near(r.V, 17.25, 1e-9, 'V'); near(r.wood.passport, 20.7, 1e-9, 'паспорт'); near(r.wood.stoneMin, 207, 1e-9, 'камни');
near(r.air.q, 86.25, 1e-9, 'Q'); assert.strictEqual(r.air.d, 100); assert.strictEqual(r.kwh, undefined); assert.strictEqual(r.heater, undefined);
assert.strictEqual(r.stones.closed, true);
assert.strictEqual(cnt(B.calc(mk({ type: 'rus', V: 0, L: 3, W: 2.5, H: 2.3, chimney: 'no' })), 'yellow'), 1);

/* C: хамам 2,0×2,0×2,2 */
r = B.calc(mk({ type: 'ham', L: 2, W: 2, H: 2.2, unheated: 0 }));
near(r.V, 8.8, 1e-9, 'V'); near(r.P, 15.84, 1e-9, 'P'); assert.strictEqual(r.heater.kw, 15);
near(r.surf.floor, 0.64, 1e-9, 'пол'); near(r.surf.bench, 0.12, 1e-9, 'полки'); near(r.surf.wall, 1.44, 1e-9, 'стены'); near(r.surf.total, 2.2, 1e-9, 'обогрев');
near(r.ham.wp, 24 * 1.15, 1e-9, 'гидроизоляция'); near(r.ham.xps, 21.6 * 1.05, 1e-9, 'XPS'); near(r.ham.mosaic, 22, 1e-9, 'мозаика');
assert.strictEqual(r.lineMain.cable, '5×6'); assert.strictEqual(r.lineSurf.cable, '3×2,5'); assert.strictEqual(r.air.n, 3);

/* таблица электрики: автомат не меньше расчётного тока */
[3.5, 4.5, 6, 7, 8, 9, 10.5, 12, 13.5, 15, 16, 18, 20, 24].forEach(kw => { const l = B.line(kw); assert(l.brk >= l.amp - 1e-9, kw + ' кВт: ' + l.brk + ' А против ' + l.amp); });
assert.strictEqual(B.line(3.5).v, 220); assert.strictEqual(B.line(7).v, 220); assert.strictEqual(B.line(8).v, 380);

/* границы предупреждений */
const sauna = o => B.calc(mk(Object.assign({ unheated: 0 }, o)));
/* печь 6 кВт (класс до 8) и класс 8 */
assert.strictEqual(sauna({ L: 2.0, W: 1.6, H: 2.1, supply: '220' }).heater.kw, 8);           /* V=6,72, P=7,39 → 8 кВт */
assert.strictEqual(cnt(sauna({ L: 2.0, W: 1.6, H: 2.1, supply: '220' }), 'red'), 1, '8 кВт при 220 В');
assert.strictEqual(cnt(sauna({ L: 2.0, W: 1.6, H: 2.1, supply: '380' }), 'red'), 0);
assert.strictEqual(sauna({ L: 1.6, W: 1.5, H: 2.1, supply: '220' }).heater.kw, 6);           /* V=5,04 → 5,54 → 6 кВт */
assert.strictEqual(cnt(sauna({ L: 1.6, W: 1.5, H: 2.1, supply: '220' }), 'red'), 0);
assert.strictEqual(cnt(B.calc(mk({ limit: 13.4 })), 'red'), 1); assert.strictEqual(cnt(B.calc(mk({ limit: 13.5 })), 'red'), 0);
assert.strictEqual(cnt(B.calc(mk({ door: 'in' })), 'red'), 1); assert.strictEqual(cnt(B.calc(mk({ door: 'lock' })), 'red'), 1);
assert.strictEqual(cnt(B.calc(mk({ vent: 'no' })), 'red'), 1); assert.strictEqual(cnt(B.calc(mk({ vent: 'gap' })), 'red'), 1);
assert.strictEqual(cnt(B.calc(mk({ insul: 'pps' })), 'red'), 1); assert.strictEqual(cnt(B.calc(mk({ type: 'ham', insul: 'xps' })), 'red'), 0);
assert.strictEqual(cnt(B.calc(mk({ type: 'ham', drain: 'no' })), 'red'), 1);
const small = o => B.calc(mk(Object.assign({ type: 'rus', unheated: 0 }, o))).warns.some(w => /менее 6 м³/.test(w.text));
assert.strictEqual(small({ L: 2, W: 1.5, H: 1.9 }), true);    /* V = 5,7 */
assert.strictEqual(small({ L: 2, W: 2, H: 1.5 }), false);     /* V = 6,0 */
assert.strictEqual(B.calc(mk({ place: 'sep', border: 1.9 })).warns.some(w => /2 м до границы/.test(w.text)), true);
assert.strictEqual(B.calc(mk({ place: 'sep', border: 2 })).warns.some(w => /2 м до границы/.test(w.text)), false);
assert.strictEqual(B.calc(mk({ place: 'built', border: 0 })).warns.some(w => /2 м до границы/.test(w.text)), false);
console.log('bath-model: ok');
