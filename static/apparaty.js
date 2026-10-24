/* Подбор автомата и УЗО для линии. Ориентировочно, не заменяет проект. Токи по МЭК 60364-5-52 (ПВХ, 30 °С, Cu). */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  if (!$('ap-room')) return;
  var SZ = [1.5, 2.5, 4, 6, 10, 16];
  // [A1, B1, C, E]: при 2 нагруженных жилах и при 3
  var IZ2 = { 1.5: [14.5, 17.5, 19.5, 22], 2.5: [19.5, 24, 27, 30], 4: [26, 32, 36, 40], 6: [34, 41, 46, 51], 10: [46, 57, 63, 70], 16: [61, 76, 85, 94] };
  var IZ3 = { 1.5: [13.5, 15.5, 17.5, 18.5], 2.5: [18, 21, 24, 25], 4: [24, 28, 32, 34], 6: [31, 36, 41, 43], 10: [42, 50, 57, 60], 16: [56, 68, 76, 80] };
  var BR = [6, 10, 16, 20, 25, 32, 40, 50, 63];
  var RC = [16, 25, 32, 40, 63];
  var PRACT = { 1.5: 10, 2.5: 16, 4: 25, 6: 32 };   // практика для розеточных групп: номинал под сечение
  var LOAD = {
    sock: { cos: 0.95, ch: 'C', rcd: 30, typ: 'A', norm: 'Розеточные группы: УЗО обязательно (СН 4.04.01, п. 16.3.3, 16.3.13; ТКП 339-2022, п. 8.7.4).' },
    light: { cos: 0.95, ch: 'B', rcd: 0, typ: 'AC', norm: 'Освещение: сейчас УЗО не требуется, кроме ванных и особо опасных помещений. Изм. № 2 к СН 4.04.01 требует УЗО до 30 мА на светильники общего освещения: вступает через 60 дней после официального опубликования, лучше сразу взять дифавтомат.' },
    wash: { cos: 0.9, ch: 'C', rcd: 30, typ: 'A', norm: 'Стиральные и посудомоечные машины: УЗО (ТКП 339-2022, п. 8.7.4), тип A по п. 8.7.10.' },
    cook: { cos: 1, ch: 'C', rcd: 30, typ: 'A', norm: 'Электроплита: отдельная линия, розетка и автомат не менее 32 А с УЗО до 30 мА. При токе больше 32 А УЗО не более 100 мА и 100 мс (СН 4.04.01, п. 11.19, 16.3.13).' },
    boiler: { cos: 1, ch: 'C', rcd: 30, typ: 'A', norm: 'Водонагреватель: УЗО до 30 мА (СН 4.04.01, п. 16.3.3, 16.3.13).' },
    floor: { cos: 1, ch: 'C', rcd: 30, typ: 'A', norm: 'Тёплые полы и обогрев поверхностей: УЗО обязательно.' },
    heater: { cos: 1, ch: 'C', rcd: 30, typ: 'A', norm: 'Приборы отопления: по Изм. № 2 к СН 4.04.01 требуется УЗО; на практике ставят до 30 мА.' },
    ac: { cos: 0.9, ch: 'C', rcd: 30, typ: 'F', norm: 'Инверторный кондиционер: тип F (ток утечки смешанных частот). Номинал и тип проверьте по паспорту прибора.' },
    pump: { cos: 0.8, ch: 'C', rcd: 30, typ: 'A', norm: 'Двигатели и насосы: характеристика C, при тяжёлом пуске D по пусковому току. При инверторном приводе УЗО тип F или B. Данные по паспорту.' },
    fire: { cos: 0.8, ch: 'C', rcd: -1, typ: '', norm: 'Противопожарные системы: нужны аппараты с электромагнитным расцепителем (отсечкой), на ГРЩ или ВРУ их окрашивают в красный цвет. УЗО на такие линии ставить запрещено (СН 4.04.01, п. 9.5, 10.2, 16.3.2).' },
    ev: { cos: 1, ch: 'C', rcd: 30, typ: 'A', norm: 'Зарядная станция: по требованию изготовителя УЗО типа A с контролем постоянной составляющей или типа B (Изм. № 2 к СН 4.04.01, ГОСТ IEC 61851-1).' }
  };
  function num(v) { var n = parseFloat(String(v).replace(',', '.').replace(/\s/g, '')); return isFinite(n) ? n : 0; }
  function f(x, d) { return Number(x).toLocaleString('ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function ph() { var r = document.querySelector('input[name="ap-ph"]:checked'); return r ? r.value : '1'; }
  function calc() {
    var room = $('ap-room').value, key = $('ap-load').value, L = LOAD[key], p = num($('ap-p').value), s = parseFloat($('ap-s').value), m = parseInt($('ap-m').value, 10), three = ph() === '3';
    var why = [], warn = [];
    if (!(p > 0)) { $('ap-verdict').textContent = 'Введите мощность больше нуля.'; ['ap-ib', 'ap-iz', 'ap-brk', 'ap-pol', 'ap-rcd', 'ap-typ'].forEach(function (i) { $(i).textContent = '—'; }); $('ap-why').textContent = ''; return; }
    var ib = three ? p * 1000 / (1.732 * 400 * L.cos) : p * 1000 / (230 * L.cos);
    var iz = (three ? IZ3 : IZ2)[s][m];
    // номинал автомата: по току нагрузки; розеточные группы ещё и по практике под сечение
    var inn = null, i;
    for (i = 0; i < BR.length; i++) if (BR[i] >= ib - 1e-9) { inn = BR[i]; break; }
    var practice = false;
    if (key === 'sock' && PRACT[s] && PRACT[s] >= (inn || 0) && PRACT[s] <= iz) { inn = PRACT[s]; practice = true; }
    var ok = true;
    if (inn == null || ib > 63) { warn.push('Ток линии ' + f(ib, 1) + ' А: больше 63 А, подбор для таких линий вынесен за рамки калькулятора. Нужен расчёт по проекту.'); ok = false; }
    else if (inn > iz + 1e-9 || ib > iz) {
      ok = false; var need = null;
      for (i = 0; i < SZ.length; i++) if ((three ? IZ3 : IZ2)[SZ[i]][m] >= inn) { need = SZ[i]; break; }
      warn.push('Сечение ' + f(s, 1) + ' мм² мало: допустимый ток кабеля ' + f(iz, 1) + ' А, а автомат нужен на ' + inn + ' А. ' + (need ? 'Минимально подходит ' + f(need, 1) + ' мм².' : 'Нужно сечение больше 16 мм².'));
    }
    // УЗО
    var forbid = L.rcd < 0, rcd = forbid ? 0 : L.rcd, typ = L.typ, mA = rcd, extra = [];
    if (!forbid && (room === 'bath' || room === 'kids')) { if (!rcd) { rcd = 30; typ = 'A'; mA = 30; extra.push(room === 'bath' ? 'В ванной и душевой УЗО до 30 мА ставят на всё, что подключено.' : 'В помещениях с постоянным пребыванием детей действует правило УЗО до 30 мА. По Изм. № 2 к СН 4.04.01 для детских потребуется до 10 мА.'); } else if (room === 'kids') extra.push('Для детских по Изм. № 2 к СН 4.04.01 потребуется УЗО до 10 мА.'); }
    if (key === 'cook' && inn && inn > 32) { mA = 100; extra.push('Ток больше 32 А: УЗО допускается до 100 мА с временем отключения не более 100 мс.'); }
    var rcdOn = !!rcd;
    var brk = inn ? L.ch + inn : '—', pol = three ? '3P' : '1P+N';
    $('ap-ib').textContent = f(ib, 1) + ' А'; $('ap-iz').textContent = f(iz, 1) + ' А';
    $('ap-brk').textContent = ok ? brk : (inn ? brk + ' (после смены сечения)' : '—'); $('ap-pol').textContent = pol + (three ? ' (при наличии нуля 3P+N)' : '');
    if (rcdOn && inn) {
      var rn = null; for (i = 0; i < RC.length; i++) if (RC[i] >= inn) { rn = RC[i]; break; }
      $('ap-rcd').textContent = 'Дифавтомат ' + brk + ', ' + mA + ' мА';
      $('ap-typ').textContent = 'Тип ' + typ + ', ' + mA + ' мА' + (rn ? '. Или автомат + УЗО ' + rn + ' А' : '');
    } else { $('ap-rcd').textContent = rcdOn ? '—' : (forbid ? 'Не ставить' : 'Не требуется'); $('ap-typ').textContent = rcdOn ? '—' : (forbid ? 'Только автомат с отсечкой' : 'Автомата достаточно'); }
    var v = $('ap-verdict');
    v.className = 'verdict' + (ok ? ' ok' : ' bad');
    v.textContent = ok ? 'Автомат ' + brk + (rcdOn ? ' и УЗО до ' + mA + ' мА, тип ' + typ + ' (удобнее одним дифавтоматом)' : '') + ' подходит к кабелю ' + f(s, 1) + ' мм².' : warn[0];
    if (room === 'office' || room === 'shop' || room === 'common') {
      if (key === 'light') extra.push('В общественных зданиях на каждую линию рабочего, аварийного и эвакуационного освещения свой аппарат защиты и управления. Для аварийного освещения УЗО не требуется даже по Изм. № 2.');
      if (room === 'common') extra.push('Освещение лестниц, коридоров, входов и домофоны питают прямо от ГРЩ (ВРУ) или щитка управления освещением в электрощитовой (СН 4.04.01, п. 9.12, 9.13). Лифты, насосы и вентиляторы идут отдельной силовой сетью.');
      if (room === 'shop' && key === 'sock') extra.push('Для торгового оборудования и касс с отдельными приборами подбирайте линию по паспорту прибора, а не по общей розеточной группе.');
    }
    why = [L.norm].concat(extra);
    if (practice) why.push('Номинал ' + inn + ' А выбран под сечение ' + f(s, 1) + ' мм² (практика для розеточных групп), нагрузка по току ниже.');
    if (L.ch === 'B') why.push('Характеристика B подходит для освещения. C тоже допустима, если есть пусковые токи.');
    if (key === 'pump') why.push('Если пусковой ток двигателя большой, возьмите характеристику D.');
    why.push('УЗО на несколько линий: номинал не меньше автомата, который его защищает, а суммарный ток утечки не более трети номинала УЗО.');
    why.push('Расчёт ориентировочный. Окончательный выбор аппарата делает проектировщик по паспорту оборудования и схеме щита.');
    var box = $('ap-why'); box.textContent = '';
    why.forEach(function (t) { var li = document.createElement('p'); li.className = 'e-note'; li.textContent = t; box.appendChild(li); });
  }
  ['ap-room', 'ap-load', 'ap-p', 'ap-s', 'ap-m'].forEach(function (id) { $(id).addEventListener('input', calc); $(id).addEventListener('change', calc); });
  Array.prototype.forEach.call(document.querySelectorAll('input[name="ap-ph"]'), function (r) { r.addEventListener('change', calc); });
  calc();
})();
