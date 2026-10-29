/* Бани и сауны: интерфейс калькулятора. Модель расчёта в bath-model.js.
   Ориентировочный расчёт, не проект. */
(function () {
  'use strict';
  var M = window.TegaBath;
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
  function on(id) { var el = $(id); return !!(el && el.checked); }
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
  function table(host, head, rows) {
    clearNode(host);
    var t = document.createElement('table'); t.className = 'e-tbl';
    var tr = document.createElement('tr');
    head.forEach(function (h) { var th = document.createElement('th'); th.textContent = h; tr.appendChild(th); });
    var thead = document.createElement('thead'); thead.appendChild(tr); t.appendChild(thead);
    var tb = document.createElement('tbody');
    rows.forEach(function (r) {
      var row = document.createElement('tr'); if (r.cls) row.className = r.cls;
      r.cells.forEach(function (c, i) { var td = document.createElement('td'); td.textContent = c; if (i > 1 && /^[\d−,\s—]+$/.test(c)) td.className = 'm'; row.appendChild(td); });
      tb.appendChild(row);
    });
    t.appendChild(tb);
    var sc = document.createElement('div'); sc.className = 'e-scroll'; sc.appendChild(t); host.appendChild(sc);
  }

  var last = null;
  var TYPES = { fin: 'Финская сауна', rus: 'Русская баня', ham: 'Хамам', ir: 'ИК-кабина', hyb: 'Гибрид' };
  var MODES = { fin: '80–100 °C, 10–20 %', rus: '60–70 °C, 40–60 %', ham: '40–50 °C, 90–100 %', ir: '45–60 °C, излучение', hyb: 'профили по паспорту кабины' };
  var WOOD = { eco: 'осина (стены и полки), липа на потолок по желанию', std: 'липа или ольха на стены и потолок, липа или абаш на полки', prem: 'термодерево на стены, липа на потолок, абаш на полки' };
  var STONES = { gab: 'габбро-диабаз', jad: 'жадеит', qrz: 'малиновый кварцит' };
  var PRESETS = {
    fin: { type: 'fin', L: 2.4, W: 2.0, H: 2.2, u: 1.8, place: 'built', sup: '380', ins: 'wool' },
    rus: { type: 'rus', L: 3.0, W: 2.5, H: 2.3, u: 0, place: 'sep', sup: '380', ins: 'wool' },
    ham: { type: 'ham', L: 2.0, W: 2.0, H: 2.2, u: 0, place: 'built', sup: '380', ins: 'xps' },
    ir: { type: 'ir', L: 1.2, W: 1.2, H: 1.9, u: 0.8, place: 'built', sup: '220', ins: 'wool' }
  };

  function cfg() {
    return {
      type: val('ba-type'), L: num('ba-L'), W: num('ba-W'), H: num('ba-H'), unheated: num('ba-u'), place: val('ba-place'), border: num('ba-bd'), supply: val('ba-sup'),
      limit: num('ba-lim'), door: val('ba-door'), vent: val('ba-vent'), insul: val('ba-ins'), budget: val('ba-bud'), chimney: val('ba-chim'), drain: val('ba-drain'), softener: val('ba-soft'),
      stone: val('ba-stone'), barrel: on('ba-o-barrel'), pano: on('ba-o-pano'), salt: on('ba-o-salt'), gun: on('ba-o-gun'),
      tariff: num('ba-tar'), session: num('ba-ses'), cab: num('ba-cab')
    };
  }
  function valid(c) {
    return c.L >= 1.2 && c.L <= 6 && c.W >= 1.2 && c.W <= 5 && c.H >= 1.9 && c.H <= 2.6 && c.unheated >= 0 && c.unheated <= 8 && c.border >= 0 && c.session > 0 && c.session <= 8 && c.cab >= 0;
  }
  var IDS = ['ba-k', 'ba-v', 'ba-s', 'ba-h', 'ba-hp', 'ba-ln', 'ba-sf', 'ba-w', 'ba-vn', 'ba-e', 'ba-ec', 'ba-m-w', 'ba-m-c', 'ba-m-f', 'ba-m-b', 'ba-m-v', 'ba-m-s', 'ba-m-k', 'ba-m-d', 'ba-m-t',
    'ba-h-w', 'ba-h-x', 'ba-h-m', 'ba-h-t', 'ba-h-h', 'ba-h-s'];

  function lineText(l, n) {
    if (!l) return '—';
    var s = l.v + ' В, кабель ' + l.cable + ' мм²' + (isFinite(l.brk) ? ', автомат ' + l.brk + ' А' : '') + ', УЗО 30 мА, ток около ' + fmt(l.amp, 1) + ' А';
    return (n > 1 ? n + ' линии: ' : '') + s;
  }

  function calc() {
    var c = cfg();
    if (!valid(c)) {
      last = null; IDS.forEach(function (i) { set(i, '—'); });
      verdict('ba-verdict', 'Введите размеры: длина 1,2–6 м, ширина 1,2–5 м, высота 1,9–2,6 м, неутеплённые поверхности 0–8 м².', true);
      ['ba-v1', 'ba-v2', 'ba-v3'].forEach(function (i) { verdict(i, '', false); });
      ['ba-ch', 'ba-bt'].forEach(function (i) { var n = $(i); if (n) clearNode(n); });
      set('ba-chn', ''); if (window.TegaAI) window.TegaAI.update(null); return;
    }
    var r = M.calc(c), t = c.type;
    last = { c: c, r: r };
    set('ba-k', TYPES[t] + ', ' + MODES[t]);
    set('ba-v', fmt(r.V, 1) + ' м³ (' + fmt(c.L, 1) + '×' + fmt(c.W, 1) + '×' + fmt(c.H, 1) + ' м)');
    set('ba-s', 'стены ' + fmt(r.Sw, 1) + ' м², потолок ' + fmt(r.Sc, 1) + ' м², обшивка ' + fmt(r.Sfin, 1) + ' м² (без двери 1,6 м²), неутеплённых ' + fmt(r.Su, 1) + ' м²');
    var red = r.warns.filter(function (w) { return w.level === 'red'; }), yel = r.warns.filter(function (w) { return w.level === 'yellow'; });
    var txt = '';
    if (red.length) txt += 'Красные: ' + red.map(function (w) { return w.text; }).join(' ') + ' ';
    if (yel.length) txt += 'Обратите внимание: ' + yel.map(function (w) { return w.text; }).join(' ') + ' ';
    if (!txt) txt = 'Критичных замечаний нет. ';
    verdict('ba-verdict', txt, red.length > 0);

    /* печь и электрика */
    if (t === 'rus') {
      set('ba-h', 'дровяная печь, закрытая каменка; электрическая мощность не требуется (освещение отдельной линией)');
      set('ba-hp', 'паспортный объём парной около ' + fmt(r.wood.passport, 0) + ' м³ (V · 1,2), камни не менее ' + fmt(r.wood.stoneMin, 0) + ' кг');
      set('ba-ln', '—'); set('ba-sf', '—');
      set('ba-w', 'сэндвич Ø115–120 мм, не менее 5 м от колосника, разделка перекрытия 500–700 мм, предтопочный лист 500×700 мм, датчик CO');
    } else {
      var hn = r.heater.n > 1 ? r.heater.n + ' × ' : '';
      var what = t === 'ham' ? 'парогенератор' : t === 'ir' ? 'ИК-панели' : 'электрокаменка';
      set('ba-h', what + ' ' + hn + fmt(r.heater.kw, t === 'ir' ? 1 : (r.heater.kw % 1 ? 1 : 0)) + ' кВт (' + fmt(r.perM3, 2) + ' кВт/м³)' + (t === 'hyb' ? '; парогенератор ' + r.steamGen.kw + ' кВт' : ''));
      set('ba-hp', 'по расчёту ' + fmt(r.P, 1) + ' кВт, коридор ' + fmt(r.Pmin, 1) + '–' + fmt(r.Pmax, 1) + ' кВт' + (t === 'ham' ? ' (1,5–2,0 кВт/м³)' : t === 'ir' ? '' : ' (1,0–1,4 кВт/м³)'));
      set('ba-ln', lineText(r.lineMain, r.heater.n) + '; участок до печи термостойким кабелем, выключатель и панель вне парной');
      set('ba-sf', r.surf ? 'пол ' + fmt(r.surf.floor, 2) + ', полки ' + fmt(r.surf.bench, 2) + ', стены ' + fmt(r.surf.wall, 2) + ' = ' + fmt(r.surf.total, 1) + ' кВт; ' + lineText(r.lineSurf, 1) : '—');
      set('ba-w', '—');
    }
    set('ba-vn', fmt(r.air.q, 0) + ' м³/ч (' + r.air.n + ' об/ч, коридор ' + fmt(r.air.qmin, 0) + '–' + fmt(r.air.qmax, 0) + '), воздуховод Ø' + r.air.d + ' мм; приток под печь, вытяжка диагонально');
    if (r.kwh) {
      set('ba-e', fmt(r.kwh.e, 1) + ' кВт·ч за сеанс ' + fmt(r.kwh.ses, 1) + ' ч (разгон ' + fmt(r.kwh.ramp, 2) + ' ч)');
      set('ba-ec', isFinite(r.kwh.cost) ? 'около ' + fmt(r.kwh.cost, 2) + ' BYN по тарифу ' + fmt(c.tariff, 4) + ' BYN/кВт·ч' : 'введите тариф');
    } else { set('ba-e', t === 'rus' ? 'дрова: расход зависит от породы и печи, в калькуляторе не считается' : '—'); set('ba-ec', '—'); }
    var cv = 'Мощность, вентиляция и линия это ориентиры практики, точные значения даёт паспорт печи. Сечение и автомат окончательно выбирает электрик по способу прокладки и длине. ';
    if (isFinite(c.limit) && c.limit > 0) cv += 'Лимит сравнивается с суммарной электрической мощностью ' + fmt(r.elTotal, 1) + ' кВт. ';
    verdict('ba-v1', cv, false);

    /* ограждения и материалы */
    if (r.enc) {
      var e = r.enc;
      set('ba-m-w', fmt(e.woolWall, 1) + ' м² толщиной 50 мм (' + fmt(e.woolWallM3, 2) + ' м³)');
      set('ba-m-c', fmt(e.woolCeil, 1) + ' м² толщиной 100 мм (' + fmt(e.woolCeilM3, 2) + ' м³)');
      set('ba-m-f', fmt(e.foil, 1) + ' м² (обшивка · 1,1), стыки алюмоскотчем');
      set('ba-m-b', fmt(e.battens, 1) + ' м.п. бруска 20×40 (шаг 0,6 м), зазор 20 мм');
      set('ba-m-v', fmt(e.board, 1) + ' м² (с запасом 5 % на раскрой)');
      set('ba-m-s', '2 яруса: длина ' + fmt(e.tier1, 1) + ' м и ' + fmt(e.tier2, 1) + ' м, планки 5 по глубине яруса, всего около ' + fmt(e.slats, 0) + ' м.п.');
      set('ba-m-k', fmt(r.stones.kg, 0) + ' кг (' + r.stones.packs + ' компл. по 20 кг), ' + STONES[c.stone] + (r.stones.closed ? ', закрытая каменка' : ', открытая каменка, но не больше ёмкости по паспорту печи'));
      set('ba-m-d', 'дверь наружу без запоров, стекло закалённое 8 мм, неутеплённых поверхностей ' + fmt(r.Su, 1) + ' м²');
      set('ba-m-t', WOOD[c.budget]);
      verdict('ba-v2', 'В расчёте только базальтовая вата. Каркас под вату (стойки), крепёж, кляймеры, термовтулки и отделка потолка в ведомость не входят, добавьте их по проекту.', false);
    } else {
      ['ba-m-w', 'ba-m-c', 'ba-m-f', 'ba-m-b', 'ba-m-v', 'ba-m-s', 'ba-m-k', 'ba-m-d', 'ba-m-t'].forEach(function (i) { set(i, '—'); });
      verdict('ba-v2', t === 'ham' ? 'Для хамама материалы считаются на вкладке «Хамам». Эта вкладка работает для сауны, русской бани и гибрида.' : 'ИК-кабина поставляется готовой или монтируется в нишу по паспорту, погонаж не считается.', false);
    }

    /* хамам */
    if (r.ham) {
      var h = r.ham;
      set('ba-h-w', fmt(h.wp, 1) + ' м² корытом с заходом на стены (с запасом 15 %)');
      set('ba-h-x', fmt(h.xps, 1) + ' м² плотного XPS 30–50 мм (с запасом 5 %)');
      set('ba-h-m', fmt(h.mosaic, 1) + ' м² (с запасом 10 %)');
      set('ba-h-t', fmt(h.floorTile, 1) + ' м² противоскользящей плитки (с запасом 10 %)');
      set('ba-h-h', 'пол ' + fmt(r.surf.floor, 2) + ' кВт, полки ' + fmt(r.surf.bench, 2) + ' кВт, стены ' + fmt(r.surf.wall, 2) + ' кВт, всего ' + fmt(r.surf.total, 1) + ' кВт');
      set('ba-h-s', '1–2 %: перепад ' + fmt(h.slopeMin, 0) + '–' + fmt(h.slopeMax, 0) + ' мм на длине ' + fmt(c.L, 1) + ' м к трапу');
      verdict('ba-v3', 'Маты пола и полок включают и проверяют до мозаики, протокол нагрева до 40–45 °C входит в сдачу. Воду из хамама в канализацию, септик или дренаж по проекту, не на рельеф и не на соседний участок.', false);
    } else {
      ['ba-h-w', 'ba-h-x', 'ba-h-m', 'ba-h-t', 'ba-h-h', 'ba-h-s'].forEach(function (i) { set(i, '—'); });
      verdict('ba-v3', 'Эта вкладка работает для типа «Хамам». Выберите его на первой вкладке или в готовых примерах.', false);
    }
    drawSection(); budget(); aiSpec(c, r);
  }

  /* ───────── запрос для ИИ-агента ───────── */
  function aiSpec(c, r) {
    if (!window.TegaAI) return;
    var t = c.type, n1 = function (x, d) { return fmt(x, d); };
    var obj = [['Тип', TYPES[t] + ', режим ' + MODES[t]], ['Размеры парной', n1(c.L, 1) + '×' + n1(c.W, 1) + '×' + n1(c.H, 1) + ' м, объём ' + n1(r.V, 1) + ' м³'],
      ['Неутеплённые поверхности (стекло)', n1(r.Su, 1) + ' м²'], ['Расположение', c.place === 'sep' ? 'отдельно стоящая баня' : 'встроена в дом'], ['Электропитание', c.supply === '380' ? '380 В, 5 жил' : '220 В'], ['Комплектация', WOOD[c.budget]]];
    var items = [];
    if (r.heater) {
      var kw = fmt(r.heater.kw, r.heater.kw % 1 ? 1 : 0);
      items.push({ name: t === 'ham' ? 'Парогенератор для хамама' : t === 'ir' ? 'ИК-панели' : 'Электрокаменка для сауны', qty: (r.heater.n > 1 ? r.heater.n + ' × ' : '') + kw + ' кВт', req: 'мощность не ниже ' + kw + ' кВт при объёме ' + n1(r.V, 1) + ' м³' + (c.supply === '380' && r.heater.kw >= 8 ? ', трёхфазное питание 380 В' : '') + ', защита от перегрева, ' + (t === 'ham' ? 'автодренаж и работа с умягчённой водой' : 'сертификат соответствия, паспорт на русском языке') });
    }
    if (t === 'rus') items.push({ name: 'Дровяная печь с закрытой каменкой', qty: '1 шт', req: 'паспортный объём парной не менее ' + n1(r.wood.passport, 0) + ' м³, масса камней не менее ' + n1(r.wood.stoneMin, 0) + ' кг, отступки и разделка по паспорту' }, { name: 'Дымоход-сэндвич с разделкой и предтопочным листом', qty: 'комплект', req: 'Ø115–120 мм, не менее 5 м от колосника, нержавеющая сталь по паспорту печи' }, { name: 'Датчик угарного газа CO', qty: '1 шт', req: 'со звуковой сиреной' });
    if (r.lineMain) items.push({ name: 'Кабель питания печи, автомат и УЗО', qty: r.lineMain.cable + ' мм², автомат ' + r.lineMain.brk + ' А, УЗО 30 мА, ' + n1(c.cab, 0) + ' м', req: 'участок до печи термостойкий (силикон или РКГМ), в негорючей гофре или металлорукаве' });
    if (r.enc) items.push({ name: 'Базальтовая вата плитная', qty: n1(r.enc.woolWall, 1) + ' м² толщиной 50 мм (стены), ' + n1(r.enc.woolCeil, 1) + ' м² толщиной 100 мм (потолок)', req: 'негорючая, для длительного нагрева в сауне по паспорту' },
      { name: 'Алюминиевая фольга-пароизоляция и алюмоскотч', qty: n1(r.enc.foil, 1) + ' м²', req: 'для парных, стыки проклеиваются' }, { name: 'Вагонка для парной', qty: n1(r.enc.board, 1) + ' м²', req: 'порода: ' + WOOD[c.budget] + '; без смолы на полках' },
      { name: 'Брус для обрешётки 20×40 и кляймеры', qty: n1(r.enc.battens, 1) + ' м.п.', req: 'сухой, без пропиток, выделяющих вредные вещества при нагреве' },
      { name: 'Камни для каменки', qty: n1(r.stones.kg, 0) + ' кг', req: 'плотная магматическая порода (габбро-диабаз, жадеит, малиновый кварцит), без пористых и слоистых' });
    if (r.ham) items.push({ name: 'Гидроизоляция хамама', qty: n1(r.ham.wp, 1) + ' м²', req: 'корытом с заходом на стены, система для постоянно влажных помещений' }, { name: 'Плотный экструдированный XPS 30–50 мм', qty: n1(r.ham.xps, 1) + ' м²', req: 'не впитывает воду' },
      { name: 'Мозаика и плитка пола', qty: n1(r.ham.mosaic, 1) + ' м² и ' + n1(r.ham.floorTile, 1) + ' м²', req: 'для хамама, плитка пола противоскользящая' }, { name: 'Греющие маты или кабель для пола, полок и стен', qty: n1(r.surf.total, 1) + ' кВт', req: 'для влажных помещений под плитку' },
      { name: 'Трап с гидрозатвором и умягчитель воды с автодренажом', qty: 'комплект', req: 'трап с подогревом, уклон пола 1–2 %' });
    if (r.air) items.push({ name: 'Вентиляционные клапаны и воздуховод', qty: '2 клапана, Ø' + r.air.d + ' мм, расход ' + n1(r.air.q, 0) + ' м³/ч', req: 'термостойкие, приток под печь и вытяжка диагонально' });
    items.push({ name: 'Дверь парной', qty: '1 шт', req: 'открывается наружу, без запоров, закалённое стекло 8 мм, магнитный притвор' });
    var notes = r.warns.map(function (w) { return w.text; });
    notes.push('В парной только базальтовая вата: пенопласт и XPS не применять (кроме XPS под гидроизоляцией хамама).');
    window.TegaAI.update({ title: TYPES[t], object: obj, items: items, notes: notes });
  }

  /* ───────── количества и ваши цены ───────── */
  function budget() {
    if (!last) return;
    var r = last.r, c = last.c, t = c.type, hn = r.heater ? r.heater.n : 0, lines = (r.lineMain ? 1 : 0) + (r.lineSurf ? 1 : 0);
    var items = [
      ['Ограждения и изоляция', 'Вата 50 мм', r.enc ? r.enc.woolWall : 0, 'м²', 'wool50'],
      ['Ограждения и изоляция', 'Вата 100 мм', r.enc ? r.enc.woolCeil : 0, 'м²', 'wool100'],
      ['Ограждения и изоляция', 'Фольга', r.enc ? r.enc.foil : 0, 'м²', 'foil'],
      ['Ограждения и изоляция', 'Обрешётка 20×40', r.enc ? r.enc.battens : 0, 'м.п.', 'batt'],
      ['Ограждения и изоляция', 'Гидроизоляция хамама', r.ham ? r.ham.wp : 0, 'м²', 'wp'],
      ['Ограждения и изоляция', 'XPS', r.ham ? r.ham.xps : 0, 'м²', 'xps'],
      ['Печь и электрика', t === 'ham' ? 'Парогенератор' : t === 'ir' ? 'ИК-панели (комплект)' : t === 'rus' ? 'Дровяная печь' : 'Печь', t === 'rus' ? 1 : hn + (r.steamGen ? 1 : 0), 'шт', 'heater'],
      ['Печь и электрика', 'Автомат', lines, 'шт', 'brk'],
      ['Печь и электрика', 'УЗО 30 мА', lines, 'шт', 'rcd'],
      ['Печь и электрика', 'Кабель', lines * (c.cab || 0), 'м.п.', 'cable'],
      ['Печь и электрика', 'Дымоход с разделкой и листом', t === 'rus' ? 1 : 0, 'компл.', 'chim'],
      ['Печь и электрика', 'Датчик CO', t === 'rus' ? 1 : 0, 'шт', 'co'],
      ['Печь и электрика', 'Камни (комплекты по 20 кг)', r.stones ? r.stones.packs : 0, 'компл.', 'stone'],
      ['Печь и электрика', 'Вентиляционные клапаны', 2, 'шт', 'vent'],
      ['Печь и электрика', 'Греющие маты или кабель', r.ham ? r.Sf + c.L * 0.5 + Math.max(0, r.Sw - M.DOOR) : 0, 'м²', 'mat'],
      ['Печь и электрика', 'Трап', t === 'ham' ? 1 : 0, 'шт', 'drain'],
      ['Печь и электрика', 'Умягчитель с автодренажом', t === 'ham' || t === 'hyb' ? 1 : 0, 'компл.', 'soft'],
      ['Отделка и полки', 'Вагонка', r.enc ? r.enc.board : 0, 'м²', 'board'],
      ['Отделка и полки', 'Планка полок', r.enc ? r.enc.slats : 0, 'м.п.', 'slat'],
      ['Отделка и полки', 'Мозаика', r.ham ? r.ham.mosaic : 0, 'м²', 'mos'],
      ['Отделка и полки', 'Плитка пола', r.ham ? r.ham.floorTile : 0, 'м²', 'tile'],
      ['Дверь и стекло', 'Дверь', 1, 'шт', 'door'],
      ['Дверь и стекло', 'Стекло и неутеплённые поверхности', r.Su, 'м²', 'glass'],
      ['Пуск', 'Пусконаладка и инструктаж', 1, 'компл.', 'start']
    ];
    var sum = 0, priced = 0, total = 0, rows = [];
    items.forEach(function (it) {
      if (!(it[2] > 0)) return;
      total++;
      var p = num('ba-p-' + it[4]), line = isFinite(p) && p >= 0 ? p * it[2] : NaN;
      if (isFinite(line)) { sum += line; priced++; }
      var whole = it[3] === 'шт' || it[3] === 'компл.';
      rows.push({ cells: [it[0], it[1], fmt(it[2], whole ? 0 : 1) + ' ' + it[3], isFinite(p) ? fmt(p, 2) : '—', isFinite(line) ? fmt(line, 2) : '—'] });
    });
    rows.push({ cls: 'tot', cells: ['Итого по позициям с ценой', '', '', '', priced ? fmt(sum, 2) : '—'] });
    table($('ba-bt'), ['Раздел', 'Позиция', 'Количество', 'Цена, BYN за ед.', 'Сумма, BYN'], rows);
    set('ba-b-n', priced + ' из ' + total);
    set('ba-b-sum', priced ? fmt(sum, 2) + ' BYN' + (priced < total ? ' (без позиций без цены)' : '') : '—');
    verdict('ba-b-verdict', 'Цены в калькулятор не заложены: они зависят от материала, поставщика и сезона. Введите цены за единицу из ваших предложений, сумма пересчитается. Для отдельно стоящей бани фундамент, сруб или каркас, кровля и инженерия вне парной сюда не входят, добавьте их отдельно.', false);
  }

  /* ───────── разрез парной ───────── */
  function drawSection() {
    var host = $('ba-ch'); if (!host || !last) return;
    clearNode(host);
    var c = last.c, r = last.r, t = c.type, W = 760, H = 330;
    var sc = Math.min(380 / c.L, 190 / c.H), x0 = 110, yf = 250, rw = c.L * sc, rh = c.H * sc, yt = yf - rh, x1 = x0 + rw;
    var el = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Разрез парной' });
    function lab(x, y, s, a, w, fill, size) { el.appendChild(svg('text', { x: x, y: y, 'font-size': size || 12, fill: fill || INK, 'text-anchor': a || 'start', 'font-weight': w || '400' }, s)); }
    function rect(x, y, w, h, fill, stroke, sw) { el.appendChild(svg('rect', { x: x, y: y, width: w, height: h, fill: fill, stroke: stroke || 'none', 'stroke-width': sw || 1 })); }
    function ln(xa, ya, xb, yb, col, w, dash) { var a = { x1: xa, y1: ya, x2: xb, y2: yb, stroke: col, 'stroke-width': w }; if (dash) a['stroke-dasharray'] = dash; el.appendChild(svg('line', a)); }
    rect(x0, yt, rw, rh, '#f6f6f7', null);
    /* слои левой стены */
    var layers = t === 'ham' ? [['стена', 18, G3], ['XPS', 12, '#e8d9a8'], ['гидро', 3, RED], ['плитка', 8, '#ffffff']] : t === 'ir' ? [['стена', 20, G3]] : [['стена', 18, G3], ['вата', 12, '#e8d9a8'], ['фольга', 2, G1], ['зазор', 6, '#ffffff'], ['вагонка', 8, '#c9a56b']];
    var lx = x0, lyt = yt - 22;
    layers.slice().reverse().forEach(function (l) { lx -= l[1]; rect(lx, lyt, l[1], rh + 22, l[2], INK, 1); });
    var lxs = x0 - layers.reduce(function (a, l) { return a + l[1]; }, 0);
    lab(lxs, lyt - 6, layers.map(function (l) { return l[0]; }).join(' · '), 'start', '400', MUT, 11);
    /* потолок и пол */
    rect(x0 - 50, lyt, rw + 100, 22, '#e8d9a8', INK, 1);
    lab(x0 + rw / 2, lyt + 15, t === 'ham' ? 'потолок со скатом и плиткой' : 'потолок: вата 100 мм, фольга', 'middle', '700', INK, 11);
    rect(x0 - 50, yf, rw + 100, 14, G3, INK, 1);
    ln(x0, yt, x0, yf, INK, 3); ln(x1, yt, x1, yf, INK, 3);
    /* полки или греющие поверхности */
    if (t !== 'ir') {
      var bw1 = Math.min(0.9, c.L * 0.45) * sc, bw2 = Math.min(0.5, c.L * 0.25) * sc;
      rect(x1 - bw2 - 6, yf - 1.0 * sc, bw2 + 6, 8, '#c9a56b', INK, 1);
      rect(x1 - bw1 - 6, yf - 0.5 * sc, bw1 + 6, 8, '#c9a56b', INK, 1);
      lab(x1 - 8, yf - 1.0 * sc - 6, 'верхний ярус', 'end', '700', INK, 11);
      if (t !== 'ham') lab(x1 - bw1 - 12, yf - 0.5 * sc + 6, 'нижний ярус', 'end', '400', MUT, 11);
    }
    /* печь, генератор, дымоход, панели */
    if (t === 'fin' || t === 'hyb') {
      rect(x0 + 14, yf - 0.8 * sc, 0.4 * sc, 0.8 * sc, INK); lab(x0 + 22, yf - 0.8 * sc - 6, 'печь ' + fmt(r.heater.kw, r.heater.kw % 1 ? 1 : 0) + ' кВт', 'start', '700', INK, 11);
    } else if (t === 'rus') {
      rect(x0 + 14, yf - 0.9 * sc, 0.55 * sc, 0.9 * sc, INK); lab(x0 + 22, yf - 0.9 * sc - 6, 'дровяная печь', 'start', '700', INK, 11);
      ln(x0 + 14 + 0.27 * sc, yf - 0.9 * sc, x0 + 14 + 0.27 * sc, yt - 50, INK, 6);
      lab(x0 + 14 + 0.27 * sc + 10, yt - 46, 'дымоход ≥ 5 м от колосника', 'start', '400', MUT, 11);
    } else if (t === 'ham') {
      rect(x0 + 14, yf - 0.5 * sc, 0.3 * sc, 0.2 * sc, RED); lab(x0 + 14, yf - 0.5 * sc - 6, 'пар', 'start', '700', RED, 11);
      ln(x0, yf - 6, x1 - 24, yf, RED, 3); rect(x1 - 36, yf - 2, 20, 4, INK);
      lab(x1 - 26, yf + 28, 'трап', 'middle', '700', INK, 11);
    } else if (t === 'ir') {
      rect(x0 + 6, yt + 40, 8, rh - 80, RED); rect(x1 - 14, yt + 40, 8, rh - 80, RED); lab(x0 + rw / 2, yt + rh / 2 + 4, 'ИК-панели по стенам', 'middle', '700', INK, 11);
    }
    /* вентиляция */
    if (t !== 'ir') {
      el.appendChild(svg('polygon', { points: (x0 - 4) + ',' + (yf - 16) + ' ' + (x0 + 12) + ',' + (yf - 8) + ' ' + (x0 - 4) + ',' + (yf - 0), fill: RED }));
      lab(x0 - 66, yf - 14, 'приток', 'start', '700', RED, 11);
      el.appendChild(svg('polygon', { points: (x1 + 14) + ',' + (yf - 34) + ' ' + (x1 + 2) + ',' + (yf - 26) + ' ' + (x1 + 14) + ',' + (yf - 18), fill: INK }));
      lab(x1 + 20, yf - 22, 'вытяжка (сушка)', 'start', '700', INK, 11);
      el.appendChild(svg('polygon', { points: (x1 + 14) + ',' + (yt + 6) + ' ' + (x1 + 2) + ',' + (yt + 14) + ' ' + (x1 + 14) + ',' + (yt + 22), fill: INK }));
      lab(x1 + 20, yt + 18, 'верхний клапан', 'start', '700', INK, 11);
    }
    /* размеры */
    ln(x0, yf + 34, x1, yf + 34, MUT, 1); lab(x0 + rw / 2, yf + 52, fmt(c.L, 1) + ' м', 'middle', '700', MUT, 12);
    lab(x1 + 60, yt + rh / 2 + 40, fmt(c.H, 1) + ' м', 'start', '700', MUT, 12);
    lab(x0 - 100, H - 12, 'Схема условная, масштаб по размеру парной. Слои: ' + (t === 'ham' ? 'основание, плотный XPS, гидроизоляция корытом, клей и плитка' : t === 'ir' ? 'готовая кабина' : 'стена, вата, фольга, зазор 20 мм, вагонка') + '.', 'start', '400', MUT, 11);
    set('ba-chn', 'Разрез показывает порядок слоёв, ярусы и точки вентиляции. Размеры и узлы уточняет проект.');
    host.appendChild(el);
  }

  function apply(k) {
    var p = PRESETS[k]; if (!p) return;
    var m = { 'ba-type': p.type, 'ba-L': p.L, 'ba-W': p.W, 'ba-H': p.H, 'ba-u': p.u, 'ba-place': p.place, 'ba-sup': p.sup, 'ba-ins': p.ins, 'ba-door': 'out', 'ba-vent': 'yes' };
    for (var id in m) { var el = $(id); if (el) el.value = String(m[id]).replace('.', ','); }
    calc();
  }

  function init() {
    var root = $('e-ba'); if (!root) return;
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
      if (el.id === 'ba-preset') { el.addEventListener('change', function () { apply(el.value); }); return; }
      el.addEventListener('input', calc); el.addEventListener('change', calc);
    });
    var rs = $('ba-p-reset');
    if (rs) rs.addEventListener('click', function () { Array.prototype.forEach.call(root.querySelectorAll('input[id^="ba-p-"]'), function (e) { e.value = ''; }); calc(); });
    calc();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
