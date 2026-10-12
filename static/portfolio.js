/* Portfolio map: markers, search, type filter, object card. No dependencies except Leaflet. */
(function () {
  var mapEl = document.getElementById('map');
  if (!mapEl || !window.L) return;

  var listEl = document.getElementById('obj-list');
  var qEl = document.getElementById('obj-q');
  var typeEl = document.getElementById('obj-type');
  var countEl = document.getElementById('obj-count');
  var cardEl = document.getElementById('obj-card');

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
  function norm(s) { return String(s == null ? '' : s).toLowerCase().replace(/ё/g, 'е'); }
  function safeSrc(u) { return typeof u === 'string' && (u.indexOf('/static/') === 0 || u.indexOf('/media/') === 0 || u.indexOf('https://') === 0); }
  function meta(o) {
    var p = [];
    if (o.type) p.push(o.type);
    if (o.year) p.push(o.year);
    if (o.area_m2) p.push(o.area_m2 + ' м²');
    if (o.city) p.push(o.city);
    return p.join(' · ');
  }

  function showCard(o, fly) {
    cardEl.textContent = '';
    cardEl.appendChild(el('h3', null, o.title));
    cardEl.appendChild(el('p', 'muted', meta(o)));
    if (o.place) cardEl.appendChild(el('p', null, o.place));
    if (o.summary) cardEl.appendChild(el('p', null, o.summary));
    (o.photos || []).filter(safeSrc).forEach(function (u) {
      var img = el('img'); img.src = u; img.alt = o.title; img.loading = 'lazy';
      cardEl.appendChild(img);
    });
    cardEl.hidden = false;
    if (history.replaceState) history.replaceState(null, '', '#' + encodeURIComponent(o.id));
    if (fly && isFinite(o.lat) && isFinite(o.lng)) map.flyTo([o.lat, o.lng], Math.max(map.getZoom(), 12));
    var m = markers[o.id]; if (m) m.openPopup();
  }

  function popup(o) {
    var box = el('div', 'pop');
    box.appendChild(el('b', null, o.title));
    box.appendChild(el('div', 'muted', meta(o)));
    var a = el('a', 'btn-sm', 'Подробнее'); a.href = '#' + encodeURIComponent(o.id);
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
    layer.clearLayers(); markers = {}; listEl.textContent = '';
    var pts = [];
    shown.forEach(function (o) {
      if (isFinite(o.lat) && isFinite(o.lng)) {
        var m = L.marker([o.lat, o.lng], { icon: pin, title: o.title, keyboard: true }).bindPopup(function () { return popup(o); });
        m.on('click', function () { showCard(o, false); });
        m.addTo(layer); markers[o.id] = m; pts.push([o.lat, o.lng]);
      }
      var li = el('li'); var b = el('button', 'row');
      b.type = 'button';
      b.appendChild(el('b', null, o.title)); b.appendChild(el('span', 'muted', meta(o)));
      b.addEventListener('click', function () { showCard(o, true); });
      li.appendChild(b); listEl.appendChild(li);
    });
    countEl.textContent = items.length ? ('Найдено: ' + shown.length + ' из ' + items.length) : '';
    if (pts.length) map.fitBounds(pts, { padding: [40, 40], maxZoom: 12 });
  }

  function init(data) {
    items = (Array.isArray(data) ? data : []).filter(function (o) { return o && o.id && o.title; });
    if (!items.length) {
      countEl.textContent = 'Объекты скоро появятся на карте.';
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
    items.forEach(function (o) { if (o.id === id) showCard(o, true); });
  }

  fetch('/static/data/objects.json', { cache: 'no-cache' })
    .then(function (r) { return r.json(); })
    .then(init)
    .catch(function () { countEl.textContent = 'Не удалось загрузить список объектов.'; });
})();
