/* Модель облегчённого калькулятора стен: ориентировочный бюджет, трудозатраты и теплопотери
   по семи (восьми) системам из статьи «Стены и ограждающие конструкции» (tools/estimates/art_sten.py,
   Табл. 4.8). Без автоматического подбора сечений и конструктива — только умножение площади на
   справочные показатели системы, которую выбирает сам пользователь. Формула теплопотерь (24×ГСОП/R0)
   та же, что в статье, и проверена там на четырёх контрольных значениях.
   Работает и в браузере (window.TegaSten), и в Node (module.exports) для проверки. */
(function (root) {
  'use strict';

  var NORM_R0 = 2.8; /* норматив РБ для стен жилых зданий, ТКП 45-2.04-43 */

  var SYSTEMS = [
    { id: 'gas1', name: 'Газобетон однослойный (375 мм)', r0: 3.2, labor: 2.1, budget: 128 },
    { id: 'gas_sftk', name: 'Газобетон 300 + СФТК (вата 150)', r0: 5.5, labor: 2.6, budget: 180 },
    { id: 'brick3', name: 'Кирпич трёхслойный (250 + вата 120 + облиц. 120)', r0: 3.6, labor: 4.5, budget: 242 },
    { id: 'keramoblok', name: 'Керамоблок 440 (однослойная керамика)', r0: 3.4, labor: 1.9, budget: 178 },
    { id: 'karkas', name: 'Каркасная 200 (стойка + вата 200)', r0: 5.2, labor: 2.7, budget: 170 },
    { id: 'sip', name: 'СИП-панель 174 (OSB 12 + ППС 150 + OSB 12)', r0: 4.4, labor: 1.5, budget: 146 },
    { id: 'brus', name: 'Брус 200 + вентфасад (вата 100 мм)', r0: 3.6, labor: 2.9, budget: 186 },
    { id: 'nvf', name: 'Монолит 200 + НВФ (вата 150)', r0: 4.6, labor: 2.9, budget: 248 }
  ];

  var REGIONS = [
    { id: 'minsk', name: 'Минск', gsop: 4360 },
    { id: 'brest', name: 'Брест', gsop: 3707 },
    { id: 'gomel', name: 'Гомель', gsop: 4156 },
    { id: 'grodno', name: 'Гродно', gsop: 4096 },
    { id: 'vitebsk', name: 'Витебск', gsop: 4641 },
    { id: 'mogilev', name: 'Могилёв', gsop: 4510 }
  ];

  function bySystem(id) { for (var i = 0; i < SYSTEMS.length; i++) if (SYSTEMS[i].id === id) return SYSTEMS[i]; return null; }
  function byRegion(id) { for (var i = 0; i < REGIONS.length; i++) if (REGIONS[i].id === id) return REGIONS[i]; return null; }

  /* input: { sysId, regionId, area, crew } -> результат или null, если входные данные некорректны */
  function calc(input) {
    var sys = bySystem(input.sysId), region = byRegion(input.regionId || 'minsk');
    var area = Number(input.area), crew = Number(input.crew) > 0 ? Number(input.crew) : 3;
    if (!sys || !region || !isFinite(area) || area <= 0) return null;

    var budgetTotal = area * sys.budget;
    var laborTotal = area * sys.labor;
    var days = laborTotal / (crew * 8);
    var heatPerM2 = 24 * region.gsop / sys.r0 / 1000; /* кВт·ч/м² за сезон */
    var heatTotalSeason = heatPerM2 * area;
    var heatTotal30y = heatTotalSeason * 30;
    var normRatio = sys.r0 / NORM_R0;

    return {
      sys: sys, region: region, area: area, crew: crew,
      budgetTotal: budgetTotal, budgetPerM2: sys.budget,
      laborTotal: laborTotal, days: days,
      r0: sys.r0, normRatio: normRatio, passesNorm: sys.r0 >= NORM_R0,
      heatPerM2: heatPerM2, heatTotalSeason: heatTotalSeason, heatTotal30y: heatTotal30y
    };
  }

  var api = { SYSTEMS: SYSTEMS, REGIONS: REGIONS, NORM_R0: NORM_R0, calc: calc };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TegaSten = api;
})(typeof window !== 'undefined' ? window : this);
