/* Модель расчёта кровли: геометрия и площади, пригодность покрытия к уклону, количества, нагрузки и предварительная проверка стропила,
   водоотвод и снегозадержание, стоимость владения по вашим ценам, солнечные модули на кровле.
   Все числа покрытий (уклоны, массы, сроки) ориентиры практики из roof-data.js, не нормативы и не цены. Расчёт ориентировочный, не проект.
   Работает и в браузере (window.TegaRoof), и в Node (module.exports) для проверки. */
(function (root) {
  'use strict';
  var D = root.TegaRoofData || (typeof require !== 'undefined' ? require('./roof-data.js') : []);
  var RAD = Math.PI / 180;
  var TIMBER = { C16: { fm: 16, E: 8000 }, C18: { fm: 18, E: 9000 }, C24: { fm: 24, E: 11000 }, C27: { fm: 27, E: 11500 }, C30: { fm: 30, E: 12000 } };
  var H_LADDER = [100, 125, 150, 175, 200, 225, 250, 300];
  var GUTTERS = { s: { name: 'Жёлоб 125, труба 90', area: 70 }, m: { name: 'Жёлоб 150, труба 110', area: 130 } };
  var TILT_PTS = [[0, 0.85], [10, 0.91], [20, 0.96], [30, 0.99], [35, 1], [45, 0.99], [60, 0.93], [90, 0.55]];
  var AZ = { s: 1, d: 0.96, ew: 0.82, n: 0.6 };
  var PV_KWH = 1030, PV_M2_KW = 5.8, PV_USABLE = 0.7;

  function byId(id) { for (var i = 0; i < D.length; i++) if (D[i].id === id) return D[i]; return null; }
  function lerp(pts, x) {
    if (x <= pts[0][0]) return pts[0][1];
    for (var i = 1; i < pts.length; i++) if (x <= pts[i][0]) { var a = pts[i - 1], b = pts[i]; return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]); }
    return pts[pts.length - 1][1];
  }
  function fixed(x, d) { return Math.round(x * Math.pow(10, d)) / Math.pow(10, d); }
  function comma(x) { return String(x).replace('.', ','); }
  function life(m, mode) { return mode === 'lo' ? m.lifeLo : mode === 'hi' ? m.lifeHi : (m.lifeLo + m.lifeHi) / 2; }

  /* пригодность покрытия к уклону: ok, special (со спецмерами), no */
  function fit(m, alpha) {
    if (alpha + 1e-9 >= m.min) return 'ok';
    if (alpha + 1e-9 >= m.special) return 'special';
    return 'no';
  }

  function geometry(g) {
    var a = g.alpha * RAD, cs = Math.cos(a), tn = Math.tan(a);
    var Lo = g.L + 2 * g.ov, Wo = g.W + 2 * g.ov, r = { Lo: Lo, Wo: Wo, planArea: Lo * Wo, pct: tn * 100 };
    if (g.form === 'gable') {
      r.run = Wo / 2; r.slopeLen = r.run / cs; r.area = 2 * r.slopeLen * Lo; r.ridge = Lo; r.hips = 0; r.eaves = 2 * Lo; r.verge = 4 * r.slopeLen; r.rise = r.run * tn; r.edges = 2;
    } else if (g.form === 'hip') {
      var mn = Math.min(Lo, Wo), mx = Math.max(Lo, Wo);
      r.run = mn / 2; r.slopeLen = r.run / cs; r.area = Lo * Wo / cs; r.ridge = mx - mn; r.hips = 4 * r.run * Math.sqrt(2 + tn * tn); r.eaves = 2 * (Lo + Wo); r.verge = 0; r.rise = r.run * tn; r.edges = 4;
    } else if (g.form === 'mono') {
      r.run = Wo; r.slopeLen = Wo / cs; r.area = Lo * Wo / cs; r.ridge = Lo; r.hips = 0; r.eaves = Lo; r.verge = 2 * r.slopeLen; r.rise = Wo * tn; r.edges = 1;
    } else {
      r.run = Wo; r.slopeLen = Wo / cs; r.area = Lo * Wo / cs; r.ridge = 0; r.hips = 0; r.eaves = 2 * (Lo + Wo); r.verge = 0; r.rise = Wo * tn; r.edges = 0;
    }
    r.valleys = g.valleys || 0;
    return r;
  }

  function calc(c) {
    var m = byId(c.mat), warns = [], r = {};
    var red = function (s) { warns.push({ level: 'red', text: s }); };
    var yel = function (s) { warns.push({ level: 'yellow', text: s }); };
    var geo = geometry(c); r.geo = geo; r.m = m;
    var A = geo.area, flatForm = c.form === 'flat';

    /* пригодность покрытия */
    r.fit = fit(m, c.alpha);
    if (r.fit === 'no') red('Уклон ' + comma(fixed(c.alpha, 1)) + '° (' + comma(fixed(geo.pct, 0)) + ' %) меньше предела ' + comma(m.special) + '° для покрытия «' + m.short + '»: оно не защитит от протечек. Увеличьте уклон или выберите покрытие для малых уклонов.');
    else if (r.fit === 'special') yel('Уклон ' + comma(fixed(c.alpha, 1)) + '° ниже стандартного ' + comma(m.min) + '° для покрытия «' + m.short + '»: нужны спецмеры (сплошная гидроизоляционная подкладка, герметизация нахлёстов и узлов, усиленное основание) по паспорту системы.');
    if (c.alpha > m.steep + 1e-9) yel('Уклон ' + comma(fixed(c.alpha, 0)) + '° круче ' + comma(m.steep) + '°: покрытие «' + m.short + '» требует дополнительной фиксации каждого элемента или другой системы крепления.');
    if (flatForm && m.grp === 'slope') yel('Плоская кровля с уклоном ' + comma(fixed(c.alpha, 1)) + '° и штучное покрытие несовместимы по водозащите: выберите рулонное, мембранное или напыляемое покрытие.');
    if (!flatForm && m.grp === 'flat' && c.alpha > 10) yel('Рулонные, мембранные и напыляемые покрытия на скатах круче 10° требуют механического крепления и защиты от сползания: обычно выбирают штучные покрытия.');

    /* количества */
    var q = {};
    q.cover = A * m.waste;
    q.coverBase = A;
    q.ridgeLen = geo.ridge + geo.hips;
    q.valleys = geo.valleys;
    q.verge = geo.verge;
    q.membrane = A * 1.15;
    q.sheath = m.base === 'sheath' || m.base === 'green' ? A * 1.05 : 0;
    q.battens = m.step ? A / m.step : 0;
    q.counter = (!flatForm && c.step > 0) ? A / c.step * 1.05 : 0;
    q.vapour = A * 1.15;
    r.q = q;

    /* нагрузки */
    var cs = Math.cos(c.alpha * RAD);
    r.mu = c.alpha <= 30 ? 0.8 : c.alpha < 60 ? 0.8 * (60 - c.alpha) / 30 : 0;
    r.S = r.mu * c.ce * c.ct * c.sk;
    r.gCover = m.mass * 0.00981;
    r.gk = r.gCover + c.gOther;
    r.gPlan = r.gk / cs;
    r.qk = (r.gPlan + r.S) * c.step;
    r.qd = (1.35 * r.gPlan + 1.5 * r.S) * c.step;
    r.M = r.qd * c.span * c.span / 8;
    var T = TIMBER[c.grade] || TIMBER.C24;
    r.fmd = 0.9 * T.fm / 1.3;
    var Wm = c.b * c.h * c.h / 6;
    r.sigma = r.M * 1e6 / Wm;
    r.utilBend = r.sigma / r.fmd;
    var I = c.b * Math.pow(c.h, 3) / 12;
    var kdef = 0.8;
    /* прогиб: постоянная нагрузка с ползучестью (1 + kdef), снег мгновенно (ψ2 = 0); предел l / 200 по длине ската */
    var qG = r.gPlan * c.step, qQ = r.S * c.step, wEff = qG * (1 + kdef) + qQ;
    var l4 = Math.pow(c.span * 1000, 4) / (384 * T.E * cs * cs);
    r.delta = 5 * wEff * l4 / I;
    r.deltaLim = c.span * 1000 / cs / 200;
    r.utilDef = r.delta / r.deltaLim;
    r.util = Math.max(r.utilBend, r.utilDef);
    var hB = Math.sqrt(6 * r.M * 1e6 / (c.b * r.fmd));
    var Ineed = 5 * wEff * l4 / r.deltaLim;
    var hD = Math.pow(12 * Ineed / c.b, 1 / 3);
    r.hReq = Math.max(hB, hD);
    r.hStd = H_LADDER[H_LADDER.length - 1];
    for (var i = 0; i < H_LADDER.length; i++) if (H_LADDER[i] >= r.hReq - 1e-9) { r.hStd = H_LADDER[i]; break; }
    if (r.util > 1) red('Предварительная проверка стропила не проходит: использование ' + comma(fixed(r.util * 100, 0)) + ' % (изгиб ' + comma(fixed(r.utilBend * 100, 0)) + ' %, прогиб ' + comma(fixed(r.utilDef * 100, 0)) + ' %). Нужно сечение высотой около ' + r.hStd + ' мм при ширине ' + c.b + ' мм, меньший шаг или промежуточная опора. Окончательно считает проектировщик.');
    else if (r.util > 0.85) yel('Стропило загружено на ' + comma(fixed(r.util * 100, 0)) + ' %: запас мал, это предварительная проверка, окончательно считает проектировщик.');
    if (m.mass > 30) yel('Тяжёлое покрытие (' + comma(m.mass) + ' кг/м²): стропильную систему, опоры и фундамент считают на эту нагрузку.');
    if (m.id === 'green') yel('Зелёная кровля весит 60–150 кг/м² во влажном состоянии: несущую способность плиты и водоотвод считают отдельно, нужны корнестойкая мембрана и дренажный слой.');

    /* утепление: R = R_пов + t / λ; толщина по заданному R (норму R вводит пользователь) */
    var LAM = { wool: 0.040, glass: 0.040, pir: 0.024, eps: 0.037, eco: 0.041 };
    var lam = LAM[c.insKind] || c.lam || 0.040;
    r.lam = lam;
    r.rOther = c.pie === 'cold' ? 0.15 : 0.25;
    r.rFact = c.insT > 0 ? r.rOther + c.insT / 1000 / lam : r.rOther;
    r.hasR = isFinite(c.rNorm) && c.rNorm > 0;
    if (r.hasR) {
      r.tReq = Math.max(c.rNorm - r.rOther, 0) * lam * 1000;
      r.tRound = Math.ceil(r.tReq / 50 - 1e-9) * 50;
      if (c.insT > 0 && r.rFact < c.rNorm - 1e-9) red('Сопротивление теплопередаче кровли ' + comma(fixed(r.rFact, 2)) + ' м²·°C/Вт ниже заданной нормы ' + comma(fixed(c.rNorm, 2)) + ': нужно утеплителя около ' + r.tRound + ' мм (расчёт ' + comma(fixed(r.tReq, 0)) + ' мм).');
    }
    if (c.pie === 'warm' && c.insT > 0 && !c.cross) yel('Утепление только между стропилами: деревянные стропила дают мостики холода (по практике 15–20 % потерь). Добавьте перекрёстный слой не менее 50 мм поверх или под стропила.');
    if (c.pie === 'warm' && c.insT > c.h && c.insT > 0 && !c.cross) yel('Толщина утеплителя ' + comma(c.insT) + ' мм больше высоты стропила ' + comma(c.h) + ' мм: остаток кладут вторым слоем перекрёстно.');
    q.insul = c.insT > 0 ? A * c.insT / 1000 * 1.05 : 0;

    /* вентиляция подкровельного пространства: площадь отверстий не менее 1/500 площади (ориентир практики) */
    r.ventArea = flatForm || c.pie === 'flat' ? 0 : A / 500;
    r.ventPerEave = geo.eaves > 0 ? r.ventArea * 1e4 / geo.eaves : 0;
    r.ventPerRidge = geo.ridge + geo.hips > 0 ? r.ventArea * 1e4 / (geo.ridge + geo.hips) : 0;
    if (!flatForm && c.ventOk === 'no') red('Нет притока по карнизу или выхода в коньке: подкровельное пространство не вентилируется. Нужны перфорированный софит и коньковый аэратор площадью не менее ' + comma(fixed(r.ventArea * 1e4, 0)) + ' см² каждый (1/500 площади).');

    /* трудозатраты, чел·ч: стропила, плёнки и утеплитель, основание, покрытие, водосток и безопасность (ориентиры практики) */
    var lab = {};
    lab.rafters = flatForm ? 0 : A * (c.struct === 'truss' ? 0.85 : 1.45);
    lab.pie = A * (c.insT > 0 ? 0.75 : 0.35);
    lab.base = flatForm ? 0 : A * 0.5;
    r.laborRate = isFinite(c.laborCover) && c.laborCover > 0 ? c.laborCover : m.labor;
    lab.cover = A * r.laborRate;
    lab.water = A * 0.4;
    lab.total = lab.rafters + lab.pie + lab.base + lab.cover + lab.water;
    r.lab = lab;
    r.perM2Hours = lab.total / A;
    r.crew = c.crew > 0 ? c.crew : 4;
    r.days = lab.total / (r.crew * 8);
    r.maintHours = 10;

    /* водоотвод */
    var gut = GUTTERS[c.gutter] || GUTTERS.s;
    r.gutter = gut;
    if (flatForm) {
      r.outlets = Math.max(2, Math.ceil(geo.planArea / 150));
      r.pipes = r.outlets; r.gutterLen = 0; r.guardLen = 0; r.guardRows = 0;
    } else {
      r.pipes = Math.max(geo.edges, Math.ceil(geo.planArea / gut.area), Math.ceil(geo.eaves / 12));
      r.gutterLen = geo.eaves;
      r.pipeLen = r.pipes * c.eaveH;
      r.guardRows = c.alpha >= 12 && m.grp === 'slope' ? (geo.slopeLen > 6 ? 2 : 1) : 0;
      r.guardLen = r.guardRows * geo.eaves;
      if (r.guardRows && (m.id === 'metal_tile' || m.id === 'profil' || m.id.indexOf('seam') === 0 || m.id === 'composite' || m.id === 'ceramic' || m.id === 'cement') && c.alpha >= 15) {
        yel('Скользкое покрытие на уклоне ' + comma(fixed(c.alpha, 0)) + '°: снег сходит лавиной, над входами, дорожками и автостоянкой ставят снегозадержатели (' + r.guardRows + ' ряд' + (r.guardRows > 1 ? 'а' : '') + ' по карнизу, ' + comma(fixed(r.guardLen, 0)) + ' м).');
      }
    }

    /* стоимость владения */
    var H = c.horizon, L = life(m, c.lifeMode);
    r.life = L;
    r.nRepl = Math.max(Math.ceil(H / L - 1e-9) - 1, 0);
    var lastUsed = H - r.nRepl * L;
    r.residual = Math.max(0, 1 - lastUsed / L);
    r.priceOk = isFinite(c.priceCover) && c.priceCover > 0;
    if (r.priceOk) {
      var base = isFinite(c.priceBase) ? c.priceBase : 0, dem = isFinite(c.priceDemol) ? c.priceDemol : 0;
      r.initial = (c.priceCover + base) * A;
      r.replEach = (c.priceCover + dem) * A;
      r.maintTotal = m.maint / 100 * c.priceCover * A * H;
      r.residualVal = r.residual * c.priceCover * A;
      r.total = r.initial + r.nRepl * r.replEach + r.maintTotal - r.residualVal;
      r.perYear = r.total / H;
      r.perM2Year = r.perYear / A;
    }
    r.costAll = [];
    if (c.prices) {
      D.forEach(function (mm) {
        var p = c.prices[mm.id];
        var LL = life(mm, c.lifeMode), nr = Math.max(Math.ceil(H / LL - 1e-9) - 1, 0), used = H - nr * LL, res = Math.max(0, 1 - used / LL);
        var f = fit(mm, c.alpha), row = { id: mm.id, name: mm.short, fit: f, life: LL, nRepl: nr, price: p };
        if (isFinite(p) && p > 0) {
          var b = isFinite(c.priceBase) ? c.priceBase : 0, dm = isFinite(c.priceDemol) ? c.priceDemol : 0;
          var AA = A;
          row.initial = (p + b) * AA; row.total = row.initial + nr * (p + dm) * AA + mm.maint / 100 * p * AA * H - res * p * AA;
          row.perYear = row.total / H; row.perM2Year = row.perYear / AA;
        }
        r.costAll.push(row);
      });
    }

    /* солнце */
    var tiltF = flatForm ? lerp(TILT_PTS, 15) : lerp(TILT_PTS, c.alpha), azF = AZ[c.az] || 1;
    var share = c.form === 'gable' ? 0.5 : c.form === 'hip' ? 0.4 : 1;
    var usable = A * share * PV_USABLE * (flatForm ? 0.45 : 1) * (c.pvShare / 100);
    r.pvArea = usable;
    r.pvKw = usable / PV_M2_KW;
    r.pvTilt = tiltF; r.pvAz = azF;
    r.pvKwh = r.pvKw * PV_KWH * tiltF * azF;
    r.pvMass = usable * 15;
    var LOSS = { on: 0.05, in: 0.08, in_nv: 0.125, bipv: 0.15, ballast: 0.04 };
    var scheme = c.pvScheme || 'on';
    r.pvLoss = LOSS[scheme] === undefined ? 0.05 : LOSS[scheme];
    if (scheme === 'in' && c.pvVent === 'no') r.pvLoss = LOSS.in_nv;
    r.pvKwhNet = r.pvKwh * (1 - r.pvLoss);
    if (c.pvShare > 0) {
      if (life(m, 'lo') < 25 && m.id !== 'pv_tile') yel('Солнечные панели служат 25–30 лет, а покрытие «' + m.short + '» по нижней оценке ' + comma(m.lifeLo) + ' лет: кровлю придётся вскрывать вместе с панелями. Либо выберите покрытие с большим сроком, либо меняйте кровлю до монтажа.');
      if (c.az === 'n' && !flatForm) yel('Северный скат даёт около 60 % выработки южного: солнечные модули туда ставят редко.');
      if ((scheme === 'in' || scheme === 'bipv') && c.pvVent === 'no') red('Панели в кровле без вентиляционного контура 60–100 мм: перегрев снижает выработку на 10–15 %, под лотком собирается конденсат. Нужен приток у карниза и выход у конька.');
      if ((scheme === 'in' || scheme === 'bipv') && flatForm) yel('Схема «в кровлю» для плоской кровли не применяется, используйте балласт или рамы с уклоном 10–15° без проколов мембраны.');
      if (scheme === 'ballast' && !flatForm) yel('Балластные рамы рассчитаны на плоские кровли; на скате используют крепёж на кровле.');
      if (scheme === 'ballast' && c.sk >= 1.6) yel('Плоская кровля с балластными рамами при снеге от 1,6 кПа: проверьте несущую способность плиты на балласт 20–35 кг/м² плюс снег.');
      if ((m.id === 'ceramic' || m.id === 'cement' || m.id === 'slate') && scheme === 'on') yel('Панели на ' + m.short.toLowerCase() + ': сверлить штучное покрытие нельзя, используют специальные крюки под черепицу и кровельные проходки по паспорту.');
      if (!flatForm && c.alpha >= 12) yel('Снегозадержатели ставят ниже массива панелей: снег сходит с гладких модулей лавиной, длину ряда увеличивают в 1,5 раза.');
    }
    r.warns = warns;
    return r;
  }

  var api = { calc: calc, geometry: geometry, fit: fit, life: life, byId: byId, TIMBER: TIMBER, GUTTERS: GUTTERS, H_LADDER: H_LADDER, TILT_PTS: TILT_PTS, AZ: AZ, MATERIALS: D };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.TegaRoof = api;
})(typeof window !== 'undefined' ? window : globalThis);
