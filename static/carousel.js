/* Карусель на главной: свежие записи (новости, статьи, объекты) + чертёж как запасной слайд. */
(function () {
  var root = document.querySelector('[data-carousel]');
  if (!root) return;
  var lang = document.documentElement.lang || 'ru';
  var prefix = lang === 'ru' ? '' : '/' + lang;
  var L = {
    ru: { object: 'Объект', news: 'Новость', article: 'Статья', prev: 'Назад', next: 'Вперёд', go: 'Слайд ' },
    be: { object: 'Аб’ект', news: 'Навіна', article: 'Артыкул', prev: 'Назад', next: 'Далей', go: 'Слайд ' },
    en: { object: 'Project', news: 'News', article: 'Article', prev: 'Previous', next: 'Next', go: 'Slide ' }
  }[lang] || {};
  var track = root.querySelector('.car-track');
  var MAX = 5, INTERVAL = 6000;

  function get(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; });
  }
  function pick(v) { return v && typeof v === 'object' ? (v[lang] || v.ru || '') : (v || ''); }
  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  Promise.all([get('/static/data/feed.json'), get('/static/data/objects.json')]).then(function (res) {
    var items = [];
    (res[0] || []).forEach(function (n) {
      items.push({ kind: n.kind || 'news', title: pick(n.title), text: pick(n.summary), date: n.date || '', url: n.url || '#', image: n.image || '' });
    });
    (res[1] || []).forEach(function (o) {
      items.push({ kind: 'object', title: o.title, text: o.summary || '', date: o.year ? o.year + '-01-01' : '', url: prefix + '/portfolio', image: (o.photos || [])[0] || '' });
    });
    items = items.filter(function (i) { return i.title; })
      .sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); }).slice(0, MAX);
    if (!items.length) return; // остаётся статичный чертёж

    var fallback = track.querySelector('.car-slide');
    var html = items.map(function (i) {
      var img = i.image ? '<img src="' + esc(i.image) + '" alt="" loading="lazy" decoding="async">' : '<div class="car-ph"></div>';
      return '<a class="car-slide" href="' + esc(i.url) + '">' + img +
        '<span class="car-cap"><span class="car-kind">' + esc(L[i.kind] || i.kind) + '</span>' +
        '<b>' + esc(i.title) + '</b><span>' + esc(i.text.length > 110 ? i.text.slice(0, 107) + '…' : i.text) + '</span></span></a>';
    }).join('');
    track.insertAdjacentHTML('afterbegin', html);
    start(root, track);
  });

  function start(root, track) {
    var slides = track.querySelectorAll('.car-slide'), n = slides.length, cur = 0, timer = null;
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    root.classList.add('on');
    var dots = root.querySelector('.car-dots');
    dots.innerHTML = Array.prototype.map.call(slides, function (_, i) {
      return '<button type="button" aria-label="' + L.go + (i + 1) + '"></button>';
    }).join('');
    function show(i) {
      cur = (i + n) % n;
      track.style.transform = 'translateX(' + (-100 * cur) + '%)';
      Array.prototype.forEach.call(slides, function (s, k) { s.setAttribute('aria-hidden', k === cur ? 'false' : 'true'); s.tabIndex = k === cur ? 0 : -1; });
      Array.prototype.forEach.call(dots.children, function (d, k) { d.setAttribute('aria-current', k === cur ? 'true' : 'false'); });
    }
    function play() { if (!reduce) { stop(); timer = setInterval(function () { show(cur + 1); }, INTERVAL); } }
    function stop() { if (timer) clearInterval(timer); timer = null; }
    root.querySelector('.car-prev').addEventListener('click', function () { show(cur - 1); play(); });
    root.querySelector('.car-next').addEventListener('click', function () { show(cur + 1); play(); });
    dots.addEventListener('click', function (e) { var k = Array.prototype.indexOf.call(dots.children, e.target); if (k >= 0) { show(k); play(); } });
    root.addEventListener('mouseenter', stop); root.addEventListener('mouseleave', play);
    root.addEventListener('focusin', stop); root.addEventListener('focusout', play);
    var x0 = null;
    root.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; stop(); }, { passive: true });
    root.addEventListener('touchend', function (e) { if (x0 !== null) { var dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) show(cur + (dx < 0 ? 1 : -1)); } x0 = null; play(); });
    show(0); play();
  }
})();
