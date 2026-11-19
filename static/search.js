/* Поиск по сайту: читает /static/search-index.json (строится tools/estimates/search_index.py
   из реального текста страниц), ищет по названию и тексту, показывает выпадающий список.
   Поиск сейчас только на русском контенте (большинство статей RU_ONLY). */
(function (root) {
  'use strict';

  function norm(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* Разбивает запрос на слова (минимум 2 символа), ищет каждое как подстроку в заголовке
     (вес 3) или в тексте (вес 1); запись должна содержать все слова хотя бы где-то. */
  function searchIndex(entries, query, limit) {
    var words = norm(query).split(' ').filter(function (w) { return w.length >= 2; });
    if (!words.length) return [];
    var scored = [];
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      var title = norm(e.title), text = norm(e.text);
      var score = 0, ok = true;
      for (var j = 0; j < words.length; j++) {
        var w = words[j];
        var inTitle = title.indexOf(w) >= 0;
        var inText = !inTitle && text.indexOf(w) >= 0;
        if (!inTitle && !inText) { ok = false; break; }
        score += inTitle ? 3 : 1;
        if (title.indexOf(' ' + w) === 0 || title.indexOf(w) === 0) score += 1; /* совпадение с начала слова/заголовка */
      }
      if (ok) scored.push({ entry: e, score: score });
    }
    scored.sort(function (a, b) { return b.score - a.score; });
    return scored.slice(0, limit || 8).map(function (s) { return s.entry; });
  }

  var api = { searchIndex: searchIndex, norm: norm };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.TegaSearch = api;
})(typeof window !== 'undefined' ? window : this);

(function () {
  'use strict';
  if (typeof window === 'undefined') return;
  var S = window.TegaSearch;

  function $(id) { return document.getElementById(id); }
  function clearNode(n) { while (n.firstChild) n.removeChild(n.firstChild); }

  function init() {
    var wrap = $('site-search'); if (!wrap) return;
    var input = $('site-search-q');
    var list = $('site-search-results');
    if (!input || !list) return;
    var entries = null, loading = null, active = -1;

    function load() {
      if (entries || loading) return loading;
      loading = fetch('/static/search-index.json').then(function (r) { return r.json(); }).then(function (d) {
        entries = d; return d;
      }).catch(function () { entries = []; return entries; });
      return loading;
    }

    function close() {
      clearNode(list); list.hidden = true; input.setAttribute('aria-expanded', 'false'); active = -1;
    }

    function render(results) {
      clearNode(list);
      if (!results.length) {
        var li = document.createElement('li'); li.className = 'empty'; li.textContent = 'Ничего не найдено';
        list.appendChild(li); list.hidden = false; input.setAttribute('aria-expanded', 'true');
        return;
      }
      results.forEach(function (e, i) {
        var li = document.createElement('li'); li.setAttribute('role', 'option'); li.id = 'site-search-opt-' + i;
        var a = document.createElement('a'); a.href = e.url; a.textContent = e.title;
        li.appendChild(a); list.appendChild(li);
      });
      list.hidden = false; input.setAttribute('aria-expanded', 'true');
    }

    function run() {
      var q = input.value;
      if (norm0(q).length < 2) { close(); return; }
      load().then(function (d) {
        render(S.searchIndex(d, q, 8));
      });
    }
    function norm0(s) { return String(s || '').trim(); }

    var t = null;
    input.addEventListener('focus', load);
    input.addEventListener('input', function () {
      if (t) clearTimeout(t);
      t = setTimeout(run, 150);
    });
    input.addEventListener('keydown', function (ev) {
      var items = list.querySelectorAll('li[role="option"]');
      if (ev.key === 'Escape') { close(); return; }
      if (!items.length) return;
      if (ev.key === 'ArrowDown') { ev.preventDefault(); active = Math.min(active + 1, items.length - 1); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); active = Math.max(active - 1, 0); }
      else if (ev.key === 'Enter') {
        if (active >= 0 && items[active]) { var a = items[active].querySelector('a'); if (a) { location.href = a.href; } }
        return;
      } else return;
      Array.prototype.forEach.call(items, function (li, i) { li.classList.toggle('on', i === active); });
      input.setAttribute('aria-activedescendant', items[active] ? items[active].id : '');
    });
    document.addEventListener('click', function (ev) {
      if (!wrap.contains(ev.target)) close();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
