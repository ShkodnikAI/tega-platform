/* Электрические калькуляторы раздела «Расчёт смет». Ориентировочные расчёты, не заменяют проект. */
(function () {
  'use strict';
  var SQ3 = 1.732;
  // Допустимые длительные токи, А: МЭК 60364-5-52 (ГОСТ 30331.5), температура воздуха 30 °С.
  // Способы прокладки: A1 — в трубе в теплоизолированной стене, B1 — в трубе или коробе на стене, C — открыто по стене, E — на лотке в воздухе.
  // Для каждого сечения: [A1, B1, C, E] при 2 нагруженных жилах, затем при 3 нагруженных жилах.
  var SZ = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120];
  var TAB = {
    cu_pvc: {
      2: { 1.5: [14.5, 17.5, 19.5, 22], 2.5: [19.5, 24, 27, 30], 4: [26, 32, 36, 40], 6: [34, 41, 46, 51], 10: [46, 57, 63, 70], 16: [61, 76, 85, 94], 25: [80, 101, 112, 119], 35: [99, 125, 138, 148], 50: [119, 151, 168, 180], 70: [151, 192, 213, 232], 95: [182, 232, 258, 282], 120: [210, 269, 299, 328] },
      3: { 1.5: [13.5, 15.5, 17.5, 18.5], 2.5: [18, 21, 24, 25], 4: [24, 28, 32, 34], 6: [31, 36, 41, 43], 10: [42, 50, 57, 60], 16: [56, 68, 76, 80], 25: [73, 89, 96, 101], 35: [89, 110, 119, 126], 50: [108, 134, 144, 153], 70: [136, 171, 184, 196], 95: [164, 207, 223, 238], 120: [188, 239, 259, 276] }
    },
    cu_xlpe: {
      2: { 1.5: [19, 23, 24, 26], 2.5: [26, 31, 33, 36], 4: [35, 42, 45, 49], 6: [45, 54, 58, 63], 10: [61, 75, 80, 86], 16: [81, 100, 107, 115], 25: [106, 133, 138, 149], 35: [131, 164, 171, 185], 50: [158, 198, 209, 225], 70: [200, 253, 269, 289], 95: [241, 306, 328, 352], 120: [278, 354, 382, 410] },
      3: { 1.5: [17, 20, 22, 23], 2.5: [23, 28, 30, 32], 4: [31, 37, 40, 42], 6: [40, 48, 52, 54], 10: [54, 66, 71, 75], 16: [73, 88, 96, 100], 25: [95, 117, 119, 127], 35: [117, 144, 147, 158], 50: [141, 175, 179, 192], 70: [179, 222, 229, 246], 95: [216, 269, 278, 298], 120: [249, 312, 322, 346] }
    },
    al_pvc: {
      2: { 2.5: [null, 18.5, 20.5, null], 4: [null, 25, 28, null], 6: [null, 32, 36, null], 10: [null, 44, 49, null], 16: [null, 59, 66, null], 25: [null, 73, 83, null], 35: [null, 90, 103, null], 50: [null, 110, 125, null], 70: [null, 140, 160, null], 95: [null, 170, 195, null], 120: [null, 197, 226, null] },
      3: { 2.5: [null, 16.5, 18.5, null], 4: [null, 22, 25, null], 6: [null, 28, 32, null], 10: [null, 39, 44, null], 16: [null, 53, 59, null], 25: [null, 67, 73, null], 35: [null, 79, 90, null], 50: [null, 99, 110, null], 70: [null, 126, 140, null], 95: [null, 153, 170, null], 120: [null, 178, 197, null] }
    }
  };
  var LAYI = { A1: 0, B1: 1, C: 2, E: 3 };
  var LAYN = { A1: 'в трубе в теплоизолированной стене', B1: 'в трубе или коробе на стене', C: 'открыто по стене', E: 'на лотке в воздухе' };
  // поправка на температуру воздуха (МЭК 60364-5-52, табл. B.52.14)
  var KT = {
    pvc: [[10, 1.22], [15, 1.17], [20, 1.12], [25, 1.06], [30, 1.0], [35, 0.94], [40, 0.87], [45, 0.79], [50, 0.71], [55, 0.61], [60, 0.5]],
    xlpe: [[10, 1.15], [15, 1.12], [20, 1.08], [25, 1.04], [30, 1.0], [35, 0.96], [40, 0.91], [45, 0.87], [50, 0.82], [55, 0.76], [60, 0.71]]
  };
  // поправка на число цепей рядом (табл. B.52.17): в канале или пучком, на стене в один слой, на лотке в один слой
  var KG = {
    bunch: [1, 0.8, 0.7, 0.65, 0.6, 0.57, 0.54, 0.52, 0.5],
    wall: [1, 0.85, 0.79, 0.75, 0.73, 0.72, 0.72, 0.71, 0.7],
    tray: [1, 0.88, 0.82, 0.77, 0.75, 0.73, 0.73, 0.72, 0.72]
  };
  var RHO = { cu_pvc: 0.0214, cu_xlpe: 0.0228, al_pvc: 0.0345 };   // Ом·мм²/м при рабочей температуре жилы
  var XL = 0.00008;                                                  // Ом/м, индуктивное сопротивление кабеля
  var BR = [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125];
  var KINDS = { light: { min: 1.5, lim: 3 }, sock: { min: 2.5, lim: 5 }, power: { min: 1.5, lim: 5 } };

  function $(id) { return document.getElementById(id); }
  function num(id) {
    var el = $(id);
    if (!el) return NaN;
    var n = parseFloat(String(el.value).replace(/\s/g, '').replace(',', '.'));
    return isFinite(n) ? n : NaN;
  }
  function radio(name) {
    var el = document.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : '';
  }
  function fmt(x, d) {
    if (!isFinite(x)) return '—';
    var s = Math.abs(x).toFixed(d);
    var parts = s.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return (x < 0 ? '−' : '') + parts.join(',');
  }
  function set(id, v) { var el = $(id); if (el) el.textContent = v; }
  function verdict(id, text, bad) {
    var el = $(id);
    if (!el) return;
    el.textContent = text;
    el.className = 'verdict' + (bad ? ' bad' : '');
  }
  function clear(ids, vid, msg) {
    ids.forEach(function (i) { set(i, '—'); });
    verdict(vid, msg || 'Введите числа больше нуля.', true);
  }
  function allPos(arr) { return arr.every(function (v) { return isFinite(v) && v > 0; }); }
  function interp(tab, x) {
    if (x <= tab[0][0]) return tab[0][1];
    for (var i = 0; i < tab.length - 1; i++) {
      if (x <= tab[i + 1][0]) return tab[i][1] + (tab[i + 1][1] - tab[i][1]) * (x - tab[i][0]) / (tab[i + 1][0] - tab[i][0]);
    }
    return tab[tab.length - 1][1];
  }
  function sizeLbl(S) { return fmt(S, S % 1 ? 1 : 0); }
  function dropPct(ph, I, L, key, S, cos, U) {
    var sin = Math.sqrt(Math.max(0, 1 - cos * cos));
    var dv = (ph === 1 ? 2 : SQ3) * I * L * (RHO[key] / S * cos + XL * sin);
    return dv / U * 100;
  }

  /* 01 подбор сечения кабеля */
  function toggleMode() {
    var byI = radio('c-mode') === 'i';
    $('c-wp').hidden = byI; $('c-wi').hidden = !byI;
  }
  function calcCable() {
    var ids = ['c-r-i', 'c-r-mech', 'c-r-cur', 'c-r-drop', 'c-r-s', 'c-r-by', 'c-r-in', 'c-r-iz', 'c-r-du'];
    var ph = parseInt(radio('c-ph'), 10), mat = radio('c-mat'), ins = radio('c-ins'), byI = radio('c-mode') === 'i';
    var lay = $('c-lay').value, kind = KINDS[$('c-kind').value];
    var U = num('c-u'), cos = num('c-cos'), L = num('c-l'), k = num('c-k'), lim = num('c-lim'), T = num('c-t'), n = Math.round(num('c-n'));
    var raw = byI ? num('c-i') : num('c-p');
    if (!allPos([raw, U, cos, L, k, lim, n]) || cos > 1 || !isFinite(T)) return clear(ids, 'c-verdict');
    if (T < 10 || T > 60) return clear(ids, 'c-verdict', 'Температура воздуха: от 10 до 60 °С.');
    var key = mat + '_' + ins;
    if (!TAB[key]) return clear(ids, 'c-verdict', 'Для алюминия таблица есть только для изоляции из ПВХ. Выберите ПВХ или медь.');
    var li = LAYI[lay];
    if (TAB[key][2][sizesOf(key)[0]][li] === null) return clear(ids, 'c-verdict', 'Для алюминия доступны способы B1 и C. Выберите другой способ или медь.');
    var I = byI ? raw * k : (ph === 1 ? raw * 1000 / (U * cos) : raw * 1000 / (SQ3 * U * cos)) * k;
    var kt = interp(KT[ins], T);
    var gl = lay === 'E' ? KG.tray : (lay === 'C' ? KG.wall : KG.bunch);
    var kg = gl[Math.min(n, gl.length) - 1];
    var cols = ph === 1 ? 2 : 3, list = sizesOf(key);
    var In = null;
    for (var i = 0; i < BR.length; i++) { if (BR[i] >= I - 1e-9) { In = BR[i]; break; } }
    set('c-r-i', fmt(I, 1) + ' А');
    if (!In) { ids.slice(1).forEach(function (x) { set(x, '—'); }); return verdict('c-verdict', 'Ток больше 125 А: такую линию рассчитывает проектировщик.', true); }
    var minS = mat === 'al' ? Math.max(2.5, kind.min) : kind.min;
    function izOf(S) { return TAB[key][cols][S][li] * kt * kg; }
    function firstBy(fn) { for (var j = 0; j < list.length; j++) { if (fn(list[j])) return list[j]; } return null; }
    var sMech = firstBy(function (S) { return S >= minS; });
    var sCur = firstBy(function (S) { return izOf(S) >= In - 1e-9; });
    var sDrop = firstBy(function (S) { return dropPct(ph, I, L, key, S, cos, U) <= lim; });
    set('c-r-mech', sizeLbl(minS) + ' мм²');
    set('c-r-cur', sCur ? sizeLbl(sCur) + ' мм²' : 'больше 120 мм²');
    set('c-r-drop', sDrop ? sizeLbl(sDrop) + ' мм²' : 'больше 120 мм²');
    set('c-r-in', In + ' А');
    if (!sCur || !sDrop) {
      ['c-r-s', 'c-r-by', 'c-r-iz', 'c-r-du'].forEach(function (x) { set(x, '—'); });
      return verdict('c-verdict', 'Сечение больше 120 мм² (или не проходит по условиям): линию рассчитывает проектировщик, возможно, несколькими кабелями.', true);
    }
    var S = Math.max(sMech, sCur, sDrop), by = [];
    if (S === sMech) by.push('механическая прочность');
    if (S === sCur) by.push('нагрев током');
    if (S === sDrop) by.push('потеря напряжения');
    var iz = izOf(S), dp = dropPct(ph, I, L, key, S, cos, U);
    set('c-r-s', (ph === 1 ? '3' : '5') + ' × ' + sizeLbl(S) + ' мм²');
    set('c-r-by', by.join(', '));
    set('c-r-iz', fmt(iz, 1) + ' А');
    set('c-r-du', fmt(dp, 2) + ' % (' + fmt(dp * U / 100, 1) + ' В)');
    var mark = (mat === 'al' ? 'АВВГнг(А)-LS' : 'ВВГнг(А)-LS');
    verdict('c-verdict', 'Условие выполнено: ' + fmt(I, 1) + ' А ≤ ' + In + ' А ≤ ' + fmt(iz, 1) + ' А, потеря ' + fmt(dp, 2) + ' % при допуске ' + fmt(lim, 1) + ' %. Способ прокладки: ' + LAYN[lay] + '. Поправки: на температуру ' + fmt(kt, 2) + ', на число цепей ' + fmt(kg, 2) + '. ' + (ins === 'xlpe' ? 'Кабель с изоляцией из сшитого полиэтилена, марку уточняйте у поставщика.' : 'Марка: ' + mark + '.') +
      (mat === 'al' ? ' Проверьте, допускает ли ваш случай алюминий: в жилых зданиях его применение ограничено.' : ''), false);
  }
  function sizesOf(key) { return Object.keys(TAB[key][2]).map(parseFloat).sort(function (a, b) { return a - b; }); }

  /* 03 ток КЗ */
  function calcKz() {
    var ids = ['k-r-z', 'k-r-ik', 'k-r-th', 'k-r-m'];
    var mat = radio('k-mat'), U = num('k-u'), S = num('k-s'), L = num('k-l'), Zs = num('k-zs'), In = num('k-in');
    var t = $('k-type').value.split(':'), mult = parseFloat(t[0]), tn = t[1];
    if (!allPos([U, S, L, In]) || !isFinite(Zs) || Zs < 0) return clear(ids, 'k-verdict');
    var Z = 2 * RHO[mat] * L / S + Zs, Ik = U / Z, th = mult * In, m = Ik / th;
    set('k-r-z', fmt(Z, 2) + ' Ом');
    set('k-r-ik', fmt(Ik, 0) + ' А');
    set('k-r-th', fmt(th, 0) + ' А (' + tn + fmt(In, 0) + ')');
    set('k-r-m', m >= 1 ? 'в ' + fmt(m, 1) + ' раза' : 'нет (' + fmt(m, 2) + ')');
    if (m >= 1) verdict('k-verdict', 'Автомат сработает на электромагнитном расцепителе, защита обеспечена.', false);
    else verdict('k-verdict', 'Тока КЗ не хватает для мгновенного срабатывания. Увеличьте сечение, сократите линию, возьмите расцепитель B или автомат меньшего номинала.', true);
  }

  /* 04 заземление */
  function calcGround() {
    var ids = ['g-r-1', 'g-r-n', 'g-r-tot', 'g-r-strip'];
    var rho = num('g-rho'), l = num('g-l'), d = num('g-d') / 1000, t0 = num('g-t0'), R = num('g-r'), eta = num('g-eta'), a = num('g-a');
    if (!allPos([rho, l, d, R, eta, a]) || !isFinite(t0) || t0 < 0 || eta > 1) return clear(ids, 'g-verdict');
    var t = t0 + l / 2;
    var Rr = rho / (2 * Math.PI * l) * (Math.log(2 * l / d) + 0.5 * Math.log((4 * t + l) / (4 * t - l)));
    var n = Rr <= R ? 1 : Math.ceil(Rr / (R * eta));
    var tot = n === 1 ? Rr : Rr / (n * eta);
    set('g-r-1', fmt(Rr, 1) + ' Ом');
    set('g-r-n', n + ' шт');
    set('g-r-tot', fmt(tot, 1) + ' Ом');
    set('g-r-strip', '≈ ' + fmt((n - 1) * a, 0) + ' м');
    verdict('g-verdict', 'Результат ориентировочный, замер на месте обязателен.', false);
  }

  /* 05 освещение */
  var ETA = [[0.5, 0.28], [0.6, 0.31], [0.8, 0.36], [1.0, 0.41], [1.25, 0.45], [1.5, 0.48], [2.0, 0.53], [2.5, 0.56], [3.0, 0.58]];
  function etaOf(i) {
    if (i <= ETA[0][0]) return ETA[0][1];
    for (var k = 0; k < ETA.length - 1; k++) {
      var a = ETA[k], b = ETA[k + 1];
      if (i <= b[0]) return a[1] + (b[1] - a[1]) * (i - a[0]) / (b[0] - a[0]);
    }
    return ETA[ETA.length - 1][1];
  }
  function grid(N, A, B) {
    var best = null;
    for (var ny = 1; ny <= N; ny++) {
      var nx = Math.ceil(N / ny), score = (nx * ny - N) * 2 + Math.abs(Math.log((A / nx) / (B / ny))) * 3;
      if (!best || score < best.s) best = { nx: nx, ny: ny, s: score };
    }
    return best;
  }
  var lastLight = null, rooms = [];
  function svgEl(name, attrs, text) {
    var e = document.createElementNS('http://www.w3.org/2000/svg', name);
    Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (text) e.textContent = text;
    return e;
  }
  function drawPlan(A, B, nx, ny) {
    var svg = $('l-svg');
    svg.textContent = '';
    var sc = Math.min(500 / A, 400 / B), w = A * sc, h = B * sc, ox = 50, oy = 30;
    svg.appendChild(svgEl('rect', { x: ox, y: oy, width: w, height: h, fill: '#fff', stroke: '#1d1f23', 'stroke-width': 3 }));
    var sx = A / nx, sy = B / ny;
    for (var gx = 1; gx < nx; gx++) svg.appendChild(svgEl('line', { x1: ox + gx * sx * sc, y1: oy, x2: ox + gx * sx * sc, y2: oy + h, stroke: '#e4e5e8' }));
    for (var gy = 1; gy < ny; gy++) svg.appendChild(svgEl('line', { x1: ox, y1: oy + gy * sy * sc, x2: ox + w, y2: oy + gy * sy * sc, stroke: '#e4e5e8' }));
    var r = Math.max(6, Math.min(20, Math.min(sx, sy) * sc * 0.28));
    for (var j = 0; j < ny; j++) for (var i = 0; i < nx; i++) {
      var cx = ox + (i + 0.5) * sx * sc, cy = oy + (j + 0.5) * sy * sc;
      svg.appendChild(svgEl('circle', { cx: cx, cy: cy, r: r, fill: '#fff', stroke: '#e3000f', 'stroke-width': 2.5 }));
      svg.appendChild(svgEl('circle', { cx: cx, cy: cy, r: Math.max(2.5, r / 4), fill: '#e3000f' }));
    }
    var f = 'IBM Plex Mono, monospace';
    svg.appendChild(svgEl('text', { x: ox + w / 2, y: oy + h + 24, 'text-anchor': 'middle', 'font-size': 14, 'font-family': f, fill: '#1d1f23' }, fmt(A, 1) + ' м'));
    svg.appendChild(svgEl('text', { x: ox - 14, y: oy + h / 2, 'text-anchor': 'middle', 'font-size': 14, 'font-family': f, fill: '#1d1f23', transform: 'rotate(-90 ' + (ox - 14) + ' ' + (oy + h / 2) + ')' }, fmt(B, 1) + ' м'));
    svg.appendChild(svgEl('text', { x: ox + sx * sc / 2, y: oy + h + 44, 'text-anchor': 'middle', 'font-size': 12, 'font-family': f, fill: '#4a4d55' }, 'шаг ' + fmt(sx, 2) + ' м'));
    svg.appendChild(svgEl('text', { x: ox + w + 8, y: oy + sy * sc / 2 + 4, 'font-size': 12, 'font-family': f, fill: '#4a4d55' }, fmt(sy, 2) + ' м'));
  }
  function calcLight() {
    var ids = ['l-r-e', 'l-r-i', 'l-r-eta', 'l-r-f', 'l-r-n', 'l-r-got', 'l-r-w'];
    var E = num('l-e'), A = num('l-a'), B = num('l-b'), H = num('l-h'), hp = num('l-hp'), Kz = num('l-kz'), Z = num('l-z');
    var fx = $('l-fix').value.split(':'), w = parseFloat(fx[0]), lm = parseFloat(fx[1]), rf = parseFloat($('l-ref').value);
    lastLight = null;
    if (!allPos([E, A, B, H, Kz, Z, w, lm]) || !isFinite(hp) || hp < 0 || H - hp < 0.5) { $('l-svg').textContent = ''; return clear(ids, 'l-verdict', 'Проверьте размеры: высота подвеса над плоскостью должна быть не меньше 0,5 м.'); }
    var h = H - hp, S = A * B, idx = S / (h * (A + B)), eta = etaOf(idx) * rf;
    var F = E * S * Kz * Z / eta, N = Math.max(1, Math.ceil(F / lm - 1e-9)), g = grid(N, A, B);
    var guard = 0;
    while (Math.max(A / g.nx, B / g.ny) > 1.5 * h && guard++ < 200) { N++; g = grid(N, A, B); }
    N = g.nx * g.ny;
    var got = N * lm * eta / (S * Kz * Z), W = N * w;
    set('l-r-e', fmt(E, 0) + ' лк');
    set('l-r-i', fmt(idx, 2));
    set('l-r-eta', fmt(eta, 2));
    set('l-r-f', fmt(F, 0) + ' лм');
    set('l-r-n', N + ' шт');
    set('l-r-got', fmt(got, 0) + ' лк');
    set('l-r-w', fmt(W, 0) + ' Вт · ' + fmt(W / S, 1) + ' Вт/м²');
    drawPlan(A, B, g.nx, g.ny);
    $('l-plan-note').textContent = g.nx + ' × ' + g.ny + ' светильников. До стены от светильника половина шага. Шаг не больше 1,5 высоты подвеса (' + fmt(1.5 * h, 1) + ' м), чтобы не было тёмных пятен.';
    verdict('l-verdict', got >= E ? 'Норма выполнена с запасом ' + fmt((got / E - 1) * 100, 0) + ' %. Мощность можно передать в калькулятор «Кабель и автомат».' : 'Норма не достигнута, добавьте светильников.', got < E);
    lastLight = { name: $('l-room').options[$('l-room').selectedIndex].text, S: S, E: E, N: N, got: got, W: W };
  }
  function renderRooms() {
    var tb = $('l-rooms');
    tb.textContent = '';
    var sS = 0, sN = 0, sW = 0;
    rooms.forEach(function (r, idx) {
      sS += r.S; sN += r.N; sW += r.W;
      var tr = document.createElement('tr');
      [r.name, fmt(r.S, 1), fmt(r.E, 0), String(r.N), fmt(r.got, 0), fmt(r.W, 0)].forEach(function (c, n) {
        var td = document.createElement('td');
        if (n) td.className = 'm';
        td.textContent = c;
        tr.appendChild(td);
      });
      var td = document.createElement('td'), b = document.createElement('button');
      b.type = 'button'; b.className = 'e-link'; b.textContent = 'Убрать'; b.setAttribute('data-del', idx);
      td.appendChild(b); tr.appendChild(td); tb.appendChild(tr);
    });
    if (rooms.length) {
      var tr2 = document.createElement('tr');
      tr2.className = 'tot';
      ['Итого', fmt(sS, 1), '', String(sN), '', fmt(sW, 0), ''].forEach(function (c, n) {
        var td = document.createElement('td');
        if (n) td.className = 'm';
        td.textContent = c;
        tr2.appendChild(td);
      });
      tb.appendChild(tr2);
    }
    try { localStorage.setItem('tega-light-rooms', JSON.stringify(rooms)); } catch (e) { /* без хранилища работаем в памяти */ }
  }

  /* вкладки */
  var panels = [];
  function show(id) {
    if (panels.indexOf(id) < 0) id = 'cable';
    var root = $('e-elec');
    Array.prototype.forEach.call(root.querySelectorAll('.e-panel'), function (p) { p.classList.toggle('on', p.id === id); });
    Array.prototype.forEach.call(document.querySelectorAll('.e-sub a'), function (a) {
      var on = a.getAttribute('data-sub') === id;
      a.classList.toggle('on', on);
      if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
    });
  }
  function fromHash() { show((location.hash || '').replace('#', '')); }

  function setPower(kw, kind) {
    var r = document.querySelector('input[name="c-mode"][value="p"]');
    if (r) r.checked = true;
    toggleMode();
    $('c-p').value = fmt(kw, 2); $('c-cos').value = '1,0'; $('c-kind').value = kind; $('c-lim').value = String(KINDS[kind].lim);
  }

  function init() {
    var root = $('e-elec');
    if (!root) return;
    Array.prototype.forEach.call(root.querySelectorAll('.e-panel'), function (p) { panels.push(p.id); });
    root.classList.add('js');
    fromHash();
    window.addEventListener('hashchange', fromHash);
    Array.prototype.forEach.call(document.querySelectorAll('.e-sub a'), function (a) {
      a.addEventListener('click', function (ev) { ev.preventDefault(); var id = a.getAttribute('data-sub'); try { history.replaceState(null, '', '#' + id); } catch (e) { location.hash = id; } show(id); });
    });
    function bind(prefix, fn) {
      Array.prototype.forEach.call(root.querySelectorAll('[id^="' + prefix + '-"] , input[name^="' + prefix + '-"]'), function (el) {
        if (el.tagName === 'INPUT' || el.tagName === 'SELECT') { el.addEventListener('input', fn); el.addEventListener('change', fn); }
      });
    }
    bind('c', calcCable); bind('k', calcKz); bind('g', calcGround); bind('l', calcLight);
    Array.prototype.forEach.call(document.querySelectorAll('input[name="c-ph"]'), function (r) {
      r.addEventListener('change', function () { $('c-u').value = r.value === '1' ? '230' : '400'; calcCable(); });
    });
    Array.prototype.forEach.call(document.querySelectorAll('input[name="c-mode"]'), function (r) {
      r.addEventListener('change', function () { toggleMode(); calcCable(); });
    });
    $('c-kind').addEventListener('change', function () { $('c-lim').value = String(KINDS[$('c-kind').value].lim); calcCable(); });
    $('l-room').addEventListener('change', function () { $('l-e').value = $('l-room').value; calcLight(); });
    $('l-add').addEventListener('click', function () { if (lastLight) { rooms.push(lastLight); renderRooms(); } });
    $('l-clear').addEventListener('click', function () { rooms = []; renderRooms(); });
    $('l-rooms').addEventListener('click', function (ev) {
      var i = ev.target.getAttribute && ev.target.getAttribute('data-del');
      if (i !== null && i !== undefined) { rooms.splice(parseInt(i, 10), 1); renderRooms(); }
    });
    $('l-tocable').addEventListener('click', function () {
      var W = rooms.length ? rooms.reduce(function (s, r) { return s + r.W; }, 0) : (lastLight ? lastLight.W : 0);
      if (!W) return;
      setPower(W / 1000, 'light');
      calcCable(); show('cable'); try { history.replaceState(null, '', '#cable'); } catch (e) { /* ничего */ }
    });
    Array.prototype.forEach.call(root.querySelectorAll('[data-kw]'), function (b) {
      b.addEventListener('click', function () {
        setPower(parseFloat(b.getAttribute('data-kw')), 'sock');
        calcCable(); show('cable'); try { history.replaceState(null, '', '#cable'); } catch (e) { /* ничего */ }
      });
    });
    try { rooms = JSON.parse(localStorage.getItem('tega-light-rooms') || '[]') || []; } catch (e) { rooms = []; }
    if (!Array.isArray(rooms)) rooms = [];
    renderRooms();
    toggleMode(); calcCable(); calcKz(); calcGround(); calcLight();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
