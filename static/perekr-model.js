/* Модель облегчённого калькулятора перекрытий и покрытий: ориентировочный бюджет, вес и трудозатраты
   по семи системам перекрытий и семи системам покрытий из статьи «Перекрытия и покрытия верхних
   конструкций» (tools/estimates/art_perekr.py, Табл. 2–3, Рис. 5–8). Без автоматического подбора
   сечений, балок или стропил — пользователь сам выбирает систему, калькулятор умножает площадь на
   справочные показатели. Формула теплопотерь (24×ГСОП/R) та же, что в статье (Табл. 9), и совпадает
   с ней на всех контрольных значениях.
   Работает и в браузере (window.TegaPerekr), и в Node (module.exports) для проверки. */
(function (root) {
  'use strict';

  var NORM_R = { pokrytie: 4.0, cherdak: 3.0, podval: 2.5 }; /* ТКП 45-2.04-43, табл. 5.1 */

  var PEREKRYTIE = [
    { id: 'derevo', name: 'Деревянные балки (3–5 м)', weight: 45, labor: 1.2, budget: 80 },
    { id: 'ijoist', name: 'Двутавры I-joist (3–8 м)', weight: 38, labor: 0.9, budget: 105 },
    { id: 'pkpb', name: 'Сборные плиты ПК/ПБ (3–9, до 12 м)', weight: 375, labor: 0.9, budget: 105 },
    { id: 'sb_monolit', name: 'Сборно-монолитное по балкам (5–9 м)', weight: 275, labor: 1.6, budget: 120 },
    { id: 'chasto', name: 'Часторебристое из термоблоков (4,5–6 м)', weight: 200, labor: 1.9, budget: 125 },
    { id: 'metall', name: 'Металлические балки (6–10 м)', weight: 175, labor: 1.4, budget: 135 },
    { id: 'monolit', name: 'Монолитная плита (4–9 м)', weight: 515, labor: 4.0, budget: 160 }
  ];

  var POKRYTIE = [
    { id: 'ondulin', name: 'Ондулин (битумный лист)', minUklon: 10, uklonUnit: 'deg', weight: 3.5, labor: 0.4, budget: 90 },
    { id: 'gibkaya', name: 'Гибкая битумная черепица', minUklon: 12, uklonUnit: 'deg', weight: 10, labor: 0.8, budget: 145 },
    { id: 'metallocherepica', name: 'Металлочерепица', minUklon: 14, uklonUnit: 'deg', weight: 5.25, labor: 0.6, budget: 159 },
    { id: 'membrana', name: 'Мембрана ПВХ/ТПО (плоская, неэксплуатируемая)', minUklon: 1.5, uklonUnit: 'pct', weight: 2.25, labor: 1.15, budget: 160 },
    { id: 'falc', name: 'Фальц двойной стоячий', minUklon: 7, uklonUnit: 'deg', weight: 4.5, labor: 0.7, budget: 170 },
    { id: 'inversionnaya', name: 'Плоская инверсионная / эксплуатируемая', minUklon: 1.5, uklonUnit: 'pct', weight: null, labor: 1.15, budget: 190 },
    { id: 'keramika', name: 'Керамическая (или цементно-песчаная) черепица', minUklon: 22, minUklonSpecial: 16, uklonUnit: 'deg', weight: 45, labor: 1.1, budget: 225 }
  ];

  var REGIONS = [
    { id: 'minsk', name: 'Минск', gsop: 4360 },
    { id: 'brest', name: 'Брест', gsop: 3707 },
    { id: 'gomel', name: 'Гомель', gsop: 4156 },
    { id: 'grodno', name: 'Гродно', gsop: 4096 },
    { id: 'vitebsk', name: 'Витебск', gsop: 4641 },
    { id: 'mogilev', name: 'Могилёв', gsop: 4510 }
  ];

  function find(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }

  /* перекрытие: { sysId, area, crew } */
  function calcPerekrytie(input) {
    var sys = find(PEREKRYTIE, input.sysId);
    var area = Number(input.area), crew = Number(input.crew) > 0 ? Number(input.crew) : 3;
    if (!sys || !isFinite(area) || area <= 0) return null;
    var laborTotal = area * sys.labor;
    return {
      sys: sys, area: area, crew: crew,
      weightTotal: area * sys.weight,
      budgetTotal: area * sys.budget, budgetPerM2: sys.budget,
      laborTotal: laborTotal, days: laborTotal / (crew * 8)
    };
  }

  /* покрытие: { sysId, area, uklon (в единицах системы: градусы или %), crew } */
  function calcPokrytie(input) {
    var sys = find(POKRYTIE, input.sysId);
    var area = Number(input.area), crew = Number(input.crew) > 0 ? Number(input.crew) : 3;
    if (!sys || !isFinite(area) || area <= 0) return null;
    var uklon = Number(input.uklon);
    var minOk = sys.minUklon, uklonOk = null;
    if (isFinite(uklon)) {
      uklonOk = uklon >= sys.minUklon;
      if (!uklonOk && sys.minUklonSpecial != null && uklon >= sys.minUklonSpecial) uklonOk = 'special';
    }
    var laborTotal = area * sys.labor;
    return {
      sys: sys, area: area, crew: crew, uklon: isFinite(uklon) ? uklon : null, uklonOk: uklonOk,
      weightTotal: sys.weight == null ? null : area * sys.weight,
      budgetTotal: area * sys.budget, budgetPerM2: sys.budget,
      laborTotal: laborTotal, days: laborTotal / (crew * 8)
    };
  }

  /* тепловые потери: { regionId, r, area, normKey } -> потери за сезон/30 лет, 24×ГСОП/R (Табл.9 статьи) */
  function calcHeatLoss(input) {
    var region = find(REGIONS, input.regionId || 'minsk');
    var r = Number(input.r), area = Number(input.area) > 0 ? Number(input.area) : 1;
    if (!region || !isFinite(r) || r <= 0) return null;
    var norm = NORM_R[input.normKey] || NORM_R.cherdak;
    var perM2 = 24 * region.gsop / r / 1000;
    return {
      region: region, r: r, area: area, norm: norm,
      perM2Season: perM2, totalSeason: perM2 * area, total30y: perM2 * area * 30,
      normRatio: r / norm
    };
  }

  var api = {
    PEREKRYTIE: PEREKRYTIE, POKRYTIE: POKRYTIE, REGIONS: REGIONS, NORM_R: NORM_R,
    calcPerekrytie: calcPerekrytie, calcPokrytie: calcPokrytie, calcHeatLoss: calcHeatLoss
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TegaPerekr = api;
})(typeof window !== 'undefined' ? window : this);
