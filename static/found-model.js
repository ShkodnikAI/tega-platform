/* Модель расчёта фундамента (MVP: лента МЗЛФ + плита). Формулы и допущения описаны в статье «Фундаменты».
   Нормативная база: СН 2.01.01-2022 (нагрузки), СП 5.01.01-2023 (глубина и пучение), СП 5.03.01-2020 и
   ГОСТ 34028-2016 (армирование, защитные слои), НРР 6.03.01 (сборник 6, трудозатраты). Расчёт ориентировочный,
   не проект: ширину подошвы, несущую способность и осадку окончательно считает проектировщик.
   Работает и в браузере (window.TegaFound), и в Node (module.exports) для проверки. */
(function (root) {
  'use strict';

  /* Нормативная глубина промерзания dfn, м (Минск, СП 5.01.01-2023) */
  var DFN = { loam: 1.0, sandyloam: 1.19, sandmid: 1.27, coarse: 1.45 };
  /* Ориентир практики для расчётного сопротивления грунта R0, кПа: уточняет инженерно-геологические
     изыскания по СП 5.01.01-2023 / СП 22.13330.2016 (коэффициенты My, Mq, Mc) — это не табличное значение нормы. */
  var R0 = { loam: 220, sandyloam: 250, sandmid: 300, coarse: 450 };
  var SOIL_NAME = { loam: 'Суглинок', sandyloam: 'Супесь, мелкий песок', sandmid: 'Песок средний', coarse: 'Крупнообломочный' };
  /* Минимальная конструктивная ширина ленты по СП 5.01.01-2023, м */
  var WALL_MIN_B = { frame: 0.3, gas: 0.4, brick: 0.4 };
  /* Ориентир погонной постоянной+полезной+снеговой нагрузки на 1 этаж, кН/м стены (СН 2.01.01-2022, упрощённый сбор) */
  var FLOOR_LOAD = { frame: 11, gas: 16, brick: 20 };
  var SNOW_MINSK = 1.6; /* кПа, ориентир по СН 2.01.04-2025 */
  /* Сортамент арматуры: масса, кг/м (ГОСТ 34028-2016) */
  var REBAR = { 8: 0.395, 10: 0.617, 12: 0.888, 14: 1.21, 16: 1.58 };
  /* Классы бетона по элементу (ориентир) */
  var CONCRETE_CLASS = { lenta: 'В22,5 W6 F150', plita: 'В22,5 W6 F150', pad: 'В15 (подбетонка)' };
  /* Трудозатраты, ориентир практики НРР 6.03.01 (сб. 6, земляные сборники) */
  var LABOR = { excav: 0.95, formwork: 4.5, rebar: 17, concrete: 0.65 }; /* чел-ч/м3, чел-ч/м2, чел-ч/т, чел-ч/м3 */

  function ceil(x) { return Math.ceil(x - 1e-9); }
  function round2(x) { return Math.round(x * 1000) / 1000; }

  /* ───────── лента МЗЛФ ───────── */
  function calcLenta(c) {
    var w = [];
    function warn(level, text) { w.push({ level: level, text: text }); }
    var dfn = DFN[c.soil], R = isFinite(c.R) && c.R > 0 ? c.R : R0[c.soil];
    var bMin = WALL_MIN_B[c.wall] || 0.4;
    var floorLoad = isFinite(c.F) && c.F > 0 ? c.F : (FLOOR_LOAD[c.wall] || 16) * c.floors + 0.4 * SNOW_MINSK * (c.plan || 1);
    var F = floorLoad; /* кН/м, погонная */
    var h = isFinite(c.h) && c.h > 0 ? c.h : 0.6; /* высота сечения ленты, м */
    var gm = 20; /* кН/м3, средний вес фундамента с грунтом на обрезах */
    var bReq = F / (R - gm * h);
    var b = Math.max(bMin, Math.ceil(Math.max(bReq, 0) / 0.1) * 0.1);
    var perim = isFinite(c.perim) && c.perim > 0 ? c.perim : 2 * (c.L + c.W);
    var d = c.shallow ? Math.min(h, 0.6) : dfn; /* МЗЛФ: заглубление мельче dfn при утеплённом контуре */

    var concrete = perim * b * h * 1.02;
    var padW = isFinite(c.padW) && c.padW > 0 ? c.padW : round2(b + 0.3);
    var padH = isFinite(c.padH) && c.padH > 0 ? c.padH : 0.4;
    var pad = perim * padW * padH * 1.2;

    var nLong = c.nLong || 4, dLong = c.dLong || 12;
    var longLen = perim * nLong * 1.05;
    var longMass = longLen * (REBAR[dLong] || REBAR[12]);
    var dStirrup = c.dStirrup || 8, step = (c.step || 350) / 1000;
    var stirrupCount = ceil(perim / step) + 1;
    var cs = 0.05; /* защитный слой для оценки периметра хомута, ориентир */
    var stirrupLen = Math.max(0, 2 * ((b - 2 * cs) + (h - 2 * cs)));
    var stirrupTotalLen = stirrupCount * stirrupLen;
    var stirrupMass = stirrupTotalLen * (REBAR[dStirrup] || REBAR[8]);
    var steelMass = longMass + stirrupMass;

    var hVert = isFinite(c.hVert) && c.hVert > 0 ? c.hVert : 0.6;
    var otmW = isFinite(c.otmW) && c.otmW > 0 ? c.otmW : 1.0;
    var epsVert = perim * hVert;
    var epsOtm = perim * otmW;
    var epsTotal = (epsVert + epsOtm) * 1.05;

    var wrapCoef = isFinite(c.wrapCoef) && c.wrapCoef > 0 ? c.wrapCoef : round2(2 * padH + padW + 0.3);
    var geo = perim * wrapCoef;
    var film = perim * round2(padW + 0.35);
    var drainLen = c.drain === false ? 0 : perim * 0.85;

    var excavVol = perim * (padW + 0.2) * (padH + d) * 1.05;
    var formworkArea = perim * h * 2;
    var tRebar = steelMass / 1000 * LABOR.rebar;
    var tForm = formworkArea * LABOR.formwork;
    var tConcrete = concrete * LABOR.concrete;
    var tExcav = excavVol * LABOR.excav;
    var laborH = tExcav + tForm + tRebar + tConcrete;
    var crew = c.crew || 4;
    var days = laborH / (crew * 8);

    if (b > bMin + 1e-9 && bReq > bMin) { /* ширина определена нагрузкой, не конструктивным минимумом */ }
    if (R - gm * h <= 0) warn('red', 'При такой высоте сечения и расчётном сопротивлении грунта формула ширины не сходится: нужна геология и проверка проектировщика.');
    if (c.ugv > 0 && c.ugv < d + 0.5 - 1e-9) warn('yellow', 'Грунтовые воды ближе 0,5 м к подошве: нужен дренаж вдоль ленты (учтён в расчёте) и проверка гидроизоляции.');
    if (c.pucin && !c.shallow) warn('yellow', 'Пучинистый грунт: для МЗЛФ обычно закладывают ленту мельче dfn с терморазрывом ЭППС и дренажом — включите «мелкое заложение».');
    if (c.soil === 'coarse' && c.pucin) warn('yellow', 'Крупнообломочный грунт обычно непучинистый: проверьте тип грунта по изысканиям.');
    if (c.floors > 2) warn('yellow', 'Свыше 2 этажей — за границей применимости MVP (до 3 этажей без спецнагрузок), проверьте нагрузку индивидуально.');
    warn('info', 'Ширина подошвы дана по упрощённой формуле b ≥ F ÷ (R − 20·h); окончательно считает проектировщик по СП 5.01.01-2023 с коэффициентами несущей способности.');

    return {
      sys: 'lenta', dfn: dfn, R: R, F: F, b: b, bReq: bReq, h: h, d: d, perim: perim,
      concrete: concrete, concreteClass: CONCRETE_CLASS.lenta, padW: padW, padH: padH, pad: pad, padClass: CONCRETE_CLASS.pad,
      nLong: nLong, dLong: dLong, longLen: longLen, longMass: longMass,
      dStirrup: dStirrup, step: step * 1000, stirrupCount: stirrupCount, stirrupLen: stirrupLen, stirrupTotalLen: stirrupTotalLen, stirrupMass: stirrupMass,
      steelMass: steelMass, epsVert: epsVert, epsOtm: epsOtm, epsTotal: epsTotal, geo: geo, film: film, drainLen: drainLen,
      excavVol: excavVol, formworkArea: formworkArea, laborH: laborH, days: days, crew: crew, warns: w
    };
  }

  /* ───────── плита ───────── */
  function calcPlita(c) {
    var w = [];
    function warn(level, text) { w.push({ level: level, text: text }); }
    var S = c.L * c.W;
    var t = isFinite(c.t) && c.t > 0 ? c.t : 0.22; /* толщина плиты, м */
    var ribW = isFinite(c.ribW) && c.ribW > 0 ? c.ribW : 0.35, ribH = isFinite(c.ribH) && c.ribH > 0 ? c.ribH : 0.35;
    var ribLen = isFinite(c.ribLen) && c.ribLen > 0 ? c.ribLen : 2 * (c.L + c.W);
    var padW = 0, padH = isFinite(c.padH) && c.padH > 0 ? c.padH : 0.3;
    var slab = S * t * 1.02;
    var ribs = ribLen * ribW * Math.max(0, ribH - t) * 1.02;
    var concrete = slab + ribs;
    var pad = S * padH * 1.2;

    var dMesh = c.dMesh || 10, step = (c.step || 200) / 1000;
    var nX = ceil(c.W / step) + 1, nY = ceil(c.L / step) + 1;
    var gridLen = nX * c.L + nY * c.W;
    var longLen = gridLen * 2 * 1.05; /* две сетки */
    var steelMassGrids = longLen * (REBAR[dMesh] || REBAR[10]);
    var studStep = 0.4, studCount = ceil((2 * (c.L + c.W)) / studStep);
    var studLen = studCount * (t + 0.1);
    var studMass = studLen * (REBAR[dMesh] || REBAR[10]);
    var steelMass = steelMassGrids + studMass;
    var minAs = 0.001 * (t * 1000) * 1000; /* мм²/м, минимальный коэффициент армирования 0,1% сечения на метр ширины */
    var dEff = REBAR[dMesh] ? dMesh : 10;
    var asProvided = 2 * (Math.PI * dEff * dEff / 4) / step; /* мм²/м: 2 сетки (верх+низ), одно направление, step в метрах */

    var epsUnder = S * (isFinite(c.epsT) && c.epsT > 0 ? c.epsT : 0.2) === 0 ? 0 : S; /* площадь утепления под плитой = площадь плиты */
    var epsRibArea = ribLen * (isFinite(c.epsRibT) ? 0 : 0);
    var eps = S * 1.05;

    var excavVol = S * (t + padH + 0.1) * 1.05;
    var formworkArea = 2 * (c.L + c.W) * (t + ribH);
    var tRebar = steelMass / 1000 * LABOR.rebar;
    var tForm = formworkArea * LABOR.formwork;
    var tConcrete = concrete * LABOR.concrete;
    var tExcav = excavVol * LABOR.excav;
    var laborH = tExcav + tForm + tRebar + tConcrete;
    var crew = c.crew || 4;
    var days = laborH / (crew * 8);

    if (asProvided < minAs - 1e-6) warn('yellow', 'Шаг сетки даёт коэффициент армирования ниже 0,1 % сечения: уменьшите шаг или увеличьте диаметр.');
    if (c.ugv > 0 && c.ugv < 0.3) warn('yellow', 'Высокий уровень грунтовых вод у подошвы плиты: нужна гидроизоляция и проверка пучения.');
    if (t < 0.18 - 1e-9) warn('yellow', 'Толщина плиты меньше 180 мм — ниже типового диапазона 200–250 мм.');
    warn('info', 'Толщина, рёбра и армирование — ориентир практики (СП 5.01.05-2025, СП 5.03.01-2020); продавливание и осадку проверяет проектировщик.');

    return {
      sys: 'plita', S: S, t: t, ribW: ribW, ribH: ribH, ribLen: ribLen, slab: slab, ribs: ribs,
      concrete: concrete, concreteClass: CONCRETE_CLASS.plita, padH: padH, pad: pad, padClass: CONCRETE_CLASS.pad,
      dMesh: dMesh, step: step * 1000, nX: nX, nY: nY, gridLen: gridLen, longLen: longLen, steelMassGrids: steelMassGrids,
      studCount: studCount, studLen: studLen, studMass: studMass, steelMass: steelMass, minAs: minAs, asProvided: asProvided,
      eps: eps, excavVol: excavVol, formworkArea: formworkArea, laborH: laborH, days: days, crew: crew, warns: w
    };
  }

  function calc(c) {
    return c.sys === 'plita' ? calcPlita(c) : calcLenta(c);
  }

  var api = { calc: calc, calcLenta: calcLenta, calcPlita: calcPlita, DFN: DFN, R0: R0, SOIL_NAME: SOIL_NAME, REBAR: REBAR, WALL_MIN_B: WALL_MIN_B, FLOOR_LOAD: FLOOR_LOAD, LABOR: LABOR };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.TegaFound = api;
})(typeof window !== 'undefined' ? window : globalThis);
