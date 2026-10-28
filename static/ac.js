/* Кондиционирование: интерфейс калькуляторов. Модель теплопритоков — в ac-model.js.
   Ориентировочный расчёт для выбора мощности и разговора с проектировщиком, не проект. */
(function () {
  'use strict';
  var M = window.TegaAC;
  if (!M) return;
  var NS = 'http://www.w3.org/2000/svg';
  var INK = '#1d1f23', RED = '#e3000f', MUT = '#4a4d55', G1 = '#7d8089', G3 = '#c6c8cd', GRID = '#e4e5e8';
  function $(id) { return document.getElementById(id); }
  function num(id) {
    var el = $(id); if (!el) return NaN;
    var n = parseFloat(String(el.value).replace(/\s/g, '').replace(',', '.').replace(/−/g, '-'));
    return isFinite(n) ? n : NaN;
  }
  function val(id) { var el = $(id); return el ? el.value : ''; }
  function fmt(x, d) {
    if (!isFinite(x)) return '—';
    var s = Math.abs(x).toFixed(d), p = s.split('.');
    p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return (x < 0 ? '−' : '') + p.join(',');
  }
  function set(id, v) { var el = $(id); if (el) el.textContent = v; }
  function verdict(id, t, bad) { var el = $(id); if (!el) return; el.textContent = t; el.className = 'verdict' + (bad ? ' bad' : ''); }
  function svg(name, attrs, text) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }
  function T(p, x, y, s, size, fill, anchor, weight) {
    p.appendChild(svg('text', { x: x, y: y, 'font-size': size || 12, fill: fill || INK, 'text-anchor': anchor || 'start', 'font-weight': weight || '400' }, s));
  }
  function clearNode(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function tdText(tr, tag, s) { var c = document.createElement(tag); c.textContent = s; tr.appendChild(c); }

  var last = null;
  var BTU = { 2.0: '7 000', 2.5: '9 000', 3.5: '12 000', 5.0: '18 000', 7.0: '24 000', 9.0: '30 000', 12.0: '42 000', 14.0: '48 000', 16.0: '55 000' };

  var PRESETS = {
    sleep: { area: 14, h: 2.7, roof: 'none', prof: 'sleep', ppl: 2, eq: 50, lt: 30, az1: -90, g1: 2, w1: 7, az2: 180, g2: 0, w2: 0, glass: 'd2', shade: 'blind', wall: 'new', tmax: 30 },
    south: { area: 25, h: 2.7, roof: 'none', prof: 'day', ppl: 3, eq: 300, lt: 150, az1: 0, g1: 8, w1: 6, az2: 180, g2: 0, w2: 0, glass: 'd2', shade: 'none', wall: 'new', tmax: 30 },
    attic: { area: 22, h: 2.5, roof: 'mans', prof: 'eve', ppl: 2, eq: 250, lt: 100, az1: 90, g1: 4, w1: 5, az2: 180, g2: 0, w2: 0, glass: 'd2', shade: 'none', wall: 'frame', tmax: 30 },
    office: { area: 30, h: 2.8, roof: 'none', prof: 'office', ppl: 4, eq: 600, lt: 300, az1: 90, g1: 6, w1: 8, az2: 180, g2: 0, w2: 0, glass: 'd2', shade: 'blind', wall: 'new', tmax: 30 },
    server: { area: 12, h: 2.7, roof: 'none', prof: 'all', ppl: 0, eq: 2500, lt: 100, az1: 180, g1: 0, w1: 6, az2: 180, g2: 0, w2: 0, glass: 'd2', shade: 'none', wall: 'new', tmax: 30 }
  };

  function cfgFromForm() {
    var c = {
      area: num('ac-area'), height: num('ac-h'), roof: val('ac-roof'), profile: val('ac-prof'),
      people: num('ac-ppl'), equip: num('ac-eq'), light: num('ac-lt'),
      f1: { az: parseFloat(val('ac-f1-az')), glass: num('ac-f1-g'), wall: num('ac-f1-w') },
      f2: { az: parseFloat(val('ac-f2-az')), glass: num('ac-f2-g'), wall: num('ac-f2-w') },
      glassType: val('ac-glass'), shade: val('ac-shade'), wallType: val('ac-wall'),
      tin: num('ac-ti'), tmax: num('ac-tmax'), swing: num('ac-sw'), infil: num('ac-inf'), fresh: num('ac-fresh'), reserve: num('ac-rsv')
    };
    return c;
  }
  function valid(c) {
    var ok = c.area > 0 && c.height > 0 && c.people >= 0 && c.equip >= 0 && c.light >= 0 && c.f1.glass >= 0 && c.f1.wall >= 0 &&
      c.f2.glass >= 0 && c.f2.wall >= 0 && isFinite(c.tin) && isFinite(c.tmax) && c.swing >= 0 && c.infil >= 0 && c.fresh >= 0 && c.reserve >= 0;
    return ok && (c.f1.glass + c.f2.glass + c.f1.wall + c.f2.wall > 0 || c.roof !== 'none');
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function calc() {
    var ids = ['ac-peak', 'ac-hour', 'ac-sens', 'ac-req', 'ac-nom', 'ac-rule'];
    var c = cfgFromForm();
    if (!valid(c)) {
      last = null; ids.forEach(function (i) { set(i, '—'); });
      verdict('ac-verdict', 'Введите площадь, высоту и хотя бы окно или наружную стену (или кровлю над помещением).', true);
      ['ac-ch', 'ac-parts'].forEach(function (i) { var n = $(i); if (n) clearNode(n); });
      set('ac-chn', ''); other();
      return;
    }
    var r = M.calc(c);
    last = { cfg: c, r: r };
    set('ac-peak', fmt(r.peakW / 1000, 2) + ' кВт');
    set('ac-hour', String(r.peakHour) + ':00 · на улице ' + fmt(r.tOutPeak, 0) + ' °С');
    set('ac-sens', fmt(r.shr * 100, 0) + ' % явное, ' + fmt((1 - r.shr) * 100, 0) + ' % влага');
    set('ac-req', fmt(r.reqW / 1000, 2) + ' кВт (запас ' + fmt(c.reserve, 0) + ' %)');
    set('ac-nom', r.nominal ? fmt(r.nominal, 1) + ' кВт (' + BTU[r.nominal] + ' BTU)' : 'больше 16 кВт');
    set('ac-rule', fmt(r.byArea / 1000, 1) + ' кВт, ' + (r.byArea > r.reqW ? 'больше' : 'меньше') + ' на ' + fmt(Math.abs(r.byArea - r.reqW) / r.reqW * 100, 0) + ' %');

    var parts = r.parts, sunShare = r.peak.total > 0 ? parts['Солнце через окна'] / r.peak.total : 0;
    var msg = 'В самый тяжёлый час (' + r.peakHour + ':00) помещению нужно отвести ' + fmt(r.peakW, 0) + ' Вт. ';
    var bad = false;
    if (!r.nominal) { msg += 'Для одной комнаты такой мощности сплитом не обойтись: смотрите канальный или мульти-сплит и разделите нагрузки. '; bad = true; }
    else {
      msg += 'Берите блок номиналом ' + fmt(r.nominal, 1) + ' кВт. ';
      if (r.nominal * 1000 / r.reqW > 1.7) msg += 'Это заметно больше расчёта: инвертор справится, но в мягкую погоду будет часто включаться и выключаться, возьмите более низкую мощность, если запас по модели нормальный. ';
    }
    if (sunShare > 0.45) {
      var c2 = clone(c); c2.shade = 'out';
      var r2 = M.calc(c2);
      if (c.shade !== 'out' && r2.peakW < r.peakW * 0.85) msg += 'Солнце через окна даёт ' + fmt(sunShare * 100, 0) + ' % нагрузки; наружная защита (ставни, маркиза) снизила бы пик до ' + fmt(r2.peakW, 0) + ' Вт. ';
      else msg += 'Солнце через окна даёт ' + fmt(sunShare * 100, 0) + ' % нагрузки. ';
    }
    msg += 'Модель ясного дня без запаздывания внутренней нагрузки, поэтому результат с небольшим запасом.';
    verdict('ac-verdict', msg, bad);
    drawHours(); drawParts(); other();
  }

  /* ───────── график по часам ───────── */
  function drawHours() {
    var host = $('ac-ch'); if (!host || !last) return;
    clearNode(host);
    var rows = last.r.rows, W = 760, H = 330, x0 = 54, y0 = 30, w = W - x0 - 20, h = H - y0 - 70, i, mx = 0;
    var seg = rows.map(function (r) {
      var sun = Math.max(0, r.sun);
      var inner = Math.max(0, r.people + r.pLat + r.equip);
      var rest = Math.max(0, r.total - sun - inner);
      return { sun: sun, inner: inner, rest: rest, tot: sun + inner + rest };
    });
    seg.forEach(function (s) { mx = Math.max(mx, s.tot); });
    if (last.r.nominal) mx = Math.max(mx, last.r.nominal * 1000 * 0.95);
    var step = mx > 6000 ? 1000 : mx > 3000 ? 500 : mx > 1500 ? 250 : mx > 700 ? 100 : 50;
    var ymax = Math.ceil(mx * 1.1 / step) * step;
    var el = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Холодильная нагрузка по часам' });
    var ticks = Math.round(ymax / step);
    for (i = 0; i <= ticks; i++) {
      var y = y0 + h - h * i / ticks;
      el.appendChild(svg('line', { x1: x0, y1: y, x2: x0 + w, y2: y, stroke: GRID }));
      T(el, x0 - 6, y + 4, fmt(ymax * i / ticks, 0), 11, MUT, 'end');
    }
    T(el, x0 - 36, y0 - 14, 'Вт', 11, MUT);
    var bw = w / 24;
    for (i = 0; i < 24; i++) {
      var s = seg[i], bx = x0 + i * bw, yy = y0 + h;
      [[s.rest, G3], [s.inner, G1], [s.sun, RED]].forEach(function (p) {
        var hh = h * p[0] / ymax;
        if (hh > 0) { yy -= hh; el.appendChild(svg('rect', { x: bx + 1, y: yy, width: bw - 2, height: hh, fill: p[1] })); }
      });
      if (i % 3 === 0) T(el, bx + bw / 2, y0 + h + 16, String(i), 11, MUT, 'middle');
    }
    if (last.r.nominal) {
      var yn = y0 + h - h * last.r.nominal * 1000 / ymax;
      if (yn >= y0 - 2) {
        el.appendChild(svg('line', { x1: x0, y1: yn, x2: x0 + w, y2: yn, stroke: INK, 'stroke-width': 2, 'stroke-dasharray': '7 5' }));
        T(el, x0 + w - 2, yn - 6, 'блок ' + fmt(last.r.nominal, 1) + ' кВт', 12, INK, 'end', '700');
      }
    }
    var ly = H - 16;
    [[RED, 'солнце через окна'], [G1, 'люди, техника, свет'], [G3, 'стены, воздух, влага']].forEach(function (p, k) {
      var lx = x0 + k * 190;
      el.appendChild(svg('rect', { x: lx, y: ly - 10, width: 12, height: 12, fill: p[0] })); T(el, lx + 18, ly, p[1], 12, INK);
    });
    T(el, x0 + w, ly, 'час суток', 11, MUT, 'end');
    host.appendChild(el);
    set('ac-chn', 'Холодильная нагрузка по часам в жаркий день: пик в ' + last.r.peakHour + ':00. Штриховая линия показывает выбранный блок: пока она выше столбцов, мощности хватает.');
  }

  function drawParts() {
    var t = $('ac-parts'); if (!t || !last) return;
    clearNode(t);
    var parts = last.r.parts, sum = 0, k;
    for (k in parts) if (parts[k] > 0) sum += parts[k];
    Object.keys(parts).sort(function (a, b) { return parts[b] - parts[a]; }).forEach(function (name) {
      var v = parts[name]; if (Math.abs(v) < 1) return;
      var d = document.createElement('div'); d.className = 'kv';
      var sp = document.createElement('span'); sp.textContent = 'В час пика: ' + name.toLowerCase();
      var bb = document.createElement('b'); bb.textContent = fmt(v, 0) + ' Вт' + (v > 0 && sum > 0 ? ' (' + fmt(v / sum * 100, 0) + ' %)' : '');
      d.appendChild(sp); d.appendChild(bb); t.appendChild(d);
    });
  }

  /* ───────── электричество, зима ───────── */
  function energy() {
    var ids = ['ac-e-cool', 'ac-e-cost', 'ac-e-vs5', 'ac-e-vs9', 'ac-h-cost', 'ac-h-save', 'ac-h-cov'];
    var q = num('ac-q'); if (!(q > 0) && last) q = last.r.peakW / 1000;
    var seer = num('ac-seer'), eflh = num('ac-eflh'), tar = parseFloat(val('ac-tar')) || num('ac-tar2');
    var scop = num('ac-scop'), loss = num('ac-loss'), tmin = num('ac-tmin'), cap = num('ac-cap'), tw = num('ac-tw');
    if (!(q > 0 && seer > 0 && eflh > 0 && tar > 0)) { ids.forEach(function (i) { set(i, '—'); }); verdict('ac-e-verdict', 'Нужны нагрузка, SEER, часы и тариф. Нагрузку можно взять из первого расчёта.', true); return; }
    var kwh = q * eflh / seer, cost = kwh * tar;
    set('ac-e-cool', fmt(kwh, 0) + ' кВт·ч за сезон');
    set('ac-e-cost', fmt(cost, 1) + ' BYN за сезон');
    var k5 = q * eflh / 5 * tar, k9 = q * eflh / 8.5 * tar;
    set('ac-e-vs5', (k5 > cost ? 'дешевле на ' : 'дороже на ') + fmt(Math.abs(k5 - cost), 1) + ' BYN (on/off, SEER 5)');
    set('ac-e-vs9', (k9 < cost ? 'дороже на ' : 'дешевле на ') + fmt(Math.abs(cost - k9), 1) + ' BYN (SEER 8,5)');
    var msg = 'Летом блок потребит около ' + fmt(kwh, 0) + ' кВт·ч за ' + fmt(eflh, 0) + ' эквивалентных часов полной нагрузки. Часы вы задаёте сами: для комнаты в Минске ориентир 150–350, это допущение, а не норма.';
    if (scop > 0 && loss > 0) {
      var one = tar / scop;
      set('ac-h-cost', fmt(one, 3) + ' BYN за 1 кВт·ч тепла (прямой электрообогрев: ' + fmt(tar, 3) + ')');
      set('ac-h-save', fmt((tar - one) * 1000, 0) + ' BYN на каждые 1 000 кВт·ч тепла');
      var cov;
      if (isFinite(tw) && isFinite(tmin) && tw < tmin) cov = 'расчётная температура ' + fmt(tw, 0) + ' °С ниже предела работы (' + fmt(tmin, 0) + ' °С): нужен основной источник тепла';
      else if (cap > 0) cov = cap * 1000 >= loss ? 'мощности хватает: ' + fmt(cap, 1) + ' кВт против потерь ' + fmt(loss / 1000, 1) + ' кВт' : 'не хватает: ' + fmt(cap, 1) + ' кВт против потерь ' + fmt(loss / 1000, 1) + ' кВт, нужен дополнительный источник';
      else cov = 'введите теплоотдачу по паспорту при расчётной температуре';
      set('ac-h-cov', cov);
    } else { ['ac-h-cost', 'ac-h-save', 'ac-h-cov'].forEach(function (i) { set(i, '—'); }); }
    verdict('ac-e-verdict', msg, false);
  }

  /* ───────── трасса, ток, конденсат ───────── */
  function trace() {
    var ids = ['ac-t-add', 'ac-t-chk', 'ac-t-br', 'ac-t-cond'];
    var l = num('ac-l'), l0 = num('ac-l0'), gm = num('ac-gm'), lmax = num('ac-lmax'), dh = num('ac-dh'), dhmax = num('ac-dhmax'), cur = num('ac-cur');
    if (!(l > 0 && l0 >= 0 && gm >= 0 && cur > 0)) { ids.forEach(function (i) { set(i, '—'); }); verdict('ac-t-verdict', 'Введите длину трассы, заводскую длину, дозаправку по паспорту и ток.', true); return; }
    var add = Math.max(0, l - l0) * gm;
    set('ac-t-add', fmt(add, 0) + ' г хладагента (' + fmt(Math.max(0, l - l0), 1) + ' м × ' + fmt(gm, 0) + ' г/м)');
    var bad = [];
    if (lmax > 0 && l > lmax) bad.push('трасса длиннее допустимой по паспорту');
    if (dhmax > 0 && dh > dhmax) bad.push('перепад высот больше допустимого');
    set('ac-t-chk', bad.length ? bad.join('; ') : 'в пределах паспорта');
    var need = cur * 1.25, br = [10, 16, 20, 25, 32, 40].filter(function (x) { return x >= need; })[0];
    set('ac-t-br', br ? 'автомат C' + br + ' А (ток ' + fmt(cur, 1) + ' А × 1,25)' : 'более 40 А: нужен проект');
    var cond = last ? last.r.latent * 3600 / 2.45e6 : NaN;
    set('ac-t-cond', isFinite(cond) ? fmt(cond, 2) + ' л/ч в час пика' : 'сначала сделайте расчёт мощности');
    verdict('ac-t-verdict', bad.length ? 'Проверьте паспорт: ' + bad.join('; ') + '. Сверх нормы нужна дозаправка и согласование с производителем.' :
      'Дозаправка считается по длине сверх заводской и граммам на метр из паспорта; автомат и сечение кабеля уточните по паспорту и в калькуляторе электрики.', bad.length > 0);
  }

  /* ───────── шум ───────── */
  function noise() {
    var ids = ['ac-n-out', 'ac-n-lim', 'ac-n-win', 'ac-n-in', 'ac-n-inlim'];
    var lo = num('ac-lo'), d = num('ac-d'), pos = num('ac-pos'), li = num('ac-li'), di = num('ac-di');
    if (!(lo > 0 && d > 0 && li > 0 && di > 0)) { ids.forEach(function (i) { set(i, '—'); }); verdict('ac-n-verdict', 'Введите уровни звука из паспорта и расстояния.', true); return; }
    var out = lo - 20 * Math.log10(Math.max(d, 1)) + (isFinite(pos) ? pos : 0);
    var inn = li - 20 * Math.log10(Math.max(di, 1));
    set('ac-n-out', fmt(out, 0) + ' дБА у окна на расстоянии ' + fmt(d, 0) + ' м');
    set('ac-n-lim', 'днём 50, ночью 40 дБА (55 и 45 минус 5)');
    set('ac-n-win', 'за окном приоткрытым ≈ ' + fmt(out - 10, 0) + ' дБА (допущение: потеря 10 дБ)');
    set('ac-n-in', fmt(inn, 0) + ' дБА в комнате на расстоянии ' + fmt(di, 0) + ' м');
    set('ac-n-inlim', 'днём 35, ночью 25 дБА (40 и 30 минус 5)');
    var msgs = [], bad = false;
    if (out > 40) { msgs.push(out > 50 ? 'у дома шум выше нормы даже днём' : 'ночью у дома шум выше нормы 40 дБА'); bad = out > 50; }
    else msgs.push('у дома ночью укладывается в 40 дБА');
    if (inn > 25) msgs.push(inn > 35 ? 'в комнате выше нормы даже днём' : 'в комнате ночью выше 25 дБА'); else msgs.push('в комнате ночью не выше 25 дБА');
    verdict('ac-n-verdict', msgs.join('; ') + '. Расчёт по свободному полю: −6 дБ на каждое удвоение расстояния; у стены +3, в углу +6. Паспортные значения измерены в идеальных условиях.', bad);
  }

  function other() { energy(); trace(); noise(); }

  /* ───────── готовые примеры и вкладки ───────── */
  function applyPreset(k) {
    var p = PRESETS[k]; if (!p) return;
    var m = { 'ac-area': p.area, 'ac-h': p.h, 'ac-roof': p.roof, 'ac-prof': p.prof, 'ac-ppl': p.ppl, 'ac-eq': p.eq, 'ac-lt': p.lt, 'ac-f1-az': p.az1, 'ac-f1-g': p.g1, 'ac-f1-w': p.w1,
      'ac-f2-az': p.az2, 'ac-f2-g': p.g2, 'ac-f2-w': p.w2, 'ac-glass': p.glass, 'ac-shade': p.shade, 'ac-wall': p.wall, 'ac-tmax': p.tmax };
    for (var id in m) { var el = $(id); if (el) el.value = String(m[id]).replace('.', ','); }
    calc();
  }

  function init() {
    var root = $('e-ac'); if (!root) return;
    var panels = [];
    Array.prototype.forEach.call(root.querySelectorAll('.e-panel'), function (p) { panels.push(p.id); });
    root.classList.add('js');
    function show(id) {
      if (panels.indexOf(id) < 0) id = panels[0];
      Array.prototype.forEach.call(root.querySelectorAll('.e-panel'), function (p) { p.classList.toggle('on', p.id === id); });
      Array.prototype.forEach.call(document.querySelectorAll('.e-sub a'), function (a) {
        var on = a.getAttribute('data-sub') === id; a.classList.toggle('on', on);
        if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      });
    }
    function fromHash() { show((location.hash || '').replace('#', '')); }
    fromHash(); window.addEventListener('hashchange', fromHash);
    Array.prototype.forEach.call(document.querySelectorAll('.e-sub a'), function (a) {
      a.addEventListener('click', function (ev) {
        ev.preventDefault(); var id = a.getAttribute('data-sub');
        try { history.replaceState(null, '', '#' + id); } catch (e) { location.hash = id; }
        show(id);
      });
    });
    Array.prototype.forEach.call(root.querySelectorAll('input, select'), function (el) {
      if (!el.id && el.type !== 'radio') return;
      if (el.id === 'ac-preset') { el.addEventListener('change', function () { applyPreset(el.value); }); return; }
      var h = /^ac-(q|seer|eflh|tar|tar2|scop|loss|tmin|cap|tw)$/.test(el.id) ? energy : /^ac-(l|l0|gm|lmax|dh|dhmax|cur)$/.test(el.id) ? trace : /^ac-(lo|d|pos|li|di)$/.test(el.id) ? noise : calc;
      el.addEventListener('input', h); el.addEventListener('change', h);
    });
    calc();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
