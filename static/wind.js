/* Ветрогенераторы: интерфейс калькулятора. Модель расчёта в wind-model.js.
   Ориентировочный расчёт, не проект. */
(function () {
  'use strict';
  var M = window.TegaWind;
  if (!M) return;
  var NS = 'http://www.w3.org/2000/svg';
  var INK = '#1d1f23', RED = '#e3000f', MUT = '#4a4d55', G1 = '#7d8089', G3 = '#c6c8cd';
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
  function clearNode(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function svg(name, attrs, text) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }

  var last = null;
  var VERD = { solar: 'ниже 4,5 м/с: выгоднее солнечные панели, ветряк только как дополнение или на автономном объекте', hybrid: '4,5–6 м/с: гибрид ветра и солнца, доля ветра 30–50 %', wind: 'выше 6 м/с: ветер основа комплекса, солнце добирает летом' };
  var PRESETS = {
    flat: { type: 'hawt', v10: 3.8, alpha: 0.2, hub: 18, Pr: 3, consumption: 4000, mode: 'grid' },
    hill: { type: 'hawt', v10: 5, alpha: 0.2, hub: 24, Pr: 3, consumption: 4000, mode: 'grid' },
    off: { type: 'hawt', v10: 4.5, alpha: 0.2, hub: 18, Pr: 3, consumption: 3000, mode: 'off' }
  };

  function cfg() {
    return {
      type: val('wn-type'), v10: num('wn-v10'), h0: num('wn-h0'), alpha: num('wn-alpha'), hub: num('wn-hub'), k: num('wn-k'),
      Pr: num('wn-pr'), vr: num('wn-vr'), vci: num('wn-vci'), vco: num('wn-vco'), eff: num('wn-eff'),
      obstH: num('wn-oh'), obstDist: num('wn-od'), mount: val('wn-mount'), boundary: num('wn-bd'), windowDist: num('wn-wd'),
      mode: val('wn-mode'), dcV: num('wn-dcv'), dcLen: num('wn-dcl'), consumption: num('wn-cons'), autonomy: num('wn-aut'), peak: num('wn-peak'),
      self: num('wn-self'), tariff: num('wn-tar'), buyout: num('wn-buy'), cost: num('wn-cost')
    };
  }
  function valid(c) {
    return c.v10 >= 2 && c.v10 <= 9 && c.h0 >= 2 && c.h0 <= 100 && c.alpha > 0 && c.alpha <= 0.5 && c.hub >= 4 && c.hub <= 60 && c.k >= 1.2 && c.k <= 4 &&
      c.Pr >= 0.1 && c.Pr <= 50 && c.vr >= 6 && c.vr <= 20 && c.vci >= 1 && c.vci < c.vr && c.vco > c.vr && c.vco <= 40 && c.eff >= 50 && c.eff <= 100 &&
      c.obstH >= 0 && c.obstDist >= 0 && c.boundary >= 0 && c.windowDist >= 1 && c.dcV >= 12 && c.dcV <= 600 && c.dcLen >= 0 && c.consumption > 0 && c.autonomy >= 0 && c.peak >= 0 &&
      c.self >= 0 && c.self <= 100 && c.tariff >= 0 && c.buyout >= 0 && (isNaN(c.cost) || c.cost >= 0);
  }
  var IDS = ['wn-k1', 'wn-k2', 'wn-k3', 'wn-k4', 'wn-s1', 'wn-s2', 'wn-s3', 'wn-s4', 'wn-s5', 'wn-e1', 'wn-e2', 'wn-e3', 'wn-e4', 'wn-e5', 'wn-e6', 'wn-m1', 'wn-m2', 'wn-m3', 'wn-m4', 'wn-m5'];

  function lab(x, y, text, anchor, w, col, size) {
    var t = svg('text', { x: x, y: y, 'text-anchor': anchor || 'start', 'font-size': size || 12, 'font-weight': w || '400', fill: col || INK, 'font-family': 'inherit' }, text);
    return t;
  }
  /* кривая мощности и распределение Вейбулла */
  function drawCurve(c, r) {
    var host = $('wn-ch'); if (!host) return; clearNode(host);
    var W = 640, H = 270, ox = 52, oy = 16, w = 560, h = 210, vmax = Math.min(30, Math.ceil(c.vco + 1));
    var el = svg('svg', { viewBox: '0 0 ' + (W + 40) + ' ' + (H + 46), width: '100%', role: 'img', 'aria-label': 'Кривая мощности и повторяемость ветра' });
    var X = function (v) { return ox + v / vmax * w; }, Y = function (p) { return oy + h - p / c.Pr * h; };
    el.appendChild(svg('rect', { x: ox, y: oy, width: w, height: h, fill: '#f4f5f6', stroke: G3 }));
    for (var i = 0; i <= 4; i++) {
      var p = c.Pr * i / 4;
      el.appendChild(svg('line', { x1: ox, x2: ox + w, y1: Y(p), y2: Y(p), stroke: G3, 'stroke-dasharray': '3 4' }));
      el.appendChild(lab(ox - 6, Y(p) + 4, fmt(p, c.Pr < 5 ? 1 : 0), 'end', '400', MUT, 11));
    }
    for (var v = 0; v <= vmax; v += 5) el.appendChild(lab(X(v), oy + h + 16, String(v), 'middle', '400', MUT, 11));
    el.appendChild(lab(ox + w, oy + h + 48, 'скорость ветра, м/с', 'end', '400', MUT, 11));
    el.appendChild(lab(ox, oy - 4, 'кВт', 'end', '400', MUT, 11));
    /* Вейбулл: столбики повторяемости */
    var cs = r.scale, maxp = 0, bars = [];
    for (var b = 0; b < vmax; b++) { var pr = M.weibullPdf(b + 0.5, c.k, cs); bars.push(pr); if (pr > maxp) maxp = pr; }
    bars.forEach(function (pr, b) {
      var bh = pr / maxp * h * 0.55;
      el.appendChild(svg('rect', { x: X(b) + 1, y: oy + h - bh, width: w / vmax - 2, height: bh, fill: G3 }));
    });
    var pts = '';
    for (var s = 0; s <= vmax * 10; s++) { var vv = s / 10; pts += X(vv).toFixed(1) + ',' + Y(M.power(vv, { Pr: c.Pr, vr: c.vr, vci: c.vci, vco: c.vco })).toFixed(1) + ' '; }
    el.appendChild(svg('polyline', { points: pts, fill: 'none', stroke: INK, 'stroke-width': 3 }));
    el.appendChild(svg('line', { x1: X(r.vHub), x2: X(r.vHub), y1: oy, y2: oy + h, stroke: RED, 'stroke-width': 2, 'stroke-dasharray': '5 4' }));
    var lx = X(r.vHub) > ox + w * 0.6 ? X(r.vHub) - 6 : X(r.vHub) + 6;
    el.appendChild(lab(lx, oy + 14, 'средний ветер ' + fmt(r.vHub, 1) + ' м/с', X(r.vHub) > ox + w * 0.6 ? 'end' : 'start', '700', RED, 12));
    el.appendChild(lab(ox, oy + h + 32, 'линия: мощность ВЭУ, серые столбики: повторяемость ветра', 'start', '400', MUT, 11));
    host.appendChild(el);
    set('wn-chn', 'Линия мощности растёт по кубу скорости до номинала, столбики показывают, как часто в году дует ветер каждой силы. Площадь под линией, взвешенная столбиками, и есть годовая выработка.');
  }

  function calc() {
    var c = cfg();
    if (!valid(c)) {
      last = null; IDS.forEach(function (i) { set(i, '—'); });
      verdict('wn-verdict', 'Проверьте данные: ветер на 10 м 2–9 м/с, ступица 4–60 м, мощность 0,1–50 кВт, скорость старта меньше номинальной, останова больше, КПД 50–100 %.', true);
      ['wn-v1', 'wn-v2', 'wn-v3'].forEach(function (i) { verdict(i, '', false); });
      var n = $('wn-ch'); if (n) clearNode(n); set('wn-chn', '');
      if (window.TegaAI) window.TegaAI.update(null); return;
    }
    var r = M.calc(c), red = r.warns.filter(function (w) { return w.level === 'red'; }), yel = r.warns.filter(function (w) { return w.level === 'yellow'; });
    last = { c: c, r: r };
    set('wn-k1', fmt(r.vHub, 2) + ' м/с на высоте ступицы ' + fmt(c.hub, 0) + ' м (v₁₀ ' + fmt(c.v10, 1) + ' м/с, показатель α ' + fmt(c.alpha, 2) + ')');
    set('wn-k2', fmt(r.eNet, 0) + ' кВт·ч в год, около ' + fmt(r.kwhDay, 1) + ' кВт·ч в сутки; КИУМ ' + fmt(r.cf * 100, 1) + ' %');
    set('wn-k3', 'ротор D ≈ ' + fmt(r.D, 1) + ' м, площадь ' + fmt(r.A, 1) + ' м²; ' + fmt(r.perM2, 0) + ' кВт·ч с 1 м² ротора');
    set('wn-k4', 'равно по энергии солнечной станции около ' + fmt(r.pvKw, 1) + ' кВтп; без выработки ' + fmt(r.idle * 100, 0) + ' % времени');
    var txt = 'Вердикт по ветру: ' + VERD[r.verdict] + '. ';
    if (red.length) txt += 'Красные: ' + red.map(function (w) { return w.text; }).join(' ') + ' ';
    if (yel.length) txt += 'Обратите внимание: ' + yel.map(function (w) { return w.text; }).join(' ') + ' ';
    verdict('wn-verdict', txt, red.length > 0 || r.verdict === 'solar');

    /* площадка */
    set('wn-s1', 'падение мачты с ротором H + R = ' + fmt(r.fall, 0) + ' м: зона целиком на своём участке' + (isFinite(c.boundary) ? ' (до границы ' + fmt(c.boundary, 0) + ' м)' : ''));
    set('wn-s2', 'зимний сход льда по ориентиру 1,5 · (H + D) ≈ ' + fmt(r.ice, 0) + ' м, на это время зону ограждают');
    set('wn-s3', 'нижняя точка ротора ' + fmt(r.lowTip, 1) + ' м; нужна не ниже ' + fmt(c.obstH + 3, 1) + ' м над землёй' + (r.wake ? ' (сейчас тень от препятствия, выработка −30 %)' : ' (тени нет)'));
    set('wn-s4', 'около ' + fmt(r.noise, 0) + ' дБА на расстоянии ' + fmt(c.windowDist, 0) + ' м (грубая оценка по типу ВЭУ, паспорт точнее)');
    set('wn-s5', M.MAST[c.mount].name + (c.mount === 'roof' ? ': не применяется' : ', типичные высоты ' + M.MAST[c.mount].lo + '–' + M.MAST[c.mount].hi + ' м; ступица ' + fmt(c.hub, 0) + ' м'));
    verdict('wn-v1', r.warns.filter(function (w) { return /Зона падения|Крыша|Сход льда|окон|Препятствие|Мачта выше|типичные высоты|шума/.test(w.text); }).map(function (w) { return w.text; }).join(' ') || 'Замечаний по площадке нет.', red.length > 0);

    /* электрика */
    set('wn-e1', 'контроллер с MPPT не менее ' + fmt(r.ctrl, 1) + ' кВт и балластный тормоз');
    set('wn-e2', 'балластный ТЭН не менее ' + fmt(r.ballast, 1) + ' кВт (сброс энергии в шторм и при полной АКБ)');
    set('wn-e3', 'ток DC ' + fmt(r.I, 0) + ' А при ' + fmt(c.dcV, 0) + ' В; кабель ' + fmt(r.dcS, 0) + ' мм² на ' + fmt(c.dcLen, 0) + ' м, потери ' + fmt(r.dcLoss * 100, 1) + ' % (для 3 % нужно ' + fmt(r.dcNeed, 1) + ' мм²)');
    if (c.mode === 'off') {
      set('wn-e4', 'потребление ' + fmt(r.daily, 1) + ' кВт·ч в сутки, автономность ' + fmt(c.autonomy, 1) + ' сут');
      set('wn-e5', 'АКБ около ' + fmt(r.batt, 0) + ' кВт·ч полной ёмкости (LFP, разряд до 80 %, КПД 90 %)');
      set('wn-e6', 'инвертор не менее ' + fmt(r.inv, 1) + ' кВт (пик ' + fmt(c.peak, 1) + ' кВт × 1,2), чистый синус');
    } else {
      set('wn-e4', 'сетевая микрогенерация, мощность ВЭУ ' + fmt(c.Pr, 1) + ' кВт');
      set('wn-e5', 'АКБ не обязательна; можно добавить для резерва');
      set('wn-e6', 'сетевой инвертор или гибридный не менее ' + fmt(r.inv, 1) + ' кВт с сертификатом защит; двунаправленный счётчик');
    }
    verdict('wn-v2', r.warns.filter(function (w) { return /DC|Автономность|Микрогенерация|Подключение/.test(w.text); }).map(function (w) { return w.text; }).join(' ') || '', false);

    /* экономика */
    set('wn-m1', 'покрытие потребления ' + fmt(r.cover * 100, 0) + ' % (потребление ' + fmt(c.consumption, 0) + ' кВт·ч в год)');
    if (c.mode === 'grid') {
      set('wn-m2', 'свои нужды ' + fmt(r.eSelf, 0) + ' кВт·ч, излишки ' + fmt(r.eExport, 0) + ' кВт·ч');
      set('wn-m3', 'около ' + fmt(r.saving, 0) + ' BYN в год (тариф ' + fmt(c.tariff, 4) + ', выкуп ' + fmt(c.buyout, 2) + ' BYN/кВт·ч)');
      set('wn-m4', isFinite(r.payback) ? 'простой срок окупаемости ' + fmt(r.payback, 1) + ' лет без инфляции и обслуживания' : 'введите стоимость комплекта');
      set('wn-m5', isFinite(r.lcoe) ? 'себестоимость энергии за 20 лет около ' + fmt(r.lcoe, 2) + ' BYN/кВт·ч' : 'введите стоимость комплекта');
      verdict('wn-v3', isFinite(r.payback) ? (r.payback > 20 ? 'Окупаемость дольше 20 лет: ВЭУ не оправдана экономически, вернитесь к замеру ветра и сравните с солнцем.' : 'Срок окупаемости ' + fmt(r.payback, 1) + ' лет: проверьте допущения, ресурс и расходы на обслуживание.') : 'Стоимость комплекта вы вводите сами по предложениям поставщиков.', isFinite(r.payback) && r.payback > 20);
    } else {
      set('wn-m2', 'автономный объект: излишки не продаются, они идут в балласт-нагрев');
      set('wn-m3', 'экономия: замещение генератора и подключения к сети, считается отдельно');
      set('wn-m4', '—'); set('wn-m5', isFinite(c.cost) && c.cost > 0 ? 'себестоимость энергии за 20 лет около ' + fmt(c.cost / (r.eNet * 20), 2) + ' BYN/кВт·ч' : 'введите стоимость комплекта');
      verdict('wn-v3', '', false);
    }
    drawCurve(c, r); aiSpec(c, r);
  }

  /* ───────── запрос для ИИ-агента ───────── */
  function aiSpec(c, r) {
    if (!window.TegaAI) return;
    var t = M.TYPES[c.type].name, n1 = fmt;
    var obj = [['Ветер', 'средняя скорость на высоте ступицы ' + n1(r.vHub, 1) + ' м/с (v₁₀ ' + n1(c.v10, 1) + ' м/с, высота ступицы ' + n1(c.hub, 0) + ' м)'],
      ['Режим', c.mode === 'off' ? 'автономный объект' : 'сетевая микрогенерация'], ['ВЭУ', t + ', номинал ' + n1(c.Pr, 1) + ' кВт при ' + n1(c.vr, 0) + ' м/с, старт ' + n1(c.vci, 1) + ' м/с, останов ' + n1(c.vco, 0) + ' м/с'],
      ['Расчётная выработка', n1(r.eNet, 0) + ' кВт·ч в год, КИУМ ' + n1(r.cf * 100, 1) + ' %'], ['Потребление', n1(c.consumption, 0) + ' кВт·ч в год']];
    var items = [
      { name: 'Ветрогенератор ' + (c.type === 'hawt' ? 'горизонтальный трёхлопастной' : c.type === 'darrieus' ? 'вертикальный Дарье' : 'Савониуса'), qty: n1(c.Pr, 1) + ' кВт, ротор около ' + n1(r.D, 1) + ' м', req: 'независимо измеренная кривая мощности (не только каталожная), напряжение системы ' + n1(c.dcV, 0) + ' В, автоматический и механический стоп, паспорт и сервис в регионе' },
      { name: 'Мачта с оттяжками или свободностоящая', qty: n1(c.hub, 0) + ' м', req: 'расчёт на ветровую и ледовую нагрузку, откидная конструкция для обслуживания с земли' },
      { name: 'Фундамент и анкерные блоки оттяжек', qty: 'комплект', req: 'расчёт на опрокидывание по грунту участка' },
      { name: 'Контроллер ВЭУ с MPPT и балластным тормозом', qty: 'не менее ' + n1(r.ctrl, 1) + ' кВт', req: 'работает без сети и связи, останов по скорости ротора' },
      { name: 'Балластная нагрузка (ТЭН водонагрева)', qty: 'не менее ' + n1(r.ballast, 1) + ' кВт', req: 'с термозащитой, подключение через реле контроллера' },
      { name: 'Кабель DC от генератора до контроллера', qty: n1(r.dcS, 0) + ' мм², ' + n1(c.dcLen, 0) + ' м', req: 'гибкий медный, потери не более 3 %' },
      { name: 'Молниеотвод, заземление и УЗИП', qty: 'комплект', req: 'отдельный заземляющий проводник, контур по проекту молниезащиты, УЗИП на вводе дома' },
      { name: c.mode === 'off' ? 'Инвертор автономный' : 'Инвертор сетевой или гибридный', qty: 'не менее ' + n1(r.inv, 1) + ' кВт', req: c.mode === 'off' ? 'чистый синус, запас на пуск насосов и компрессоров' : 'сертификат защит для подключения к сети энергоснабжающей организации' }
    ];
    if (c.mode === 'off') items.push({ name: 'Аккумуляторная батарея LFP', qty: 'около ' + n1(r.batt, 0) + ' кВт·ч', req: 'автономность ' + n1(c.autonomy, 1) + ' суток, встроенная BMS, работа при отрицательных температурах по паспорту' });
    var notes = r.warns.map(function (w) { return w.text; });
    notes.push('Нужна независимая кривая мощности модели; проверить, что заявленная номинальная мощность относится к скорости ветра, которая реально бывает на участке.');
    window.TegaAI.update({ title: 'Ветрогенератор ' + n1(c.Pr, 1) + ' кВт', object: obj, items: items, notes: notes });
  }

  function apply(k) {
    var p = PRESETS[k]; if (!p) return;
    var m = { 'wn-type': p.type, 'wn-v10': p.v10, 'wn-alpha': p.alpha, 'wn-hub': p.hub, 'wn-pr': p.Pr, 'wn-cons': p.consumption, 'wn-mode': p.mode };
    for (var id in m) { var el = $(id); if (el) el.value = String(m[id]).replace('.', ','); }
    calc();
  }

  function init() {
    var root = $('e-wn'); if (!root) return;
    var panels = [];
    Array.prototype.forEach.call(root.querySelectorAll('.e-panel'), function (p) { panels.push(p.id); });
    root.classList.add('js');
    function show(id) {
      if (panels.indexOf(id) < 0) id = panels[0];
      Array.prototype.forEach.call(root.querySelectorAll('.e-panel'), function (p) { p.classList.toggle('on', p.id === id); });
      Array.prototype.forEach.call(document.querySelectorAll('.e-sub a'), function (a) {
        var onn = a.getAttribute('data-sub') === id; a.classList.toggle('on', onn);
        if (onn) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
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
      if (el.id === 'wn-preset') { el.addEventListener('change', function () { apply(el.value); }); return; }
      el.addEventListener('input', calc); el.addEventListener('change', calc);
    });
    calc();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
