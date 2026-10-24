/* Смета отделки: помещения → ведомость отделки → смета → цена → отчёты.
   Предварительный укрупнённый расчёт. Нормы и цены ниже ориентировочные, их заменяют нормативы и прайс.
   Данные хранятся только в браузере (localStorage). Без inline-скриптов: CSP сайта. */
(function (root) {
  'use strict';
  var WASTE = 1.1;                 // запас материалов 10 %
  var FSZN = 0.34, INS = 0.015, OHR = 0.8, PROFIT = 0.6, VAT = 0.2, NPD = 0.1;
  var KEY = 'tega.otd.v1';

  // ─── каталог материалов: [название, ед., размер упаковки, упаковка, цена за упаковку с НДС, руб.]
  var M = {
    prime_deep: ['Грунт глубокого проникновения', 'л', 10, 'канистра 10 л', 18.4],
    prime_beton: ['Бетоноконтакт', 'кг', 15, 'ведро 15 кг', 62],
    prime_univ: ['Грунт универсальный', 'л', 10, 'канистра 10 л', 16.5],
    pl_cem: ['Штукатурка цементная', 'кг', 25, 'мешок 25 кг', 9.8],
    pl_gips: ['Штукатурка гипсовая', 'кг', 30, 'мешок 30 кг', 14.5],
    put_eq: ['Шпатлёвка выравнивающая', 'кг', 25, 'мешок 25 кг', 17.9],
    put_fin: ['Шпатлёвка финишная', 'кг', 25, 'мешок 25 кг', 21.6],
    paint_water: ['Краска водоэмульсионная', 'л', 9, 'банка 9 л', 74.9],
    paint_acryl: ['Краска акриловая', 'л', 9, 'банка 9 л', 98],
    paint_silic: ['Краска силиконовая', 'л', 9, 'банка 9 л', 142],
    paint_silk: ['Краска силикатная', 'л', 9, 'банка 9 л', 118],
    wp_paper: ['Обои бумажные', 'м²', 5.3, 'рулон 5,3 м²', 12],
    wp_vinyl: ['Обои виниловые', 'м²', 5.3, 'рулон 5,3 м²', 22],
    wp_fliz: ['Обои флизелиновые', 'м²', 5.3, 'рулон 5,3 м²', 26],
    wp_glue: ['Клей для обоев', 'кг', 5, 'пачка 5 кг', 11],
    gl_roll: ['Стеклообои', 'м²', 50, 'рулон 50 м²', 95],
    gl_glue: ['Клей для стеклообоев', 'кг', 10, 'ведро 10 кг', 28],
    gkl: ['ГКЛ 12,5 мм', 'м²', 3, 'лист 3 м²', 11.5],
    gkl_glue: ['Клей гипсовый для ГКЛ', 'кг', 25, 'мешок 25 кг', 12],
    gkl_prof: ['Профиль для каркаса ГКЛ', 'м', 3, 'штанга 3 м', 3.2],
    stretch: ['Полотно натяжного потолка с багетом', 'м²', 1, 'м²', 14],
    tile_glue: ['Клей плиточный', 'кг', 25, 'мешок 25 кг', 11.5],
    tile_grout: ['Фуга (затирочная смесь)', 'кг', 5, 'пакет 5 кг', 9],
    svp_clip: ['СВП: основания (клипсы)', 'шт', 100, 'упаковка 100 шт', 14],
    svp_wedge: ['СВП: клинья', 'шт', 100, 'упаковка 100 шт', 9],
    cross: ['Крестики для плитки', 'шт', 200, 'упаковка 200 шт', 2.5],
    tile_corner: ['Уголок защитный для плитки', 'м', 2.5, 'штанга 2,5 м', 7.5],
    corner_perf: ['Угол перфорированный', 'м', 3, 'штанга 3 м', 2.1],
    screed_semi: ['Смесь для полусухой стяжки', 'кг', 40, 'мешок 40 кг', 4.8],
    screed_self: ['Самонивелирующаяся смесь', 'кг', 25, 'мешок 25 кг', 21],
    hydro: ['Гидроизоляция обмазочная', 'кг', 15, 'ведро 15 кг', 58],
    laminate: ['Ламинат', 'м²', 2.4, 'упаковка 2,4 м²', 38.5],
    parquet: ['Паркетная доска', 'м²', 2, 'упаковка 2 м²', 70],
    lino: ['Линолеум', 'м²', 1, 'м²', 9.5],
    underlay: ['Подложка', 'м²', 10, 'рулон 10 м²', 14],
    plinth: ['Плинтус', 'м', 2.5, 'штанга 2,5 м', 4.2],
    tile: ['Плитка', 'м²', 1, 'м²', 28]
  };
  // ─── операции: [название, ед., норма чел.-ч на единицу]
  var O = {
    constr_gklk: ['Обшивка ГКЛ по каркасу', 'м²', 0.9], constr_gklg: ['Обшивка ГКЛ на клею', 'м²', 0.5],
    stretch: ['Натяжной потолок', 'м²', 0.45], grunt: ['Грунтование основания', 'м²', 0.04],
    pl_cem: ['Штукатурка цементная', 'м²', 0.55], pl_gips: ['Штукатурка гипсовая', 'м²', 0.45],
    pl_extra: ['Дополнительный слой штукатурки', 'м²', 0.25], pl_prime: ['Грунтование перед штукатуркой', 'м²', 0.04],
    pe: ['Шпатлёвка выравнивающая', 'м²', 0.3], pf: ['Шпатлёвка финишная', 'м²', 0.3],
    p_extra: ['Дополнительный слой шпатлёвки', 'м²', 0.25], p_prime: ['Грунтование перед шпатлёвкой', 'м²', 0.04],
    sand: ['Шлифовка', 'м²', 0.15], prime_fin: ['Грунтование перед финишем', 'м²', 0.04],
    paint: ['Окраска', 'м²', 0.125], wp: ['Оклейка обоями', 'м²', 0.3], gl: ['Оклейка стеклообоями', 'м²', 0.4],
    gl_paint: ['Окраска стеклообоев', 'м²', 0.25], decor: ['Декоративное покрытие', 'м²', 1],
    tile: ['Облицовка плиткой', 'м²', 1.1], tile_prime: ['Грунтование перед облицовкой', 'м²', 0.04],
    tile_grout: ['Фугование швов', 'м²', 0.12], cut45: ['Подрезка кромок под 45°', 'м.п.', 0.25], tcorner: ['Установка защитных уголков', 'м.п.', 0.2],
    f_prime: ['Грунтование основания', 'м²', 0.04], screed_semi: ['Полусухая стяжка', 'м²', 0.7], screed_self: ['Самонивелирующийся пол', 'м²', 0.35],
    hydro: ['Гидроизоляция', 'м²', 0.2], f_tile: ['Облицовка пола плиткой', 'м²', 1], f_grout: ['Фугование швов', 'м²', 0.12],
    f_parquet: ['Укладка паркета', 'м²', 0.6], f_laminate: ['Укладка ламината', 'м²', 0.4], f_lino: ['Укладка линолеума', 'м²', 0.3],
    f_underlay: ['Укладка подложки', 'м²', 0.06], plinth: ['Установка плинтуса', 'м.п.', 0.25],
    s_prime: ['Грунтование откосов', 'м.п.', 0.03], s_pl_cem: ['Штукатурка откосов цементная', 'м.п.', 0.7], s_pl_gips: ['Штукатурка откосов гипсовая', 'м.п.', 0.55],
    s_pl_extra: ['Дополнительный слой штукатурки откосов', 'м.п.', 0.3], s_pe: ['Шпатлёвка откосов выравнивающая', 'м.п.', 0.35],
    s_pf: ['Шпатлёвка откосов финишная', 'м.п.', 0.4], s_sand: ['Шлифовка откосов', 'м.п.', 0.1], s_corner: ['Установка угла перфорированного', 'м.п.', 0.3],
    s_paint: ['Окраска откосов', 'м.п.', 0.2], s_wp: ['Оклейка откосов обоями', 'м.п.', 0.35], s_decor: ['Декор откосов', 'м.п.', 1]
  };
  var SURF = { walls: 'Стены', slopes: 'Откосы', ceiling: 'Потолок', floor: 'Пол' };
  var SURF_ORDER = ['walls', 'slopes', 'ceiling', 'floor'];
  var PAINT = { water: ['Водоэмульсионная', 'paint_water', 0.12], acryl: ['Акриловая', 'paint_acryl', 0.13], silic: ['Силиконовая', 'paint_silic', 0.13], silk: ['Силикатная', 'paint_silk', 0.14] };
  var WP = { paper: ['Бумажные', 'wp_paper', 0.3], vinyl: ['Виниловые', 'wp_vinyl', 0.35], fliz: ['Флизелиновые', 'wp_fliz', 0.3] };
  var GRUNT = { deep: ['Глубокого проникновения', 'prime_deep', 0.15], beton: ['Бетоноконтакт', 'prime_beton', 0.3], univ: ['Универсальный', 'prime_univ', 0.15] };
  var DECOR = { plaster: ['Декоративная штукатурка', 1], venet: ['Венецианская', 1.5], other: ['Другое', 1] };

  // ─── утилиты
  function num(v, d) { var n = parseFloat(String(v).replace(',', '.').replace(/\s/g, '')); return isFinite(n) ? n : (d || 0); }
  function r2(x) { return Math.round((x + 1e-9) * 100) / 100; }
  function r1(x) { return Math.round((x + 1e-9) * 10) / 10; }
  function fmt(x, d) { d = d == null ? 2 : d; return Number(x).toLocaleString('ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var uid = 0;
  function nid() { uid++; return 'i' + Date.now().toString(36) + uid; }

  // ─── состояние по умолчанию
  function wallSpec() { return { fin: 'paint', constr: 'base', grunt: 'deep', plaster: 'none', plExtra: 0, plPrime: 0, pe: 2, pf: 1, pExtra: 0, pPrime: 0, paint: 'water', layers: 2, finPrime: 1, wp: 'vinyl', glPaint: 1, decor: 'plaster', tile: tileSpec() }; }
  function tileSpec() { return { w: 300, h: 600, joint: 3, price: 28, cut45: 0, corner: 0, cutOn: 0, cornerOn: 0, grout: 1, prime: 1 }; }
  function floorSpec() { return { screed: 'semi', prime: 1, hydro: 0, cover: 'laminate', tile: tileSpec(), underlay: 1, plinth: 1, price: 0 }; }
  function newZone(surf) { return { id: nid(), area: 0, spec: surf === 'floor' ? floorSpec() : wallSpec() }; }
  function newRoom(name) {
    return { id: nid(), name: name || 'Помещение', L: 5, W: 4, H: 2.7, windows: [], doors: [],
      sheet: { walls: [newZone('walls')], slopes: [newZone('slopes')], ceiling: [newZone('ceiling')], floor: [newZone('floor')] } };
  }
  function newState() {
    return { obj: { name: 'Объект', no: 'ПР-0001', customer: '', kind: 'live', date: today() },
      works: { walls: true, slopes: true, ceiling: false, floor: true },
      rate: { hh: 8, trM: 40, trW: 60, load: 30, waste: 50 }, prices: {}, rooms: [newRoom('Помещение 1')], active: 0, step: 'rooms', nOpen: { w: 0, d: 0 } };
  }
  function today() { var d = new Date(); return ('0' + d.getDate()).slice(-2) + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + '.' + d.getFullYear(); }

  // ─── геометрия помещения
  function geo(rm) {
    var L = num(rm.L), W = num(rm.W), H = num(rm.H), P = 2 * (L + W), floor = L * W, gross = P * H, open = 0, slLen = 0, slArea = 0, doorW = 0;
    var ops = [];
    ['windows', 'doors'].forEach(function (k) {
      (rm[k] || []).forEach(function (o) {
        var w = num(o.w), hh = num(o.h), q = Math.max(0, num(o.qty, 1)), rev = num(o.rev);
        open += w * hh / 1e6 * q;
        if (k === 'doors') doorW += w / 1000 * q;
        if (rev > 0) { var len = (2 * hh + w) / 1000 * q; slLen += len; slArea += len * rev / 1000; ops.push({ k: k, id: o.id, len: len, area: len * rev / 1000 }); }
      });
    });
    return { L: L, W: W, H: H, P: P, floor: floor, gross: gross, open: open, walls: Math.max(0, gross - open), slLen: slLen, slArea: slArea, ceiling: floor, plinth: Math.max(0, P - doorW), slopes: ops };
  }
  function surfTotal(g, s) { return s === 'walls' ? g.walls : s === 'floor' ? g.floor : s === 'ceiling' ? g.ceiling : g.slArea; }
  function zoneAreas(rm, surf, g) {
    var zs = rm.sheet[surf], tot = surfTotal(g, surf);
    if (zs.length === 1) return [tot];
    return zs.map(function (z) { return num(z.area); });
  }
  function tileK(w, h) { var big = Math.max(num(w), num(h)); return big < 150 ? 2 : big <= 600 ? 1 : big <= 1200 ? 1.5 : 2; }

  // ─── расчёт
  function calc(S) {
    var out = { rooms: [], lines: [], mats: {}, hours: 0 };
    S.rooms.forEach(function (rm, ri) {
      var g = geo(rm), R = { id: rm.id, name: rm.name, no: ri + 1, geo: g, lines: [], mats: {}, hours: 0 };
      function op(surf, zi, id, qty, normMul, label, unitOv) {
        if (!(qty > 0)) return;
        var o = O[id], norm = o[2] * (normMul || 1), ln = { surf: surf, zone: zi, id: id, key: id + '|' + (label || ''), name: label || o[0], unit: unitOv || o[1], qty: qty, norm: norm, hours: qty * norm };
        R.lines.push(ln); R.hours += ln.hours;
      }
      function mat(id, qty) { if (qty > 0) R.mats[id] = (R.mats[id] || 0) + qty * WASTE; }
      SURF_ORDER.forEach(function (surf) {
        if (!S.works[surf]) return;
        var areas = zoneAreas(rm, surf, g), zs = rm.sheet[surf];
        zs.forEach(function (z, zi) {
          var a = areas[zi], sp = z.spec, zl = zs.length > 1 ? ' (уч. ' + (zi + 1) + ')' : '';
          if (!(a > 0)) return;
          if (surf === 'floor') return floorZone(a, sp, zi, zl);
          if (surf === 'slopes') return slopeZone(a, sp, zi);
          wallZone(surf, a, sp, zi, zl);
        });
      });
      function groundMat(sp, area) { var gr = GRUNT[sp.grunt]; mat(gr[1], area * gr[2]); }
      function wallZone(surf, a, sp, zi, zl) {
        var isCeil = surf === 'ceiling', suf = zl;
        if (isCeil && sp.constr === 'stretch') { op(surf, zi, 'stretch', a); mat('stretch', a / WASTE); return; }
        if (sp.fin === 'tile') {
          var t = sp.tile, k = tileK(t.w, t.h);
          if (sp.constr === 'gklg') { op(surf, zi, 'constr_gklg', a); mat('gkl', a * 1.05 / WASTE); mat('gkl_glue', a * 4 / WASTE); }
          if (sp.constr === 'gklk') { op(surf, zi, 'constr_gklk', a); mat('gkl', a * 1.05 / WASTE); mat('gkl_prof', a * 3 / WASTE); }
          op(surf, zi, 'grunt', a); groundMat(sp, a);
          tileBlock(surf, zi, a, t, k, 'tile', false);
          return;
        }
        if (sp.constr === 'gklg') { op(surf, zi, 'constr_gklg', a); mat('gkl', a * 1.05 / WASTE); mat('gkl_glue', a * 4 / WASTE); }
        if (sp.constr === 'gklk') { op(surf, zi, 'constr_gklk', a); mat('gkl', a * 1.05 / WASTE); mat('gkl_prof', a * 3 / WASTE); }
        op(surf, zi, 'grunt', a); groundMat(sp, a);
        if (sp.plaster !== 'none') {
          var pid = sp.plaster === 'cem' ? 'pl_cem' : 'pl_gips';
          if (sp.plPrime) { op(surf, zi, 'pl_prime', a); mat(GRUNT[sp.grunt][1], a * GRUNT[sp.grunt][2]); }
          op(surf, zi, pid, a); mat(pid, a * (pid === 'pl_cem' ? 14 : 9));
          if (sp.plExtra) { op(surf, zi, 'pl_extra', a); mat(pid, a * (pid === 'pl_cem' ? 14 : 9)); }
        }
        var pe = num(sp.pe), pf = num(sp.pf);
        if (pe > 0 || pf > 0) {
          if (sp.pPrime) { op(surf, zi, 'p_prime', a); mat(GRUNT[sp.grunt][1], a * GRUNT[sp.grunt][2]); }
          if (pe > 0) { op(surf, zi, 'pe', a, pe, 'Шпатлёвка выравнивающая, ' + pe + ' ' + (pe === 1 ? 'раз' : 'раза')); mat('put_eq', a * 1.2 * pe); }
          if (pf > 0) { op(surf, zi, 'pf', a, pf, 'Шпатлёвка финишная, ' + pf + ' ' + (pf === 1 ? 'раз' : 'раза')); mat('put_fin', a * 1 * pf); }
          if (sp.pExtra) { op(surf, zi, 'p_extra', a); mat('put_eq', a * 1.2); }
          op(surf, zi, 'sand', a);
        }
        if (sp.fin === 'paint') {
          var pt = PAINT[sp.paint], ly = num(sp.layers, 1);
          if (sp.finPrime) { op(surf, zi, 'prime_fin', a); mat(GRUNT[sp.grunt][1], a * GRUNT[sp.grunt][2]); }
          op(surf, zi, 'paint', a, ly, 'Окраска ' + pt[0].toLowerCase() + ', ' + ly + ' ' + (ly === 1 ? 'слой' : 'слоя'));
          mat(pt[1], a * pt[2] * ly);
        } else if (sp.fin === 'wallpaper') {
          var w = WP[sp.wp];
          if (sp.finPrime) { op(surf, zi, 'prime_fin', a); mat(GRUNT[sp.grunt][1], a * GRUNT[sp.grunt][2]); }
          op(surf, zi, 'wp', a, w[2] / 0.3, 'Оклейка обоями (' + w[0].toLowerCase() + ')'); mat(w[1], a * 1.05 / WASTE * 1.1); mat('wp_glue', a * 0.2);
        } else if (sp.fin === 'glass') {
          if (sp.finPrime) { op(surf, zi, 'prime_fin', a); mat(GRUNT[sp.grunt][1], a * GRUNT[sp.grunt][2]); }
          op(surf, zi, 'gl', a); mat('gl_roll', a / WASTE); mat('gl_glue', a * 0.25);
          if (sp.glPaint) { op(surf, zi, 'gl_paint', a); mat('paint_water', a * 0.25); }
        } else if (sp.fin === 'decor') {
          var dc = DECOR[sp.decor]; op(surf, zi, 'decor', a, dc[1], 'Декор: ' + dc[0].toLowerCase());
        }
      }
      function tileBlock(surf, zi, a, t, k, opId, floor) {
        var tw = num(t.w), th = num(t.h), jn = num(t.joint, 3), kn = k;
        op(surf, zi, floor ? 'f_tile' : 'tile', a, kn, (floor ? 'Облицовка пола плиткой ' : 'Облицовка плиткой ') + tw + '×' + th + (kn !== 1 ? ' (к = ' + String(kn).replace('.', ',') + ')' : ''));
        mat('tile', a); R.tilePrice = R.tilePrice || {}; R.tilePrice[(floor ? 'f' : 'w') + zi + surf] = num(t.price);
        mat('tile_glue', a * 5);
        var tiles = tw > 0 && th > 0 ? a * 1e6 / (tw * th) : 0, clips = Math.max(2, Math.ceil((tw + th) / 200));
        mat('svp_clip', tiles * clips); mat('svp_wedge', tiles * clips); mat('cross', tiles * 4);
        if (t.prime) { op(surf, zi, floor ? 'f_prime' : 'tile_prime', a, 1, 'Грунтование перед облицовкой'); mat(GRUNT.univ[1], a * GRUNT.univ[2]); }
        if (t.grout) { op(surf, zi, floor ? 'f_grout' : 'tile_grout', a); mat('tile_grout', a * (0.3 + jn * 0.1)); }
        if (!floor && t.cutOn) op(surf, zi, 'cut45', num(t.cut45));
        if (!floor && t.cornerOn) { op(surf, zi, 'tcorner', num(t.corner)); mat('tile_corner', num(t.corner)); }
      }
      function slopeZone(a, sp, zi) {
        var len = g.slLen, surf = 'slopes';
        if (!(len > 0)) return;
        op(surf, zi, 's_prime', len); mat(GRUNT[sp.grunt][1], a * GRUNT[sp.grunt][2]);
        if (sp.plaster !== 'none') {
          op(surf, zi, sp.plaster === 'cem' ? 's_pl_cem' : 's_pl_gips', len); mat(sp.plaster === 'cem' ? 'pl_cem' : 'pl_gips', a * (sp.plaster === 'cem' ? 14 : 9));
          if (sp.plExtra) { op(surf, zi, 's_pl_extra', len); mat(sp.plaster === 'cem' ? 'pl_cem' : 'pl_gips', a * (sp.plaster === 'cem' ? 14 : 9)); }
        }
        var pe = num(sp.pe), pf = num(sp.pf);
        if (pe > 0) { op(surf, zi, 's_pe', len, pe, 'Шпатлёвка откосов выравнивающая, ' + pe + ' ' + (pe === 1 ? 'раз' : 'раза')); mat('put_eq', a * 1.2 * pe); }
        if (pf > 0) { op(surf, zi, 's_pf', len, pf, 'Шпатлёвка откосов финишная, ' + pf + ' ' + (pf === 1 ? 'раз' : 'раза')); mat('put_fin', a * pf); }
        if (pe > 0 || pf > 0) op(surf, zi, 's_sand', len);
        op(surf, zi, 's_corner', len); mat('corner_perf', len);
        if (sp.fin === 'paint') {
          var pt = PAINT[sp.paint], ly = num(sp.layers, 1);
          op(surf, zi, 's_paint', len, ly, 'Окраска откосов, ' + ly + ' ' + (ly === 1 ? 'слой' : 'слоя')); mat(pt[1], a * pt[2] * ly);
        } else if (sp.fin === 'wallpaper') { op(surf, zi, 's_wp', len); mat(WP[sp.wp][1], a * 1.1); mat('wp_glue', a * 0.2); }
        else if (sp.fin === 'decor') op(surf, zi, 's_decor', len, DECOR[sp.decor][1], 'Декор откосов: ' + DECOR[sp.decor][0].toLowerCase());
      }
      function floorZone(a, sp, zi, zl) {
        var surf = 'floor';
        if (sp.prime) { op(surf, zi, 'f_prime', a); mat('prime_univ', a * 0.15); }
        if (sp.screed === 'semi') { op(surf, zi, 'screed_semi', a); mat('screed_semi', a * 80 / WASTE); }
        if (sp.screed === 'self') { op(surf, zi, 'screed_self', a); mat('screed_self', a * 15 / WASTE); }
        if (sp.hydro) { op(surf, zi, 'hydro', a); mat('hydro', a * 1.5 / WASTE); }
        var c = sp.cover;
        if (c === 'tile') tileBlock(surf, zi, a, sp.tile, tileK(sp.tile.w, sp.tile.h), 'f_tile', true);
        if (c === 'parquet') { op(surf, zi, 'f_parquet', a); mat('parquet', a); }
        if (c === 'laminate') { op(surf, zi, 'f_laminate', a); mat('laminate', a); }
        if (c === 'lino') { op(surf, zi, 'f_lino', a); mat('lino', a); }
        if (sp.underlay && (c === 'laminate' || c === 'parquet')) { op(surf, zi, 'f_underlay', a); mat('underlay', a); }
        if (sp.plinth && g.floor > 0) { var pl = g.plinth * a / g.floor; op(surf, zi, 'plinth', pl); mat('plinth', pl); }
      }
      // защита, подготовка и уборка: 4 % от трудозатрат помещения
      var base = R.hours;
      if (base > 0) { var ln = { surf: 'common', zone: 0, id: 'protect', key: 'protect|', name: 'Защита, подготовка и уборка', unit: 'пом.', qty: 1, norm: base * 0.04, hours: base * 0.04 }; R.lines.push(ln); R.hours += ln.hours; }
      out.rooms.push(R);
    });
    // плитка: цена по участкам берётся из спецификации плитки (усреднение по объёму)
    out.rooms.forEach(function (R, ri) {
      Object.keys(R.mats).forEach(function (id) { out.mats[id] = (out.mats[id] || 0) + R.mats[id]; });
      out.hours += R.hours;
    });
    // средняя цена плитки по объекту
    var tsum = 0, tprice = 0;
    S.rooms.forEach(function (rm, ri) {
      var g = geo(rm);
      ['walls', 'floor'].forEach(function (surf) {
        if (!S.works[surf]) return;
        var areas = zoneAreas(rm, surf, g);
        rm.sheet[surf].forEach(function (z, zi) {
          var sp = z.spec, isTile = surf === 'walls' ? sp.fin === 'tile' : sp.cover === 'tile';
          if (isTile && areas[zi] > 0) { tsum += areas[zi]; tprice += areas[zi] * num(sp.tile.price); }
        });
      });
    });
    out.tilePrice = tsum > 0 ? tprice / tsum : M.tile[4];
    out.rooms.forEach(function (R) { R.hours = R.lines.reduce(function (s, l) { return s + l.hours; }, 0); });
    out.hours = out.rooms.reduce(function (s, R) { return s + R.hours; }, 0);
    return out;
  }

  function unitPrice(S, C, id) {
    var pr = S.prices && S.prices[id];
    if (pr != null && pr !== '') return num(pr);
    return id === 'tile' ? C.tilePrice : M[id][4];
  }
  // материалы: сводная спецификация по упаковкам и по помещениям
  function specs(S, C) {
    var rows = [], total = 0, ids = Object.keys(C.mats).filter(function (id) { return C.mats[id] > 0.0001; });
    ids.sort(function (a, b) { return Object.keys(M).indexOf(a) - Object.keys(M).indexOf(b); });
    ids.forEach(function (id) {
      var m = M[id], need = C.mats[id], pack = m[2], price = unitPrice(S, C, id), n = Math.ceil(need / pack - 1e-9), sum = r2(n * price);
      rows.push({ id: id, name: m[0], unit: m[1], need: need, packTxt: m[3], pack: pack, n: n, price: price, sum: sum, per: price / pack });
      total += sum;
    });
    var perRoom = C.rooms.map(function (R) {
      var s = 0, list = [];
      Object.keys(R.mats).forEach(function (id) { var c = R.mats[id] * unitPrice(S, C, id) / M[id][2]; s += c; list.push({ id: id, name: M[id][0], unit: M[id][1], need: R.mats[id], cost: c }); });
      list.sort(function (a, b) { return Object.keys(M).indexOf(a.id) - Object.keys(M).indexOf(b.id); });
      return { room: R, list: list, cost: r2(s) };
    });
    var roomSum = r2(perRoom.reduce(function (s, p) { return s + p.cost; }, 0));
    return { rows: rows, total: r2(total), perRoom: perRoom, roomSum: roomSum, rounding: r2(total - roomSum) };
  }

  // формирование цены
  function price(S, C, SP) {
    var hh = num(S.rate.hh), rate = S.rate, live = S.obj.kind === 'live';
    var hours = C.hours, ot = r2(hours * hh), npd = r2(ot / (1 - NPD) - ot), ohr = r2(ot * OHR);
    var matV = SP.total, matN = r2(matV / (1 + VAT));
    var tr = r2(num(rate.trM) + num(rate.trW) + num(rate.load)), waste = r2(num(rate.waste));
    var p1 = { ot: ot, npd: npd, ohr: ohr, mat: matV, trM: r2(num(rate.trM)), trW: r2(num(rate.trW)), load: r2(num(rate.load)), waste: waste };
    p1.total = r2(ot + npd + ohr + matV + tr + waste);
    var fszn = r2(ot * FSZN), ins = r2(ot * INS), profit = r2(ot * PROFIT);
    var p2 = { ot: ot, fszn: fszn, ins: ins, ohr: ohr, mat: matN, trM: p1.trM, trW: p1.trW, load: p1.load, waste: waste, profit: profit };
    p2.sub = r2(ot + fszn + ins + ohr + matN + tr + waste + profit);
    p2.vat = live ? 0 : r2(p2.sub * VAT);
    p2.total = r2(p2.sub + p2.vat);
    // по помещениям (цена 2)
    var rooms = C.rooms.map(function (R, i) {
      var rot = r2(R.hours * hh), rm = r2(SP.perRoom[i].cost / (1 + VAT));
      var row = { room: R, hours: R.hours, ot: rot, fi: r2(rot * (FSZN + INS)), ohr: r2(rot * OHR), mat: rm, profit: r2(rot * PROFIT) };
      row.sub = r2(row.ot + row.fi + row.ohr + row.mat + row.profit); return row;
    });
    var sums = {}; ['hours', 'ot', 'fi', 'ohr', 'mat', 'profit', 'sub'].forEach(function (k) { sums[k] = r2(rooms.reduce(function (s, r) { return s + r[k]; }, 0)); });
    var round = r2(matN - sums.mat), left = r2(p2.sub - sums.sub - round - tr - waste);
    return { p1: p1, p2: p2, rooms: rooms, sums: sums, roundMat: round, tr: tr, hh: hh, hours: hours, live: live, resid: left };
  }

  // группировка трудозатрат по объекту для ведомости
  function worksByObject(S, C) {
    var groups = {};
    C.rooms.forEach(function (R) {
      R.lines.forEach(function (l) {
        var g = groups[l.surf] = groups[l.surf] || { surf: l.surf, items: {}, order: [] };
        if (!g.items[l.key]) { g.items[l.key] = { name: l.name, unit: l.unit, qty: 0, norm: l.norm, hours: 0, w: 0 }; g.order.push(l.key); }
        var it = g.items[l.key]; it.qty += l.qty; it.hours += l.hours;
      });
    });
    return groups;
  }

  var API = { M: M, O: O, calc: calc, specs: specs, price: price, geo: geo, newState: newState, newRoom: newRoom, worksByObject: worksByObject, fmt: fmt, r2: r2, num: num, esc: esc,
    SURF: SURF, SURF_ORDER: SURF_ORDER, PAINT: PAINT, WP: WP, GRUNT: GRUNT, DECOR: DECOR, tileK: tileK, wallSpec: wallSpec, floorSpec: floorSpec, newZone: newZone, unitPrice: unitPrice, KEY: KEY, nid: nid, today: today, zoneAreas: zoneAreas, surfTotal: surfTotal, tileSpec: tileSpec };
  root.TegaOtd = API;
  if (typeof module !== 'undefined') module.exports = API;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
