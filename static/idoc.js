/* Заполняемые акты: выбор формы, поля ввода, живой бланк, печать и сохранение.
   Данные берутся из window.IDOC_DATA (static/idoc-data.js), логика бланка из window.TegaIdoc (static/idoc-core.js).
   Всё остаётся в браузере: на сервер ничего не отправляется. Черновик хранится только в этом браузере. */
(function () {
  'use strict';
  var D = window.IDOC_DATA, C = window.TegaIdoc;
  var root = document.getElementById('idoc');
  if (!D || !C || !root) return;

  var KEY = 'tega.idoc.v1';
  var pick = document.getElementById('idoc-form');
  var fieldsBox = document.getElementById('idoc-fields');
  var paperBox = document.getElementById('idoc-paper');
  var info = document.getElementById('idoc-info');
  var prog = document.getElementById('idoc-prog');
  var status = document.getElementById('idoc-status');
  var form = null, vals = {};
  var saveTimer = 0;

  function find(id) { for (var i = 0; i < D.forms.length; i++) if (D.forms[i].id === id) return D.forms[i]; return null; }

  function store(all) {
    try { if (all === undefined) return JSON.parse(localStorage.getItem(KEY) || '{}'); localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) { /* хранилище недоступно */ }
    return {};
  }
  function saveDraft() {
    var all = store();
    all[form.id] = vals;
    store(all);
  }
  function say(t) {
    status.textContent = t;
    clearTimeout(say.t);
    say.t = setTimeout(function () { status.textContent = ''; }, 2600);
  }

  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (text != null) n.textContent = text;
    return n;
  }

  function buildFields() {
    fieldsBox.textContent = '';
    C.fields(form).forEach(function (f, i) {
      var id = 'idf-' + f.key;
      var wrap = el('div', { 'class': 'idoc-f' });
      wrap.appendChild(el('label', { 'for': id }, f.label));
      var inp;
      if (f.type === 'area') inp = el('textarea', { rows: '2' });
      else if (f.type === 'date') inp = el('input', { type: 'date' });
      else if (f.type === 'choice') {
        inp = el('select');
        inp.appendChild(el('option', { value: '' }, '— не выбрано —'));
        f.opts.forEach(function (o) { var op = el('option', { value: o }, o); inp.appendChild(op); });
      } else inp = el('input', { type: 'text', autocomplete: 'off' });
      inp.id = id;
      inp.setAttribute('data-k', f.key);
      inp.value = vals[f.key] || '';
      var evt = f.type === 'choice' || f.type === 'date' ? 'change' : 'input';
      inp.addEventListener(evt, function () { vals[f.key] = inp.value; paint(); clearTimeout(saveTimer); saveTimer = setTimeout(saveDraft, 250); });
      wrap.appendChild(inp);
      fieldsBox.appendChild(wrap);
    });
  }

  function paint() {
    paperBox.innerHTML = C.renderHtml(form, vals);
    var p = C.progress(form, vals);
    prog.textContent = 'Заполнено полей: ' + p.filled + ' из ' + p.total;
  }

  function open(id, keepHash) {
    var f = find(id) || D.forms[0];
    form = f;
    vals = store()[f.id] || {};
    pick.value = f.id;
    info.textContent = '';
    info.appendChild(el('b', {}, f.source));
    info.appendChild(document.createTextNode('. ' + f.use));
    info.appendChild(el('br'));
    info.appendChild(document.createTextNode('Место в Перечне: ' + f.perechen + '.'));
    buildFields();
    paint();
    if (!keepHash) { try { history.replaceState(null, '', '#' + f.id); } catch (e) { /* ignore */ } }
  }

  /* ───────── сохранение ───────── */
  function fileName(ext) {
    var d = new Date();
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    return 'akt-' + form.id + '-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '.' + ext;
  }
  function plain() { return C.renderText(form, vals); }

  function copy() {
    var t = plain();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(function () { say('Текст скопирован'); }, function () { say('Не удалось скопировать: выделите текст вручную'); });
    } else say('Копирование недоступно в этом браузере');
  }
  function txt() {
    var blob = new Blob(['﻿' + plain()], { type: 'text/plain;charset=utf-8' });
    var a = el('a', { href: URL.createObjectURL(blob), download: fileName('txt') });
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    say('Файл .txt сохранён');
  }
  function print() {
    var old = document.getElementById('id-print');
    if (old) old.remove();
    var box = el('div', { id: 'id-print' });
    box.innerHTML = C.renderHtml(form, vals);
    document.body.appendChild(box);
    document.body.classList.add('id-printing');
    var end = function () {
      document.body.classList.remove('id-printing');
      box.remove();
      window.removeEventListener('afterprint', end);
    };
    window.addEventListener('afterprint', end);
    window.print();
    setTimeout(function () { if (document.body.classList.contains('id-printing') && !window.matchMedia('print').matches) end(); }, 1200);
  }
  function clearForm() {
    vals = {};
    var all = store();
    delete all[form.id];
    store(all);
    buildFields();
    paint();
    say('Поля очищены');
  }

  fieldsBox.addEventListener('submit', function (e) { e.preventDefault(); });
  pick.addEventListener('change', function () { open(pick.value); });
  document.getElementById('idoc-copy').addEventListener('click', copy);
  document.getElementById('idoc-txt').addEventListener('click', txt);
  document.getElementById('idoc-print').addEventListener('click', print);
  document.getElementById('idoc-clear').addEventListener('click', clearForm);
  window.addEventListener('hashchange', function () { var h = location.hash.slice(1); if (h && h !== form.id && find(h)) open(h, true); });

  open((location.hash || '').slice(1) || D.forms[0].id, !location.hash);
})();
