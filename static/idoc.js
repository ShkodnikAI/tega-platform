/* Заполняемые акты: выбор формы, поля ввода, живой бланк, печать и сохранение.
   Данные берутся из window.IDOC_DATA (static/idoc-data.js), логика бланка из window.TegaIdoc (static/idoc-core.js).
   Всё остаётся в браузере: на сервер ничего не отправляется. Черновик хранится только в этом браузере. */
(function () {
  'use strict';
  var D = window.IDOC_DATA, C = window.TegaIdoc;
  var root = document.getElementById('idoc');
  if (!D || !C || !root) return;

  var KEY = 'tega.idoc.v1';
  var PKEY = 'tega.idoc.profile.v1';   /* данные объекта и участники: вводятся один раз, подставляются во все акты */
  var MKEY = 'tega.idoc.mats.v1';      /* список материалов и документов о качестве */
  var SHARED = ['_city', 'mo', 'zakorg', 'obj', 'dog', 'zak', 'gp', 'smo', 'pod', 'sub', 'tn', 'an', 'ruk', 'lab', 'proj', 'pd'];
  var profile = {}, mats = [];
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
  function load(k, dflt) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? dflt : v; } catch (e) { return dflt; } }
  function put(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* хранилище недоступно */ } }
  profile = load(PKEY, {});
  mats = load(MKEY, []);
  if (!Array.isArray(mats)) mats = [];
  function view() { var v = {}; Object.keys(vals).forEach(function (k) { v[k] = vals[k]; }); v._mats = mats; return v; }
  function applyProfile() {
    SHARED.forEach(function (k) { if (vals[k] === undefined && profile[k]) vals[k] = profile[k]; });
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

  /* Кто входит в комиссию и подписывает акт: выключенные участники исчезают из бланка, полей и подписей. */
  var partiesBox = document.getElementById('idoc-parties');
  function buildParties() {
    partiesBox.textContent = '';
    var ps = form.parties || [];
    partiesBox.hidden = !ps.length;
    if (!ps.length) return;
    partiesBox.appendChild(el('b', {}, form.ptitle || 'Кто входит в комиссию и подписывает акт'));
    ps.forEach(function (pt) {
      var lab = el('label');
      var cb = el('input', { type: 'checkbox' });
      cb.checked = C.partyOn(form, vals, pt.k);
      cb.addEventListener('change', function () {
        vals['_on_' + pt.k] = cb.checked ? '1' : '0';
        buildFields();
        paint();
        clearTimeout(saveTimer);
        saveTimer = setTimeout(saveDraft, 250);
      });
      lab.appendChild(cb);
      lab.appendChild(document.createTextNode(pt.label));
      partiesBox.appendChild(lab);
    });
    partiesBox.appendChild(el('small', {}, form.phint || 'Снятая галочка убирает строку комиссии и подпись из акта. Состав комиссии определяют договор и проект.'));
  }

  /* Память: данные объекта и перечень материалов. */
  var memBox = document.getElementById('idoc-mem');
  function buildMem() {
    memBox.textContent = '';
    memBox.appendChild(el('b', {}, 'Запоминается в этом браузере'));
    memBox.appendChild(el('small', {}, 'Объект, организации и фамилии подписантов вводятся один раз и подставляются во все акты. На сервер ничего не отправляется.'));
    var forget = el('button', { type: 'button', 'class': 'idoc-mini' }, 'Забыть данные объекта');
    forget.addEventListener('click', function () {
      profile = {}; put(PKEY, profile);
      SHARED.forEach(function (k) { vals[k] = ''; });
      buildFields(); paint(); saveDraft(); say('Данные объекта удалены из браузера');
    });
    memBox.appendChild(forget);
    var det = el('details', { 'class': 'idoc-matsbox' });
    if (form && form.id === 'mat-list') det.open = true;
    det.appendChild(el('summary', {}, 'Материалы и сертификаты (' + mats.length + ')'));
    var list = el('div', { 'class': 'idoc-matlist' });
    mats.forEach(function (m, i) {
      var row = el('div', { 'class': 'idoc-matrow' });
      row.appendChild(el('span', {}, (i + 1) + '. ' + m.name + (m.doc ? ' — ' + m.doc : '')));
      var del = el('button', { type: 'button', 'class': 'idoc-x', 'aria-label': 'Удалить материал ' + (i + 1) }, '×');
      del.addEventListener('click', function () { mats.splice(i, 1); put(MKEY, mats); buildMem(); paint(); });
      row.appendChild(del);
      list.appendChild(row);
    });
    det.appendChild(list);
    var n = el('input', { type: 'text', placeholder: 'Материал, изделие', 'aria-label': 'Наименование материала', autocomplete: 'off' });
    var d = el('input', { type: 'text', placeholder: 'Сертификат или паспорт: номер, дата, изготовитель', 'aria-label': 'Документ о качестве', autocomplete: 'off' });
    var add = el('button', { type: 'button', 'class': 'idoc-mini' }, 'Добавить в перечень');
    add.addEventListener('click', function () {
      if (!n.value.trim()) { say('Введите наименование материала'); return; }
      mats.push({ name: n.value.trim(), doc: d.value.trim() }); put(MKEY, mats); buildMem(); paint();
      det.open = true;
    });
    det.appendChild(n); det.appendChild(d); det.appendChild(add);
    memBox.appendChild(det);
  }

  /* Почерк и цвет чернил: выбор запоминается в браузере и применяется к бланку и к печати. */
  var SKEY = 'tega.idoc.style.v1';
  var HANDS = [
    { id: 'bad', name: 'Bad Script', fam: "'Bad Script'", s: 1 },
    { id: 'marck', name: 'Marck Script', fam: "'Marck Script'", s: 1.05 },
    { id: 'caveat', name: 'Caveat', fam: "'Caveat'", s: 1.3 },
    { id: 'neucha', name: 'Neucha', fam: "'Neucha'", s: 1.05 },
    { id: 'pangolin', name: 'Pangolin', fam: "'Pangolin'", s: 0.95 },
    { id: 'nunito', name: 'Nunito (шрифт сайта)', fam: "'Nunito'", s: 0.9 },
    { id: 'plex', name: 'IBM Plex Mono (шрифт сайта)', fam: "'IBM Plex Mono'", s: 0.82 }
  ];
  var INKS = [
    { c: '#16358a', n: 'Синие' }, { c: '#14161a', n: 'Чёрные' }, { c: '#4b2a85', n: 'Фиолетовые' }, { c: '#e3000f', n: 'Красные (фирменный цвет)' }
  ];
  var style = load(SKEY, { font: 'bad', ink: '#16358a' });
  function hand() { for (var i = 0; i < HANDS.length; i++) if (HANDS[i].id === style.font) return HANDS[i]; return HANDS[0]; }
  function applyStyle() {
    var h = hand(), s = document.documentElement.style;
    s.setProperty('--idoc-hand', h.fam);
    s.setProperty('--idoc-hs', String(h.s));
    s.setProperty('--idoc-ink', /^#[0-9a-f]{6}$/i.test(style.ink) ? style.ink : '#16358a');
  }
  function saveStyle() { try { localStorage.setItem(SKEY, JSON.stringify(style)); } catch (e) { /* хранилище недоступно */ } applyStyle(); }
  var styleBox = document.getElementById('idoc-style');
  function buildStyle() {
    styleBox.textContent = '';
    styleBox.appendChild(el('b', {}, 'Почерк и цвет чернил'));
    var sel = el('select', { id: 'idoc-hand', 'aria-label': 'Шрифт заполнения' });
    HANDS.forEach(function (h) { var o = el('option', { value: h.id }, h.name); if (h.id === style.font) o.selected = true; sel.appendChild(o); });
    sel.addEventListener('change', function () { style.font = sel.value; saveStyle(); });
    styleBox.appendChild(sel);
    var ink = el('div', { 'class': 'idoc-ink' });
    INKS.forEach(function (k) {
      var b = el('button', { type: 'button', title: k.n, 'aria-label': k.n, 'aria-pressed': String(style.ink.toLowerCase() === k.c) });
      b.style.backgroundColor = k.c;
      b.addEventListener('click', function () { style.ink = k.c; saveStyle(); buildStyle(); });
      ink.appendChild(b);
    });
    var pickc = el('input', { type: 'color', value: style.ink, 'aria-label': 'Свой цвет чернил' });
    pickc.addEventListener('input', function () { style.ink = pickc.value; saveStyle(); });
    pickc.addEventListener('change', buildStyle);
    ink.appendChild(pickc);
    ink.appendChild(el('label', {}, 'свой цвет'));
    styleBox.appendChild(ink);
    styleBox.appendChild(el('div', { 'class': 'idoc-sample' }, 'Будович Мастак Якаснавич, 12.05.2026'));
  }
  applyStyle();

  function buildFields() {
    fieldsBox.textContent = '';
    C.fields(form, vals).forEach(function (f, i) {
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
      inp.addEventListener(evt, function () { vals[f.key] = inp.value; if (SHARED.indexOf(f.key) >= 0) { profile[f.key] = inp.value; put(PKEY, profile); } paint(); clearTimeout(saveTimer); saveTimer = setTimeout(saveDraft, 250); });
      wrap.appendChild(inp);
      if (f.hint) wrap.appendChild(el('small', { 'class': 'idoc-hint' }, f.hint));
      if (f.key === 'mat') {
        var fill = el('button', { type: 'button', 'class': 'idoc-mini' }, 'Подставить из перечня материалов');
        fill.addEventListener('click', function () {
          if (!mats.length) { say('Перечень материалов пуст: добавьте материалы ниже, в блоке «Материалы и сертификаты»'); return; }
          vals.mat = mats.map(function (m) { return m.name + (m.doc ? ' (' + m.doc + ')' : ''); }).join('; ');
          inp.value = vals.mat; paint(); saveDraft();
        });
        wrap.appendChild(fill);
      }
      fieldsBox.appendChild(wrap);
    });
  }

  function paint() {
    paperBox.innerHTML = C.renderHtml(form, view());
    var p = C.progress(form, vals);
    prog.textContent = 'Заполнено полей: ' + p.filled + ' из ' + p.total;
  }

  function open(id, keepHash) {
    var f = find(id) || D.forms[0];
    form = f;
    vals = store()[f.id] || {};
    applyProfile();
    pick.value = f.id;
    info.textContent = '';
    info.appendChild(el('b', {}, f.source));
    info.appendChild(document.createTextNode('. ' + f.use));
    info.appendChild(el('br'));
    info.appendChild(document.createTextNode('Место в Перечне: ' + f.perechen + '.'));
    buildParties();
    buildMem();
    buildFields();
    paint();
    if (!keepHash) { try { history.replaceState(null, '', '#' + f.id); } catch (e) { /* ignore */ } }
  }

  /* ───────── сохранение ───────── */
  /* Имя файла: раздел — акт — дата (дата акта, а если её нет, сегодняшняя). */
  function baseName() {
    var d = new Date();
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    var date = /^\d{4}-\d{2}-\d{2}$/.test(vals._date || '') ? vals._date : d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    var sec = '';
    D.groups.forEach(function (g) { if (g.id === form.group) sec = g.section || g.name; });
    var name = [sec, form.short, date].filter(Boolean).join(' - ');
    return name.replace(/[\\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150);
  }
  function fileName(ext) { return baseName() + '.' + ext; }
  function plain() { return C.renderText(form, view()); }

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
    box.innerHTML = C.renderHtml(form, view());
    document.body.appendChild(box);
    document.body.classList.add('id-printing');
    var oldTitle = document.title;
    document.title = baseName();   /* браузер предлагает это имя при сохранении в PDF */
    var end = function () {
      document.title = oldTitle;
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
    buildParties();
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

  buildStyle();
  open((location.hash || '').slice(1) || D.forms[0].id, !location.hash);
})();
