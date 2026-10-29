/* Модель расчёта парной: печь или парогенератор, электрика, вентиляция, погонаж ограждений и отделки, хамам, камни, энергия.
   Формулы и ориентиры практики описаны в статье «Бани и сауны». Расчёт ориентировочный, не проект.
   Работает и в браузере (window.TegaBath), и в Node (module.exports) для проверки. */
(function (root) {
  'use strict';

  var DOOR = 1.6;                                                   /* площадь двери, м² */
  var HEATERS = [4.5, 6, 8, 9, 10.5, 12, 13.5, 15, 18];             /* ряд мощностей электрокаменок, кВт */
  var STEAM = [6, 9, 12, 15, 18, 24];                               /* ряд парогенераторов хамама, кВт */
  var HYB_STEAM = [3, 6, 9, 12];                                    /* парогенератор гибридной кабины, кВт */
  var K_SAUNA = 1.1, K_UNHEATED = 0.5;                              /* кВт/м³ и кВт/м² неутеплённой поверхности */
  var K_STEAM = 1.8, STEAM_MIN = 1.5, STEAM_MAX = 2.0;              /* кВт/м³ хамама и коридор */
  var K_IR = 1.0;
  var RAMP = { fin: 0.75, ham: 0.6, hyb: 0.75, ir: 0.25 };          /* часы разгона */
  var AIR = { fin: 5, rus: 5, hyb: 5, ir: 3, ham: 3 };              /* кратность вентиляции, об/ч */
  var BREAKERS = [10, 16, 20, 25, 32, 40, 50, 63];

  function ceil(x) { return Math.ceil(x - 1e-9); }
  function pickUp(ladder, p) {
    for (var i = 0; i < ladder.length; i++) if (ladder[i] >= p - 1e-9) return { n: 1, kw: ladder[i] };
    var l = ladder[ladder.length - 1];
    return { n: ceil(p / l), kw: l };
  }
  function pickSteam(V) {
    var p = V * K_STEAM, lo = V * STEAM_MIN, hi = V * STEAM_MAX, best = null, d;
    STEAM.forEach(function (k) {
      if (k >= lo - 1e-9 && k <= hi + 1e-9) {
        d = Math.abs(k - p);
        if (!best || d < best.d) best = { d: d, kw: k };
      }
    });
    return best ? { n: 1, kw: best.kw } : pickUp(STEAM, p);
  }

  /* Линия питания по мощности (таблица практики). Ток по 380 В, cos φ = 1 для ТЭНов. */
  function line(kw) {
    var r;
    if (kw <= 3.5) r = { v: 220, cable: '3×2,5', mm2: 2.5, brk: 16 };
    else if (kw <= 7) r = { v: 220, cable: '3×6', mm2: 6, brk: 32 };
    else if (kw <= 9) r = { v: 380, cable: '5×2,5', mm2: 2.5, brk: 16 };
    else if (kw <= 12) r = { v: 380, cable: '5×4', mm2: 4, brk: 20 };
    else if (kw <= 16) r = { v: 380, cable: '5×6', mm2: 6, brk: 25 };
    else if (kw <= 20) r = { v: 380, cable: '5×6', mm2: 6, brk: 32 };
    else if (kw <= 24) r = { v: 380, cable: '5×10', mm2: 10, brk: 40 };
    else r = { v: 380, cable: 'по проекту', mm2: NaN, brk: NaN };
    r.kw = kw;
    r.amp = r.v === 220 ? kw * 1000 / 220 : kw * 1000 / (Math.sqrt(3) * 380);
    r.rcd = 30;
    return r;
  }

  function duct(q) { return q <= 100 ? 100 : q <= 160 ? 125 : q <= 250 ? 150 : 200; }

  function calc(c) {
    var t = c.type, warns = [], V = c.L * c.W * c.H, Sw = 2 * (c.L + c.W) * c.H, Sc = c.L * c.W, Sf = Sc;
    var Sfin = Sw + Sc - DOOR;
    var Su = (c.unheated || 0) + (c.pano ? 2 : 0);
    var r = { type: t, V: V, Sw: Sw, Sc: Sc, Sf: Sf, Sfin: Sfin, Su: Su };
    var red = function (s) { warns.push({ level: 'red', text: s }); };
    var yel = function (s) { warns.push({ level: 'yellow', text: s }); };

    /* печь, парогенератор */
    var el = 0;          /* электрическая мощность основного прибора, кВт */
    if (t === 'fin' || t === 'hyb') {
      r.P = V * K_SAUNA + K_UNHEATED * Su;
      r.Pmin = V * 1.0; r.Pmax = V * 1.4;
      r.heater = pickUp(HEATERS, r.P);
      el = r.heater.kw * r.heater.n;
      r.perM3 = el / V;
    } else if (t === 'ham') {
      r.P = V * K_STEAM; r.Pmin = V * STEAM_MIN; r.Pmax = V * STEAM_MAX;
      r.heater = pickSteam(V);
      el = r.heater.kw * r.heater.n;
      r.perM3 = el / V;
    } else if (t === 'ir') {
      r.P = V * K_IR; r.Pmin = V * 0.9; r.Pmax = V * 1.1;
      r.heater = { n: 1, kw: Math.round(r.P * 10) / 10 };
      el = r.P;
      r.perM3 = el / V;
    } else if (t === 'rus') {
      r.wood = { passport: V * 1.2, stoneMin: Math.max(100, V * 12) };
      r.perM3 = NaN;
    }
    if (t === 'hyb') r.steamGen = pickUp(HYB_STEAM, V * 1.0);
    r.el = el;

    /* хамам: обогрев поверхностей, гидроизоляция, отделка */
    if (t === 'ham') {
      var floorKw = Sf * 0.16, benchKw = c.L * 0.5 * 0.12, wallKw = Math.max(0, Sw - DOOR) * 0.09;
      r.surf = { floor: floorKw, bench: benchKw, wall: wallKw, total: floorKw + benchKw + wallKw };
      r.ham = {
        wp: (Sw - DOOR + Sc + Sf) * 1.15,
        xps: (Sw + Sc) * 1.05,
        mosaic: Sfin * 1.1,
        floorTile: Sf * 1.1,
        slopeMin: c.L * 10, slopeMax: c.L * 20        /* перепад пола к трапу, мм */
      };
    }

    /* электрика */
    if (el > 0) {
      r.lineMain = line(r.heater.n > 1 ? r.heater.kw : el);
      r.lineMain.count = r.heater.n;
    }
    if (r.surf) r.lineSurf = line(Math.max(r.surf.total, 0.1));
    r.elTotal = el + (r.surf ? r.surf.total : 0);

    /* вентиляция */
    var n = AIR[t] || 5;
    r.air = { n: n, q: V * n, qmin: V * 3, qmax: V * 6 };
    r.air.d = duct(r.air.q);

    /* ограждения (сауна, русская, гибрид) */
    if (t === 'fin' || t === 'rus' || t === 'hyb') {
      var l1 = Math.min(c.L, 2.0), l2 = Math.max(c.W - 0.4, 0);
      r.enc = {
        woolWall: Sw, woolCeil: Sc, woolWallM3: Sw * 0.05, woolCeilM3: Sc * 0.1,
        foil: Sfin * 1.1, battens: Sfin / 0.6, board: Sfin * 1.05,
        tier1: l1, tier2: l2, slats: (l1 + l2) * 5
      };
      var stoneKg = t === 'rus' ? Math.max(100, V * 12) : Math.max(40, V * 8);
      r.stones = { kg: stoneKg, packs: ceil(stoneKg / 20), closed: t === 'rus' };
    }

    /* эксплуатация (электрическая часть) */
    if (t !== 'rus' && el > 0) {
      var ramp = RAMP[t], ses = c.session || 1.5, p = r.elTotal;
      r.kwh = { ramp: ramp, ses: ses, e: p * ramp + p * ses * 0.4 };
      r.kwh.cost = isFinite(c.tariff) ? r.kwh.e * c.tariff : NaN;
    }

    /* предупреждения */
    if (el >= 8 - 1e-9 && c.supply === '220') red('Прибор ' + String(el).replace('.', ',') + ' кВт: от 8 кВт нужен ввод 380 В, 5 жил. Однофазная линия на такую мощность не рассчитывается.');
    if (isFinite(c.limit) && c.limit > 0 && r.elTotal > c.limit + 1e-9 && t !== 'rus') red('Не хватает мощности: нужно ' + String(Math.round(r.elTotal * 10) / 10).replace('.', ',') + ' кВт при лимите ' + String(c.limit).replace('.', ',') + ' кВт. Уменьшите объём, возьмите прибор меньше (с обоснованием) или расширьте ввод.');
    if (c.door === 'in' || c.door === 'lock') red('Дверь парной открывается наружу и без запоров: при плохом самочувствии человек должен выйти без усилий.');
    if (c.vent === 'no' || c.vent === 'gap') red('Нужна организованная вентиляция: приток под печь, вытяжка диагонально, кратность ' + n + ' об/ч. Форточка и щель под дверью её не заменяют.');
    if (t === 'rus' && V < 6) yel('Для русской бани объём менее 6 м³ мал для качественного пара: рассмотрите ИК-кабину, сауну или гибрид.');
    if (t === 'ham') {
      if (c.drain === 'no') red('Хамам без трапа и уклона нельзя: гидроизоляция корытом с заходом на стены и уклон пола 1–2 % к трапу.');
      if (c.softener === 'no') yel('Парогенератору нужны умягчение воды и автодренаж: без них накипь выводит его из строя за сезон.');
      if (c.insul === 'wool') yel('В хамаме вата намокает: под гидроизоляцией применяют плотный XPS.');
      if (c.insul === 'pps') yel('В хамаме вместо пенопласта ППС берут плотный экструдированный XPS: он не впитывает воду.');
    } else if (t !== 'ir' && (c.insul === 'pps' || c.insul === 'xps')) {
      red('В парной только базальтовая вата: пенопласт и XPS при нагреве выделяют вредные вещества и плавятся.');
    }
    if (t === 'rus' && c.chimney === 'no') yel('Дровяная печь без проекта дымохода: нужны разделка, отступки по паспорту (не менее 500 мм до защищённой стены, ориентир практики), предтопочный лист и датчик CO.');
    if (c.place === 'sep' && isFinite(c.border) && c.border < 2) yel('Отдельно стоящая баня как хозпостройка: по публикациям об Изменении № 4 к СН 3.01.03-2020 (с 01.12.2026) не менее 2 м до границы смежного участка, сверьте с текстом.');
    if (t === 'hyb') yel('Гибридная кабина: профили климата и мощности задаёт паспорт; ввод считайте по одновременной работе каменки и генератора.');
    if (c.barrel) yel('Бочка или уличный модуль: объём и ограждение задаёт производитель, пирог с фольгой и вагонкой для них не считается, вентиляцию и электрику проверьте по паспорту.');
    if (c.salt) yel('Соляные панели ставят вне зоны прямого жара печи, крепёж и допустимую температуру задаёт паспорт панелей.');
    r.warns = warns;
    return r;
  }

  var api = { calc: calc, line: line, pickUp: pickUp, pickSteam: pickSteam, duct: duct, HEATERS: HEATERS, STEAM: STEAM, DOOR: DOOR, BREAKERS: BREAKERS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.TegaBath = api;
})(typeof window !== 'undefined' ? window : globalThis);
