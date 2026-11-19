/* Проверка модели фундамента: контрольный эталон №1 (лента МЗЛФ 10×10, Минск) и граничные случаи плиты.
   Источник эталона: tega-kalkulyator-zadanie.pdf, Табл. 6 — допуск ±2% по объёмам, ±1% по массе арматуры.
   Запуск: node tests/unit/found-model.test.js */
const assert = require('assert');
const F = require('../../static/found-model.js');
const near = (a, b, pct, m) => assert(Math.abs(a - b) <= Math.abs(b) * pct, m + ': ' + a + ' vs ' + b + ' (tol ' + (pct * 100) + '%)');

/* Эталон №1: дом 10×10, газобетон 400, суглинок R=220, УГВ 1,8, пучинистый, Минск dfn=1,0 */
const base = {
  sys: 'lenta', L: 10, W: 10, floors: 2, wall: 'gas', soil: 'loam', R: 220, ugv: 1.8, pucin: true,
  perim: 56, F: 62, shallow: true, h: 0.6, dLong: 12, nLong: 4, dStirrup: 8, step: 350, crew: 4
};
let r = F.calc(base);
near(r.b, 0.4, 0.01, 'ширина ленты b');
near(r.h, 0.6, 0.01, 'высота сечения h');
near(r.concrete, 13.7, 0.02, 'бетон ленты, м3');
near(r.pad, 18.8, 0.02, 'подушка, м3');
near(r.steelMass, 310, 0.01, 'масса арматуры, кг');
near(r.epsTotal, 90, 0.05, 'ЭППС, м2 (вертикаль + под отмосткой)');
assert.strictEqual(r.concreteClass, 'В22,5 W6 F150');

/* проверка по частям: продольная и хомуты отдельно, как в источнике */
near(r.longLen, 235, 0.01, 'продольная арматура, пог.м');
near(r.longMass, 209, 0.01, 'масса продольной арматуры, кг');
near(r.stirrupMass, 101, 0.02, 'масса хомутов, кг');

/* предупреждения: пучинистый грунт без мелкого заложения -> предупреждение */
let r2 = F.calc(Object.assign({}, base, { shallow: false }));
assert(r2.warns.some(w => w.level === 'yellow' && /Пучинистый/.test(w.text)), 'предупреждение о пучении без МЗЛФ');

/* сорт отсутствует в REBAR (невалидный диаметр) не должен падать */
let r3 = F.calc(Object.assign({}, base, { dLong: 99 }));
assert(isFinite(r3.longMass) && r3.longMass > 0, 'запасной диаметр при неизвестном значении');

/* ───────── плита: базовая проверка объёмов и минимального армирования ───────── */
const plitaBase = { sys: 'plita', L: 10, W: 10, floors: 2, wall: 'gas', soil: 'loam', R: 220, ugv: 1.8, pucin: false, t: 0.22, dMesh: 10, step: 200, ribW: 0.35, ribH: 0.35, ribLen: 40, crew: 4 };
let p = F.calc(plitaBase);
near(p.S, 100, 1e-9, 'площадь плиты');
near(p.slab, 100 * 0.22 * 1.02, 1e-6, 'объём плиты без рёбер');
assert(p.steelMass > 0, 'масса арматуры плиты положительна');
assert(p.asProvided >= p.minAs, 'шаг 200мм Ø10 проходит по минимальному армированию 0,1%');

let p2 = F.calc(Object.assign({}, plitaBase, { t: 0.15 }));
assert(p2.warns.some(w => w.level === 'yellow' && /180 мм/.test(w.text)), 'предупреждение при тонкой плите');

/* ───────── подбор типа фундамента и справочный расход на месте ───────── */
let weak = F.rankTypes({ soil: 'torf', floors: 1, wall: 'frame', ugv: 2, pucin: false, priority: 'balance' });
assert.strictEqual(weak[0].type.id, 'svai', 'на торфе/иле первой рекомендацией должны быть сваи');

let dry = F.rankTypes({ soil: 'sandmid', floors: 1, wall: 'frame', ugv: 3, pucin: false, priority: 'balance' });
assert.strictEqual(dry[0].type.id, 'stolb', 'сухой песок, каркас, одноэтажка -> столбчатый первым');

