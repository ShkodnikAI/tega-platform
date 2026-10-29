/* Проверка модели кровли: геометрия, пригодность по уклону, нагрузки и стропило, водоотвод, стоимость владения, солнце.  Запуск: node tests/unit/roof-model.test.js */
const assert = require('assert');
const R = require('../../static/roof-model.js');
const base = { form: 'gable', L: 10, W: 8, ov: 0.5, alpha: 30, valleys: 0, mat: 'metal_tile', step: 0.6, insT: 200, sk: 1.2, ce: 1, ct: 1.1, gOther: 0.45, span: 4, b: 50, h: 200, grade: 'C24',
  gutter: 's', eaveH: 3, horizon: 50, lifeMode: 'mid', priceCover: 40, priceBase: 20, priceDemol: 5, pvShare: 50, az: 's' };
const mk = o => Object.assign({}, base, o);
const near = (a, b, t, m) => assert(Math.abs(a - b) <= t, m + ': ' + a + ' vs ' + b);
const has = (r, re, lvl) => r.warns.some(w => re.test(w.text) && (!lvl || w.level === lvl));
let r = R.calc(mk({}));
/* геометрия двускатной: план 11×9 м с карнизами */
near(r.geo.planArea, 99, 1e-9, 'план'); near(r.geo.slopeLen, 4.5 / Math.cos(Math.PI / 6), 1e-9, 'скат'); near(r.geo.area, 2 * 11 * 4.5 / Math.cos(Math.PI / 6), 1e-9, 'площадь');
near(r.geo.ridge, 11, 1e-9, 'конёк'); near(r.geo.eaves, 22, 1e-9, 'карниз'); near(r.geo.pct, 57.735, 1e-3, 'уклон %');
/* вальма: площадь = план / cos, 4 ребра */
const hip = R.calc(mk({ form: 'hip' })); near(hip.geo.area, 99 / Math.cos(Math.PI / 6), 1e-9, 'вальма'); near(hip.geo.ridge, 2, 1e-9, 'конёк вальмы'); assert(hip.geo.hips > 0);
/* пригодность: металлочерепица 14° стандарт, 10° спецмеры, ниже красное */
assert.strictEqual(R.calc(mk({ alpha: 14 })).fit, 'ok'); assert.strictEqual(R.calc(mk({ alpha: 12 })).fit, 'special'); assert.strictEqual(R.calc(mk({ alpha: 9 })).fit, 'no');
assert(has(R.calc(mk({ alpha: 9 })), /не защитит/, 'red')); assert(has(R.calc(mk({ alpha: 12 })), /спецмеры/, 'yellow'));
assert(has(R.calc(mk({ mat: 'ceramic', alpha: 50 })), /дополнительной фиксации/, 'yellow'));
assert(has(R.calc(mk({ form: 'flat', alpha: 2, mat: 'metal_tile' })), /штучное покрытие/, 'yellow'));
assert.strictEqual(R.calc(mk({ form: 'flat', alpha: 2, mat: 'pvc' })).fit, 'ok');
/* снег по схеме Еврокода: mu 0,8 до 30°, линейно до 0 к 60° */
near(r.mu, 0.8, 1e-9, 'mu 30'); near(R.calc(mk({ alpha: 45 })).mu, 0.4, 1e-9, 'mu 45'); near(R.calc(mk({ alpha: 60 })).mu, 0, 1e-9, 'mu 60');
near(r.S, 0.8 * 1.1 * 1.2, 1e-9, 'S');
/* стропило 50×200 C24, пролёт 4 м, шаг 0,6: ручной расчёт прогиба 15,2 мм при пределе 23,1 мм (ползучесть только на постоянную часть) */
near(r.delta, 15.22, 0.1, 'прогиб мм'); near(r.utilDef, 0.659, 0.01, 'прогиб'); near(r.utilBend, 0.51, 0.03, 'изгиб'); assert.strictEqual(r.hStd, 175);
assert(has(R.calc(mk({ h: 150 })), /не проходит/, 'red'));
assert(!has(R.calc(mk({ h: 250 })), /загружено|не проходит/));
/* водоотвод: 114 м² плана 99 м² при жёлобе 125 даёт 2 трубы (минимум по числу карнизов), один скат больше длины 12 м даёт доп. трубы */
assert.strictEqual(r.pipes, 2); assert.strictEqual(R.calc(mk({ L: 30 })).pipes, 6);
assert.strictEqual(R.calc(mk({ form: 'flat', alpha: 2, mat: 'pvc' })).outlets, 2);
assert.strictEqual(r.guardRows, 1); assert(has(r, /снегозадержател/, 'yellow'));
/* стоимость владения: металлочерепица 40 лет, горизонт 50: одна замена, остаточная стоимость */
near(r.life, 40, 1e-9, 'срок'); assert.strictEqual(r.nRepl, 1); near(r.residual, 1 - 10 / 40, 1e-9, 'остаток');
const A = r.geo.area; near(r.total, (40 + 20) * A + (40 + 5) * A + 0.01 * 40 * A * 50 - 0.75 * 40 * A, 1e-6, 'итого');
assert.strictEqual(R.calc(mk({ mat: 'slate', alpha: 30 })).nRepl, 0);
assert.strictEqual(R.calc(mk({ mat: 'profil', lifeMode: 'lo' })).nRepl, 2);
/* солнце: южный скат 50 % площади, 70 % полезной, 5,8 м² на кВт */
near(r.pvKw, A * 0.5 * 0.7 * 0.5 / 5.8, 1e-9, 'кВтп'); near(r.pvKwh, r.pvKw * 1030 * r.pvTilt * 1, 1e-6, 'кВт·ч'); near(R.calc(mk({ az: 'n' })).pvKwh / r.pvKwh, 0.6, 1e-9, 'север');
assert(has(R.calc(mk({ mat: 'corr_bit', alpha: 15 })), /25–30 лет/, 'yellow'));
/* утепление: R = Rпов + t/λ; для R 5,0 и λ 0,040 нужно (5 − 0,25)·0,04 = 190 мм, округление 200 */
const ins = R.calc(mk({ pie: 'warm', insKind: 'wool', rNorm: 5, insT: 200, cross: true, ventOk: 'yes' }));
near(ins.rFact, 0.25 + 0.2 / 0.04, 1e-9, 'R факт'); near(ins.tReq, 190, 1e-9, 'толщина'); assert.strictEqual(ins.tRound, 200); assert(!has(ins, /ниже заданной нормы/));
assert(has(R.calc(mk({ pie: 'warm', insKind: 'wool', rNorm: 5, insT: 100, cross: true })), /ниже заданной нормы/, 'red'));
assert(has(R.calc(mk({ pie: 'warm', insKind: 'wool', insT: 100, cross: false })), /мостики холода/, 'yellow'));
assert.strictEqual(R.calc(mk({ pie: 'cold', insKind: 'wool', rNorm: 5, insT: 0 })).rOther, 0.15);
/* вентиляция 1/500 площади */
near(ins.ventArea, ins.geo.area / 500, 1e-9, 'вент');
assert(has(R.calc(mk({ ventOk: 'no' })), /не вентилируется/, 'red')); assert(!has(R.calc(mk({ ventOk: 'yes' })), /не вентилируется/));
/* труд: сумма этапов, срок = чел·ч / (бригада·8) */
const lw = R.calc(mk({ struct: 'board', crew: 4 })); near(lw.lab.total, lw.lab.rafters + lw.lab.pie + lw.lab.base + lw.lab.cover + lw.lab.water, 1e-9, 'труд');
near(lw.days, lw.lab.total / 32, 1e-9, 'дни'); near(lw.lab.cover, lw.geo.area * 0.9, 1e-9, 'покрытие металлочерепица 0,9');
assert(R.calc(mk({ struct: 'truss' })).lab.rafters < lw.lab.rafters);
near(R.calc(mk({ laborCover: 2 })).lab.cover, lw.geo.area * 2, 1e-9, 'своя норма');
/* схемы установки панелей */
const pvIn = R.calc(mk({ pvScheme: 'in', pvVent: 'no' })); near(pvIn.pvLoss, 0.125, 1e-9, 'потери без вентзазора'); assert(has(pvIn, /без вентиляционного контура/, 'red'));
near(R.calc(mk({ pvScheme: 'on' })).pvLoss, 0.05, 1e-9, 'на кровле'); near(R.calc(mk({ pvScheme: 'in', pvVent: 'yes' })).pvLoss, 0.08, 1e-9, 'в кровлю');
assert(has(R.calc(mk({ pvScheme: 'on', mat: 'ceramic' })), /сверлить штучное/, 'yellow'));
console.log('roof-model: ok');
