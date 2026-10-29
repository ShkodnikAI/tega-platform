/* Модель расчёта бассейна: оборот и насос, фильтр, трубы, нагрев и энергия сезона, обеззараживание, промывка.
   Формулы и ориентиры практики описаны в статье «Бассейны». Расчёт ориентировочный, не проект.
   Работает и в браузере (window.TegaPool), и в Node (module.exports) для проверки. Биопул считает зону регенерации через TegaPond. */
(function (root) {
  'use strict';

  var TURN_H = { skim: 5, over: 3.5, frame: 5 };                 /* часы полного оборота, ориентир практики */
  var PUMPS = [
    { qmax: 8, name: 'до 8 м³/ч', w: '0,5–0,8 кВт' }, { qmax: 12, name: '8–12 м³/ч', w: '0,75–1,1 кВт' },
    { qmax: 18, name: '12–18 м³/ч', w: '1,1–1,5 кВт' }, { qmax: 30, name: '18–30 м³/ч', w: '1,5–2,2 кВт' }
  ];
  var FILTERS = [400, 500, 600, 750, 900];                        /* диаметры песочных фильтров, мм */
  var PIPES = [{ d: 40, id: 33 }, { d: 50, id: 44 }, { d: 63, id: 57 }, { d: 75, id: 68 }, { d: 90, id: 82 }, { d: 110, id: 101 }, { d: 125, id: 115 }, { d: 160, id: 147 }, { d: 200, id: 184 }]; /* ПВХ-труба, внутренний диаметр, мм */
  var UV_LADDER = [11, 24, 36, 55, 75, 110, 150, 220];
  var HP = [5, 8, 11, 14, 18, 22, 28];                            /* тепловая мощность теплового насоса, кВт, ряд для подбора */
  var K_OPEN = 0.25;                                              /* кВт/м² потерь открытого зеркала за сезон, ориентир */
  var K_COVER = { none: 1, bubble: 0.55, slat: 0.45 };
  var K_PLACE = { out: 1, pav: 0.35, in: 0.20 };
  var ETA = { eco: 0.35, std: 0.45, prem: 0.55 };

  function ceil(x) { return Math.ceil(x - 1e-9); }
  function pickPump(q) {
    for (var i = 0; i < PUMPS.length; i++) if (PUMPS[i].qmax >= q - 1e-9) return { n: 1, cls: PUMPS[i] };
    var l = PUMPS[PUMPS.length - 1];
    return { n: ceil(q / l.qmax), cls: l };
  }
  function pickFilter(q) {
    var a = q / 40, d = Math.sqrt(4 * a / Math.PI) * 1000;
    for (var i = 0; i < FILTERS.length; i++) if (FILTERS[i] >= d - 1e-9) return { n: 1, d: FILTERS[i] };
    var amax = Math.PI * Math.pow(FILTERS[FILTERS.length - 1] / 1000, 2) / 4;
    return { n: ceil(a / amax), d: FILTERS[FILTERS.length - 1] };
  }
  function pickPipe(q, vmax) {
    for (var i = 0; i < PIPES.length; i++) {
      var v = q / 3600 / (Math.PI * Math.pow(PIPES[i].id / 1000, 2) / 4);
      if (v <= vmax + 1e-9) return { d: PIPES[i].d, v: v };
    }
    var p = PIPES[PIPES.length - 1];
    return { d: p.d, v: q / 3600 / (Math.PI * Math.pow(p.id / 1000, 2) / 4) };
  }
  function cell(v) { return v <= 20 ? 8 : v <= 40 ? 16 : v <= 70 ? 24 : v <= 100 ? 32 : 32 + 8 * ceil((v - 100) / 30); }
  function pickUV(w) {
    for (var i = 0; i < UV_LADDER.length; i++) if (UV_LADDER[i] >= w - 1e-9) return { n: 1, w: UV_LADDER[i] };
    return { n: ceil(w / 220), w: 220 };
  }
  function pickHP(kw) {
    for (var i = 0; i < HP.length; i++) if (HP[i] >= kw - 1e-9) return { n: 1, kw: HP[i] };
    return { n: ceil(kw / 28), kw: 28 };
  }

  function energy(c, S, V, coverKey) {
    var f = K_PLACE[c.place] * K_COVER[coverKey];
    var loss = S * K_OPEN * f;                         /* кВт */
    var hours = c.months * 30 * 24;
    var dT = Math.max(0, c.tTarget - c.tStart);
    var e0 = V * 1.163 * dT;                           /* кВт·ч на первичный нагрев */
    var eHeat = c.heat === 'none' ? 0 : loss * hours + e0;
    return { loss: loss, hours: hours, e0: e0, eHeat: eHeat, dT: dT };
  }
  function elec(c, eHeat) {
    if (c.heat === 'hp') return eHeat / c.cop;
    if (c.heat === 'el') return eHeat;
    return 0;                                          /* котёл: топливо, не электричество */
  }

  function calc(c) {
    var w = [];
    function warn(l, t) { w.push({ level: l, text: t }); }
    var bio = c.type === 'bio', frame = c.type === 'frame';
    var S = c.L * c.W, V = S * c.d;
    var tH = bio ? 1 / 1.5 : TURN_H[c.type];
    var Q = V / tH;
    var pump, perPump;
    if (bio) {
      var P = root.TegaPond || (typeof require !== 'undefined' ? require('./pond-model.js') : null);
      pump = { n: 1, cls: null };
      for (var i = 0; i < P.PUMPS.length; i++) if (P.PUMPS[i].qmax >= Q - 1e-9) { pump = { n: 1, cls: P.PUMPS[i] }; break; }
      if (!pump.cls) { var lp = P.PUMPS[P.PUMPS.length - 1]; pump = { n: ceil(Q / lp.qmax), cls: lp }; }
    } else pump = pickPump(Q);
    perPump = Q / pump.n;
    var eta = ETA[c.budget] || ETA.std, variable = c.budget !== 'eco';
    var Pel = Q * c.H / (367 * eta);                   /* кВт */
    var kwhPump = Pel * c.pumpHours * (variable ? 0.6 : 1);

    var cartridge = !bio && V <= 20;
    var filt = bio ? null : pickFilter(perPump * pump.n);
    var filtArea = filt ? filt.n * Math.PI * Math.pow(filt.d / 1000, 2) / 4 : 0;
    var sand = filt ? filtArea * 0.5 * 1500 : 0;       /* кг, слой около 0,5 м */
    var wash = filt ? filtArea * 40 * (4 / 60) : 0;    /* м³ воды на промывку, 4 мин при около 40 м³/ч·м² */
    var suc = pickPipe(Q, 1.5), prs = pickPipe(Q, 2.0);
    var skim = bio || c.type === 'over' ? 0 : Math.max(1, ceil((bio ? 0 : S) / 25));
    var noz = bio ? 0 : Math.max(2, ceil(Q / 4));
    var gutter = c.type === 'over' ? 2 * (c.L + c.W) : 0;
    var tank = c.type === 'over' ? V * 0.05 : 0;

    /* обеззараживание */
    var cellG = (c.disinf === 'elec' || c.disinf === 'elecuv') ? cell(V) : 0;
    var uvW = (c.disinf === 'elecuv' || c.disinf === 'uv') ? V * (c.disinf === 'uv' && bio ? 1.5 : 1.5) : 0;
    var uv = uvW > 0 ? pickUV(uvW) : null;
    var doser = c.disinf === 'dose' || c.disinf === 'elec' || c.disinf === 'elecuv';
    var salt = cellG ? V * 4 : 0;
    var fresh = c.bathers * 30 / 1000;                 /* м³/сут свежей воды, 30 л на человека */

    /* энергия */
    var cov = frame && c.cover === 'none' ? 'none' : c.cover;
    var en = energy(c, S, V, cov), enOpen = energy(c, S, V, 'none');
    var eEl = elec(c, en.eHeat), eElOpen = elec(c, enOpen.eHeat);
    var p0 = en.dT > 0 ? V * 1.163 * en.dT / c.t0 : 0;
    var hp = c.heat === 'hp' ? pickHP(Math.max(en.loss * 1.3, p0 / 4)) : null;
    var hpHours = hp ? en.e0 / (hp.kw * hp.n) : 0;
    var days = c.months * 30;
    var kwhUV = uv ? uv.n * uv.w * 12 / 1000 : 0;
    var kwhCell = cellG ? (cellG * 0.007 * 12 / 1) : 0; /* ячейка около 7 Вт на 1 г/ч, 12 ч/сут */
    var kwhDay = kwhPump + kwhUV + kwhCell;
    var kwhSeason = kwhDay * days + eEl;
    var eFuel = c.heat === 'boiler' ? en.eHeat / 0.9 : 0;

    /* биопул: зона регенерации и растения по модели пруда */
    var bioRes = null;
    if (bio) {
      var Pn = root.TegaPond || require('./pond-model.js');
      bioRes = Pn.calc({ type: 'bath', L: c.L, W: c.W, dAvg: c.d, dPit: Math.max(c.d, 1.8), fish: 'none', winterFish: false, power: true, ground: 'loam', budget: c.budget,
        plot: 0, border: c.border, reg: c.reg, turn: 1.5, lift: 0.3, trace: 4, turns: 1, zBog: 0, zShal: 0, zDeep: 0, zFlt: 0, species: 'base' });
    }

    /* предупреждения */
    var chem = !bio;
    if (bio && c.disinf !== 'none' && c.disinf !== 'uv') warn('red', 'Биопул несовместим с хлорированием и электролизом: хлор убивает растения и биоплёнку. Оставьте УФ как опцию или без обеззараживания.');
    if (chem && c.disinf === 'none') warn('red', 'Химический бассейн без обеззараживания недопустим: выберите хлор, электролиз или связку электролиз + УФ.');
    if (chem && c.disinf === 'uv') warn('red', 'УФ сам по себе не оставляет остаточного дезинфектанта в воде: нужен хлор или электролиз.');
    if (bio && c.reg < 30 - 1e-9) warn('red', 'Зона регенерации меньше 30 % площади: прозрачность без химии не гарантирована, ориентир 30–50 %.');
    if (c.place === 'in' && c.cover === 'none') warn('red', 'В помещении без покрытия влага и конденсат разрушают конструкции: нужно ламельное покрытие или осушение воздуха с вентиляцией.');
    if (c.drain !== 'own') warn('red', 'Промывочные и дренажные воды нельзя сбрасывать на соседний участок или за границу своего: отводите их в свой дренаж или канализацию (требования проверьте по Водному кодексу и местным правилам).');
    if (chem && c.bathers > 8 && !doser) warn('yellow', 'Больше 8 купающихся и ручная химия: на пиках нагрузки нужны автоматические дозаторы pH и ORP.');
    if (c.source === 'well') warn('yellow', 'Скважина: до подбора химии сделайте анализ воды на железо и жёсткость, возможна предподготовка.');
    if (c.place === 'out' && c.months > 6) warn('yellow', 'Открытый бассейн дольше 6 месяцев в году нерационален: зимой потери растут, нужен павильон или помещение.');
    if (c.border < 3 - 1e-9 && !frame) warn('yellow', 'Меньше 3 м до границы: по СН 3.01.03-2020 с Изменением № 4 (с 01.12.2026) для жилого дома 3 м, для хозяйственных построек 2 м; отдельная норма для бассейна из доступных источников не подтверждена, уточните в отделе архитектуры.');
    if (!frame && c.winter === 'none') warn('yellow', 'Зимний сценарий не выбран: заранее решите, как бассейн переживёт зиму.');
    if (!frame && c.winter === 'drain') warn('yellow', 'Слив чаши на зиму: при высоком уровне грунтовых вод пустую чашу выдавливает, решение только по проекту.');
    if (frame) warn('yellow', 'Каркасный бассейн не зимует в грунте: демонтаж или консервация строго по паспорту производителя.');
    if (c.d > 1.6 + 1e-9) warn('yellow', 'Глубина больше 1,6 м: для семейного купания избыточна (больше воды и нагрева). Прыжки с тумбы возможны только от 2,4 м и по проекту.');
    if (c.tTarget > 30 + 1e-9) warn('yellow', 'Вода выше +30 °С: потери и испарение растут быстро.');
    if (c.heat !== 'none' && c.place === 'out' && c.cover === 'none') warn('yellow', 'Нагрев без покрытия: основная часть тепла уходит с испарением, покрытие окупается первым.');
    if (c.heat === 'hp' && c.cop > 6 + 1e-9) warn('yellow', 'COP выше 6 для среднесезонных условий Беларуси нереалистичен: паспортные значения даны при тёплом воздухе.');
    if (!frame) warn('yellow', 'Стационарный бассейн: порядок оформления уточните в отделе архитектуры и строительства. Указ № 202 от 13.06.2022 касается одноквартирных домов и нежилых капитальных построек 5-го класса сложности, бассейн в его тексте не назван.');
    if (pump.n > 1) warn('yellow', 'Расход больше типового класса: нужно несколько насосов или решение для большого объёма.');
    if (c.safety === 'none') warn('yellow', 'Нет защиты детей: покрытие, ограждение 1,2 м или датчик падения в воду.');

    return {
      S: S, V: V, tH: tH, Q: Q, H: c.H, eta: eta, Pel: Pel, variable: variable, pump: pump, perPump: perPump, kwhPump: kwhPump,
      cartridge: cartridge, filt: filt, filtArea: filtArea, sand: sand, wash: wash, suc: suc, prs: prs, skim: skim, noz: noz, gutter: gutter, tank: tank,
      cellG: cellG, uv: uv, uvW: uvW, doser: doser, salt: salt, fresh: fresh,
      en: en, enOpen: enOpen, eEl: eEl, eElOpen: eElOpen, hp: hp, hpHours: hpHours, p0: p0, eFuel: eFuel,
      kwhUV: kwhUV, kwhCell: kwhCell, kwhDay: kwhDay, kwhSeason: kwhSeason, bio: bioRes, warns: w
    };
  }

  var api = { calc: calc, K_OPEN: K_OPEN, K_COVER: K_COVER, K_PLACE: K_PLACE, PUMPS: PUMPS, FILTERS: FILTERS, energy: energy, elec: elec };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.TegaPool = api;
})(typeof window !== 'undefined' ? window : globalThis);
