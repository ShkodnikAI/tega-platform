/* Ядро заполняемых актов: разбор описания формы, список полей, вывод бланка в HTML и в текст.
   Форма описана массивом блоков (см. tools/estimates/art_idoc.py), текст блока содержит поля вида
   [[ключ|подпись|пояснение под линией|ml]]  (ml — многострочное поле)
   [[?ключ|подпись|вариант1¦вариант2]]       («нужное подчеркнуть»: выбранный вариант подчёркивается)
   [[~ключ|подпись|вариант1¦вариант2]]       («ненужное зачеркнуть»: невыбранный вариант зачёркивается).
   Работает в браузере (window.TegaIdoc) и в Node (module.exports). Ничего не отправляет на сервер. */
(function (root) {
  'use strict';

  var MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  var SEP = '¦';
  var TOKEN = /\[\[([?~]?)([a-z0-9_]+)\|([^\]]*)\]\]/g;

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* Разбор строки блока на куски: текст и поля. */
  function parse(str) {
    var out = [], last = 0, m;
    TOKEN.lastIndex = 0;
    while ((m = TOKEN.exec(str))) {
      if (m.index > last) out.push({ t: 'txt', v: str.slice(last, m.index) });
      var p = m[3].split('|');
      if (m[1]) {
        out.push({ t: 'c', kind: m[1] === '?' ? 'u' : 's', key: m[2], label: p[0], opts: (p[1] || '').split(SEP) });
      } else {
        out.push({ t: 'f', key: m[2], label: p[0], cap: p[1] || '', ml: p[2] === 'ml' });
      }
      last = m.index + m[0].length;
    }
    if (last < str.length) out.push({ t: 'txt', v: str.slice(last) });
    return out;
  }

  function textsOf(block) {
    if (block.k === 'title') return block.lines;
    if (block.k === 'sign' || block.k === 'date') return [];
    return [block.text || ''];
  }

  /* Участники комиссии: form.parties = [{k,label,def}]; включены по умолчанию, кроме тех, у кого def=false.
     Состояние хранится в vals['_on_<k>'] ('1' / '0'). Блок с role и подпись с keys скрываются, если участник выключен. */
  function partyOn(form, vals, k) {
    var ps = form.parties || [];
    for (var i = 0; i < ps.length; i++) {
      if (ps[i].k !== k) continue;
      var v = (vals || {})['_on_' + k];
      if (v === '1') return true;
      if (v === '0') return false;
      return ps[i].def !== false;
    }
    return true;
  }
  function shown(form, vals) {
    return form.blocks.map(function (b) {
      if (b.role && !partyOn(form, vals, b.role)) return null;
      if (b.k === 'sign') {
        var keep = [], keys = [];
        b.roles.forEach(function (r, i) {
          var k = b.keys && b.keys[i];
          if (k && !partyOn(form, vals, k)) return;
          keep.push(r); keys.push(k);
        });
        if (!keep.length) return null;
        return { k: 'sign', dt: b.dt, roles: keep, keys: keys };
      }
      return b;
    }).filter(Boolean);
  }

  /* Список полей формы по порядку появления, без повторов по ключу. */
  function fields(form, vals) {
    var seen = {}, list = [];
    shown(form, vals).forEach(function (b) {
      if (b.k === 'date') {
        if (b.city && !seen._city) { seen._city = 1; list.push({ key: '_city', type: 'text', label: 'Населённый пункт' }); }
        if (!seen._date) { seen._date = 1; list.push({ key: '_date', type: 'date', label: b.label || 'Дата акта' }); }
        return;
      }
      if (b.k === 'tbl') {
        if (!seen[b.key]) { seen[b.key] = 1; list.push({ key: b.key, type: 'area', label: b.label, hint: 'Одна строка таблицы на строку ввода, колонки через «;»: ' + b.cols.join(' ; ') }); }
        return;
      }
      textsOf(b).forEach(function (s) {
        parse(s).forEach(function (x) {
          if (x.t === 'txt' || seen[x.key]) return;
          seen[x.key] = 1;
          if (x.t === 'f') list.push({ key: x.key, type: x.ml ? 'area' : 'text', label: x.label });
          else list.push({ key: x.key, type: 'choice', label: x.label, opts: x.opts });
        });
      });
    });
    return list;
  }

  /* Дата в виде «16» ноября 2026 г. Пустая дата даёт бланк «____» ________ 20__ г. */
  function dateParts(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!m) return null;
    var mo = parseInt(m[2], 10);
    if (mo < 1 || mo > 12) return null;
    return { d: m[3], mo: MONTHS[mo - 1], y: m[1] };
  }
  function dateHtml(iso) {
    var p = dateParts(iso);
    if (!p) return '«____» ______________ 20___ г.';
    return '«' + esc(p.d) + '» ' + esc(p.mo) + ' ' + esc(p.y) + ' г.';
  }
  function dateText(iso) {
    var p = dateParts(iso);
    if (!p) return '«____» ______________ 20___ г.';
    return '«' + p.d + '» ' + p.mo + ' ' + p.y + ' г.';
  }

  function fieldHtml(x, vals) {
    var v = String(vals[x.key] || '').trim();
    if (x.t === 'f') {
      return '<span class="fld' + (x.ml ? ' ml' : '') + (v ? '' : ' empty') + '"><span class="v">' + (v ? esc(v) : '&nbsp;') + '</span>' +
        (x.cap ? '<small>' + esc(x.cap) + '</small>' : '') + '</span>';
    }
    var cur = vals[x.key];
    var html = x.opts.map(function (o) {
      var on = cur === o;
      if (x.kind === 'u') return on ? '<u>' + esc(o) + '</u>' : esc(o);
      return cur && !on ? '<s>' + esc(o) + '</s>' : esc(o);
    });
    return '<span class="ch">' + html.join(x.kind === 'u' ? ' / ' : ' ') + '</span>';
  }
  function fieldText(x, vals) {
    var v = String(vals[x.key] || '').trim();
    if (x.t === 'f') return v || '__________';
    var cur = vals[x.key];
    if (x.kind === 'u') return cur || x.opts.join('/');
    return cur ? cur : x.opts.join(' ');
  }

  function inline(str, vals, asText) {
    return parse(str).map(function (x) {
      if (x.t === 'txt') return asText ? x.v : esc(x.v);
      return asText ? fieldText(x, vals) : fieldHtml(x, vals);
    }).join('');
  }

  /* Таблица формы: строки вводятся в одном поле, колонки разделяет «;». Пустые строки добавляются до минимума. */
  function tblRows(b, vals) {
    var rows = String((vals || {})[b.key] || '').split('\n').map(function (r) { return r.trim(); }).filter(Boolean)
      .map(function (r) { return r.split(';').map(function (c) { return c.trim(); }); });
    while (rows.length < (b.min || 5)) rows.push([]);
    return rows;
  }
  function tblHtml(b, vals) {
    var rows = tblRows(b, vals);
    return '<table class="idoc-mats"><thead><tr>' + b.cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr>' + b.cols.map(function (c, i) { return '<td><span class="hw">' + esc(r[i] || '') + '</span></td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
  }
  function tblText(b, vals) {
    return [b.cols.join('  |  ')].concat(tblRows(b, vals).map(function (r) { return b.cols.map(function (c, i) { return r[i] || '________'; }).join('  |  '); })).join('\n');
  }

  /* Перечень материалов и документов о качестве (список хранится в браузере, см. idoc.js). */
  function matsHtml(list) {
    list = list || [];
    var n = Math.max(8, list.length), rows = '';
    for (var i = 0; i < n; i++) {
      var m = list[i] || {};
      rows += '<tr><td class="n">' + (i + 1) + '</td><td><span class="hw">' + esc(m.name || '') + '</span></td><td><span class="hw">' + esc(m.doc || '') + '</span></td></tr>';
    }
    return '<table class="idoc-mats"><thead><tr><th>№</th><th>Наименование материала, изделия, конструкции</th><th>Документ о качестве: вид, номер, дата, изготовитель</th></tr></thead><tbody>' + rows + '</tbody></table>';
  }
  function matsText(list) {
    list = list || [];
    var n = Math.max(8, list.length), out = ['№  Наименование  —  Документ о качестве'];
    for (var i = 0; i < n; i++) {
      var m = list[i] || {};
      out.push((i + 1) + '.  ' + (m.name || '__________') + '  —  ' + (m.doc || '__________'));
    }
    return out.join('\n');
  }

  /* Бланк в HTML. */
  /* Титульный лист раздела: макет А4 с логотипом и реквизитами ООО «ТЭГА ПЛЮС» (данные с страницы «Контакты»). */
  var ORG = ['<b>ООО «ТЭГА ПЛЮС»</b>', '220059, г. Минск, ул. Шамякина, 9, пом. 1Н', 'тел. +375 17 347-11-09, факс +375 17 347-11-06',
    'tegabymi@gmail.com', 'УНП 190729589, ОКПО 376949605000', 'р/с BY65 UNBS 3012 0037 0500 4000 0933', 'ЗАО «БСБ Банк», BIC UNBSBY2X'];
  function renderTitle(form, vals) {
    var section = '', obj = '', dog = '', rows = [], dts = [];
    shown(form, vals).forEach(function (b) {
      if (b.k === 'title') { section = String(b.lines[1] || '').replace(/^Раздел:\s*/, ''); return; }
      if (b.k !== 'p' && b.k !== 'pc') return;
      var ps = parse(b.text), label = '', f = null;
      ps.forEach(function (x) { if (x.t === 'txt') label += x.v; else if (!f) f = x; });
      if (!f) return;
      label = label.trim();
      var fh = fieldHtml(f, vals);
      if (f.key === 'obj') obj = '<div class="tp-obj"><div class="tp-lb">' + esc(label) + '</div>' + fh + '</div>';
      else if (f.key === 'dog') dog = '<div class="tp-row"><div class="tp-lb">' + esc(label) + '</div>' + fh + '</div>';
      else if (f.key === 'd1' || f.key === 'd2') dts.push('<div><div class="tp-lb">' + esc(label) + '</div>' + fh + '</div>');
      else rows.push('<div class="tp-row"><div class="tp-lb">' + esc(label) + '</div>' + fh + '</div>');
    });
    var foot = '<div class="tp-foot"><span class="fld' + (vals._city ? '' : ' empty') + '"><span class="v">' + (vals._city ? esc(vals._city) : '&nbsp;') +
      '</span><small>населённый пункт</small></span><span class="idoc-date' + (dateParts(vals._date) ? ' hw' : '') + '">' + dateHtml(vals._date) + '</span></div>';
    return '<div class="idoc-paper idoc-tp"><div class="tp-in">' +
      '<div class="tp-head"><img src="/static/logo-ru.png" alt="ТЭГА ПЛЮС"><div class="tp-org">' + ORG.join('<br>') + '</div></div>' +
      '<div class="tp-bar"></div>' +
      '<div class="tp-ttl"><h1>ИСПОЛНИТЕЛЬНАЯ<br>ДОКУМЕНТАЦИЯ</h1><div class="s">Раздел</div><div class="n">' + esc(section) + '</div></div>' +
      '<div class="tp-body">' + obj + dog + rows.join('') + (dts.length ? '<div class="tp-dts">' + dts.join('') + '</div>' : '') + '</div>' +
      foot + '</div><div class="tp-strip"></div></div>';
  }

  function renderHtml(form, vals) {
    vals = vals || {};
    if (form.title === true) return renderTitle(form, vals);
    var out = ['<div class="idoc-paper">'];
    shown(form, vals).forEach(function (b) {
      switch (b.k) {
        case 'title':
          out.push('<div class="idoc-title">' + b.lines.map(function (l) { return '<div>' + inline(l, vals) + '</div>'; }).join('') + '</div>');
          break;
        case 'date':
          out.push('<div class="idoc-dateline">' + (b.city
            ? '<span class="fld' + (vals._city ? '' : ' empty') + '"><span class="v">' + (vals._city ? esc(vals._city) : '&nbsp;') + '</span><small>населённый пункт</small></span>'
            : '<span></span>') + '<span class="idoc-date' + (dateParts(vals._date) ? ' hw' : '') + '">' + dateHtml(vals._date) + '</span></div>');
          break;
        case 'h':
          out.push('<div class="idoc-h">' + esc(b.text) + '</div>');
          break;
        case 'mats':
          out.push(matsHtml(vals._mats));
          break;
        case 'tbl':
          out.push(tblHtml(b, vals));
          break;
        case 'li':
          out.push('<div class="idoc-li">— ' + inline(b.text, vals) + '</div>');
          break;
        case 'sign':
          out.push('<div class="idoc-signs">' + b.roles.map(function (r) {
            return '<div class="idoc-sign"><div class="r">' + esc(r) + '</div>' +
              (b.dt ? '<div class="l"><i></i><small>дата и время</small></div>' : '') +
              '<div class="l"><i></i><small>подпись</small></div><div class="l w"><i></i><small>' + (b.dt ? 'фамилия, инициалы' : 'расшифровка подписи') + '</small></div></div>';
          }).join('') + '</div>');
          break;
        default:
          out.push('<p class="idoc-p' + (b.k === 'pc' ? ' c' : '') + '">' + inline(b.text, vals) + '</p>');
      }
    });
    out.push('<div class="idoc-src">' + esc(form.source) + '</div></div>');
    return out.join('');
  }

  /* Бланк в простой текст. */
  function renderText(form, vals) {
    vals = vals || {};
    var out = [];
    shown(form, vals).forEach(function (b) {
      switch (b.k) {
        case 'title':
          out.push(b.lines.map(function (l) { return inline(l, vals, true); }).join('\n'));
          break;
        case 'date':
          out.push((b.city ? (vals._city || '____________') + '    ' : '') + dateText(vals._date));
          break;
        case 'h':
          out.push('\n' + b.text.toUpperCase());
          break;
        case 'mats':
          out.push(matsText(vals._mats));
          break;
        case 'tbl':
          out.push(tblText(b, vals));
          break;
        case 'li':
          out.push('— ' + inline(b.text, vals, true));
          break;
        case 'sign':
          out.push('\n' + b.roles.map(function (r) {
            return r + (b.dt ? '   ______ (дата и время)' : '') + '   ____________ (подпись)   ____________ (' + (b.dt ? 'фамилия, инициалы' : 'расшифровка подписи') + ')';
          }).join('\n'));
          break;
        default:
          out.push(inline(b.text, vals, true));
      }
    });
    out.push('\n[' + form.source + ']');
    return out.join('\n');
  }

  /* Сколько полей заполнено (для индикатора). */
  function progress(form, vals) {
    var fs = fields(form, vals), n = 0;
    fs.forEach(function (f) { if (String((vals || {})[f.key] || '').trim()) n++; });
    return { filled: n, total: fs.length };
  }

  var api = { parse: parse, fields: fields, partyOn: partyOn, renderHtml: renderHtml, renderText: renderText, progress: progress, dateText: dateText, MONTHS: MONTHS, SEP: SEP };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TegaIdoc = api;
})(typeof window !== 'undefined' ? window : this);
