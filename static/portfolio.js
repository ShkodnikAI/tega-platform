/* Portfolio map: markers, search, type filter, object card. No dependencies except Leaflet. */
(function () {
  var mapEl = document.getElementById('map');
  if (!mapEl || !window.L) return;

  var listEl = document.getElementById('obj-list');
  var qEl = document.getElementById('obj-q');
  var typeEl = document.getElementById('obj-type');
  var countEl = document.getElementById('obj-count');
  var cardEl = document.getElementById('obj-card');
  var gridEl = document.getElementById('obj-grid');
  var dlg = document.getElementById('obj-dialog');
  var dlgBody = document.getElementById('obj-dialog-body');

  var map = L.map(mapEl, { scrollWheelZoom: false }).setView([53.7, 27.9], 7);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
  var layer = L.layerGroup().addTo(map);
  var pin = L.divIcon({ className: 'pin', iconSize: [22, 22], iconAnchor: [11, 11], popupAnchor: [0, -10] });

  var items = [], markers = {};

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  var LANG = (document.documentElement.lang || 'ru').slice(0, 2);
  var S = {
    ru: { sqm: 'м²', more: 'Подробнее', found: 'Найдено: ', of: ' из ', soon: 'Объекты скоро появятся на карте.', fail: 'Не удалось загрузить список объектов.' },
    be: { sqm: 'м²', more: 'Падрабязней', found: 'Знойдзена: ', of: ' з ', soon: 'Аб\u2019екты хутка з\u2019явяцца на карце.', fail: 'Не ўдалося загрузіць спіс аб\u2019ектаў.' },
    en: { sqm: 'm\u00b2', more: 'Details', found: 'Found: ', of: ' of ', soon: 'Projects will appear on the map soon.', fail: 'Could not load the list of projects.' }
  };
  var T = S[LANG] || S.ru;
  // Per-language fields: title_be / title_en etc. fall back to the Russian base field.
  function localize(o) {
    var r = {};
    Object.keys(o).forEach(function (k) { r[k] = o[k]; });
    ['title', 'type', 'city', 'place', 'summary'].forEach(function (f) {
      var v = o[f + '_' + LANG];
      if (typeof v === 'string' && v) r[f] = v;
    });
    return r;
  }
  function norm(s) { return String(s == null ? '' : s).toLowerCase().replace(/ё/g, 'е'); }
  function safeSrc(u) { return typeof u === 'string' && (u.indexOf('/static/') === 0 || u.indexOf('/media/') === 0 || u.indexOf('https://') === 0); }
  function meta(o) {
    var p = [];
    if (o.type) p.push(o.type);
    if (o.year) p.push(o.year);
    if (o.area_m2) p.push(o.area_m2 + ' ' + T.sqm);
    if (o.city) p.push(o.city);
    return p.join(' · ');
  }

  function fill(box, o) {
    box.textContent = '';
    box.appendChild(el('h3', null, o.title));
    box.appendChild(el('p', 'muted', meta(o)));
    if (o.place) box.appendChild(el('p', null, o.place));
    if (o.summary) box.appendChild(el('p', null, o.summary));
    (o.photos || []).filter(safeSrc).forEach(function (u) {
      var img = el('img'); img.src = u; img.alt = o.title; img.loading = 'lazy';
      box.appendChild(img);
    });
  }

  function openDialog(o) {
    if (!dlg || !dlg.showModal) { showCard(o, true); return; }
    fill(dlgBody, o);
    if (!dlg.open) dlg.showModal();
    if (history.replaceState) history.replaceState(null, '', '#' + encodeURIComponent(o.id));
  }

  function gridCard(o) {
    var b = el('button', 'pcard'); b.type = 'button';
    var cover = (o.photos || []).filter(safeSrc)[0];
    var ph = el('div', 'pimg');
    if (cover) {
      var th = cover.replace(/\/([^\/]+)\.webp$/, '/$1.thumb.webp');
      var img = el('img'); img.src = th; img.alt = o.title; img.loading = 'lazy';
      img.onerror = function () { img.onerror = null; img.src = cover; };
      ph.appendChild(img);
    } else {
      ph.className = 'pimg empty';
      ph.appendChild(el('span', null, o.type || ''));
    }
    b.appendChild(ph);
    var body = el('div', 'pbody');
    body.appendChild(el('b', null, o.title));
    body.appendChild(el('span', 'muted', meta(o)));
    b.appendChild(body);
    b.addEventListener('click', function () { openDialog(o); });
    return b;
  }

  function showCard(o, fly) {
    fill(cardEl, o);
    cardEl.hidden = false;
    if (history.replaceState) history.replaceState(null, '', '#' + encodeURIComponent(o.id));
    if (fly && isFinite(o.lat) && isFinite(o.lng)) map.flyTo([o.lat, o.lng], Math.max(map.getZoom(), 12));
    var m = markers[o.id]; if (m) m.openPopup();
  }

  function popup(o) {
    var box = el('div', 'pop');
    box.appendChild(el('b', null, o.title));
    box.appendChild(el('div', 'muted', meta(o)));
    var a = el('a', 'btn-sm', T.more); a.href = '#' + encodeURIComponent(o.id);
    a.addEventListener('click', function (e) { e.preventDefault(); showCard(o, false); });
    box.appendChild(a);
    return box;
  }

  function render() {
    var q = norm(qEl.value).trim(), t = typeEl.value;
    var shown = items.filter(function (o) {
      if (t && o.type !== t) return false;
      if (!q) return true;
      return norm([o.title, o.type, o.city, o.place, o.summary].join(' ')).indexOf(q) !== -1;
    });
    layer.clearLayers(); markers = {}; listEl.textContent = ''; gridEl.textContent = '';
    var pts = [];
    shown.forEach(function (o) {
      if (isFinite(o.lat) && isFinite(o.lng)) {
        var m = L.marker([o.lat, o.lng], { icon: pin, title: o.title, keyboard: true }).bindPopup(function () { return popup(o); });
        m.on('click', function () { showCard(o, false); });
        m.addTo(layer); markers[o.id] = m; pts.push([o.lat, o.lng]);
      }
      gridEl.appendChild(gridCard(o));
      var li = el('li'); var b = el('button', 'row');
      b.type = 'button';
      b.appendChild(el('b', null, o.title)); b.appendChild(el('span', 'muted', meta(o)));
      b.addEventListener('click', function () { showCard(o, true); });
      li.appendChild(b); listEl.appendChild(li);
    });
    countEl.textContent = items.length ? (T.found + shown.length + T.of + items.length) : '';
    if (pts.length) map.fitBounds(pts, { padding: [40, 40], maxZoom: 12 });
  }

  function init(data) {
    items = (Array.isArray(data) ? data : []).filter(function (o) { return o && o.id && o.title; }).map(localize);
    if (!items.length) {
      countEl.textContent = T.soon;
      return;
    }
    var types = {};
    items.forEach(function (o) { if (o.type) types[o.type] = 1; });
    Object.keys(types).sort().forEach(function (t) {
      var op = el('option', null, t); op.value = t; typeEl.appendChild(op);
    });
    qEl.addEventListener('input', render);
    typeEl.addEventListener('change', render);
    render();
    openFromHash();
    window.addEventListener('hashchange', openFromHash);
  }

  function openFromHash() {
    var id = decodeURIComponent((location.hash || '').slice(1));
    items.forEach(function (o) { if (o.id === id) openDialog(o); });
  }

  if (dlg) {
    dlg.querySelector('.pclose').addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('close', function () { if (history.replaceState) history.replaceState(null, '', location.pathname); });
  }

  fetch('/static/data/objects.json', { cache: 'no-cache' })
    .then(function (r) { return r.json(); })
    .then(init)
    .catch(function () { countEl.textContent = T.fail; });
})();
