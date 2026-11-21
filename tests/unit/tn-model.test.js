/* Юнит-тесты модели калькулятора тепловых насосов (static/tn-model.js).
   Запуск: node tests/unit/tn-model.test.js */
var assert = require('assert');
var M = require('../../static/tn-model.js');

/* Точки k(t) должны воспроизводиться ровно в контрольных точках источника (art_heatpump.py, раздел 6). */
assert.strictEqual(M.kAtTemp(7), 1.0);
assert.strictEqual(M.kAtTemp(-7), 0.75);
assert.strictEqual(M.kAtTemp(-15), 0.60);
assert.strictEqual(M.kAtTemp(-25), 0.50);
assert.ok(M.kAtTemp(-10) < M.kAtTemp(-7) && M.kAtTemp(-10) > M.kAtTemp(-15), 'k(t) монотонно убывает с морозом');
assert.strictEqual(M.kAtTemp(10), 1.0, 'выше верхней точки — потолок 1,0');
assert.strictEqual(M.kAtTemp(-30), 0.50, 'ниже нижней точки — пол 0,50');

/* Теплопотери: невалидные входные данные -> null. */
assert.strictEqual(M.calcLoss({ regionId: 'minsk', s: 0, wallArea: 100, wallR: 3.2, topR: 4.5, botR: 3.0 }), null);
assert.strictEqual(M.calcLoss({ regionId: 'unknown', s: 150, wallArea: 100, wallR: 3.2, topR: 4.5, botR: 3.0 }), null);

/* Теплопотери: формула Qтр + Qвент (та же структура, что в панели hloss калькулятора «Отопление»). */
var loss = M.calcLoss({
  regionId: 'minsk', s: 150, h: 2.7, wallArea: 108, wallR: 3.2, winArea: 24, winR: 0.6, doorArea: 2,
  topR: 4.5, botR: 3.0, airChange: 0.6, recupEff: 0, occupants: 4, dhwPerPerson: 40, tGvs: 55, tCold: 10
});
assert.ok(loss);
var dt = 20 - (-24);
var qTrExpected = (108 / 3.2 + 24 / 0.6 + 2 / 0.8) * dt + (150 / 4.5) * dt * 0.9 + (150 / 3.0) * dt * 0.6;
assert.ok(Math.abs(loss.qTrW - qTrExpected) < 1e-6, 'трансмиссионные потери считаются по формуле Шага 1 ТЗ');
var qVentExpected = 0.335 * 0.6 * (150 * 2.7) * dt * (1 - 0);
assert.ok(Math.abs(loss.qVentW - qVentExpected) < 1e-6, 'вентиляционные потери считаются по формуле Шага 2 ТЗ');
assert.ok(Math.abs(loss.qdKw - (qTrExpected + qVentExpected) / 1000) < 1e-9);
assert.ok(loss.totalHeat > loss.qGodOt && loss.qGvs > 0, 'годовое тепло = отопление + ГВС');

/* Рекуператор снижает вентиляционные потери. */
var lossRecup = M.calcLoss(Object.assign({}, { regionId: 'minsk', s: 150, h: 2.7, wallArea: 108, wallR: 3.2, winArea: 24, winR: 0.6, doorArea: 2, topR: 4.5, botR: 3.0, airChange: 0.6, occupants: 4, dhwPerPerson: 40, tGvs: 55, tCold: 10 }, { recupEff: 0.6 }));
assert.ok(lossRecup.qVentW < loss.qVentW, 'рекуперация 60% уменьшает потери на вентиляцию');

/* Мощность и SCOP: невалидные данные -> null. */
assert.strictEqual(M.calcPower({ typeId: 'unknown', qdKw: 8 }), null);
assert.strictEqual(M.calcPower({ typeId: 'aw', qdKw: 0 }), null);

/* Воздух-вода, премиум, график 35/28: SCOP близок к заявленному в статье (Рис.1 — 3,8), совпадение
   с собственным примером JSON источника (ТЗ, раздел 6: SCOP 3,75, 5650 кВт·ч/год при Qd ≈ 8,6 кВт) —
   проверяем, что наша модель даёт тот же порядок величины на том же входе. */
