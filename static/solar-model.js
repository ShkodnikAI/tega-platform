/* Солнечная генерация: расчётная модель (Минск, 53,9° с. ш.).
   Ориентировочный почасовой расчёт: выработка по ориентациям, режим накопителя, деньги, подбор оборудования.
   Не заменяет проект. Работает и в браузере (window.TegaSolar), и в Node (module.exports) для проверки. */
(function (root) {
  'use strict';
  var LAT = 53.9, GSC = 1.367, RAD = Math.PI / 180;
  // Климат Минска: суммарная радиация на горизонтальную поверхность, кВт·ч/м² за месяц (годовая около 1020, по данным БГУ 1984–2008).
  var MON_H = [17, 33, 77, 116, 160, 170, 168, 140, 90, 47, 19, 12].map(function (x) { return x * 1020 / 1049; });
  var DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  var NREP = [17, 47, 75, 105, 135, 162, 198, 228, 258, 288, 318, 344];
  var TAMB = [-4.4, -3.7, 0.6, 8.0, 14.1, 17.4, 19.3, 18.2, 12.8, 7.0, 1.4, -2.5];
  var ALB = [0.6, 0.6, 0.4, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.3, 0.5];
  var SNOW = [0.35, 0.2, 0.05, 0, 0, 0, 0, 0, 0, 0, 0.05, 0.3];
  var MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  // три типа дня: ясный, средний, пасмурный (доли дней и множители индекса ясности; потом нормируются на месячную сумму)
  var DT_W = [0.25, 0.45, 0.30], DT_M = [1.5, 1.12, 0.39];

  var MODULES = {
    m450: { name: 'Моно 450 Вт (PERC, 108 п/я)', p: 450, voc: 37.4, vmp: 31.3, isc: 15.2, imp: 14.4, tp: -0.0035, tv: -0.0027, bif: 0, area: 2.0, w: 1.134, l: 1.762 },
    m550: { name: 'TOPCon 550 Вт (144 п/я)', p: 550, voc: 49.9, vmp: 41.9, isc: 13.9, imp: 13.1, tp: -0.0030, tv: -0.0025, bif: 0, area: 2.58, w: 1.134, l: 2.278 },
    b580: { name: 'TOPCon bifacial 580 Вт (двусторонний)', p: 580, voc: 52.0, vmp: 43.4, isc: 14.0, imp: 13.4, tp: -0.0029, tv: -0.0025, bif: 0.7, area: 2.58, w: 1.134, l: 2.278 },
    custom: { name: 'Свой модуль', p: 600, voc: 51.5, vmp: 43.2, isc: 14.9, imp: 13.9, tp: -0.0030, tv: -0.0025, bif: 0, area: 2.7, w: 1.134, l: 2.382 }
  };

  var PROFILES = {
    evening: { name: 'Вечерний дом (работа вне дома)', h: [2, 1.5, 1.3, 1.3, 1.4, 2, 4.5, 6, 4, 2.5, 2.2, 2.4, 2.8, 2.6, 2.4, 2.6, 3.5, 6, 8.5, 9.5, 8.5, 6.5, 4.5, 3] },
    home: { name: 'Дом днём (удалёнка, семья дома)', h: [1.8, 1.4, 1.3, 1.3, 1.4, 1.8, 3.5, 5.5, 5.5, 5, 5, 5.5, 6, 5.5, 5, 5, 5.5, 6.5, 7, 7, 6, 4.5, 3.5, 2.5] },
    day: { name: 'Дневное хозяйство (СТО, ферма, мастерская)', h: [1, 1, 1, 1, 1, 1.5, 3, 6, 9, 10.5, 10.5, 10, 8, 10, 10.5, 10, 8.5, 5.5, 3, 2, 1.5, 1.2, 1, 1] },
    flat: { name: 'Ровная нагрузка (котельная, насосы, холод)', h: [4, 4, 4, 4, 4, 4, 4.2, 4.3, 4.3, 4.3, 4.3, 4.3, 4.3, 4.3, 4.3, 4.3, 4.3, 4.4, 4.4, 4.4, 4.3, 4.2, 4.1, 4] }
  };
  var SEASONS = {
    usual: { name: 'Обычный дом', m: [1.18, 1.12, 1.05, 0.97, 0.92, 0.88, 0.86, 0.86, 0.92, 1.0, 1.1, 1.18] },
    heat: { name: 'Электроотопление или тепловой насос', m: [1.9, 1.7, 1.4, 0.9, 0.5, 0.35, 0.3, 0.3, 0.5, 0.9, 1.4, 1.8] },
    flat: { name: 'Ровно по году', m: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] }
  };
  // Тарифы для населения с 01.03.2026, BYN/кВт·ч (Постановление Совмина от 25.02.2026 № 93)
  var TARIFFS = {
    a: { name: 'Жильё с электроплитой, без газа', one: 0.2581, two: [0.1807, 0.5162], three: [0.1549, 0.1807, 0.4646] },
    b: { name: 'Все остальные случаи', one: 0.3037, two: [0.2126, 0.6074], three: [0.1822, 0.2126, 0.5467] }
  };

  function norm(a) { var s = a.reduce(function (x, y) { return x + y; }, 0); return a.map(function (v) { return v / s; }); }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function sinD(x) { return Math.sin(x * RAD); }
  function cosD(x) { return Math.cos(x * RAD); }

  /* ───────── солнечная геометрия и разложение радиации ───────── */
  function dayGeom(m) {
    var n = NREP[m], dec = 23.45 * sinD(360 * (284 + n) / 365), e0 = 1 + 0.033 * cosD(360 * n / 365);
    var ws = Math.acos(clamp(-Math.tan(LAT * RAD) * Math.tan(dec * RAD), -1, 1)) / RAD;
    var h0 = 24 / Math.PI * GSC * e0 * (cosD(LAT) * cosD(dec) * sinD(ws) + Math.PI * ws / 180 * sinD(LAT) * sinD(dec));
    return { dec: dec, e0: e0, ws: ws, h0: h0 };
  }
  function erbs(kt, ws) {
    var r = ws <= 81.4 ? 1.391 - 3.560 * kt + 4.189 * kt * kt - 2.137 * kt * kt * kt : 1.311 - 3.022 * kt + 3.427 * kt * kt - 1.821 * kt * kt * kt;
    return clamp(r, 0.12, 1);
  }
  // индексы ясности трёх типов дня с сохранением месячной суммы
  function dayKt(m) {
    var g = dayGeom(m), kt = MON_H[m] / DAYS[m] / g.h0, k = DT_M.map(function (x) { return x * kt; });
    for (var it = 0; it < 6; it++) {
      k = k.map(function (x) { return Math.min(x, 0.78); });
      var mean = k.reduce(function (s, x, i) { return s + x * DT_W[i]; }, 0);
      k = k.map(function (x) { return x * kt / mean; });
    }
    return k.map(function (x) { return Math.min(x, 0.8); });
  }
  // почасовая радиация на горизонтали: I, Id (кВт/м² в среднем за час), cosz
  function hourly(m, ktDay) {
    var g = dayGeom(m), H = ktDay * g.h0, Hd = H * erbs(ktDay, g.ws), out = [];
    var a = 0.409 + 0.5016 * sinD(g.ws - 60), b = 0.6609 - 0.4767 * sinD(g.ws - 60);
    var den = sinD(g.ws) - Math.PI * g.ws / 180 * cosD(g.ws);
    for (var h = 0; h < 24; h++) {
      var w = 15 * (h + 0.5 - 12), cz = sinD(LAT) * sinD(g.dec) + cosD(LAT) * cosD(g.dec) * cosD(w);
      if (cz <= 0.01 || Math.abs(w) >= g.ws) { out.push({ I: 0, Id: 0, cz: Math.max(cz, 0), w: w, dec: g.dec, i0: 0 }); continue; }
      var rt = Math.PI / 24 * (a + b * cosD(w)) * (cosD(w) - cosD(g.ws)) / den;
      var rd = Math.PI / 24 * (cosD(w) - cosD(g.ws)) / den;
      var I = Math.max(0, rt * H), Id = Math.min(I, Math.max(0, rd * Hd));
      out.push({ I: I, Id: Id, cz: cz, w: w, dec: g.dec, i0: GSC * g.e0 * cz });
    }
    return out;
  }
  // облучённость наклонной плоскости (Hay–Davies), кВт/м²; beta — наклон, gam — азимут плоскости (0 юг, + на запад).
  // С потерями на отражение от стекла (IAM): прямая по ASHRAE b0 = 0,05, рассеянная и отражённая от земли около 0,93.
  function tilted(r, beta, gam, rho) {
    if (r.I <= 0) return 0;
    var d = r.dec;
    var ct = sinD(d) * sinD(LAT) * cosD(beta) - sinD(d) * cosD(LAT) * sinD(beta) * cosD(gam) +
      cosD(d) * cosD(LAT) * cosD(beta) * cosD(r.w) + cosD(d) * sinD(LAT) * sinD(beta) * cosD(gam) * cosD(r.w) +
      cosD(d) * sinD(beta) * sinD(gam) * sinD(r.w);
    var Ib = r.I - r.Id, Ai = r.i0 > 0 ? Math.min(Ib / r.i0, 1) : 0, Rb = Math.max(0, ct) / Math.max(r.cz, 0.087);
    Rb = Math.min(Rb, 8);
    var iam = ct > 0.02 ? Math.max(0, 1 - 0.05 * (1 / ct - 1)) : 0;
    return (Ib + r.Id * Ai) * Rb * iam + (r.Id * (1 - Ai) * (1 + cosD(beta)) / 2 + r.I * rho * (1 - cosD(beta)) / 2) * 0.93;
  }

  var _hCache = null;
  function hourlyAll() {
    if (_hCache) return _hCache;
    _hCache = [];
    for (var m = 0; m < 12; m++) { var kt = dayKt(m); _hCache.push(kt.map(function (k) { return hourly(m, k); })); }
    return _hCache;
  }

  /* ───────── выработка массива: [месяц][тип дня][час] -> кВт постоянного тока ───────── */
  function arrayDC(ar, opt) {
    var mod = MODULES[ar.type], res = [], H = hourlyAll();
    var kF = ar.tight ? 0.045 : 0.030, pk = ar.n * mod.p / 1000;
    var dcLoss = 1 - (opt.dcLoss || 0.03), shade = 1 - (opt.shade || 0);
    for (var m = 0; m < 12; m++) {
      var row = [];
      var snow = SNOW[m] * clamp((60 - ar.tilt) / 40, 0, 1);
      for (var j = 0; j < 3; j++) {
        var hh = [];
        for (var h = 0; h < 24; h++) {
          var r = H[m][j][h];
          var gf = tilted(r, ar.tilt, ar.az, ALB[m]);
          var gr = mod.bif ? tilted(r, 180 - ar.tilt, ar.az + 180, ALB[m]) * mod.bif * 0.85 : 0;
          var g = gf * (1 - snow) + gr;
          var tc = TAMB[m] + kF * 1000 * gf;
          var p = pk * g * (1 + mod.tp * (tc - 25)) * 0.98 * 0.985 * dcLoss * shade;
          hh.push(Math.max(0, p));
        }
        row.push(hh);
      }
      res.push(row);
    }
    return res;
  }
  function planeKwh(ar) { // облучённость плоскости за год, кВт·ч/м² (для справки)
    var H = hourlyAll(), s = 0;
    for (var m = 0; m < 12; m++) for (var j = 0; j < 3; j++) for (var h = 0; h < 24; h++) s += tilted(H[m][j][h], ar.tilt, ar.az, ALB[m]) * DT_W[j] * DAYS[m];
    return s;
  }

  /* ───────── нагрузка и тариф ───────── */
  function loadShape(profile, shift) {
    var s = norm(PROFILES[profile].h.slice());
    if (shift > 0) {
      var moved = 0, i;
      for (i = 17; i <= 22; i++) { var d = s[i] * shift; s[i] -= d; moved += d; }
      for (i = 10; i <= 15; i++) s[i] += moved / 6;
    }
    return s;
  }
  function priceAt(sch, tar, h, weekend) {
    var t = TARIFFS[tar];
    if (sch === 'one') return t.one;
    if (sch === 'two') return (!weekend && h >= 17 && h <= 21) ? t.two[1] : t.two[0];
    if (h >= 23 || h < 6) return t.three[0];
    if (!weekend && h >= 17 && h <= 22) return t.three[2];
    return t.three[1];
  }

  /* ───────── годовой расчёт ───────── */
  function simulate(cfg) {
    var arrs = cfg.arrays.filter(function (a) { return a.n > 0; });
    var eta = cfg.battery > 0 ? 0.97 : 0.975;
    var pacRated = cfg.pac || 1e9;
    var dcs = arrs.map(function (a) { return arrayDC(a, cfg); });
    var shape = loadShape(cfg.profile, cfg.shift || 0), season = norm(SEASONS[cfg.season].m.map(function (x, i) { return x * DAYS[i]; }));
    var C = cfg.battery || 0, dod = 0.9, rsv = clamp(cfg.reserve == null ? 0.2 : cfg.reserve, 0, 0.9);
    var emin = C * Math.max(1 - dod, rsv), emax = C, rt = Math.sqrt(0.92), pb = cfg.batPower || (C > 0 ? Math.max(1, C * 0.5) : 0);
    var out = { gen: [], load: [], self: [], exp: [], imp: [], dc: [], clip: 0, cyc: 0, cost0: 0, cost1: 0, income: 0, day: [], perArr: arrs.map(function () { return 0; }) };
    for (var m = 0; m < 12; m++) {
      var mg = 0, ml = 0, ms = 0, me = 0, mi = 0, mdc = 0, dayRec = null;
      var dl = cfg.load * season[m] / DAYS[m];
      for (var j = 0; j < 3; j++) {
        var soc = C > 0 ? (emin + emax) / 2 : 0, rec = [];
        for (var pass = 0; pass < 3; pass++) {
          rec = [];
          var dgen = 0, dload = 0, dself = 0, dexp = 0, dimp = 0, ddis = 0;
          for (var h = 0; h < 24; h++) {
            var pdc = 0;
            for (var k = 0; k < dcs.length; k++) { pdc += dcs[k][m][j][h]; }
            var pac = Math.min(pdc * eta, pacRated);
            if (pdc * eta > pacRated) out.clip += (pdc * eta - pacRated) * DT_W[j] * DAYS[m];
            var L = dl * shape[h], dir = Math.min(L, pac), sur = pac - dir, def = L - dir, ch = 0, di = 0;
            if (C > 0) {
              if (sur > 0) { ch = Math.min(sur, pb, (emax - soc) / rt); soc += ch * rt; }
              if (def > 0) { di = Math.min(def, pb, (soc - emin) * rt); soc -= di / rt; }
            }
            var ex = sur - ch, im = def - di;
            rec.push({ pv: pac, load: L, soc: C > 0 ? soc : 0, ex: ex, im: im, di: di, ch: ch });
            dgen += pac; dload += L; dself += dir + di; dexp += ex; dimp += im; ddis += di;
          }
          if (pass === 2) {
            var wd = DT_W[j] * DAYS[m];
            mg += dgen * wd; ml += dload * wd; ms += dself * wd; me += dexp * wd; mi += dimp * wd; mdc += 0; out.cyc += ddis * wd;
            // стоимость: будни по зонам, выходные по минимальной ставке
            for (var q = 0; q < 24; q++) {
              var r = rec[q], pw = priceAt(cfg.scheme, cfg.tariff, q, false), pe = priceAt(cfg.scheme, cfg.tariff, q, true), mix = (5 * pw + 2 * pe) / 7 * (cfg.tariffK || 1);
              out.cost0 += r.load * mix * wd; out.cost1 += r.im * mix * wd; out.income += r.ex * (cfg.buyback || 0) * wd;
            }
            if (j === 1) dayRec = rec;
          }
        }
      }
      out.gen.push(mg); out.load.push(ml); out.self.push(ms); out.exp.push(me); out.imp.push(mi); out.day.push(dayRec);
    }
    // выработка по массивам (для таблицы), кВт·ч постоянного тока
    arrs.forEach(function (a, k) {
      var s = 0;
      for (var m = 0; m < 12; m++) for (var j = 0; j < 3; j++) for (var h = 0; h < 24; h++) s += dcs[k][m][j][h] * DT_W[j] * DAYS[m];
      out.perArr[k] = s;
    });
    var sum = function (a) { return a.reduce(function (x, y) { return x + y; }, 0); };
    out.genY = sum(out.gen); out.loadY = sum(out.load); out.selfY = sum(out.self); out.expY = sum(out.exp); out.impY = sum(out.imp);
    out.savings = out.cost0 - out.cost1 + out.income;
    out.kwp = arrs.reduce(function (s, a) { return s + a.n * MODULES[a.type].p / 1000; }, 0);
    out.cycles = C > 0 ? out.cyc / (C * dod) : 0;
    out.arrs = arrs;
    return out;
  }

  /* ───────── подбор инвертора, строк, батарей и спецификация ───────── */
  var INVERTERS = [
    { id: 'h1-3', kind: 'hyb', ph: 1, pac: 3.6, mppt: 2, spm: 1, imax: 16, vmax: 500, vlo: 125, vhi: 425, dcmax: 5.4, batV: 48, name: 'Гибридный 1ф 3,6 кВт, АКБ 48 В' },
    { id: 'h1-5', kind: 'hyb', ph: 1, pac: 5, mppt: 2, spm: 1, imax: 16, vmax: 500, vlo: 125, vhi: 425, dcmax: 7.5, batV: 48, name: 'Гибридный 1ф 5 кВт, АКБ 48 В' },
    { id: 'h1-6', kind: 'hyb', ph: 1, pac: 6, mppt: 2, spm: 1, imax: 16, vmax: 500, vlo: 125, vhi: 425, dcmax: 9, batV: 48, name: 'Гибридный 1ф 6 кВт, АКБ 48 В' },
    { id: 'h1-8', kind: 'hyb', ph: 1, pac: 8, mppt: 2, spm: 2, imax: 26, vmax: 500, vlo: 125, vhi: 425, dcmax: 12, batV: 48, name: 'Гибридный 1ф 8 кВт, АКБ 48 В' },
    { id: 'h3-8', kind: 'hyb', ph: 3, pac: 8, mppt: 2, spm: 2, imax: 26, vmax: 800, vlo: 200, vhi: 650, dcmax: 12, batV: 48, name: 'Гибридный 3ф 8 кВт, АКБ 48 В' },
    { id: 'h3-12', kind: 'hyb', ph: 3, pac: 12, mppt: 2, spm: 2, imax: 26, vmax: 800, vlo: 200, vhi: 650, dcmax: 18, batV: 48, name: 'Гибридный 3ф 12 кВт, АКБ 48 В' },
    { id: 'h3-15', kind: 'hyb', ph: 3, pac: 15, mppt: 3, spm: 2, imax: 26, vmax: 1000, vlo: 180, vhi: 850, dcmax: 22.5, batV: 48, name: 'Гибридный 3ф 15 кВт, АКБ' },
    { id: 'g1-3', kind: 'grid', ph: 1, pac: 3, mppt: 2, spm: 1, imax: 16, vmax: 600, vlo: 80, vhi: 560, dcmax: 4.5, name: 'Сетевой 1ф 3 кВт' },
    { id: 'g1-5', kind: 'grid', ph: 1, pac: 5, mppt: 2, spm: 1, imax: 16, vmax: 600, vlo: 80, vhi: 560, dcmax: 7.5, name: 'Сетевой 1ф 5 кВт' },
    { id: 'g3-6', kind: 'grid', ph: 3, pac: 6, mppt: 2, spm: 1, imax: 16, vmax: 1000, vlo: 140, vhi: 850, dcmax: 9, name: 'Сетевой 3ф 6 кВт' },
    { id: 'g3-10', kind: 'grid', ph: 3, pac: 10, mppt: 2, spm: 2, imax: 16, vmax: 1000, vlo: 140, vhi: 850, dcmax: 15, name: 'Сетевой 3ф 10 кВт' },
    { id: 'g3-15', kind: 'grid', ph: 3, pac: 15, mppt: 3, spm: 2, imax: 22, vmax: 1000, vlo: 160, vhi: 850, dcmax: 22.5, name: 'Сетевой 3ф 15 кВт' },
    { id: 'g3-20', kind: 'grid', ph: 3, pac: 20, mppt: 3, spm: 2, imax: 26, vmax: 1100, vlo: 180, vhi: 1000, dcmax: 30, name: 'Сетевой 3ф 20 кВт' },
    { id: 'g3-30', kind: 'grid', ph: 3, pac: 30, mppt: 3, spm: 2, imax: 26, vmax: 1100, vlo: 180, vhi: 1000, dcmax: 45, name: 'Сетевой 3ф 30 кВт' }
  ];
  var BAT_MOD = { lv: { kwh: 5.12, pw: 2.5, name: 'LFP-модуль 48 В, 5,12 кВт·ч' } };

  // строки: допустимое число модулей в строке по напряжению (холод и жара)
  function stringRange(mod, inv, tmin) {
    var vocCold = mod.voc * (1 + Math.abs(mod.tv) * (25 - tmin)), vmpCold = mod.vmp * (1 + Math.abs(mod.tv) * (25 - tmin));
    var vmpHot = mod.vmp * (1 - 0.0030 * 45);
    var nMax = Math.min(Math.floor(inv.vmax * 0.98 / vocCold), Math.floor(inv.vhi / vmpCold));
    var nMin = Math.ceil(inv.vlo * 1.05 / vmpHot);
    return { nMin: nMin, nMax: nMax, vocCold: vocCold, vmpHot: vmpHot, vmpCold: vmpCold };
  }
  // раскладка модулей массива по строкам
  function layout(ar, inv, tmin) {
    var mod = MODULES[ar.type], r = stringRange(mod, inv, tmin);
    if (r.nMax < r.nMin || r.nMax < 1) return { ok: false, why: 'модули не укладываются в диапазон напряжения инвертора', range: r };
    var perMppt = Math.max(1, Math.min(inv.spm, Math.floor(inv.imax * 1.03 / mod.imp)));
    if (mod.isc > inv.imax * 1.4) return { ok: false, why: 'ток модуля выше входа MPPT', range: r };
    var best = null;
    for (var n = r.nMax; n >= Math.max(r.nMin, 1); n--) {
      var s = Math.ceil(ar.n / n), tot = s * n, ex = tot - ar.n;
      var mp = Math.ceil(s / perMppt);
      var score = Math.abs(ex) * 3 + mp * 2 + (r.nMax - n) * 0.1;
      if (!best || score < best.score) best = { n: n, s: s, tot: tot, mp: mp, score: score, ex: ex };
    }
    return { ok: true, n: best.n, s: best.s, tot: best.tot, mp: best.mp, range: r, perMppt: perMppt, extra: best.ex };
  }
  function pickInverter(cfg) {
    var arrs = cfg.arrays.filter(function (a) { return a.n > 0; });
    var kind = cfg.battery > 0 ? 'hyb' : 'grid';
    var dc = arrs.reduce(function (s, a) { return s + a.n * MODULES[a.type].p / 1000; }, 0), ph = cfg.phases;
    var target = cfg.dcac || 1.25, list = INVERTERS.filter(function (i) { return i.kind === kind && (ph === 3 ? i.ph === 3 : true); });
    // при 3ф сети допускаем 1ф-гибрид нельзя: берём только соответствующие фазности
    if (ph === 1) list = list.filter(function (i) { return i.ph === 1; });
    var notes = [], fallback = null;
    for (var i = 0; i < list.length; i++) {
      var inv = list[i];
      if (inv.pac * 1.5 < dc * 1.0 && false) continue;
      if (dc / inv.pac > 1.45 || dc > inv.dcmax) { continue; }
      var lays = [], used = 0, ok = true;
      for (var k = 0; k < arrs.length; k++) {
        var l = layout(arrs[k], inv, cfg.tmin);
        if (!l.ok) { ok = false; break; }
        lays.push(l); used += l.mp;
      }
      if (!ok || used > inv.mppt) continue;
      if (dc / inv.pac < Math.min(0.9, target - 0.35)) { if (!fallback) fallback = { inv: inv, lays: lays }; }
      return { inv: inv, count: 1, lays: lays, dc: dc, arrs: arrs, ratio: dc / inv.pac };
    }
    // не уместилось в один: берём несколько одинаковых самых крупных, делим массивы по порядку
    var big = list[list.length - 1];
    var cnt = Math.max(2, Math.ceil(dc / (big.pac * 1.3)));
    var lays2 = arrs.map(function (a) {
      var l = layout(Object.assign({}, a, { n: Math.ceil(a.n / cnt) }), big, cfg.tmin);
      if (!l.ok) l = { ok: false, n: 1, s: 1, tot: a.n, mp: 1, range: l.range, extra: 0, why: l.why };
      return l;
    });
    return { inv: big, count: cnt, lays: lays2, dc: dc, arrs: arrs, ratio: dc / (big.pac * cnt), multi: true };
  }

  var DEF_PRICES = { // USD, розница 2025–2026 (ориентиры, меняются в калькуляторе)
    mod_w: 0.19, mount_roof_w: 0.07, mount_fence_w: 0.13, inv_hyb_kw: 190, inv_grid_kw: 85, bat_kwh: 260, cab_dc_m: 1.3, mc4: 6, spd_dc: 70, spd_ac: 55, dcsw: 55,
    acbrk: 40, rcd: 35, eps_box: 160, meter: 90, logger: 40, ground: 120, ac_cab_m: 3.5, labor_w: 0.13, bms: 0, design: 150, rate: 2.9
  };
  function crossSection(I, L, three) { // AC-кабель Cu, ΔU ≤ 1,5 %
    var S = [2.5, 4, 6, 10, 16, 25, 35], u = three ? 400 : 230, k = three ? 1.732 : 2, rho = 0.0225;
    for (var i = 0; i < S.length; i++) {
      var amp = { 2.5: 21, 4: 28, 6: 36, 10: 50, 16: 68, 25: 89, 35: 111 }[S[i]];
      var du = k * rho * L * I / S[i] / u * 100;
      if (amp >= I * 1.25 && du <= 1.5) return S[i];
    }
    return 50;
  }
  function bom(cfg, pick, prices) {
    var P = Object.assign({}, DEF_PRICES, prices || {}), lines = [], arrs = pick.arrs;
    
    var addL = function (grp, name, qty, unit, price, note) { lines.push({ grp: grp, name: name, qty: qty, unit: unit, price: price, sum: qty * price, note: note || '' }); };
    var rate = P.rate;
    arrs.forEach(function (a, i) {
      var mod = MODULES[a.type], lay = pick.lays[i], total = pick.multi ? a.n : lay.tot;
      var wp = total * mod.p;
      addL('Модули', mod.name + ' · массив ' + (i + 1), total, 'шт', Math.round(mod.p * P.mod_w * (mod.bif ? 1.06 : 1)), 'для строк по ' + lay.n + ' шт.');
      var fence = a.tilt >= 75;
      addL('Монтаж', (fence ? 'Каркас забора под модули (доплата к ограждению)' : 'Кровельная система крепления') + ' · массив ' + (i + 1), Math.round(wp), 'Вт', fence ? P.mount_fence_w : P.mount_roof_w);
    });
    var inv = pick.inv, cnt = pick.count;
    addL('Инвертор', inv.name, cnt, 'шт', Math.round(inv.pac * (inv.kind === 'hyb' ? P.inv_hyb_kw : P.inv_grid_kw)), 'DC/AC ' + pick.ratio.toFixed(2).replace('.', ','));
    var nb = 0;
    if (cfg.battery > 0) {
      nb = Math.ceil(cfg.battery / BAT_MOD.lv.kwh - 0.001);
      addL('Накопитель', BAT_MOD.lv.name, nb, 'шт', Math.round(BAT_MOD.lv.kwh * P.bat_kwh), 'итого ' + (nb * BAT_MOD.lv.kwh).toFixed(1).replace('.', ',') + ' кВт·ч' + (nb > 1 ? ', шина или стойка' : ''));
    }
    var strings = pick.lays.reduce(function (s, l) { return s + l.s; }, 0), mp = pick.lays.reduce(function (s, l) { return s + l.mp; }, 0);
    var dist = cfg.dist || 15;
    addL('Защита и коммутация', 'Кабель PV1-F 6 мм², 2 жилы на строку (туда и обратно)', Math.round(strings * dist * 2), 'м', P.cab_dc_m);
    addL('Защита и коммутация', 'Разъёмы MC4 (пара)', strings * 2, 'пар', P.mc4);
    addL('Защита и коммутация', 'DC-разъединитель на вход MPPT', mp, 'шт', P.dcsw, 'видимый разрыв для пожарных');
    addL('Защита и коммутация', 'УЗИП II класса, DC-сторона', mp, 'шт', P.spd_dc);
    addL('Защита и коммутация', 'УЗИП II класса, AC-сторона', 1, 'шт', P.spd_ac);
    var iac = inv.pac * cnt * 1000 / (inv.ph === 3 ? 1.732 * 400 : 230);
    addL('Защита и коммутация', 'Автомат AC ' + [16, 20, 25, 32, 40, 50, 63].filter(function (x) { return x >= iac * 1.1; })[0] + ' А + УЗО тип A/B', 1, 'компл.', P.acbrk + P.rcd);
    var sec = crossSection(iac, cfg.distAc || 10, inv.ph === 3);
    addL('Защита и коммутация', 'Кабель AC от инвертора до щита, медь ' + sec + ' мм²', cfg.distAc || 10, 'м', P.ac_cab_m * (sec / 6 + 0.4));
    if (cfg.battery > 0) addL('Защита и коммутация', 'Щит резервной группы (EPS) и автомат АКБ', 1, 'компл.', P.eps_box);
    addL('Защита и коммутация', 'Заземление и уравнивание потенциалов', 1, 'компл.', P.ground);
    addL('Учёт и мониторинг', 'Двунаправленный счётчик', 1, 'шт', P.meter);
    addL('Учёт и мониторинг', 'Wi-Fi-логгер, приложение мониторинга', 1, 'шт', P.logger);
    var wpAll = pick.arrs.reduce(function (s, a, i) { return s + (pick.multi ? a.n : pick.lays[i].tot) * MODULES[a.type].p; }, 0);
    addL('Работы', 'Монтаж, пусконаладка, оформление подключения', Math.round(wpAll), 'Вт', P.labor_w);
    addL('Работы', 'Проект: аудит тени, строки, защиты, исполнительная схема', 1, 'шт', P.design);
    var sum = lines.reduce(function (s, l) { return s + l.sum; }, 0);
    var invCost = lines.filter(function (l) { return l.grp === 'Инвертор'; }).reduce(function (s, l) { return s + l.sum; }, 0);
    var batCost = lines.filter(function (l) { return l.grp === 'Накопитель'; }).reduce(function (s, l) { return s + l.sum; }, 0);
    return { lines: lines, usd: sum, byn: sum * rate, invUsd: invCost, batUsd: batCost, rate: rate, batModules: nb, sec: sec, iac: iac, strings: strings, mppts: mp };
  }

  /* ───────── экономика на 25 лет ───────── */
  function econ(cfg, sim, capexByn, invByn, batByn) {
    var g = cfg.growth, dr = cfg.disc, deg = 0.004, opex = 0.005, yrs = 25, flow = [], cum = -capexByn, cumArr = [cum], disc = -capexByn;
    var batLife = cfg.battery > 0 ? Math.min(15, Math.floor(6000 * 0.8 / Math.max(1, sim.cycles)) ) : 99, invLife = 12;
    var pay = null, dpay = null, dcum = -capexByn;
    var s0 = sim.savings;
    for (var t = 1; t <= yrs; t++) {
      var sv = s0 * Math.pow(1 - deg, t - 1) * Math.pow(1 + g, t - 1);
      var cost = capexByn * opex * Math.pow(1 + g * 0.5, t - 1);
      var rep = 0;
      if (t === invLife + 1) rep += invByn * 0.8;
      if (cfg.battery > 0 && t === batLife + 1 && batLife < 25) rep += batByn * 0.6;
      var cf = sv - cost - rep;
      var prev = cum; cum += cf; dcum += cf / Math.pow(1 + dr, t);
      flow.push(cf); cumArr.push(cum);
      if (pay === null && prev < 0 && cum >= 0) pay = t - 1 + (-prev) / cf;
      if (dpay === null && dcum - cf / Math.pow(1 + dr, t) < 0 && dcum >= 0) dpay = t;
    }
    var npv = -capexByn; flow.forEach(function (c, i) { npv += c / Math.pow(1 + dr, i + 1); });
    var lo = -0.5, hi = 1, irr = null;
    function f(r) { var s = -capexByn; flow.forEach(function (c, i) { s += c / Math.pow(1 + r, i + 1); }); return s; }
    if (f(lo) > 0 && f(hi) < 0) { for (var i = 0; i < 60; i++) { var mid = (lo + hi) / 2; if (f(mid) > 0) lo = mid; else hi = mid; } irr = (lo + hi) / 2; }
    return { flow: flow, cum: cumArr, pay: pay, dpay: dpay, npv: npv, irr: irr, batLife: batLife, savings1: s0 };
  }

  function configure(cfg, prices) { // полный цикл: выработка, оборудование, деньги
    var pick = pickInverter(cfg);
    var cfg2 = Object.assign({}, cfg, { pac: pick.inv.pac * pick.count });
    var sim = simulate(cfg2);
    var bm = bom(cfg2, pick, prices);
    var batPow = cfg.battery > 0 ? Math.min(pick.inv.pac * pick.count, bm.batModules * BAT_MOD.lv.pw) : 0;
    if (cfg.battery > 0) { cfg2.batPower = batPow; sim = simulate(cfg2); }
    var e = econ(cfg2, sim, bm.byn, bm.invUsd * bm.rate, bm.batUsd * bm.rate);
    return { pick: pick, sim: sim, bom: bm, econ: e, cfg: cfg2 };
  }

  var api = {
    LAT: LAT, MON_H: MON_H, DAYS: DAYS, MONTHS: MONTHS, MODULES: MODULES, PROFILES: PROFILES, SEASONS: SEASONS, TARIFFS: TARIFFS, INVERTERS: INVERTERS,
    BAT_MOD: BAT_MOD, DEF_PRICES: DEF_PRICES, simulate: simulate, configure: configure, pickInverter: pickInverter, bom: bom, econ: econ,
    arrayDC: arrayDC, planeKwh: planeKwh, stringRange: stringRange, layout: layout, priceAt: priceAt, loadShape: loadShape
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TegaSolar = api;
})(typeof window !== 'undefined' ? window : this);
