/* Модель расчёта малой ветроустановки: ветер на ступице, распределение Вейбулла, кривая мощности, годовая выработка и КИУМ,
   ротор, мачта и зоны, электрика, АКБ, экономика. Формулы и ориентиры практики описаны в статье «Ветрогенераторы».
   Расчёт ориентировочный, не проект. Работает и в браузере (window.TegaWind), и в Node (module.exports) для проверки. */
(function (root) {
  'use strict';

  var RHO = 1.225;
  var TYPES = {
    hawt: { name: 'Горизонтальная, 3 лопасти', cp: 0.38, vci: 3, noise: 45 },
    darrieus: { name: 'Вертикальная Дарье', cp: 0.30, vci: 4, noise: 40 },
    savonius: { name: 'Савониуса (роторная)', cp: 0.18, vci: 2, noise: 38 }
  };
  var MAST = { guy: { name: 'Трубчатая на оттяжках', lo: 12, hi: 24 }, free: { name: 'Свободностоящая башня', lo: 18, hi: 30 }, tilt: { name: 'Фермовая откидная', lo: 10, hi: 16 }, roof: { name: 'Крыша или фасад', lo: 0, hi: 0 } };
  var SECTIONS = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95];
  var INV = [1, 1.5, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20];
  var PV_YIELD = 1030;               /* кВт·ч с 1 кВтп в год: типовая крыша 35° на юг, Минск, модель калькулятора солнечных систем */
  var RHO_CU = 0.0175;               /* Ом·мм²/м */

  function gamma(z) {
    /* приближение Ланцоша */
    var g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
    z -= 1; var x = c[0], t = z + g + 0.5;
    for (var i = 1; i < g + 2; i++) x += c[i] / (z + i);
    return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
  }
  function weibullScale(vmean, k) { return vmean / gamma(1 + 1 / k); }
  function weibullPdf(v, k, c) { return v <= 0 ? 0 : (k / c) * Math.pow(v / c, k - 1) * Math.exp(-Math.pow(v / c, k)); }
  function power(v, o) {
    if (v < o.vci || v > o.vco) return 0;
    if (v >= o.vr) return o.Pr;
    return o.Pr * (v * v * v - o.vci * o.vci * o.vci) / (o.vr * o.vr * o.vr - o.vci * o.vci * o.vci);
  }
  /* средняя мощность и КИУМ по Вейбуллу: интегрирование с шагом 0,05 м/с */
  function meanPower(vmean, k, o) {
    var c = weibullScale(vmean, k), s = 0, dv = 0.05;
    for (var v = dv / 2; v < 45; v += dv) s += power(v, o) * weibullPdf(v, k, c) * dv;
    return s;
  }
  function pick(ladder, x) { for (var i = 0; i < ladder.length; i++) if (ladder[i] >= x - 1e-9) return ladder[i]; return ladder[ladder.length - 1]; }
  function fixed(x, d) { return Math.round(x * Math.pow(10, d)) / Math.pow(10, d); }
  function comma(x) { return String(x).replace('.', ','); }

  function calc(c) {
    var t = TYPES[c.type], warns = [], r = {};
    var red = function (s) { warns.push({ level: 'red', text: s }); };
    var yel = function (s) { warns.push({ level: 'yellow', text: s }); };
    var o = { Pr: c.Pr, vr: c.vr, vci: c.vci, vco: c.vco };

    /* ветер на ступице */
    r.vHub = c.v10 * Math.pow(c.hub / c.h0, c.alpha);
    r.scale = weibullScale(r.vHub, c.k);
    r.Pmean = power(r.vHub, o);                                 /* мощность при средней скорости */
    r.P55 = power(5.5, o);
    r.cube = Math.pow(2, 3);

    /* ротор по номиналу: A = P / (0,5 · ρ · v³ · Cp) */
    r.A = c.Pr * 1000 / (0.5 * RHO * Math.pow(c.vr, 3) * t.cp);
    r.D = 2 * Math.sqrt(r.A / Math.PI);
    r.R = r.D / 2;

    /* помеха от препятствий */
    r.lowTip = c.hub - r.R;
    r.needHub = c.obstH + 3 + r.R;
    r.wake = (c.obstDist <= 150 && r.lowTip < c.obstH + 3 - 1e-9);
    r.wakeK = r.wake ? 0.7 : 1;

    /* выработка */
    var pm = meanPower(r.vHub, c.k, o);
    r.eGross = pm * 8760;
    r.eNet = r.eGross * (c.eff / 100) * r.wakeK;
    r.cf = r.eNet / (c.Pr * 8760);
    r.cfGross = pm / c.Pr;
    r.perM2 = r.eNet / r.A;
    r.kwhDay = r.eNet / 365;
    r.pvKw = r.eNet / PV_YIELD;
    r.idle = 1 - (function () { var s = 0, dv = 0.05, cc = r.scale; for (var v = dv / 2; v < 45; v += dv) if (v >= c.vci && v <= c.vco) s += weibullPdf(v, c.k, cc) * dv; return s; })();   /* доля времени без выработки */

    /* площадка и мачта */
    r.fall = c.hub + r.R;
    r.ice = 1.5 * (c.hub + r.D);
    var m = MAST[c.mount];
    r.mast = m;
    r.noise = t.noise - 20 * Math.log(c.windowDist / 15) / Math.LN10;

    /* электрика */
    r.ctrl = c.Pr * 1.2;
    r.ballast = c.Pr;
    r.I = c.Pr * 1000 / c.dcV;
    r.dcS = pick(SECTIONS, 2 * c.dcLen * r.I * RHO_CU / (0.03 * c.dcV));
    r.dcLoss = r.I * 2 * c.dcLen * RHO_CU / (r.dcS * c.dcV);
    r.dcNeed = 2 * c.dcLen * r.I * RHO_CU / (0.03 * c.dcV);
    r.daily = c.consumption / 365;
    r.batt = c.mode === 'off' ? r.daily * c.autonomy / (0.8 * 0.9) : 0;
    r.inv = c.mode === 'off' ? pick(INV, c.peak * 1.2) : pick(INV, c.Pr);
    r.cover = r.eNet / c.consumption;

    /* экономика */
    if (c.mode === 'grid') {
      r.eSelf = Math.min(r.eNet * c.self / 100, c.consumption);
      r.eExport = r.eNet - r.eSelf;
      r.saving = r.eSelf * c.tariff + r.eExport * c.buyout;
      r.payback = c.cost > 0 && r.saving > 0 ? c.cost / r.saving : NaN;
      r.lcoe = c.cost > 0 ? c.cost / (r.eNet * 20) : NaN;
    }

    /* вердикт по правилу ступицы */
    r.verdict = r.vHub < 4.5 ? 'solar' : r.vHub <= 6 ? 'hybrid' : 'wind';

    /* предупреждения */
    if (c.mount === 'roof') red('Крыша и фасад для ВЭУ не применяются: турбулентность, вибрации в конструкциях и шум в доме. Нужна отдельная мачта на открытой точке участка.');
    if (isFinite(c.boundary) && r.fall > c.boundary + 1e-9) red('Зона падения мачты с ротором равна ' + comma(fixed(r.fall, 0)) + ' м и выходит за границу участка (до границы ' + comma(c.boundary) + ' м): она должна целиком лежать на своём участке.');
    if (c.mount !== 'roof' && c.hub > 0 && (c.hub < m.lo - 1e-9 || c.hub > m.hi + 1e-9)) yel('Для типа «' + m.name + '» типичные высоты ' + m.lo + '–' + m.hi + ' м, а у вас ' + comma(c.hub) + ' м: выбор типа мачты и расчёт фундамента делает проектировщик.');
    if (c.hub > 30) yel('Мачта выше 30 м: уточните согласования по высоте и маркировку в местных органах и у владельца аэродромных зон.');
    if (r.wake) yel('Препятствие высотой ' + comma(c.obstH) + ' м на расстоянии ' + comma(c.obstDist) + ' м создаёт ветровую тень: нижняя точка ротора ' + comma(fixed(r.lowTip, 1)) + ' м, нужна не ниже ' + comma(fixed(c.obstH + 3, 1)) + ' м (ступица около ' + comma(fixed(r.needHub, 0)) + ' м). В расчёт заложено снижение выработки на 30 %, это нижняя граница потерь по публикациям.');
    if (isFinite(c.windowDist) && c.windowDist < 30) yel('До окон ' + comma(c.windowDist) + ' м: по практике держат 30–50 м из-за шума и мерцания тени от лопастей.');
    if (isFinite(c.windowDist) && r.noise > 45) yel('Оценка шума у окон ' + comma(fixed(r.noise, 0)) + ' дБА выше справочного ночного ориентира 45 дБА (территория у жилых домов, постановление Минздрава № 115 от 2011 года). Модель грубая, нужен шумовой расчёт по паспорту.');
    if (r.ice > c.boundary + 1e-9) yel('Сход льда с ротора зимой опасен дальше зоны падения: по зарубежным руководствам ориентир 1,5 · (H + D) = ' + comma(fixed(r.ice, 0)) + ' м. Предусмотрите стоп при обледенении и ограждение зоны.');
    if (r.vHub < 4.5) yel('Средний ветер на ступице ' + comma(fixed(r.vHub, 1)) + ' м/с ниже 4,5 м/с: по практике выгоднее солнечные панели, ветряк оправдан только в гибриде или на автономном объекте.');
    if (c.type === 'savonius') yel('Роторные установки Савониуса для выработки киловатт-часов неэффективны: коэффициент использования около 0,15–0,2, ротор получается очень большим.');
    if (c.type === 'darrieus') yel('Вертикальные установки Дарье тише и работают в рваном потоке, но при равной мощности ротор больше, а выработка по публикациям на четверть-треть ниже горизонтальных.');
    if (c.mode === 'grid' && c.Pr > 15) yel('Микрогенерация для физлица около 15 кВт (закон № 204-З о возобновляемых источниках энергии, лимит и условия уточняйте в энергоснабжающей организации). Мощность выше требует другого статуса.');
    if (c.mode === 'grid') yel('Подключение, двунаправленный счётчик и договор оформляются до пуска, излишки выкупаются по условиям энергоснабжающей организации.');
    if (c.mode === 'off' && c.autonomy < 2) yel('Автономность АКБ меньше 2 суток: зимой безветрие бывает дольше, закладывайте 2–3 суток и гибрид с солнцем или генератором.');
    if (r.dcNeed > 35 && c.dcLen > 0) yel('Для потерь не более 3 % при ' + c.dcV + ' В и ' + comma(c.dcLen) + ' м требуется ' + comma(fixed(r.dcNeed, 0)) + ' мм² меди: поднимите напряжение или ставьте контроллер у подножия мачты.');
    if (c.dcLen > 0 && r.dcLoss * 100 > 5) yel('Потери в DC-спуске ' + comma(fixed(r.dcLoss * 100, 0)) + ' %: слишком много.');
    r.warns = warns;
    return r;
  }

  var api = { calc: calc, power: power, meanPower: meanPower, weibullScale: weibullScale, weibullPdf: weibullPdf, gamma: gamma, TYPES: TYPES, MAST: MAST, SECTIONS: SECTIONS, INV: INV, PV_YIELD: PV_YIELD, RHO: RHO };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.TegaWind = api;
})(typeof window !== 'undefined' ? window : globalThis);