var pw = M.calcPower({ typeId: 'aw', graphId: '35', equipClass: 'premium', pNom: 11, bivalentT: -15, qdKw: 8.6, qGodOt: 18200, qGvs: 3300 });
assert.ok(pw);
assert.ok(pw.scopOt > 3.5 && pw.scopOt < 4.1, 'SCOP воздух-вода премиум в графике 35/28 около 3,8 (статья, Рис.1)');
assert.ok(pw.welec > 0 && pw.welec < 7000, 'годовое электропотребление в разумных пределах эталонного дома');

/* Грунтовый источник не теряет мощность с морозом (k=1 всегда), в отличие от воздушного. */
var pwAir = M.calcPower({ typeId: 'aw', graphId: '35', equipClass: 'standard', pNom: 11, bivalentT: -25, qdKw: 8.6, qGodOt: 18200, qGvs: 3300 });
var pwGround = M.calcPower({ typeId: 'bw_v', graphId: '35', equipClass: 'standard', pNom: 10, bivalentT: -25, qdKw: 8.6, qGodOt: 18200, qGvs: 3300 });
assert.ok(pwAir.pBiv < pwAir.pNom, 'воздушный ТН теряет мощность на морозе');
assert.strictEqual(pwGround.pBiv, pwGround.pNom, 'грунтовый контур не зависит от температуры воздуха');
assert.strictEqual(pwGround.ok, true);

/* Проверка требования Pбив >= 0,8·Qd (раздел «Падение мощности» статьи, Шаг 7 ТЗ). */
assert.strictEqual(pwAir.ok, pwAir.pBiv >= 0.8 * 8.6);

/* 75/65 ощутимо хуже 35/28 при прочих равных. */
var pw75 = M.calcPower({ typeId: 'aw', graphId: '75', equipClass: 'standard', pNom: 11, bivalentT: -15, qdKw: 8.6, qGodOt: 18200, qGvs: 3300 });
assert.ok(pw75.scopOt < pw.scopOt, 'график 75/65 даёт более низкий SCOP, чем 35/28');

/* Грунтовый контур: воспроизводим собственный числовой пример источника (раздел 3.4 статьи:
   «ТН 10 кВт с COP 4,3 → отбор 7,7 кВт → 2 скважины по 80 м», отбор q = 45–55 Вт/м). */
var gr = M.calcGround({ soilId: 'clay_wet', pTn: 10, scop: 4.3, siteArea: 500, boreDepth: 80 });
assert.ok(gr);
assert.ok(Math.abs(gr.pOtbW / 1000 - 7.674) < 0.01, 'отбор тепла из грунта = Pтн·(1 − 1/COP) ≈ 7,7 кВт');
assert.strictEqual(gr.vertical.boreholes, 2, 'при q = 55 Вт/м и глубине 80 м нужно 2 скважины — как в примере источника');
assert.ok(gr.horizontal.areaNeeded > 0 && gr.horizontal.pipeLen > gr.horizontal.areaNeeded / 1, 'горизонтальный контур: площадь и длина трубы положительны');
assert.strictEqual(M.calcGround({ soilId: 'unknown', pTn: 10, scop: 4.3 }), null);
assert.strictEqual(M.calcGround({ soilId: 'clay_wet', pTn: 10, scop: 1 }), null, 'COP <= 1 некорректен для отбора тепла');

/* Экономика: ТН дешевле электрокотла и дровяного котла, субсидированный газ — дешевле всех (статья, раздел 9). */
var ec = M.calcEconomics({ totalHeat: 21500, scopOt: 3.8, tElec: 0.21, tGas: 0.13, tPellet: 0.40, tWood: 120 });
assert.ok(ec);
var byId = {}; ec.rows.forEach(function (r) { byId[r.id] = r; });
assert.ok(byId.hp.cost < byId.eb.cost, 'тепловой насос дешевле электрокотла');
assert.ok(byId.gas.cost < byId.hp.cost, 'субсидированный газ дешевле теплового насоса (честный вывод статьи, раздел 9)');
assert.strictEqual(M.calcEconomics({ totalHeat: 0, scopOt: 3.8, tElec: 0.21 }), null);

/* Списки справочников непустые и содержат ожидаемые типы/регионы/грунты. */
assert.ok(M.REGIONS.length === 6);
assert.ok(M.TYPES.some(function (t) { return t.id === 'bw_v'; }));
assert.ok(M.SOILS.length === 6);
assert.ok(M.GRAPHS.length === 4);

console.log('tn-model: ok');