let mix = F.siteMix(10);
near(mix.cementBags, 10 * 380 / 50, 1e-9, 'мешки цемента на 10 м3');
near(mix.sandM3, 4.5, 1e-9, 'песок на 10 м3');
near(mix.gravelM3, 8.5, 1e-9, 'щебень на 10 м3');

/* ───────── масса здания (стены + перекрытия + кровля): влияет на подбор типа и на авто-оценку нагрузки ───────── */
let heavy3 = F.rankTypes({ soil: 'sandmid', floors: 3, wall: 'brick', ceil: 'monolith', roof: 'heavy', ugv: 3, pucin: false, priority: 'balance' });
assert(heavy3.some(function (it) { return it.type.id === 'stolb' && it.reasons.some(function (r) { return /масса здания/.test(r); }); }), 'тяжёлая 3-этажная конструкция должна штрафовать столбчатый по массе');

let light1 = F.rankTypes({ soil: 'sandmid', floors: 1, wall: 'frame', ceil: 'wood', roof: 'light', ugv: 3, pucin: false, priority: 'balance' });
assert.strictEqual(light1[0].type.id, 'stolb', 'лёгкий каркасный одноэтажный дом на сухом песке -> столбчатый первым и без штрафа по массе');

/* каркас+дерево+лёгкая кровля, 2 этажа, против кирпич+монолит+тяжёлая кровля, 2 этажа: вторая нагрузка заметно больше */
let fLight = F.calcLenta(Object.assign({}, base, { wall: 'frame', ceil: 'wood', roof: 'light', F: undefined }));
let fHeavy = F.calcLenta(Object.assign({}, base, { wall: 'brick', ceil: 'monolith', roof: 'heavy', F: undefined }));
assert(fHeavy.F > fLight.F * 1.5, 'тяжёлая конструкция (кирпич+монолит+тяжёлая кровля) должна давать заметно большую погонную нагрузку, чем лёгкая (каркас+дерево+лёгкая кровля)');

/* ───────── подвал: влияет на подбор типа, не на объёмы/армирование ленты ───────── */
let noBase = F.rankTypes({ soil: 'loam', floors: 2, wall: 'brick', ugv: 3, pucin: false, priority: 'balance', basement: false });
let withBase = F.rankTypes({ soil: 'loam', floors: 2, wall: 'brick', ugv: 3, pucin: false, priority: 'balance', basement: true });
assert.strictEqual(withBase[0].type.basementOk, true, 'с подвалом первой рекомендацией должна быть система с basementOk');
assert(['lentaZagl', 'lentaFbs'].indexOf(withBase[0].type.id) >= 0, 'с подвалом первой — заглублённая лента или сборная ФБС');
let mzlfNoBase = noBase.find(function (it) { return it.type.id === 'mzlf'; });
let mzlfWithBase = withBase.find(function (it) { return it.type.id === 'mzlf'; });
assert(mzlfWithBase.score < mzlfNoBase.score, 'подвал штрафует МЗЛФ (basementOk: false) относительно сценария без подвала');
assert(mzlfWithBase.reasons.some(function (r) { return /подвал/.test(r); }), 'причина штрафа МЗЛФ упоминает подвал');

let basementLenta = F.calcLenta(Object.assign({}, base, { basement: true, shallow: false }));
near(basementLenta.concrete, F.calcLenta(Object.assign({}, base, { basement: false, shallow: false })).concrete, 1e-9, 'подвал не меняет объём бетона ленты (влияет только на подбор типа и предупреждения)');
assert(basementLenta.warns.some(function (w) { return w.level === 'info' && /высоту сечения/.test(w.text); }), 'подвал на заглублённой ленте даёт подсказку про высоту сечения');

let basementShallow = F.calcLenta(Object.assign({}, base, { basement: true, shallow: true }));
assert(basementShallow.warns.some(function (w) { return w.level === 'yellow' && /заглублённой ленте/.test(w.text); }), 'подвал на МЗЛФ (shallow) предупреждает, что обычно нужна заглублённая лента');

let basementPlita = F.calcPlita(Object.assign({}, plitaBase, { basement: true }));
assert(basementPlita.warns.some(function (w) { return w.level === 'yellow' && /конструктивно не делают/.test(w.text); }), 'подвал на плите предупреждает, что конструктивно не делается');

console.log('found-model: ok');
