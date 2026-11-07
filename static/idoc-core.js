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

  /* Список полей формы по порядку появления, без повторов по ключу. */
  function fields(form) {
    var seen = {}, list = [];
    form.blocks.forEach(function (b) {
      if (b.k === 'date') {
        if (b.city && !seen._city) { seen._city = 1; list.push({ key: '_city', type: 'text', label: 'Населённый пункт' }); }
        if (!seen._date) { seen._date = 1; list.push({ key: '_date', type: 'date', label: b.label || 'Дата акта' }); }
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

  /* Бланк в HTML. */
  function renderHtml(form, vals) {
    vals = vals || {};
    var out = ['<div class="idoc-paper">'];
    form.blocks.forEach(function (b) {
      switch (b.k) {
        case 'title':
          out.push('<div class="idoc-title">' + b.lines.map(function (l) { return '<div>' + inline(l, vals) + '</div>'; }).join('') + '</div>');
          break;
        case 'date':
          out.push('<div class="idoc-dateline">' + (b.city
            ? '<span class="fld' + (vals._city ? '' : ' empty') + '"><span class="v">' + (vals._city ? esc(vals._city) : '&nbsp;') + '</span><small>населённый пункт</small></span>'
            : '<span></span>') + '<span class="idoc-date">' + dateHtml(vals._date) + '</span></div>');
          break;
        case 'h':
          out.push('<div class="idoc-h">' + esc(b.text) + '</div>');
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
    form.blocks.forEach(function (b) {
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
    var fs = fields(form), n = 0;
    fs.forEach(function (f) { if (String((vals || {})[f.key] || '').trim()) n++; });
    return { filled: n, total: fs.length };
  }

  var api = { parse: parse, fields: fields, renderHtml: renderHtml, renderText: renderText, progress: progress, dateText: dateText, MONTHS: MONTHS, SEP: SEP };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TegaIdoc = api;
})(typeof window !== 'undefined' ? window : this);
