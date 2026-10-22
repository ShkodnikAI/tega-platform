/* Электрические калькуляторы раздела «Расчёт смет». Ориентировочные расчёты, не заменяют проект. */
(function () {
  'use strict';
  var SQ3 = 1.732;
  var RHO = { cu: 0.0175, al: 0.028 };                 // Ом·мм²/м
  // допустимые токи, А: IEC 60364-5-52, способ C (на стене), изоляция ПВХ; 2 и 3 нагруженные жилы. Ориентир.
  var IZ = {
    cu: { 2: { 1.5: 19.5, 2.5: 27, 4: 36, 6: 46, 10: 63, 16: 85, 25: 112 }, 3: { 1.5: 17.5, 2.5: 24, 4: 32, 6: 41, 10: 57, 16: 76, 25: 96 } },
    al: { 2: { 2.5: 20.5, 4: 28, 6: 36, 10: 49, 16: 66, 25: 83 }, 3: { 2.5: 18.5, 4: 25, 6: 32, 10: 44, 16: 59, 25: 73 } }
  };
  var BR = [6, 10, 16, 20, 25, 32, 40, 50, 63];
  var PIPE = 0.85;

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
  function dropPct(ph, I, L, rho, S, cos, U) {
    var dv = ph === 1 ? 2 * I * L * rho / S : SQ3 * I * L * rho * cos / S;
    return dv / U * 100;
  }
  function sizes(mat, ph) {
    return Object.keys(IZ[mat][ph === 1 ? 2 : 3]).map(parseFloat).sort(function (a, b) { return a - b; });
  }
  function izOf(mat, ph, S, pipe) { return IZ[mat][ph === 1 ? 2 : 3][S] * (pipe ? PIPE : 1); }
  function sizeLbl(S) { return fmt(S, S % 1 ? 1 : 0); }

  /* 01 кабель и автомат */
  function calcCable() {
    var ids = ['c-r-i', 'c-r-in', 'c-r-s', 'c-r-iz', 'c-r-du'];
    var ph = parseInt(radio('c-ph'), 10), mat = radio('c-mat'), pipe = radio('c-lay') === 'pipe';
    var P = num('c-p') * 1000, U = num('c-u'), cos = num('c-cos'), L = num('c-l'), k = num('c-k'), lim = num('c-lim');
    if (!allPos([P, U, cos, L, k, lim]) || cos > 1) return clear(ids, 'c-verdict');
    var I = (ph === 1 ? P / (U * cos) : P / (SQ3 * U * cos)) * k;
    set('c-r-i', fmt(I, 1) + ' А');
    var In = null;
    for (var i = 0; i < BR.length; i++) { if (BR[i] >= I) { In = BR[i]; break; } }
    if (!In) { ids.slice(1).forEach(function (x) { set(x, '—'); }); return verdict('c-verdict', 'Ток больше 63 А: такую линию рассчитывает проектировщик.', true); }
    set('c-r-in', In + ' А');
    var minS = radio('c-mat') === 'al' ? 2.5 : (($('c-kind').value === 'sock') ? 2.5 : 1.5);
    var rho = RHO[mat], list = sizes(mat, ph), pick = null, byDrop = null;
    for (var j = 0; j < list.length; j++) {
      var S = list[j];
      if (S < minS) continue;
      var dp = dropPct(ph, I, L, rho, S, cos, U);
      if (izOf(mat, ph, S, pipe) >= In) {
        if (dp <= lim) { pick = { S: S, dp: dp }; break; }
        if (!byDrop) byDrop = { S: S, dp: dp };
      }
    }
    if (!pick) {
      set('c-r-s', '—'); set('c-r-iz', '—'); set('c-r-du', byDrop ? fmt(byDrop.dp, 1) + ' %' : '—');
      return verdict('c-verdict', 'Даже сечение 25 мм² не проходит по току или по потере: линию должен считать проектировщик.', true);
    }
    var iz = izOf(mat, ph, pick.S, pipe);
    set('c-r-s', (ph === 1 ? '3' : '5') + ' × ' + sizeLbl(pick.S) + ' мм²');
    set('c-r-iz', fmt(iz, 1) + ' А');
    set('c-r-du', fmt(pick.dp, 1) + ' % (' + fmt(pick.dp * U / 100, 1) + ' В)');
    var mark = (mat === 'al' ? 'АВВГнг(А)-LS' : 'ВВГнг(А)-LS');
    verdict('c-verdict', 'Условие выполнено: ' + fmt(I, 1) + ' А ≤ ' + In + ' А ≤ ' + fmt(iz, 1) + ' А, потеря в пределах ' + fmt(lim, 0) + ' %. Марка: ' + mark + '.' +
      (mat === 'al' ? ' Проверьте, допускает ли ваш случай алюминий: в жилых зданиях его применение ограничено.' : ''), false);
  }

  /* 02 потеря напряжения */
  function calcDrop() {
    var ids = ['d-r-i', 'd-r-min', 'd-r-rec', 'd-r-du'];
    var tb = $('d-rows');
    var ph = parseInt(radio('d-ph'), 10), mat = radio('d-mat');
    var P = num('d-p') * 1000, U = num('d-u'), cos = num('d-cos'), L = num('d-l'), lim = num('d-lim');
    tb.textContent = '';
    if (!allPos([P, U, cos, L, lim]) || cos > 1) return clear(ids, 'd-verdict');
    var I = ph === 1 ? P / (U * cos) : P / (SQ3 * U * cos);
    var In = null;
    for (var i = 0; i < BR.length; i++) { if (BR[i] >= I) { In = BR[i]; break; } }
    var rho = RHO[mat], rec = null;
    var factor = ph === 1 ? 2 * I * L * rho : SQ3 * I * L * rho * cos;
    var minS = factor / (lim / 100 * U);
    sizes(mat, ph).concat(mat === 'cu' ? [] : []).forEach(function (S) {
      var iz = izOf(mat, ph, S, false), dp = dropPct(ph, I, L, rho, S, cos, U);
      var curOk = In !== null && iz >= In, dropOk = dp <= lim, ok = curOk && dropOk;
      var text = ok ? 'подходит' : (!curOk ? 'не проходит по току' : 'не проходит по потере');
      if (ok && !rec) { rec = { S: S, dp: dp }; text = 'рекомендуем'; }
      var tr = document.createElement('tr');
      tr.className = ok ? 'ok' : 'bad';
      [sizeLbl(S), fmt(iz, 1), fmt(dp, 2), text].forEach(function (c, n) {
        var td = document.createElement('td');
        if (n < 3) td.className = 'm';
        td.textContent = c;
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    set('d-r-i', fmt(I, 1) + ' А');
    set('d-r-min', '≈ ' + fmt(minS, 1) + ' мм²');
    if (!In) return verdict('d-verdict', 'Ток больше 63 А: линию рассчитывает проектировщик.', true);
    if (!rec) { set('d-r-rec', '—'); set('d-r-du', '—'); return verdict('d-verdict', 'Ни одно сечение до 25 мм² не подходит: нужен проект.', true); }
    set('d-r-rec', sizeLbl(rec.S) + ' мм²');
    set('d-r-du', fmt(rec.dp, 2) + ' % (' + fmt(rec.dp * U / 100, 1) + ' В)');
    verdict('d-verdict', 'Сечение выбрано по длительному току и проверено по потере напряжения.', false);
  }

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
    bind('c', calcCable); bind('d', calcDrop); bind('k', calcKz); bind('g', calcGround); bind('l', calcLight);
    Array.prototype.forEach.call(document.querySelectorAll('input[name="c-ph"]'), function (r) {
      r.addEventListener('change', function () { $('c-u').value = r.value === '1' ? '230' : '400'; calcCable(); });
    });
    Array.prototype.forEach.call(document.querySelectorAll('input[name="d-ph"]'), function (r) {
      r.addEventListener('change', function () { $('d-u').value = r.value === '1' ? '230' : '400'; calcDrop(); });
    });
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
      $('c-p').value = fmt(W / 1000, 2); $('c-cos').value = '1,0'; $('c-kind').value = 'light';
      calcCable(); show('cable'); try { history.replaceState(null, '', '#cable'); } catch (e) { /* ничего */ }
    });
    Array.prototype.forEach.call(root.querySelectorAll('[data-kw]'), function (b) {
      b.addEventListener('click', function () {
        $('c-p').value = fmt(parseFloat(b.getAttribute('data-kw')), 2); $('c-cos').value = '1,0'; $('c-kind').value = 'sock';
        calcCable(); show('cable'); try { history.replaceState(null, '', '#cable'); } catch (e) { /* ничего */ }
      });
    });
    try { rooms = JSON.parse(localStorage.getItem('tega-light-rooms') || '[]') || []; } catch (e) { rooms = []; }
    if (!Array.isArray(rooms)) rooms = [];
    renderRooms();
    calcCable(); calcDrop(); calcKz(); calcGround(); calcLight();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
