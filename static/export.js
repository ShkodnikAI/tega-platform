/* Копирование и сохранение результатов калькуляторов: текстом в буфер, файлом .txt или на печать.
   Подключается на страницах со справочниками и расчётами. Ничего не отправляет на сервер: текст собирается из того, что на экране. */
(function () {
  'use strict';

  var NOTE = 'Ориентировочный расчёт для сметы и разговора с проектировщиком, не проект. Окончательные значения подтверждают по действующим нормам и документации производителя.';
  var BUTTONS = [['copy', 'Копировать'], ['txt', 'Скачать .txt'], ['print', 'Печать']];

  function clean(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
  function shown(el) { return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function stamp() {
    var d = new Date();
    return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function fileStamp() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  /* Поле формы: подпись, значение и единица */
  function fieldLine(f) {
    var lab = f.querySelector('label');
    var inp = f.querySelector('input, select, textarea');
    if (!lab || !inp) return null;
    var val;
    if (inp.tagName === 'SELECT') val = inp.options[inp.selectedIndex] ? inp.options[inp.selectedIndex].text : '';
    else if (inp.type === 'checkbox') val = inp.checked ? 'да' : 'нет';
    else val = inp.value;
    var u = f.querySelector('.u');
    var unit = u ? clean(u.textContent) : '';
    val = clean(val);
    if (val === '') val = '—';
    return [clean(lab.textContent), unit && val !== '—' ? val + ' ' + unit : val];
  }

  /* Входные данные: поля и переключатели формы по порядку, подзаголовки из жирных заметок */
  function collectInputs(form) {
    var rows = [];
    if (!form) return rows;
    var walk = function (node) {
      Array.prototype.forEach.call(node.children, function (c) {
        if (!shown(c)) return;
        if (c.classList.contains('e-f')) {
          var r = fieldLine(c);
          if (r) rows.push(r);
        } else if (c.classList.contains('e-seg')) {
          var lg = c.querySelector('legend');
          var on = c.querySelector('input:checked');
          if (lg && on) {
            var sp = on.parentNode.querySelector('span');
            rows.push([clean(lg.textContent), clean(sp ? sp.textContent : on.value)]);
          }
        } else if (c.classList.contains('e-note') && c.children.length === 1 && c.firstElementChild.tagName === 'B' &&
                   clean(c.textContent) === clean(c.firstElementChild.textContent)) {
          rows.push(['#', clean(c.textContent)]);
        } else if (c.classList.contains('e-row') || c.tagName === 'DIV' || c.tagName === 'DETAILS') {
          walk(c);
        }
      });
    };
    walk(form);
    return rows;
  }

  function collectResults(out) {
    var rows = [], verdict = '';
    if (!out) return { rows: rows, verdict: verdict, filled: false };
    var filled = false;
    Array.prototype.forEach.call(out.querySelectorAll('.kv'), function (kv) {
      var k = kv.querySelector('span'), b = kv.querySelector('b');
      if (!k || !b) return;
      var v = clean(b.textContent);
      if (v && v !== '—') filled = true;
      rows.push([clean(k.textContent), v || '—']);
    });
    var vd = out.querySelector('.verdict');
    if (vd) verdict = clean(vd.textContent);
    return { rows: rows, verdict: verdict, filled: filled || verdict !== '' };
  }

  /* Таблицы и подписи к рисункам внутри панели (для разделов без блока «Результат») */
  function collectExtra(panel) {
    var rows = [];
    Array.prototype.forEach.call(panel.querySelectorAll('h4, table, figcaption, .e-sum'), function (el) {
      if (!shown(el)) return;
      if (el.tagName === 'H4') rows.push(['#', clean(el.textContent)]);
      else if (el.tagName === 'TABLE') {
        Array.prototype.forEach.call(el.rows, function (tr) {
          var cells = Array.prototype.map.call(tr.cells, function (c) { return clean(c.innerText || c.textContent); });
          rows.push(['|', cells.join(' | ')]);
        });
      } else {
        var t = clean(el.textContent);
        if (t) rows.push(['~', t]);
      }
    });
    return rows;
  }

  function build(ctx) {
    var panel = ctx.panel;
    var h = panel.querySelector('.e-sech h2, .e-sech h3');
    var page = document.querySelector('.e-head h1');
    var title = clean(h ? h.textContent : document.title);
    var lines = [];
    lines.push('ТЭГА ПЛЮС · tega.plus');
    lines.push((page ? clean(page.textContent) + ' · ' : '') + title);
    lines.push('Дата: ' + stamp());
    var url = location.href.split('#')[0] + (panel.id ? '#' + panel.id : '');
    lines.push('Страница: ' + url);
    var inputs = collectInputs(ctx.form);
    if (inputs.length) {
      lines.push('', 'ИСХОДНЫЕ ДАННЫЕ');
      inputs.forEach(function (r) { lines.push(r[0] === '#' ? '  ' + r[1] + ':' : '— ' + r[0] + ': ' + r[1]); });
    }
    var res = collectResults(ctx.out);
    if (res.rows.length || res.verdict) {
      lines.push('', 'РЕЗУЛЬТАТ');
      res.rows.forEach(function (r) { lines.push('— ' + r[0] + ': ' + r[1]); });
      if (res.verdict) lines.push('', 'Вывод: ' + res.verdict);
    }
    var extra = ctx.extra ? collectExtra(panel) : [];
    if (extra.length) {
      lines.push('');
      extra.forEach(function (r) {
        if (r[0] === '#') lines.push('', r[1].toUpperCase());
        else lines.push(r[0] === '|' ? r[1] : r[1]);
      });
    }
    lines.push('', NOTE);
    return { text: lines.join('\n'), filled: res.filled || extra.length > 0, title: title, inputs: inputs, res: res, extra: extra, url: url, date: stamp(), page: page ? clean(page.textContent) : '' };
  }

  function say(box, msg, bad) {
    var s = box.querySelector('.e-xp-s');
    if (!s) return;
    s.textContent = msg;
    s.className = 'e-xp-s' + (bad ? ' bad' : '');
    clearTimeout(box._t);
    box._t = setTimeout(function () { s.textContent = ''; }, 3200);
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (ok, fail) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.className = 'e-xp-ta';
        document.body.appendChild(ta);
        ta.select();
        var done = document.execCommand('copy');
        document.body.removeChild(ta);
        done ? ok() : fail(new Error('copy'));
      } catch (e) { fail(e); }
    });
  }

  function download(name, text) {
    var blob = new Blob(['﻿' + text], { type: 'text/plain;charset=utf-8' });
    var a = document.createElement('a');
    var u = URL.createObjectURL(blob);
    a.href = u;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(u); }, 1500);
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function printSheet(d) {
    var old = document.getElementById('e-print');
    if (old) old.parentNode.removeChild(old);
    var root = el('div');
    root.id = 'e-print';
    root.appendChild(el('div', 'xp-brand', 'ТЭГА ПЛЮС · tega.plus'));
    root.appendChild(el('h1', '', d.title));
    root.appendChild(el('p', 'xp-meta', (d.page ? d.page + ' · ' : '') + d.date));
    var table = function (head, rows) {
      if (!rows.length) return;
      root.appendChild(el('h2', '', head));
      var t = el('table');
      rows.forEach(function (r) {
        var tr = el('tr');
        if (r[0] === '#') { var th = el('th', '', r[1]); th.colSpan = 2; tr.appendChild(th); }
        else { tr.appendChild(el('td', '', r[0])); tr.appendChild(el('td', 'v', r[1])); }
        t.appendChild(tr);
      });
      root.appendChild(t);
    };
    table('Исходные данные', d.inputs);
    table('Результат', d.res.rows);
    if (d.res.verdict) root.appendChild(el('p', 'xp-verdict', d.res.verdict));
    if (d.extra.length) {
      var t2 = el('table');
      d.extra.forEach(function (r) {
        var tr = el('tr');
        if (r[0] === '#') { var th = el('th', '', r[1]); th.colSpan = 2; tr.appendChild(th); }
        else if (r[0] === '|') { var td = el('td', '', r[1]); td.colSpan = 2; tr.appendChild(td); }
        else { var td2 = el('td', '', r[1]); td2.colSpan = 2; tr.appendChild(td2); }
        t2.appendChild(tr);
      });
      root.appendChild(t2);
    }
    root.appendChild(el('p', 'xp-note', NOTE));
    document.body.appendChild(root);
    document.body.classList.add('e-printing');
    var end = function () {
      document.body.classList.remove('e-printing');
      if (root.parentNode) root.parentNode.removeChild(root);
      window.removeEventListener('afterprint', end);
    };
    window.addEventListener('afterprint', end);
    window.print();
    setTimeout(function () { if (document.body.classList.contains('e-printing') && !window.matchMedia('print').matches) end(); }, 1200);
  }

  function act(box, ctx, kind) {
    var d = build(ctx);
    if (!d.filled) { say(box, 'Сначала введите данные: результата пока нет.', true); return; }
    if (kind === 'copy') {
      copyText(d.text).then(function () { say(box, 'Скопировано в буфер обмена.'); },
        function () { say(box, 'Не удалось скопировать, используйте «Скачать .txt».', true); });
    } else if (kind === 'txt') {
      download('tega-' + (ctx.panel.id || 'raschet') + '-' + fileStamp() + '.txt', d.text);
      say(box, 'Файл сохранён.');
    } else {
      printSheet(d);
    }
  }

  function toolbar(ctx) {
    var box = el('div', 'e-xp');
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', 'Сохранить или скопировать результат');
    BUTTONS.forEach(function (b) {
      var btn = el('button', 'e-btn ghost sm', b[1]);
      btn.type = 'button';
      btn.addEventListener('click', function () { act(box, ctx, b[0]); });
      box.appendChild(btn);
    });
    var s = el('span', 'e-xp-s');
    s.setAttribute('role', 'status');
    box.appendChild(s);
    return box;
  }

  function init() {
    Array.prototype.forEach.call(document.querySelectorAll('.e-out'), function (out) {
      if (out.parentNode.querySelector('.e-xp')) return;
      var panel = out.closest('.e-panel, .ap-box');
      var calc = out.closest('.e-calc');
      if (!panel || !calc) return;
      var ctx = { panel: panel, out: out, form: calc.querySelector('.e-form'), extra: panel.hasAttribute('data-xtbl') };
      out.parentNode.insertBefore(toolbar(ctx), out.nextSibling);
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-xp]'), function (panel) {
      if (panel.querySelector(':scope > .e-xp')) return;
      var ctx = { panel: panel, out: null, form: null, extra: true };
      panel.appendChild(toolbar(ctx));
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
