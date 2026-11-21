/* Модель калькулятора тепловых насосов: теплопотери по упрощённой методике ТКП 45-2.04-43 (та же
   формула, что в калькуляторе «Отопление», static panel hloss), SCOP по модели EN 14825 (база —
   tools/estimates/art_heatpump.py, Табл. 1 и Рис. 1), точка бивалентности, экономика против четырёх
   других источников тепла и упрощённый подбор грунтового контура по формулам ТЗ калькулятора
   (площадь/длина контура — прямая арифметика, без геологического проектирования и без автоматического
   выбора типа насоса: тип и систему источника выбирает сам пользователь).
   Это ориентировочный расчёт (±15–20 %), не проект отопления по ТКП 45-4.02-182.
   Работает и в браузере (window.TegaTN), и в Node (module.exports) для проверки. */
(function (root) {
  'use strict';

  var TV = 20; /* расчётная температура внутреннего воздуха, °C (ГОСТ 30494-2011) */
  var KBYT = 0.9; /* коэффициент бытовых теплопоступлений для годового расчёта по методу ГСОП, 0,85–0,95 */

  var REGIONS = [
    { id: 'minsk', name: 'Минск', gsop: 4360, tn: -24, topcp: -1.0, nop: 203 },
    { id: 'brest', name: 'Брест', gsop: 3707, tn: -19, topcp: 0.4, nop: 187 },
    { id: 'gomel', name: 'Гомель', gsop: 4156, tn: -23, topcp: -1.6, nop: 194 },
    { id: 'grodno', name: 'Гродно', gsop: 4096, tn: -22, topcp: -0.5, nop: 194 },
    { id: 'vitebsk', name: 'Витебск', gsop: 4641, tn: -26, topcp: -2.2, nop: 210 },
    { id: 'mogilev', name: 'Могилёв', gsop: 4510, tn: -25, topcp: -2.0, nop: 206 }
  ];

  var TYPES = [
    { id: 'aa', name: 'Воздух–воздух (сплит, мультисплит)', scop35: 3.5, defrost: true, ground: null },
    { id: 'aw', name: 'Воздух–вода (моноблок)', scop35: 3.8, defrost: true, ground: null },
    { id: 'bw_h', name: 'Грунтовый горизонтальный коллектор (B/W)', scop35: 4.6, defrost: false, ground: 'horizontal' },
    { id: 'bw_v', name: 'Грунтовый вертикальный зонд (B/W)', scop35: 4.7, defrost: false, ground: 'vertical' },
    { id: 'ww', name: 'Вода–вода (W/W)', scop35: 5.2, defrost: false, ground: 'water' },
    { id: 'hybrid', name: 'Гибрид (ТН + резервный котёл)', scop35: 3.8, defrost: true, ground: null }
  ];

  var GRAPHS = [
    { id: '35', name: '35/28 — тёплый пол', delta: 0 },
    { id: '45', name: '45/40 — низкотемпературные радиаторы', delta: -0.4 },
    { id: '55', name: '55/45 — обычные радиаторы', delta: -0.9 },
    { id: '75', name: '75/65 — старые радиаторы (не рекомендуется с ТН)', delta: -1.5 }
  ];

  var SOILS = [
    { id: 'sand_dry', name: 'Сухой песок', qh: 12, qv: 30 },
    { id: 'loam_dry', name: 'Сухой суглинок', qh: 17, qv: 35 },
    { id: 'loam_wet', name: 'Влажный суглинок', qh: 25, qv: 45 },
    { id: 'clay_wet', name: 'Водонасыщенная глина', qh: 35, qv: 55 },
    { id: 'rock', name: 'Скальные грунты', qh: 40, qv: 70 },
    { id: 'peat', name: 'Торф неосушенный', qh: 15, qv: 25 }
  ];

  /* k(t): доля номинальной мощности (паспорт A7/W35) при температуре воздуха t, кусочно-линейно
     по контрольным точкам источника (−7→0,75; −15→0,60; −25→0,50), 7°C принят за номинал (k=1). */
  var BIV_K = [[7, 1.0], [-7, 0.75], [-15, 0.60], [-25, 0.50]];
  function kAtTemp(t) {
    if (t >= BIV_K[0][0]) return BIV_K[0][1];
    if (t <= BIV_K[BIV_K.length - 1][0]) return BIV_K[BIV_K.length - 1][1];
    for (var i = 0; i < BIV_K.length - 1; i++) {
      var a = BIV_K[i], b = BIV_K[i + 1];
      if (t <= a[0] && t >= b[0]) return b[1] + (a[1] - b[1]) * (t - b[0]) / (a[0] - b[0]);
    }
    return BIV_K[BIV_K.length - 1][1];
  }

  function byId(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }

  /* ── Шаги 1–5 источника: теплопотери и годовое тепло (упрощённая методика ТКП 45-2.04-43) ── */
  function calcLoss(inp) {
    var region = byId(REGIONS, inp.regionId || 'minsk');
    var s = Number(inp.s), h = Number(inp.h) > 0 ? Number(inp.h) : 2.7;
    var wallArea = Number(inp.wallArea), wallR = Number(inp.wallR);
    var winArea = Number(inp.winArea) || 0, winR = Number(inp.winR) || 0.6;
    var doorArea = Number(inp.doorArea) || 0;
    var topR = Number(inp.topR), botR = Number(inp.botR);
    var airChange = Number(inp.airChange) > 0 ? Number(inp.airChange) : 0.6;
    var recupEff = Number(inp.recupEff) >= 0 ? Number(inp.recupEff) : 0;
    var occupants = Number(inp.occupants) > 0 ? Number(inp.occupants) : 4;
    var dhwPerPerson = Number(inp.dhwPerPerson) > 0 ? Number(inp.dhwPerPerson) : 40;
    var tGvs = Number(inp.tGvs) > 0 ? Number(inp.tGvs) : 55;
    var tCold = isFinite(Number(inp.tCold)) ? Number(inp.tCold) : 10;
    if (!region || !isFinite(s) || s <= 0 || !isFinite(wallArea) || wallArea < 0 || !(wallR > 0) || !(topR > 0) || !(botR > 0)) return null;

    var dt = TV - region.tn;
    var qTrW = (wallArea / wallR + winArea / winR + doorArea / 0.8) * dt * 1.0
      + (s / topR) * dt * 0.9
      + (s / botR) * dt * 0.6;
    var V = s * h;
    var qVentW = 0.335 * airChange * V * dt * (1 - recupEff);
    var qdKw = (qTrW + qVentW) / 1000;

    var qGodOt = qdKw * (TV - region.topcp) / dt * 24 * region.nop * KBYT; /* кВт·ч/год, метод ГСОП */
    var qGvs = occupants * dhwPerPerson * 4.19 * (tGvs - tCold) * 365 * 1.15 / 3600; /* кВт·ч/год */
    var totalHeat = qGodOt + qGvs;

    return {
      region: region, s: s, qdKw: qdKw, qTrW: qTrW, qVentW: qVentW,
      perM2: qdKw * 1000 / s, qGodOt: qGodOt, qGvs: qGvs, totalHeat: totalHeat
    };
  }

  /* ── Шаги 6–8, 10: тип ТН, SCOP, мощность в точке бивалентности, электропотребление, электрика ── */
  function calcPower(inp) {
    var type = byId(TYPES, inp.typeId), graph = byId(GRAPHS, inp.graphId || '35');
    var qdKw = Number(inp.qdKw), qGodOt = Number(inp.qGodOt) || 0, qGvs = Number(inp.qGvs) || 0;
    var premium = inp.equipClass === 'premium';
    var pNom = Number(inp.pNom) > 0 ? Number(inp.pNom) : (isFinite(qdKw) && qdKw > 0 ? qdKw * 1.25 : NaN);
    var bivalentT = isFinite(Number(inp.bivalentT)) ? Number(inp.bivalentT) : -15;
    if (!type || !graph || !isFinite(qdKw) || qdKw <= 0 || !isFinite(pNom) || pNom <= 0) return null;

    var base = type.scop35 + graph.delta + (premium ? 0.3 : -0.1);
    var scopOt = type.defrost ? base * 0.93 : base;
    if (scopOt < 1.3) scopOt = 1.3;
    var scopGvs = Math.max(1.1, scopOt - 0.6);

    var k = type.defrost ? kAtTemp(bivalentT) : 1.0; /* грунт/вода — источник стабильный, провала мощности в мороз нет */
    var pBiv = pNom * k;
    var ok = pBiv >= 0.8 * qdKw;
    var deficitPct = ok ? 0 : (1 - pBiv / qdKw) * 100;

    var welec = (qGodOt > 0 ? qGodOt / scopOt : 0) + (qGvs > 0 ? qGvs / scopGvs : 0);

    var line;
    if (pNom <= 3.5) line = '1 фаза, C16, кабель 3×2,5 мм²';
    else if (pNom <= 7) line = '1 фаза, C25, кабель 3×4 мм²';
    else line = '3 фазы 400 В, C16–C20, кабель 5×2,5 мм²';

    return {
      type: type, graph: graph, scopOt: scopOt, scopGvs: scopGvs,
      pNom: pNom, bivalentT: bivalentT, pBiv: pBiv, ok: ok, deficitPct: deficitPct,
      welec: welec, line: line
    };
  }

  /* ── Шаг 11 (без LCC и эскалации тарифов): сравнение годовой стоимости тепла по пяти источникам ── */
  function calcEconomics(inp) {
    var totalHeat = Number(inp.totalHeat), scopOt = Number(inp.scopOt);
    var tElec = Number(inp.tElec), tGas = Number(inp.tGas), tPellet = Number(inp.tPellet), tWood = Number(inp.tWood);
    if (!isFinite(totalHeat) || totalHeat <= 0 || !isFinite(scopOt) || scopOt <= 0) return null;
    var rows = [
      { id: 'hp', name: 'Тепловой насос (ваш SCOP)', cost: totalHeat / scopOt * tElec },
      { id: 'eb', name: 'Электрокотёл (КПД 99 %)', cost: totalHeat / 0.99 * tElec },
      { id: 'gas', name: 'Газовый котёл (КПД 92 %, 9,3 кВт·ч/м³)', cost: isFinite(tGas) ? totalHeat / (9.3 * 0.92) * tGas : NaN },
      { id: 'pellet', name: 'Пеллетный котёл (КПД 85 %, 4 800 кВт·ч/т)', cost: isFinite(tPellet) ? totalHeat / (4800 * 0.85) * (tPellet * 1000) : NaN },
      { id: 'wood', name: 'Дровяной котёл (КПД 75 %, 4 000 кВт·ч/т)', cost: isFinite(tWood) ? totalHeat / (4000 * 0.75) * tWood : NaN }
    ];
    var ebCost = rows[1].cost;
    rows.forEach(function (r) { r.savingsVsEb = isFinite(r.cost) ? (1 - r.cost / ebCost) * 100 : NaN; });
    return { totalHeat: totalHeat, rows: rows };
  }

  /* ── Шаг 9: грунтовый контур (площадь/длина — арифметика по формулам ТЗ, без автоподбора) ── */
  function calcGround(inp) {
    var soil = byId(SOILS, inp.soilId);
    var pTn = Number(inp.pTn), scop = Number(inp.scop);
    var siteArea = Number(inp.siteArea) || 0, boreDepth = Number(inp.boreDepth) > 0 ? Number(inp.boreDepth) : 80;
    var stepM = Number(inp.stepM) > 0 ? Number(inp.stepM) : 0.7;
    var linesM = Number(inp.linesM) || 20;
    if (!soil || !isFinite(pTn) || pTn <= 0 || !isFinite(scop) || scop <= 1) return null;

    var pOtbW = pTn * (1 - 1 / scop) * 1000; /* Вт, тепло, отбираемое из грунта/воды */

    var areaNeeded = pOtbW / soil.qh;
    var pipeLen = areaNeeded / stepM * 1.1;
    var siteOk = siteArea > 0 ? areaNeeded <= siteArea : null;

    var totalLen = pOtbW / soil.qv;
    var boreholes = Math.max(1, Math.ceil(totalLen / boreDepth));
    var glycolL = (totalLen * 1.06 + linesM * 0.6 + 10) * 1.15;
    var tankL = Math.max(15, glycolL * 0.15);

    var dT = 3; /* K, расчётный перепад для вода–вода */
    var gFlow = 0.86 * pOtbW / 1000 / dT; /* м³/ч */
    var minDebit = gFlow * 1.3;

    return {
      soil: soil, pOtbW: pOtbW,
      horizontal: { areaNeeded: areaNeeded, pipeLen: pipeLen, siteOk: siteOk },
      vertical: { totalLen: totalLen, boreholes: boreholes, perBore: totalLen / boreholes, glycolL: glycolL, tankL: tankL },
      water: { gFlow: gFlow, minDebit: minDebit }
    };
  }

  var api = {
    REGIONS: REGIONS, TYPES: TYPES, GRAPHS: GRAPHS, SOILS: SOILS,
    kAtTemp: kAtTemp, calcLoss: calcLoss, calcPower: calcPower, calcEconomics: calcEconomics, calcGround: calcGround
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TegaTN = api;
})(typeof window !== 'undefined' ? window : this);
