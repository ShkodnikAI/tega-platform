/* Инженерные калькуляторы: водоснабжение, канализация, отопление, вентиляция.
   Ориентировочные расчёты по физике (гидравлика, теплотехника) и по числам из справочников сайта. Не заменяют проект. */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function num(id) {
    var el = $(id);
    if (!el) return NaN;
    var n = parseFloat(String(el.value).replace(/\s/g, '').replace(',', '.').replace(/\u2212/g, '-'));
    return isFinite(n) ? n : NaN;
  }
  function radio(name) { var el = document.querySelector('input[name="' + name + '"]:checked'); return el ? el.value : ''; }
  function fmt(x, d) {
    if (!isFinite(x)) return '—';
    var s = Math.abs(x).toFixed(d), p = s.split('.');
    p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return (x < 0 ? '−' : '') + p.join(',');
  }
  function set(id, v) { var el = $(id); if (el) el.textContent = v; }
  function verdict(id, text, bad) { var el = $(id); if (!el) return; el.textContent = text; el.className = 'verdict' + (bad ? ' bad' : ''); }
  function clear(ids, vid, msg) { ids.forEach(function (i) { set(i, '—'); }); verdict(vid, msg || 'Введите числа больше нуля.', true); }
  function allPos(a) { return a.every(function (v) { return isFinite(v) && v > 0; }); }
  function interp(tab, x) {
    if (x <= tab[0][0]) return tab[0][1];
    for (var i = 0; i < tab.length - 1; i++) if (x <= tab[i + 1][0]) return tab[i][1] + (tab[i + 1][1] - tab[i][1]) * (x - tab[i][0]) / (tab[i + 1][0] - tab[i][0]);
    return tab[tab.length - 1][1];
  }

  /* ───────── гидравлика ───────── */
  var WATER = { cold: { rho: 999.7, nu: 1.307e-6 }, hot: { rho: 983.2, nu: 0.478e-6 }, heat: { rho: 977.8, nu: 0.415e-6 } };
  var ROUGH = { plastic: 0.007e-3, copper: 0.0015e-3, steel: 0.2e-3 };
  // внутренние диаметры труб, мм (типовые, зависят от производителя и PN)
  var PIPES = {
    ppr: [['20 × 3,4', 13.2], ['25 × 4,2', 16.6], ['32 × 5,4', 21.2], ['40 × 6,7', 26.6], ['50 × 8,3', 33.2], ['63 × 10,5', 42.0], ['75 × 12,5', 50.0]],
    mp: [['16 × 2,0', 12.0], ['20 × 2,0', 16.0], ['26 × 3,0', 20.0], ['32 × 3,0', 26.0], ['40 × 3,5', 33.0]],
    pex: [['16 × 2,0', 12.0], ['20 × 2,0', 16.0], ['25 × 2,3', 20.4], ['32 × 3,0', 26.0], ['40 × 3,7', 32.6]],
    steel: [['Ду 15', 15.7], ['Ду 20', 21.2], ['Ду 25', 27.1], ['Ду 32', 35.9], ['Ду 40', 41.0], ['Ду 50', 53.0]]
  };
  function hyd(Q, dmm, k, w) {
    var d = dmm / 1000, A = Math.PI * d * d / 4, v = Q / A, Re = v * d / w.nu, f;
    if (Re < 2300) f = 64 / Re; else { var t = Math.log(k / (3.7 * d) + 5.74 / Math.pow(Re, 0.9)) / Math.LN10; f = 0.25 / (t * t); }
    return { v: v, Re: Re, R: f / d * w.rho * v * v / 2 };
  }
  function pickPipe(series, Q, vmax) {
    var list = PIPES[series];
    for (var i = 0; i < list.length; i++) { var v = Q / (Math.PI * Math.pow(list[i][1] / 1000, 2) / 4); if (v <= vmax) return list[i]; }
    return null;
  }

  /* ───────── водоснабжение ───────── */
  var FIX = { umyv: 0.09, mojka: 0.12, dush: 0.09, vanna: 0.18, wc: 0.10, stir: 0.20, posud: 0.15 };
  var lastWater = null;
  function calcWd() {
    var ids = ['wd-q', 'wd-n', 'wd-k', 'wd-d', 'wd-pipe', 'wd-v', 'wd-r'];
    var sum = 0, n = 0, key;
    for (key in FIX) { var c = num('wd-' + key); if (isFinite(c) && c > 0) { sum += c * FIX[key]; n += c; } }
    var vmax = num('wd-vmax');
    if (!n || !allPos([vmax])) { lastWater = null; return clear(ids, 'wd-verdict', 'Укажите приборы и допустимую скорость.'); }
    var k = n > 1 ? Math.max(0.2, 1 / Math.sqrt(n - 1)) : 1, Q = sum * k;
    set('wd-q', fmt(Q, 2) + ' л/с (' + fmt(Q * 3.6, 2) + ' м³/ч)');
    set('wd-n', fmt(n, 0)); set('wd-k', fmt(k, 2));
    var dreq = Math.sqrt(4 * (Q / 1000) / (Math.PI * vmax)) * 1000;
    set('wd-d', fmt(dreq, 1) + ' мм');
    var p = pickPipe(radio('wd-s'), Q / 1000, vmax);
    if (!p) { lastWater = null; set('wd-pipe', '—'); set('wd-v', '—'); set('wd-r', '—'); return verdict('wd-verdict', 'Расход больше, чем пропустят трубы этого ряда при заданной скорости. Нужен проект.', true); }
    var h = hyd(Q / 1000, p[1], ROUGH.plastic, WATER.cold);
    lastWater = { Q: Q, s: radio('wd-s'), d: p[1] };
    set('wd-pipe', p[0] + ' мм (внутр. ' + fmt(p[1], 1) + ')');
    set('wd-v', fmt(h.v, 2) + ' м/с'); set('wd-r', fmt(h.R, 0) + ' Па/м');
    verdict('wd-verdict', 'Подходит труба ' + p[0] + ' мм: скорость ' + fmt(h.v, 2) + ' м/с при допустимой ' + fmt(vmax, 1) + ' м/с. Расход взят с запасом: холодная и горячая вода суммируются, как на вводе.', false);
  }
  function calcWp() {
    var ids = ['wp-v', 'wp-re', 'wp-r', 'wp-loss', 'wp-end'];
    var Q = num('wp-q'), d = num('wp-d'), L = num('wp-l'), loc = num('wp-loc'), p0 = num('wp-p'), H = num('wp-h');
    if (!allPos([Q, d, L, p0]) || !isFinite(loc) || loc < 0 || !isFinite(H)) return clear(ids, 'wp-verdict');
    var w = radio('wp-t') === 'hot' ? WATER.hot : WATER.cold, h = hyd(Q / 1000, d, ROUGH[$('wp-mat').value] || ROUGH.plastic, w);
    var loss = h.R * L * (1 + loc / 100) / 100000, stat = H * w.rho * 9.81 / 100000, end = p0 - loss - stat;
    set('wp-v', fmt(h.v, 2) + ' м/с'); set('wp-re', fmt(h.Re, 0)); set('wp-r', fmt(h.R, 0) + ' Па/м');
    set('wp-loss', fmt(loss, 2) + ' бар'); set('wp-end', fmt(end, 2) + ' бар');
    var msg = 'Потеря на трение и местные сопротивления ' + fmt(loss, 2) + ' бар, на подъём ' + fmt(stat, 2) + ' бар. Остаётся ' + fmt(end, 2) + ' бар у прибора.';
    if (end < 0) verdict('wp-verdict', msg + ' Давления не хватает: увеличьте диаметр или ставьте повысительный насос.', true);
    else if (end < 1) verdict('wp-verdict', msg + ' Давление небольшое: сверьтесь с минимальным напором приборов по паспорту (душевые панели и проточные нагреватели просят больше).', true);
    else verdict('wp-verdict', msg + (h.v > 2 ? ' Скорость выше 2 м/с: возможен шум, лучше взять диаметр больше.' : ''), false);
  }
  function calcWh() {
    var ids = ['wh-e', 'wh-t', 'wh-kw', 'wh-a1', 'wh-a3'];
    var V = num('wh-v'), t1 = num('wh-t1'), t2 = num('wh-t2'), P = num('wh-p'), Qm = num('wh-qm');
    if (!allPos([V, P, Qm]) || !isFinite(t1) || !isFinite(t2) || t2 <= t1) return clear(ids, 'wh-verdict', 'Введите объём, мощность, расход и температуры (горячая выше холодной).');
    var E = V * (t2 - t1) * 4.19 / 3600, T = E / P, kw = Qm * (t2 - t1) * 4.19 / 60;
    set('wh-e', fmt(E, 2) + ' кВт·ч'); set('wh-t', T >= 1 ? fmt(T, 1) + ' ч' : fmt(T * 60, 0) + ' мин');
    set('wh-kw', fmt(kw, 1) + ' кВт'); set('wh-a1', fmt(kw * 1000 / 230, 0) + ' А'); set('wh-a3', fmt(kw * 1000 / (1.732 * 400), 0) + ' А');
    verdict('wh-verdict', 'Бойлер ' + fmt(V, 0) + ' л греется ' + (T >= 1 ? fmt(T, 1) + ' ч' : fmt(T * 60, 0) + ' мин') + ' без учёта потерь. Проточному нагревателю на ' + fmt(Qm, 1) + ' л/мин нужно ' + fmt(kw, 1) + ' кВт: ' + (kw > 7 ? 'для однофазной сети это много, обычно берут трёхфазную линию. ' : '') + 'Автомат и сечение кабеля подберите в разделе «Электрика».', kw > 14);
  }


  /* ───────── скважинный насос и гидроаккумулятор ───────── */
  var MOTORS = [0.37, 0.55, 0.75, 1.1, 1.5, 2.2, 3.0, 4.0, 5.5, 7.5];
  var ACC = [24, 50, 80, 100, 150, 200, 300, 500];
  function calcPu() {
    var ids = ['pu-h', 'pu-fr', 'pu-depth', 'pu-ph', 'pu-pm', 'pu-i', 'pu-flow'];
    var Q = num('pu-q'), deb = num('pu-deb'), Hd = num('pu-hd'), L = num('pu-l'), d = num('pu-d'), dz = num('pu-dz'), loc = num('pu-loc'), Poff = num('pu-poff'), res = num('pu-res');
    if (!allPos([Q, deb, Hd, d, Poff]) || !isFinite(L) || L < 0 || !isFinite(dz) || !isFinite(loc) || loc < 0 || !isFinite(res) || res < 0) return clear(ids, 'pu-verdict', 'Введите числа: расход, дебит, глубины, диаметр и давление.');
    var depth = Hd + 2, q = Q / 60000, h = hyd(q, d, ROUGH.plastic, WATER.cold);
    var fr = h.R * (depth + L) * (1 + loc / 100) / 9810, H = (Hd + dz + fr + Poff * 10.197) * (1 + res / 100);
    var Ph = 9.81 * q * H, Pshaft = Ph / 0.45, mot = MOTORS[MOTORS.length - 1];
    for (var i = 0; i < MOTORS.length; i++) if (MOTORS[i] >= Pshaft) { mot = MOTORS[i]; break; }
    var I = mot / 0.75 * 1000 / (230 * 0.9);
    set('pu-h', fmt(H, 0) + ' м (' + fmt(H / 10.197, 1) + ' бар)'); set('pu-fr', fmt(fr, 1) + ' м'); set('pu-depth', 'не менее ' + fmt(depth, 0) + ' м');
    set('pu-ph', fmt(Ph, 2) + ' кВт'); set('pu-pm', fmt(mot, 2) + ' кВт'); set('pu-i', fmt(I, 0) + ' А (1 фаза)'); set('pu-flow', fmt(Q * 0.06, 1) + ' м³/ч');
    var msg = 'Ищите насос, который даёт ' + fmt(Q * 0.06, 1) + ' м³/ч при напоре не менее ' + fmt(H, 0) + ' м, причём рабочая точка должна лежать в середине кривой, а не на краю. ', bad = false;
    if (Q * 0.06 > 0.8 * deb) { bad = true; msg += 'Расход больше 80 % дебита скважины: насос будет осушать скважину, берите меньшую подачу или ставьте накопительную ёмкость. '; }
    if (h.v > 2) { bad = true; msg += 'Скорость в трубе ' + fmt(h.v, 1) + ' м/с слишком велика, возьмите трубу больше. '; }
    if (H > 150) { bad = true; msg += 'Напор очень большой, нужен многоступенчатый насос: проверьте с поставщиком. '; }
    msg += 'Подвес на 2 м ниже динамического уровня и не ближе 1 м до дна. Нужны защита от сухого хода и обратный клапан.';
    verdict('pu-verdict', msg, bad);
  }
  function calcHb() {
    var ids = ['hb-use', 'hb-pre', 'hb-v', 'hb-tank', 'hb-z'];
    var Q = num('hb-q'), Z = num('hb-z0'), on = num('hb-on'), off = num('hb-off'), rate = num('hb-rate');
    if (!allPos([Q, Z, on, off, rate]) || off <= on) return clear(ids, 'hb-verdict', 'Давление отключения должно быть выше давления включения.');
    var use = 15 * Q / Z, pre = Math.max(0.2, on - 0.2), P0 = pre + 1, k = P0 * (1 / (on + 1) - 1 / (off + 1)), V = use / k, tank = null;
    for (var i = 0; i < ACC.length; i++) if (ACC[i] >= V) { tank = ACC[i]; break; }
    set('hb-use', fmt(use, 0) + ' л'); set('hb-pre', fmt(pre, 1) + ' бар'); set('hb-v', fmt(V, 0) + ' л'); set('hb-tank', tank ? tank + ' л' : '—');
    var z = tank ? 15 * Q / (tank * k) : NaN;
    set('hb-z', tank ? fmt(z, 0) + ' в час' : '—');
    var bad = !tank || off - on < 1 || off > rate, msg = tank ? 'Возьмите гидроаккумулятор ' + tank + ' л: насос будет включаться не чаще ' + fmt(z, 0) + ' раз в час при самой тяжёлой нагрузке. ' : 'Нужен бак больше 500 л или несколько баков. ';
    if (off - on < 1) msg += 'Разница включения и отключения меньше 1 бар: бак получится огромным, а насос будет часто стартовать. ';
    if (off > rate) msg += 'Давление отключения выше рабочего давления бака. ';
    set('hb-ins', 'Ваши значения: давление в баке без воды ' + fmt(pre, 1) + ' бар, реле включает насос при ' + fmt(on, 1) + ' бар и отключает при ' + fmt(off, 1) + ' бар.');
    verdict('hb-verdict', msg + 'Как настроить бак — во вкладке «Настройка бака».', bad);
  }

  /* ───────── канализация ───────── */
  var DU = { umyv: 0.5, dush: 0.6, vanna: 0.8, mojka: 0.8, posud: 0.8, stir: 0.8, wc: 2.0, trap: 0.8 };
  var SEW = [[50, 46], [75, 69], [110, 104], [125, 118], [160, 152]];
  function manning(D, y, S, n) {
    var th = 2 * Math.acos(1 - 2 * y), A = D * D / 8 * (th - Math.sin(th)), P = D * th / 2, R = A / P;
    return { Q: A * Math.pow(R, 2 / 3) * Math.sqrt(S) / n, v: Math.pow(R, 2 / 3) * Math.sqrt(S) / n };
  }
  function fillFor(D, Q, S, n) {
    var lo = 0.001, hi = 0.82;
    if (manning(D, hi, S, n).Q < Q) return null;
    for (var i = 0; i < 40; i++) { var m = (lo + hi) / 2; if (manning(D, m, S, n).Q < Q) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }
  function calcSd() {
    var ids = ['sd-du', 'sd-q', 'sd-dn', 'sd-fill', 'sd-v'];
    var sum = 0, big = 0, key, wc = 0;
    for (key in DU) { var c = num('sd-' + key); if (isFinite(c) && c > 0) { sum += c * DU[key]; big = Math.max(big, DU[key]); if (key === 'wc') wc = c; } }
    var K = parseFloat(radio('sd-k')), S = num('sd-s') / 100, ymax = num('sd-y');
    if (!sum || !allPos([K, S, ymax]) || ymax > 0.8) return clear(ids, 'sd-verdict', 'Укажите приборы, уклон и наполнение (от 0,1 до 0,8).');
    var Q = Math.max(K * Math.sqrt(sum), big);
    set('sd-du', fmt(sum, 1) + ' л/с'); set('sd-q', fmt(Q, 2) + ' л/с');
    for (var i = 0; i < SEW.length; i++) {
      if (wc && SEW[i][0] < 110) continue;
      var D = SEW[i][1] / 1000, y = fillFor(D, Q / 1000, S, 0.010);
      if (y !== null && y <= ymax) {
        var v = manning(D, y, S, 0.010).v;
        set('sd-dn', 'Ø ' + SEW[i][0] + ' мм'); set('sd-fill', fmt(y * 100, 0) + ' %'); set('sd-v', fmt(v, 2) + ' м/с');
        var msg = 'Достаточно трубы Ø ' + SEW[i][0] + ' мм при уклоне ' + fmt(S * 100, 1) + ' %.' + (wc ? ' Отвод от унитаза не меньше Ø 110 мм.' : '');
        if (v < 0.7) msg += ' Расчётная скорость ниже 0,7 м/с, но для небольших бытовых расходов нормы допускают не рассчитывать скорость и брать уклон 0,03 (Ø до 50 мм) или 0,02 (Ø больше 50 мм).';
        return verdict('sd-verdict', msg, false);
      }
    }
    ids.slice(2).forEach(function (x) { set(x, '—'); });
    verdict('sd-verdict', 'Расход больше, чем пропустит труба Ø 160 мм при таком уклоне и наполнении. Увеличьте уклон или обратитесь к проектировщику.', true);
  }
  var lastSlopeDn = 0;
  function calcSs() {
    var ids = ['ss-min', 'ss-drop', 'ss-have', 'ss-max'];
    var dn = num('ss-dn'), L = num('ss-l'), s = num('ss-s') / 100, av = num('ss-a');
    if (!allPos([dn, L])) return clear(ids, 'ss-verdict');
    var smin = dn <= 50 ? 0.03 : 0.02;
    if (lastSlopeDn !== dn) { lastSlopeDn = dn; if ($('ss-s')) $('ss-s').value = fmt(smin * 100, 1); s = smin; }
    if (!isFinite(s) || s <= 0) return clear(ids, 'ss-verdict', 'Введите уклон в процентах.');
    set('ss-min', fmt(smin * 100, 1) + ' % (' + fmt(smin * L * 1000, 0) + ' мм на ' + fmt(L, 1) + ' м)');
    set('ss-drop', fmt(s * L * 1000, 0) + ' мм');
    set('ss-max', fmt(0.15 * L * 1000, 0) + ' мм');
    var bad = false, msg = 'При уклоне ' + fmt(s * 100, 1) + ' % участок ' + fmt(L, 1) + ' м понижается на ' + fmt(s * L * 1000, 0) + ' мм. ';
    if (s > 0.15) { bad = true; msg += 'Уклон больше наибольшего допустимого 15 %. '; }
    if (s < smin) { bad = true; msg += 'Уклон меньше нормативного ' + fmt(smin * 100, 1) + ' % для этого диаметра. '; }
    if (isFinite(av) && av > 0) {
      var have = av / (L * 1000);
      set('ss-have', fmt(have * 100, 2) + ' %');
      if (have < smin) { bad = true; msg += 'Имеющегося перепада ' + fmt(av, 0) + ' мм не хватает: нужно минимум ' + fmt(smin * L * 1000, 0) + ' мм. '; }
      else if (have > 0.15) { bad = true; msg += 'Перепад слишком велик: уклон выйдет больше 15 %, ставьте промежуточный стояк или колено. '; }
      else msg += 'Имеющийся перепад ' + fmt(av, 0) + ' мм подходит. ';
    } else set('ss-have', '—');
    verdict('ss-verdict', msg + 'Нормы: 0,03 для Ø до 50 мм, 0,02 для больших диаметров, не более 0,15.', bad);
  }


  /* ───────── септик ───────── */
  var SEPTS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  var SOILS = { sand: ['песок', 80], supes: ['супесь', 40], sugl: ['суглинок', 20], clay: ['глина', 0] };
  function calcSe() {
    var ids = ['se-q', 'se-v', 'se-ch', 'se-std', 'se-type', 'se-field', 'se-nak'];
    var p = num('se-p'), lp = parseFloat($('se-use').value), ex = num('se-ex'), gw = num('se-gw'), sd = num('se-sd');
    if (!allPos([p, lp, gw, sd]) || !isFinite(ex) || ex < 0) return clear(ids, 'se-verdict', 'Введите число жильцов, глубину грунтовых вод и глубину заложения.');
    var soil = SOILS[$('se-soil').value], el = radio('se-el') === '1', car = radio('se-car') === '1';
    var Q = (p * lp + ex) / 1000, days = Q <= 5 ? 3 : 2.5, V = Q * days;
    var std = null; for (var i = 0; i < SEPTS.length; i++) if (SEPTS[i] >= V) { std = SEPTS[i]; break; }
    var ch = Q <= 1 ? '2 камеры: ' + fmt(V * 0.75, 2) + ' и ' + fmt(V * 0.25, 2) + ' м³' : '3 камеры: ' + fmt(V * 0.5, 2) + ', ' + fmt(V * 0.25, 2) + ' и ' + fmt(V * 0.25, 2) + ' м³';
    var clear1 = gw - sd, infil = soil[1] > 0 && clear1 >= 1, field = soil[1] > 0 ? Q * 1000 / soil[1] : NaN;
    var nak = Q * 14;
    set('se-q', fmt(Q, 2) + ' м³/сут'); set('se-std', std ? fmt(std, 1) + ' м³' : '—'); set('se-v', fmt(V, 1) + ' м³ (запас на ' + fmt(days, 1) + ' суток)'); set('se-ch', ch); set('se-std', std ? fmt(std, 1) + ' м³' : '—');
    set('se-field', infil ? fmt(field, 0) + ' м² фильтрации' : '—'); set('se-nak', fmt(nak, 1) + ' м³ на 14 суток');
    var type, msg = 'Расход ' + fmt(Q * 1000, 0) + ' л в сутки. ';
    if (Q <= 0.2 && car) { type = 'Накопительная ёмкость (выгребная)'; msg += 'При малом стоке дешевле герметичная ёмкость с откачкой, чем септик. '; }
    else if (infil) { type = 'Септик + фильтрация в грунт'; msg += 'Грунт (' + soil[0] + ') принимает воду, до воды остаётся ' + fmt(clear1, 1) + ' м. '; if (Q > 1.5) msg += 'Для большого стока рассмотрите станцию биологической очистки: площадь поля фильтрации ' + fmt(field, 0) + ' м² велика. '; }
    else if (el) { type = 'Станция биологической очистки (СБО) с отводом очищенной воды'; msg += (soil[1] === 0 ? 'Глина не принимает воду. ' : 'Грунтовые воды слишком близко, чтобы заглублять фильтрацию. ') + 'СБО работает на электричестве, очищенную воду отводят в канаву, на рельеф или в дренаж по согласованию. '; }
    else if (car) { type = 'Накопительная ёмкость (выгребная)'; msg += (soil[1] === 0 ? 'Глина не принимает воду. ' : 'Грунтовые воды близко. ') + 'Электричества нет, поэтому выбор сводится к герметичной ёмкости с откачкой. Нужно ' + fmt(nak, 1) + ' м³ ёмкости на откачку раз в 14 суток. '; }
    else { type = 'Нужен проект'; msg += 'Грунт не принимает воду, электричества и подъезда нет: решение подбирает проектировщик. '; }
    set('se-type', type);
    verdict('se-verdict', msg + 'Объём камер принят в 3 суток притока для стока до 5 м³ в сутки. Нагрузки на грунт и расстояния ориентировочные: сверьте их с проектом и местными требованиями.', type === 'Нужен проект');
  }

  /* ───────── отопление ───────── */
  var lastHeat = null;
  function calcHl() {
    var ids = ['hl-tr', 'hl-vent', 'hl-total', 'hl-m2'];
    var S = num('hl-s'), h = num('hl-h'), ti = num('hl-ti'), te = num('hl-te'), aw = num('hl-aw'), uw = num('hl-uw'), ag = num('hl-ag'), ug = num('hl-ug'), n = num('hl-n'), add = num('hl-add');
    var ur = parseFloat($('hl-roof').value), uf = parseFloat($('hl-floor').value);
    if (!allPos([S, h, uw, ug, n]) || !isFinite(ti) || !isFinite(te) || !isFinite(aw) || aw < 0 || !isFinite(ag) || ag < 0 || !isFinite(add) || ti <= te) { lastHeat = null; return clear(ids, 'hl-verdict', 'Проверьте числа: внутренняя температура должна быть выше наружной.'); }
    var dT = ti - te, tr = (uw * aw + ug * ag + ur * S + uf * S) * dT, vent = 0.335 * n * S * h * dT, total = (tr + vent) * (1 + add / 100);
    lastHeat = { W: total, S: S };
    set('hl-tr', fmt(tr, 0) + ' Вт'); set('hl-vent', fmt(vent, 0) + ' Вт'); set('hl-total', fmt(total, 0) + ' Вт'); set('hl-m2', fmt(total / S, 0) + ' Вт/м²');
    verdict('hl-verdict', 'Потери помещения около ' + fmt(total, 0) + ' Вт при ' + fmt(te, 0) + ' °С на улице. ' + (total / S > 150 ? 'Показатель больше 150 Вт/м²: проверьте, не завышены ли площади окон и стен, или утепляйте.' : 'Показатель в обычных пределах.') + ' Это оценка по упрощённой формуле, а не теплотехнический расчёт по нормам.', total / S > 150);
  }
  var BRK = [[2, 2, 1], [7, 3, 2], [16, 4, 3], [19, 5, 3], [28, 8, 4]];
  function calcHr() {
    var ids = ['hr-dt', 'hr-k', 'hr-nom', 'hr-n', 'hr-g', 'hr-br'];
    var Q = num('hr-q'), tf = num('hr-tf'), tr = num('hr-tr'), ti = num('hr-ti'), n = num('hr-exp'), qs = num('hr-sec');
    if (!allPos([Q, qs, n]) || !isFinite(tf) || !isFinite(tr) || !isFinite(ti) || tf <= tr) return clear(ids, 'hr-verdict', 'Температура подачи должна быть выше обратки, остальные числа больше нуля.');
    var dt = (tf + tr) / 2 - ti;
    if (dt <= 0) return clear(ids, 'hr-verdict', 'Средняя температура воды ниже температуры воздуха.');
    var k = Math.pow(dt / 70, n), nom = Q / k, N = Math.ceil(nom / qs - 0.001), G = Q * 3600 / (4190 * (tf - tr));
    set('hr-dt', fmt(dt, 1) + ' К'); set('hr-k', fmt(k, 2)); set('hr-nom', fmt(nom, 0) + ' Вт'); set('hr-n', N + ' секц.'); set('hr-g', fmt(G, 0) + ' л/ч');
    var br = '—';
    if (N <= 1) br = '—'; else for (var i = 0; i < BRK.length; i++) if (N <= BRK[i][0]) { br = BRK[i][1] + ' одиночных или ' + BRK[i][2] + ' двойных'; break; }
    if (br === '—' && N > 28) br = 'больше 28 секций: разделите на два прибора';
    set('hr-br', br);
    verdict('hr-verdict', 'При средней температуре воды ' + fmt((tf + tr) / 2, 0) + ' °С радиатор отдаёт ' + fmt(k * 100, 0) + ' % номинала. Нужно ' + N + ' секций по ' + fmt(qs, 0) + ' Вт. Кронштейны по ТКП 45-1.03-85, табл. 2. Подключение, закрытие экраном и нишей снижают отдачу, берите запас 10 %.', N > 28);
  }
  function calcHp() {
    var ids = ['hp-g', 'hp-d', 'hp-pipe', 'hp-v', 'hp-r'];
    var Q = num('hp-q'), tf = num('hp-tf'), tr = num('hp-tr'), vmax = num('hp-vmax');
    if (!allPos([Q, vmax]) || !isFinite(tf) || !isFinite(tr) || tf <= tr) return clear(ids, 'hp-verdict', 'Температура подачи должна быть выше обратки.');
    var m = Q / (4190 * (tf - tr)), Qv = m / WATER.heat.rho;
    set('hp-g', fmt(m * 3600, 0) + ' кг/ч (' + fmt(Qv * 1000, 3) + ' л/с)');
    set('hp-d', fmt(Math.sqrt(4 * Qv / (Math.PI * vmax)) * 1000, 1) + ' мм');
    var p = pickPipe($('hp-s').value, Qv, vmax);
    if (!p) { ['hp-pipe', 'hp-v', 'hp-r'].forEach(function (x) { set(x, '—'); }); return verdict('hp-verdict', 'Мощность больше, чем пропустит трубопровод этого ряда при заданной скорости.', true); }
    var h = hyd(Qv, p[1], $('hp-s').value === 'steel' ? ROUGH.steel : ROUGH.plastic, WATER.heat);
    set('hp-pipe', p[0]); set('hp-v', fmt(h.v, 2) + ' м/с'); set('hp-r', fmt(h.R, 0) + ' Па/м');
    verdict('hp-verdict', 'Для участка ' + fmt(Q, 0) + ' Вт подходит ' + p[0] + ': скорость ' + fmt(h.v, 2) + ' м/с. Потери на метр ' + fmt(h.R, 0) + ' Па. ' + (h.R > 250 ? 'Потери велики для насоса бытовой системы: возьмите диаметр больше.' : 'Для бытовой системы это обычно приемлемо.'), h.R > 250);
  }
  function calcHf() {
    var ids = ['hf-q', 'hf-cap', 'hf-len', 'hf-loops', 'hf-g'];
    var S = num('hf-s'), step = num('hf-step'), tf = num('hf-tf'), ti = num('hf-ti'), lead = num('hf-lead'), lmax = num('hf-lmax'), dT = num('hf-dt'), need = num('hf-need');
    if (!allPos([S, step, lmax, dT]) || !isFinite(tf) || !isFinite(ti) || tf <= ti || !isFinite(lead) || lead < 0) return clear(ids, 'hf-verdict', 'Температура пола должна быть выше температуры воздуха.');
    var q = 8.92 * Math.pow(tf - ti, 1.1), Q = q * S, len = S / (step / 1000) * 1.05 + lead * 2, loops = Math.ceil(len / lmax), G = Q * 3600 / (4190 * dT);
    set('hf-q', fmt(q, 0) + ' Вт/м²'); set('hf-cap', fmt(Q, 0) + ' Вт'); set('hf-len', fmt(len, 0) + ' м'); set('hf-loops', loops + ' (по ' + fmt(len / loops, 0) + ' м)'); set('hf-g', fmt(G, 0) + ' л/ч');
    var bad = false, msg = 'Пол отдаёт около ' + fmt(q, 0) + ' Вт/м² при температуре поверхности ' + fmt(tf, 0) + ' °С. ';
    if (tf > 29) { bad = true; msg += 'Для постоянного пребывания людей поверхность пола не должна быть выше 29 °С (33 °С при временном). '; }
    if (isFinite(need) && need > 0) {
      if (Q < need) { bad = true; msg += 'Потерь помещения ' + fmt(need, 0) + ' Вт пол не покрывает: нужен дополнительный радиатор или меньший шаг трубы. '; }
      else msg += 'Потери помещения ' + fmt(need, 0) + ' Вт покрываются. ';
    }
    verdict('hf-verdict', msg + 'Тёплый пол пускают через 20 суток после заливки: вода 25 °С три суток, дальше +5 °С в сутки. Сопротивление покрытия (ламинат, ковёр) в расчёт не входит и снижает отдачу.', bad);
  }
  var RHOW = [[10, 999.7], [20, 998.2], [30, 995.7], [40, 992.2], [50, 988.0], [60, 983.2], [70, 977.8], [80, 971.8], [90, 965.3], [95, 961.9], [100, 958.4]];
  var TANKS = [8, 12, 18, 24, 35, 50, 80, 100, 150, 200, 300, 500];
  function calcHx() {
    var ids = ['hx-vso', 'hx-e', 'hx-v', 'hx-tank'];
    var Vs = num('hx-vs'), kw = num('hx-kw'), T = num('hx-t'), p0 = num('hx-p0'), pm = num('hx-pm');
    if (!(Vs > 0)) { if (kw > 0) Vs = kw * 12; }
    if (!allPos([Vs, T, p0, pm]) || T <= 10 || T > 100 || pm <= p0) return clear(ids, 'hx-verdict', 'Задайте объём воды (или мощность котла), температуру, давление в баке и открытия клапана (клапан выше давления в баке).');
    var e = interp(RHOW, 10) / interp(RHOW, T) - 1, V = Vs * e / (1 - (p0 + 1) / (pm + 1)), tank = null;
    for (var i = 0; i < TANKS.length; i++) if (TANKS[i] >= V) { tank = TANKS[i]; break; }
    set('hx-vso', fmt(Vs, 0) + ' л'); set('hx-e', fmt(e * 100, 2) + ' %'); set('hx-v', fmt(V, 1) + ' л'); set('hx-tank', tank ? tank + ' л' : '—');
    verdict('hx-verdict', tank ? 'Берите бак не меньше ' + tank + ' л. Предварительное давление в баке (воздух) равно давлению воды в холодной системе ' + fmt(p0, 1) + ' бар.' : 'Нужен бак больше 500 л или несколько баков: проект.', !tank);
  }


  /* ───────── стоимость тепла и удлинение труб ───────── */
  var FUELS = { hp: 1, ebp: 1, eb: 1, gas: 9.3, wood: 4000, pel: 4800, lpg: 6.9 };
  var FNAMES = { hp: 'Тепловой насос', ebp: 'Электрокотёл по льготному тарифу', eb: 'Электрокотёл по обычному тарифу', gas: 'Газ', wood: 'Дрова', pel: 'Пеллеты', lpg: 'Сжиженный газ' };
  function calcHc() {
    var Q = num('hc-q'), best = null, bk = null, any = false;
    Object.keys(FUELS).forEach(function (k) {
      var e = num('hc-e-' + k), p = num('hc-p-' + k);
      if (!(e > 0) || !(p > 0)) { set('hc-c-' + k, '—'); set('hc-s-' + k, '—'); return; }
      var c = p / (FUELS[k] * e / 100);
      set('hc-c-' + k, fmt(c, 4)); set('hc-s-' + k, Q > 0 ? fmt(c * Q, 0) : '—');
      any = true;
      if (best === null || c < best) { best = c; bk = k; }
    });
    if (!any || !(Q > 0)) return verdict('hc-verdict', 'Введите потребность в тепле и цены (хотя бы для одного источника).', true);
    verdict('hc-verdict', 'Дешевле всего по введённым данным: ' + FNAMES[bk].toLowerCase() + ', ' + fmt(best, 4) + ' BYN за кВт·ч тепла, около ' + fmt(best * Q, 0) + ' BYN за сезон. Это только топливо: оборудование, обслуживание и подключение сюда не входят.', false);
  }
  function calcEx() {
    var ids = ['ex-dt', 'ex-dl', 'ex-arm'];
    var a = parseFloat($('ex-m').value), L = num('ex-l'), tw = num('ex-tw'), tm = num('ex-tm'), d = num('ex-d');
    if (!allPos([a, L, d]) || !isFinite(tw) || !isFinite(tm)) return clear(ids, 'ex-verdict', 'Введите длину, диаметр и температуры.');
    var dT = tw - tm, dl = a * L * dT, arm = 30 * Math.sqrt(d * Math.abs(dl));
    set('ex-dt', fmt(dT, 0) + ' К'); set('ex-dl', fmt(dl, 1) + ' мм'); set('ex-arm', fmt(arm, 0) + ' мм');
    verdict('ex-verdict', 'Участок ' + fmt(L, 1) + ' м удлинится на ' + fmt(dl, 1) + ' мм. ' + (Math.abs(dl) > 10 ? 'Это много: нужен компенсатор, Г- или П-образный участок (плечо не меньше ' + fmt(arm, 0) + ' мм) и подвижные опоры. Неподвижные опоры ставьте у фитингов.' : 'Удлинение небольшое, но трубу не закрепляют жёстко по всей длине: оставляйте зазор в креплениях.'), Math.abs(dl) > 30);
  }

  /* ───────── вентиляция ───────── */
  var AIR = {
    room: { name: 'Жилая комната (приток)', area: 3, mult: 0.5 },
    kitchen_e: { name: 'Кухня с электроплитой (вытяжка)', fix: 60 },
    kitchen_g: { name: 'Кухня с газовой плитой (вытяжка)', fix: 90 },
    bath: { name: 'Ванная, душевая', fix: 25 },
    wc: { name: 'Туалет', fix: 25 },
    sanuzel: { name: 'Совмещённый санузел', fix: 50 },
    office: { name: 'Офис, кабинет', man: 60 },
    hall: { name: 'Зал, где люди не более 3 ч', man: 20 },
    shop: { name: 'Торговый зал, магазин', man: 60 },
    own: { name: 'Своя кратность', mult: 1 }
  };
  function calcVa() {
    var ids = ['va-by', 'va-ppl', 'va-area', 'va-mult', 'va-q'];
    var t = AIR[$('va-type').value], S = num('va-s'), h = num('va-h'), P = num('va-p'), m = num('va-m');
    if (!t || !allPos([S, h]) || !isFinite(P) || P < 0) return clear(ids, 'va-verdict', 'Введите площадь, высоту и число людей.');
    var V = S * h, parts = [];
    if (t.fix) parts.push([t.fix, 'норма для помещения']);
    if (t.man && P > 0) parts.push([t.man * P, fmt(t.man, 0) + ' м³/ч на человека']);
    if (t.area) parts.push([t.area * S, '3 м³/ч на м² жилых помещений']);
    var mm = isFinite(m) && m > 0 ? m : (t.mult || 0);
    if (mm) parts.push([mm * V, 'кратность ' + fmt(mm, 1) + ' раз в час']);
    if (!parts.length) return clear(ids, 'va-verdict', 'Для этого помещения укажите число людей или кратность.');
    var best = parts.reduce(function (a, b) { return b[0] > a[0] ? b : a; });
    set('va-by', best[1]); set('va-ppl', t.man && P > 0 ? fmt(t.man * P, 0) + ' м³/ч' : '—'); set('va-area', t.area ? fmt(t.area * S, 0) + ' м³/ч' : (t.fix ? fmt(t.fix, 0) + ' м³/ч' : '—'));
    set('va-mult', fmt(best[0] / V, 1) + ' раз/ч'); set('va-q', fmt(best[0], 0) + ' м³/ч (' + fmt(best[0] / 3.6, 0) + ' л/с)');
    verdict('va-verdict', 'Расход воздуха ' + fmt(best[0], 0) + ' м³/ч определяет ' + best[1] + '. ' + (t.fix ? 'Норма для вытяжек из кухонь и санузлов — ориентир практики, сверьте с таблицей СН 4.02.03. ' : '') + 'Нормы на человека (60 и 20 м³/ч) и 3 м³/ч на м² даны по СН 4.02.03, прил. П, табл. П.1.', false);
  }
  var ROUND = [100, 125, 160, 200, 250, 315, 400, 500, 630, 800];
  var lastQ = 0;
  function calcVd() {
    var ids = ['vd-d', 'vd-v', 'vd-r', 'vd-dp', 'vd-rect'];
    var Q = num('vd-q'), v = num('vd-vmax'), L = num('vd-l'), z = num('vd-z'), b = num('vd-b');
    if (!allPos([Q, v, L]) || !isFinite(z) || z < 0 || !isFinite(b) || b <= 0) return clear(ids, 'vd-verdict');
    var q = Q / 3600, dreq = Math.sqrt(4 * q / (Math.PI * v)) * 1000, d = ROUND[ROUND.length - 1];
    for (var i = 0; i < ROUND.length; i++) if (ROUND[i] >= dreq) { d = ROUND[i]; break; }
    var h = hyd(q, d, 0.1e-3, { rho: 1.2, nu: 15.1e-6 }), dp = h.R * L + z * 1.2 * h.v * h.v / 2;
    // равнозначный прямоугольный: de = 1,3 (ab)^0,625 / (a+b)^0,25, решаем по a при заданной высоте b
    var lo = b, hi = 5000;
    function de(a) { return 1.3 * Math.pow(a * b, 0.625) / Math.pow(a + b, 0.25); }
    var rect = '—';
    if (de(hi) >= d) { for (var k = 0; k < 40; k++) { var mid = (lo + hi) / 2; if (de(mid) < d) lo = mid; else hi = mid; } rect = Math.ceil(hi / 50) * 50 + ' × ' + b + ' мм'; }
    set('vd-d', 'Ø ' + d + ' мм (расчётный ' + fmt(dreq, 0) + ')'); set('vd-v', fmt(h.v, 2) + ' м/с'); set('vd-r', fmt(h.R, 2) + ' Па/м'); set('vd-dp', fmt(dp, 0) + ' Па'); set('vd-rect', rect);
    var bad = h.v > v * 1.15;
    verdict('vd-verdict', 'Круглый воздуховод Ø ' + d + ' мм, скорость ' + fmt(h.v, 2) + ' м/с, потери сети ' + fmt(dp, 0) + ' Па: вентилятор должен давать это давление плюс потери решёток, фильтра и клапанов. ' + (h.v > 5 && $('vd-net').value === 'home' ? 'В жилье выше 5 м/с воздуховод шумит. ' : '') + 'Скорости 3–5 м/с в жилье и 5–8 м/с в офисах — практический ориентир.', bad);
  }
  var GR = [[150, 150], [200, 200], [300, 150], [300, 300], [400, 200], [400, 400], [600, 300], [600, 600]];
  function calcVg() {
    var ids = ['vg-area', 'vg-n'];
    var Q = num('vg-q'), v = num('vg-v'), k = num('vg-k');
    if (!allPos([Q, v, k]) || k > 1) return clear(ids, 'vg-verdict', 'Свободное сечение — доля от 0,1 до 1.');
    var free = Q / 3600 / v, nom = free / k, rows = GR.map(function (g) { return g[0] + ' × ' + g[1] + ' мм — ' + Math.ceil(nom / (g[0] * g[1] / 1e6) - 0.001) + ' шт.'; });
    set('vg-area', fmt(free * 10000, 0) + ' см² свободного сечения'); set('vg-n', fmt(nom * 10000, 0) + ' см² по габариту');
    verdict('vg-verdict', 'Варианты: ' + rows.join(', ').replace(/\.,/g, ';') + ' Скорость в решётке 2–3 м/с даёт тихую работу, выше — свист.', v > 3.5);
  }
  function calcVh() {
    var ids = ['vh-t', 'vh-p', 'vh-a1', 'vh-a3'];
    var Q = num('vh-q'), te = num('vh-te'), ts = num('vh-ts'), ti = num('vh-ti'), eta = num('vh-eta');
    if (!allPos([Q]) || !isFinite(te) || !isFinite(ts) || !isFinite(ti) || !isFinite(eta) || eta < 0 || eta > 95 || ts <= te) return clear(ids, 'vh-verdict', 'Приточный воздух должен быть теплее наружного, КПД рекуператора от 0 до 95 %.');
    var t1 = te + eta / 100 * (ti - te), P = Math.max(0, 0.335 * Q * (ts - t1)) / 1000;
    set('vh-t', fmt(t1, 1) + ' °С'); set('vh-p', fmt(P, 1) + ' кВт'); set('vh-a1', fmt(P * 1000 / 230, 0) + ' А'); set('vh-a3', fmt(P * 1000 / (1.732 * 400), 0) + ' А');
    verdict('vh-verdict', 'После рекуператора воздух ' + fmt(t1, 1) + ' °С, догреть до ' + fmt(ts, 0) + ' °С нужно ' + fmt(P, 1) + ' кВт. ' + (P > 3.5 ? 'Однофазная сеть не подойдёт, электрокалорифер подключают трёхфазно. ' : '') + 'Автомат и кабель подберите в разделе «Электрика → Автоматы и УЗО».', false);
  }

  /* ───────── вкладки и связывание ───────── */
  function init() {
    var root = $('e-inzh');
    if (!root) return;
    var panels = [];
    Array.prototype.forEach.call(root.querySelectorAll('.e-panel'), function (p) { panels.push(p.id); });
    root.classList.add('js');
    function show(id) {
      if (panels.indexOf(id) < 0) id = panels[0];
      Array.prototype.forEach.call(root.querySelectorAll('.e-panel'), function (p) { p.classList.toggle('on', p.id === id); });
      Array.prototype.forEach.call(document.querySelectorAll('.e-sub a'), function (a) {
        var on = a.getAttribute('data-sub') === id;
        a.classList.toggle('on', on);
        if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      });
    }
    function fromHash() { show((location.hash || '').replace('#', '')); }
    fromHash();
    window.addEventListener('hashchange', fromHash);
    Array.prototype.forEach.call(document.querySelectorAll('.e-sub a'), function (a) {
      a.addEventListener('click', function (ev) {
        ev.preventDefault(); var id = a.getAttribute('data-sub');
        try { history.replaceState(null, '', '#' + id); } catch (e) { location.hash = id; }
        show(id);
      });
    });
    var F = { hc: calcHc, ex: calcEx, se: calcSe, pu: calcPu, hb: calcHb, wd: calcWd, wp: calcWp, wh: calcWh, sd: calcSd, ss: calcSs, hl: calcHl, hr: calcHr, hp: calcHp, hf: calcHf, hx: calcHx, va: calcVa, vd: calcVd, vg: calcVg, vh: calcVh };
    Object.keys(F).forEach(function (pre) {
      Array.prototype.forEach.call(root.querySelectorAll('[id^="' + pre + '-"], input[name^="' + pre + '-"]'), function (el) {
        if (el.tagName === 'INPUT' || el.tagName === 'SELECT') { el.addEventListener('input', F[pre]); el.addEventListener('change', F[pre]); }
      });
    });
    function go(id) { try { history.replaceState(null, '', '#' + id); } catch (e) { /* ничего */ } show(id); }
    function on(id, fn) { var el = $(id); if (el) el.addEventListener('click', fn); }
    on('wd-to', function () {
      if (!lastWater) return;
      $('wp-q').value = fmt(lastWater.Q, 2); $('wp-mat').value = 'plastic'; $('wp-d').value = fmt(lastWater.d, 1);
      calcWp(); go('wpress');
    });
    on('pu-to', function () {
      var Q = num('pu-q'), off = num('pu-poff');
      if (!(Q > 0) || !(off > 0)) return;
      $('hb-q').value = fmt(Q, 0); $('hb-off').value = fmt(off, 1); $('hb-on').value = fmt(Math.max(0.5, off - 1.5), 1);
      calcHb(); go('tank');
    });
    on('hb-go', function () { go('tanksetup'); });
    on('hl-to-r', function () { if (!lastHeat) return; $('hr-q').value = fmt(lastHeat.W, 0); calcHr(); go('radiators'); });
    on('hl-to-p', function () { if (!lastHeat) return; $('hp-q').value = fmt(lastHeat.W, 0); calcHp(); go('hpipes'); });
    on('hl-to-f', function () { if (!lastHeat) return; $('hf-s').value = fmt(lastHeat.S, 1); $('hf-need').value = fmt(lastHeat.W, 0); calcHf(); go('floor'); });
    on('va-to-d', function () {
      var t = AIR[$('va-type').value], S = num('va-s'), h = num('va-h'), P = num('va-p'), m = num('va-m');
      var arr = [t.fix || 0, t.man && P > 0 ? t.man * P : 0, t.area ? t.area * S : 0, (isFinite(m) && m > 0 ? m : (t.mult || 0)) * S * h];
      var q = Math.max.apply(null, arr);
      if (q > 0) { $('vd-q').value = fmt(q, 0); $('vg-q').value = fmt(q, 0); $('vh-q').value = fmt(q, 0); calcVd(); calcVg(); calcVh(); go('duct'); }
    });
    var cp = $('hr-type');
    if (cp) cp.addEventListener('change', function () { $('hr-sec').value = cp.value; calcHr(); });
    var PG = { water: ['wd', 'wp', 'wh', 'pu', 'hb'], sewer: ['sd', 'ss', 'se'], heat: ['hl', 'hr', 'hp', 'hf', 'hx', 'hc', 'ex'], vent: ['va', 'vd', 'vg', 'vh'] };
    (PG[root.getAttribute('data-page')] || []).forEach(function (k) { F[k](); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
