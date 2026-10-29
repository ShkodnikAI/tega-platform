/* Модель расчёта пруда: оборот воды, насос, биофильтр, УФ, скиммеры, аэрация, плёнка, растения, эксплуатация.
   Формулы и ориентиры практики описаны в статье «Пруды и биопруды». Расчёт ориентировочный, не проект.
   Работает и в браузере (window.TegaPond), и в Node (module.exports) для проверки. */
(function (root) {
  'use strict';

  var TURN = { decor: 0.75, bath: 1.5, koi: 3.0 };          /* об/ч, середина диапазонов практики */
  var TURN_RANGE = { decor: [0.5, 1], bath: [1, 2], koi: [2, 4] };
  var FILTER = { decor: 0.12, koi: 0.35 };                    /* доля объёма пруда */
  var UV = { decor: 2, bath: 2, koi: 1.5 };                   /* Вт на м³ */
  var UV_LADDER = [11, 24, 36, 55, 75, 110, 150, 220];
  var ETA = { eco: 0.35, std: 0.45, prem: 0.55 };
  var PUMPS = [
    { qmax: 10, name: 'до 10 м³/ч', w: '60–90 Вт' },
    { qmax: 25, name: '10–25 м³/ч', w: '120–250 Вт' },
    { qmax: 50, name: '25–50 м³/ч', w: '300–500 Вт' },
    { qmax: 110, name: '50–110 м³/ч', w: '550–900 Вт' }
  ];
  var COMP = [{ l: 60, w: 35 }, { l: 100, w: 60 }, { l: 150, w: 90 }, { l: 250, w: 150 }];
  var NEED = { none: 0.30, mod: 0.35, koi: 0.45 };            /* доля зеркала под растениями по рыбе */

  function ceil(x) { return Math.ceil(x - 1e-9); }
  function pickUV(w) {
    for (var i = 0; i < UV_LADDER.length; i++) if (UV_LADDER[i] >= w - 1e-9) return { n: 1, w: UV_LADDER[i] };
    var n = ceil(w / UV_LADDER[UV_LADDER.length - 1]);
    return { n: n, w: UV_LADDER[UV_LADDER.length - 1] };
  }
  function pickPump(q) {
    for (var i = 0; i < PUMPS.length; i++) if (PUMPS[i].qmax >= q - 1e-9) return { n: 1, cls: PUMPS[i] };
    var last = PUMPS[PUMPS.length - 1];
    return { n: ceil(q / last.qmax), cls: last };
  }
  function pickComp(a) {
    for (var i = 0; i < COMP.length; i++) if (COMP[i].l >= a - 1e-9) return { n: 1, c: COMP[i] };
    var last = COMP[COMP.length - 1];
    return { n: ceil(a / last.l), c: last };
  }
  function pack(n, step) { return step > 1 ? Math.ceil(n / step - 1e-9) * step : n; }

  /* распределение целого поровну между видами */
  function split(total, names) {
    var out = [], base = Math.floor(total / names.length), rem = total - base * names.length;
    names.forEach(function (nm, i) { out.push({ name: nm, n: base + (i < rem ? 1 : 0) }); });
    return out;
  }

  function plants(c, S, Sreg) {
    var rows = [], z;
    if (c.type === 'bath') {
      var n = ceil(Sreg * 8);
      split(n, ['Ирис аировидный', 'Камыш озёрный (в щебне bog-фильтра)', 'Сусак зонтичный', 'Рогоз малый (только в контейнере)']).forEach(function (s) {
        rows.push({ zone: 'Зона регенерации', area: Sreg, name: s.name, n: s.n, pack: 5, box: /контейнер/.test(s.name) });
      });
      return rows;
    }
    var a = { bog: S * c.zBog / 100, shal: S * c.zShal / 100, deep: S * c.zDeep / 100, flt: S * c.zFlt / 100 };
    var ext = c.species === 'ext';
    var zones = [
      { id: 'bog', zone: 'Болотная 0–10 см', area: a.bog, dens: 6, names: ['Ирис аировидный', 'Калужница болотная', 'Осока ложносыть', 'Ситник развесистый'], pack: 5 },
      { id: 'shal', zone: 'Мелководье 10–40 см', area: a.shal, dens: 4, names: ext ? ['Сусак зонтичный', 'Камыш озёрный (в контейнере)', 'Мята водная (в контейнере)', 'Рогоз малый (только в контейнере)'] : ['Сусак зонтичный', 'Камыш озёрный (в контейнере)'], pack: 5 },
      { id: 'deep', zone: 'Глубоководная 40–80 см', area: a.deep, dens: 0.5, names: S < 30 ? ['Кувшинка четырёхгранная'] : ['Кувшинка белая', 'Кувшинка четырёхгранная'].concat(ext ? ['Кубышка жёлтая'] : []), pack: 1 },
      { id: 'flt', zone: 'Плавающие', area: a.flt, dens: 2, names: ['Водокрас лягушачий', 'Рдест блестящий'], pack: 5 }
    ];
    zones.forEach(function (zn) {
      var total = ceil(zn.area * zn.dens);
      if (total <= 0) return;
      split(total, zn.names).forEach(function (s) {
        if (s.n > 0) rows.push({ zone: zn.zone, area: zn.area, name: s.name, n: s.n, pack: zn.pack, box: /контейнер/.test(s.name) });
      });
    });
    return rows;
  }

  function calc(c) {
    var w = [];
    function warn(level, text) { w.push({ level: level, text: text }); }
    var S = c.L * c.W;
    var V = S * c.dAvg;
    var bath = c.type === 'bath', koi = c.type === 'koi';
    var k = isFinite(c.turn) && c.turn > 0 ? c.turn : TURN[c.type];
    var Q = V * k;
    var H = c.lift + 0.15 * c.trace + 0.5 * c.turns;
    var eta = ETA[c.budget] || ETA.std;
    var Pel = Q * H / (367 * eta) * 1000;               /* Вт на валу, из гидравлической мощности */
    var pump = pickPump(Q / 1);
    var perPump = Q / pump.n;
    var variable = c.budget === 'prem';

    var Sreg = bath ? S * c.reg / 100 : 0;
    var Swim = bath ? S - Sreg : S;
    var Vf = bath ? 0 : V * FILTER[c.type];
    var bog = bath ? { area: Sreg, gravel: Sreg * 0.3 } : null;
    var filt;
    if (bath) filt = 'bog-фильтр: щебень 20–40 мм слоем около 0,3 м на зоне регенерации, перфорированная раздача';
    else if (koi) filt = 'барабанный фильтр и биомодули общим объёмом загрузки по расчёту';
    else if (V <= 40) filt = 'проточный биофильтр, объём загрузки по расчёту';
    else filt = 'модульный биофильтр, объём загрузки по расчёту';

    var uvW = V * UV[c.type];
    var uv = pickUV(uvW);
    var nSkim = Math.max(1, ceil(Swim / 30));
    var skimT = Swim / nSkim <= 25 ? 'поверхностный плавающий' : Swim / nSkim <= 40 ? 'береговой встроенный' : 'береговой двойной';
    var drain = koi ? Math.max(2, ceil(S * 0.2 / 20)) : 0;
    var A = V * (c.winterFish ? 8 : 4);
    var comp = pickComp(A);
    var deicer = c.winterFish && c.fish !== 'none' ? 1 : 0;

    var Lp = c.L + 2 * c.dPit + 1, Wp = c.W + 2 * c.dPit + 1;
    var Sp = Lp * Wp * 1.1;
    var geo = Sp * 1.15;
    var thick = (Sp <= 120 && c.dPit <= 2.0) ? 1.0 : 1.5;
    var earth = V * 1.15;

    var kwhSummer = (Pel * 24 * (variable ? 0.7 : 1) + uv.n * uv.w * 12) / 1000;
    var compOpt = c.fish === 'none';
    var kwhWinter = ((compOpt ? 0 : comp.n * comp.c.w * 24) + deicer * 200 * 12) / 1000;

    var pl = plants(c, S, Sreg);
    var plTotal = 0, plBuy = 0;
    pl.forEach(function (r) { r.buy = pack(r.n, r.pack); plTotal += r.n; plBuy += r.buy; });

    var fishLoad = c.fish === 'koi' ? 'koi' : c.fish === 'mod' ? 'mod' : 'none';
    var need = NEED[fishLoad], eff, deficit = 0;
    if (bath) { eff = c.reg / 100; need = 0.30; }
    else eff = (c.zBog + c.zShal + c.zFlt) / 100;
    if (eff < need - 1e-9) deficit = (need - eff) * S;

    /* предупреждения */
    if (c.winterFish && c.fish !== 'none' && c.dPit < 1.5 - 1e-9) warn('red', 'Зимовальная яма меньше 1,5 м: она должна быть ниже промерзания (около 1 м, по проекту), ориентир 1,5–1,8 м.');
    if (c.dAvg > c.dPit + 1e-9) warn('red', 'Средняя глубина больше глубины ямы: проверьте данные.');
    if (koi && k < 2 - 1e-9) warn('red', 'Кой-пруд: оборот 2–4 об/ч, иначе биофильтр не справится.');
    if (!koi && c.fish === 'koi') warn('yellow', 'Кои в пруде типа «' + (bath ? 'купальный' : 'декоративный') + '»: нагрузка по азоту как у кой-пруда, считайте как кой.');
    if (bath && c.reg < 30 - 1e-9) warn('red', 'Зона регенерации меньше 30 % площади: прозрачность без химии не гарантирована.');
    if (bath) warn('yellow', 'Купание: вода должна отвечать отдельным санитарным требованиям, они жёстче, чем для декоративного пруда. Продумайте ограждение, выход и безопасность детей.');
    if (S > 100 + 1e-9) warn('yellow', 'Зеркало больше 100 м² (1 сотка): это не пруд-копань по упрощённому порядку Закона № 148-З (по публикациям, сверьте с текстом закона), нужны проект и согласования.');
    if (c.dPit > 2 + 1e-9) warn('yellow', 'Глубина больше 2 м: выходит за пределы пруда-копани без проекта (по публикациям о Законе № 148-З, сверьте с текстом).');
    if (c.plot > 0 && S > c.plot * 100 * 0.05 + 1e-9) warn('yellow', 'Зеркало больше 5 % площади участка: за пределами упрощённого порядка (по публикациям о Законе № 148-З, сверьте с текстом).');
    if (c.border < 3 - 1e-9) warn('red', 'Пруд ближе 3 м от границы соседнего участка (от береговой линии): по Закону № 148-З отступ не менее 3 м, сверьте с текстом закона.');
    if (c.ground === 'quick') warn('yellow', 'Плывун: нужна пригрузка плёнки и террас или анкерная плита, расчёт индивидуально, лучше с геологией.');
    if (c.ground === 'sand') warn('yellow', 'Песок: стенки осыпаются при выемке, террасы укрепляют, под плёнку обязателен плотный геотекстиль.');
    if (!c.power) warn('yellow', 'Нет электричества: насос и аэрацию не запустить. Предусмотрите ввод, ИБП или генератор.');
    if (deficit > 0.05) warn('yellow', 'Мало растений: увеличьте зону растений на ' + deficit.toFixed(1).replace('.', ',') + ' м² (нужно около ' + Math.round(need * 100) + ' % зеркала при такой нагрузке по рыбе).');
    if (k < TURN_RANGE[c.type][0] - 1e-9 && !koi) warn('yellow', 'Оборот ' + k + ' об/ч ниже ориентира ' + TURN_RANGE[c.type].join('–') + ' об/ч для этого типа.');
    if (k > TURN_RANGE[c.type][1] + 1e-9) warn('yellow', 'Оборот ' + k + ' об/ч выше ориентира ' + TURN_RANGE[c.type].join('–') + ' об/ч: насос «про запас» вымывает биоплёнку.');
    if (H > 5) warn('yellow', 'Напор больше 5 м: подбирайте насос по его характеристике, класс по расходу даёт только ориентир.');
    if (pump.n > 1) warn('yellow', 'Расход больше 110 м³/ч: нужно несколько насосов или насос-пруд большого размера.');

    return {
      S: S, V: V, k: k, Q: Q, H: H, Pel: Pel, eta: eta, variable: variable, pump: pump, perPump: perPump,
      Sreg: Sreg, Swim: Swim, Vf: Vf, filt: filt, bog: bog, uvW: uvW, uv: uv, nSkim: nSkim, skimT: skimT, drain: drain,
      A: A, comp: comp, compOpt: compOpt, deicer: deicer, Lp: Lp, Wp: Wp, Sp: Sp, geo: geo, thick: thick, earth: earth,
      kwhSummer: kwhSummer, kwhWinter: kwhWinter, plants: pl, plTotal: plTotal, plBuy: plBuy, need: need, eff: eff, deficit: deficit, warns: w
    };
  }

  var api = { calc: calc, TURN: TURN, TURN_RANGE: TURN_RANGE, PUMPS: PUMPS, COMP: COMP, UV_LADDER: UV_LADDER };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.TegaPond = api;
})(typeof window !== 'undefined' ? window : globalThis);
