/* Запрос для ИИ-агента: по данным расчёта собирает структурированный запрос на подбор материалов и оборудования
   в трёх категориях (эконом, стандарт, премиум) для выбранного региона. Калькулятор передаёт описание через TegaAI.update(spec).
   spec: { title, object: [[название, значение]], items: [{ name, qty, req }], notes: [строки ограничений] }.
   Работает и в браузере (window.TegaAI), и в Node (module.exports) для проверки. */
(function (root) {
  'use strict';

  var TIERS = {
    eco: { name: 'Эконом', text: 'минимально достаточное и безопасное решение: без лишних функций, но с подтверждённым соответствием требованиям расчёта' },
    std: { name: 'Стандарт', text: 'оптимальное соотношение цены и качества: проверенные серийные модели с хорошей репутацией и доступным сервисом' },
    prem: { name: 'Премиум', text: 'лучшее по качеству, долговечности, сервису и комфорту: допустимы дорогие решения, если они дают измеримое преимущество' }
  };
  var CRIT = {
    rating: 'высокий рейтинг (не ниже 4,5 из 5) при достаточном числе отзывов, не менее нескольких десятков; учитывайте накрутку и однотипные отзывы',
    reviews: 'реальные отзывы владельцев об эксплуатации не менее года: поломки, сервис, расходники',
    stock: 'наличие в регионе: склад, срок поставки, возможность гарантийного обслуживания и запчастей',
    warranty: 'гарантия производителя и условия гарантийного ремонта в регионе',
    cert: 'подтверждение соответствия (маркировка соответствия, декларации, паспорт и инструкция на русском языке)',
    safety: 'безопасность в условиях применения: температурные пределы, влагозащита, пожарные характеристики по паспорту',
    energy: 'энергоэффективность и стоимость владения: расход, ресурс, цена расходников'
  };
  var SHOP = { region: 'магазины и поставщики выбранного региона (с возможностью самовывоза или доставки по региону)', online: 'интернет-магазины с доставкой в выбранный регион', any: 'любые источники, главное чтобы покупка и доставка в регион были реальны' };

  function lines(arr) { return arr.filter(function (x) { return x !== null && x !== undefined; }).join('\n'); }

  function build(spec, o) {
    o = o || {};
    var tiers = (o.tiers && o.tiers.length ? o.tiers : ['eco', 'std', 'prem']);
    var crit = (o.crit || []).filter(function (k) { return CRIT[k]; });
    var place = [o.country, o.city].filter(Boolean).join(', ') || 'не указан';
    var out = [];
    out.push('# Задача');
    out.push('Ты опытный инженер-комплектатор и аналитик рынка. Подбери материалы и оборудование для объекта «' + spec.title + '» строго по техническим данным ниже. '
      + 'Количества и требования получены из инженерного расчёта, это ориентир для подбора, а не проект. Не меняй их без объяснения.');
    out.push('');
    out.push('# Объект');
    (spec.object || []).forEach(function (p) { out.push(p[0] === '#' ? '## ' + p[1] : '- ' + p[0] + ': ' + p[1]); });
    out.push('');
    out.push('# Что подобрать');
    (spec.items || []).forEach(function (it, i) {
      out.push((i + 1) + '. ' + it.name + (it.qty ? ' — ' + String(it.qty).replace(/\.$/, '') : '') + (it.req ? '. Требования: ' + it.req : ''));
    });
    if (spec.notes && spec.notes.length) {
      out.push('');
      out.push('# Ограничения безопасности из расчёта (обязательны)');
      spec.notes.forEach(function (n) { out.push('- ' + n); });
    }
    out.push('');
    out.push('# Регион и условия покупки');
    out.push('- Регион: ' + place + '.');
    out.push('- Где покупать: ' + (SHOP[o.shop] || SHOP.region) + '.');
    out.push('- Валюта цен: ' + (o.currency || 'BYN') + '. Цены бери только из реальных предложений региона и указывай дату и источник.');
    out.push('');
    out.push('# Ценовые категории');
    out.push('Для каждой позиции предложи по одному-двум вариантам в каждой категории:');
    tiers.forEach(function (k) { out.push('- ' + TIERS[k].name + ': ' + TIERS[k].text + '.'); });
    if (o.budget) out.push('Ориентир общего бюджета на комплект: ' + o.budget + '. Если он нереалистичен для какой-то категории, так и напиши.');
    if (crit.length) {
      out.push('');
      out.push('# Критерии выбора, в порядке важности');
      crit.forEach(function (k, i) { out.push((i + 1) + '. ' + CRIT[k] + '.'); });
    }
    out.push('');
    out.push('# Правила достоверности');
    out.push('- Не выдумывай модели, характеристики, цены и рейтинги. Если данных нет, пиши «нет данных».');
    out.push('- К каждому варианту дай ссылку на страницу товара или каталог и укажи источник рейтинга (какой магазин или сервис, сколько отзывов, на какую дату).');
    out.push('- Характеристики сверяй с паспортом производителя, а не с рекламным описанием. Отдельно отмечай то, что не подтверждено.');
    out.push('- Проверь совместимость позиций между собой (мощность, сечения, габариты, напряжение, диаметры) и отметь конфликты с расчётом.');
    out.push('- Если для надёжного подбора не хватает данных, сначала задай мне до пяти уточняющих вопросов.');
    out.push('');
    out.push('# Формат ответа');
    out.push('1. Краткое резюме: 3–5 строк, что изменить в подходе или комплекте.');
    out.push('2. Таблица по каждой позиции: категория, модель, ключевые характеристики, цена и дата, рейтинг и источник, плюсы и минусы, ссылка.');
    out.push('3. Итог по комплекту для каждой категории: сумма, чем категория лучше или хуже соседней.');
    out.push('4. Риски и что проверить у монтажника и продавца до покупки.');
    out.push('5. Что я мог упустить.');
    if (o.note) { out.push(''); out.push('# Мои пожелания'); out.push(o.note); }
    return out.join('\n');
  }

  var api = { build: build, TIERS: TIERS, CRIT: CRIT };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.TegaAI = api;

  /* ───────── интерфейс ───────── */
  if (typeof document === 'undefined') return;
  var spec = null, items = [], panelState = {}, panelKeys = '';
  function $(id) { return document.getElementById(id); }
  function txt(n) { return (n.textContent || '').replace(/\s+/g, ' ').trim(); }
  function opts() {
    var tiers = [], crit = [];
    ['eco', 'std', 'prem'].forEach(function (k) { var e = $('ai-t-' + k); if (e && e.checked) tiers.push(k); });
    Object.keys(CRIT).forEach(function (k) { var e = $('ai-c-' + k); if (e && e.checked) crit.push(k); });
    return { country: $('ai-country') ? $('ai-country').value.trim() : '', city: $('ai-city') ? $('ai-city').value.trim() : '', shop: $('ai-shop') ? $('ai-shop').value : 'region', tiers: tiers, crit: crit,
      budget: $('ai-budget') ? $('ai-budget').value.trim() : '', note: $('ai-note') ? $('ai-note').value.trim() : '', currency: $('ai-cur') ? $('ai-cur').value : 'BYN' };
  }
  /* Сбор данных со страницы: поля ввода и результаты расчётных вкладок (для страниц без собственного описания). */
  function harvest() {
    var host = document.querySelector('.e-elec'); if (!host) return [];
    var groups = [];
    Array.prototype.forEach.call(host.querySelectorAll('.e-panel'), function (pn) {
      if (pn.querySelector('#ai-root') || /art$/.test(pn.id) || pn.classList.contains('e-art')) return;
      var h = pn.querySelector('h2'), lines = [], notes = [];
      Array.prototype.forEach.call(pn.querySelectorAll('.e-f'), function (f) {
        var lb = f.querySelector('label'), inp = f.querySelector('input, select'); if (!lb || !inp) return;
        var v = inp.tagName === 'SELECT' ? txt(inp.options[inp.selectedIndex] || inp) : inp.value.trim();
        var u = f.querySelector('.u'); if (!v) return;
        lines.push([txt(lb), v + (u ? ' ' + txt(u) : '')]);
      });
      Array.prototype.forEach.call(pn.querySelectorAll('.kv'), function (kv) {
        var k = kv.querySelector('span'), b = kv.querySelector('b'); if (!k || !b) return;
        var v = txt(b); if (v && v !== '—') lines.push([txt(k), v]);
      });
      Array.prototype.forEach.call(pn.querySelectorAll('.verdict'), function (v) { var t = txt(v); if (t) notes.push(t.length > 400 ? t.slice(0, 400) + '…' : t); });
      if (lines.length > 0 && pn.querySelector('.kv')) groups.push({ key: pn.id, title: h ? txt(h).replace(/^\d+\s*/, '') : pn.id, lines: lines, notes: notes });
    });
    return groups;
  }
  function syncLists(groups) {
    var keys = groups.map(function (g) { return g.key; }).join('|');
    var host = $('ai-pans');
    if (host && keys !== panelKeys) {
      panelKeys = keys; host.textContent = '';
      groups.forEach(function (g) {
        if (!(g.key in panelState)) panelState[g.key] = true;
        var l = document.createElement('label'); l.className = 'o-chk';
        var c = document.createElement('input'); c.type = 'checkbox'; c.checked = panelState[g.key];
        c.addEventListener('change', function () { panelState[g.key] = c.checked; render(); });
        var sp = document.createElement('span'); sp.textContent = g.title;
        l.appendChild(c); l.appendChild(sp); host.appendChild(l);
      });
    }
  }
  var harvestMode = false, itemState = {};
  function renderItems() {
    var host = $('ai-items'); if (!host) return;
    items.forEach(function (it, i) {
      itemState[i] = true;
      var l = document.createElement('label'); l.className = 'o-chk';
      var c = document.createElement('input'); c.type = 'checkbox'; c.checked = true;
      c.addEventListener('change', function () { itemState[i] = c.checked; render(); });
      var sp = document.createElement('span'); sp.textContent = it.name;
      l.appendChild(c); l.appendChild(sp); host.appendChild(l);
    });
  }
  function render() {
    var box = $('ai-out'); if (!box) return;
    var sp = spec;
    if (harvestMode) {
      var groups = harvest(); syncLists(groups);
      var obj = [], notes = [];
      groups.forEach(function (g) {
        if (panelState[g.key] === false) return;
        obj.push(['#', g.title]); g.lines.forEach(function (l) { obj.push(l); });
        g.notes.forEach(function (n) { if (notes.indexOf(n) < 0 && /[а-я]/i.test(n)) notes.push(n); });
      });
      var chosen = items.filter(function (it, i) { return itemState[i] !== false; });
      sp = obj.length ? { title: ($('ai-root').getAttribute('data-title') || 'Объект'), object: obj, items: chosen, notes: notes.slice(0, 8) } : null;
      if (obj.length && !chosen.length) { box.textContent = 'Выберите, что подбирать.'; return; }
    }
    if (!sp) { box.textContent = 'Введите корректные данные расчёта на расчётных вкладках, запрос соберётся автоматически.'; return; }
    var o = opts();
    if (!o.tiers.length) { box.textContent = 'Выберите хотя бы одну категорию.'; return; }
    box.textContent = build(sp, o);
    var n = $('ai-len'); if (n) n.textContent = box.textContent.length + ' символов, ' + (sp.items || []).length + ' позиций';
  }
  function flash(btn, t) { var old = btn.getAttribute('data-t') || btn.textContent; btn.setAttribute('data-t', old); btn.textContent = t; setTimeout(function () { btn.textContent = old; }, 1600); }
  function copy(btn) {
    var t = $('ai-out').textContent;
    function fallback() { var ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) { } document.body.removeChild(ta); flash(btn, 'Скопировано'); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function () { flash(btn, 'Скопировано'); }, fallback); else fallback();
  }
  function download() {
    var b = new Blob([$('ai-out').textContent], { type: 'text/plain;charset=utf-8' }), a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = 'zapros-dlya-ii.txt'; document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }
  function openIn(btn, base) {
    var t = $('ai-out').textContent;
    copy(btn);
    window.open(base.indexOf('?') < 0 ? base : base + encodeURIComponent(t.length > 6000 ? t.slice(0, 6000) : t), '_blank', 'noopener');
  }
  function init() {
    var r = $('ai-root'); if (!r) return;
    var raw = r.getAttribute('data-items');
    if (raw) { try { items = JSON.parse(raw); harvestMode = items.length > 0; } catch (e) { items = []; } renderItems(); }
    Array.prototype.forEach.call(r.querySelectorAll('input, select, textarea'), function (e) { if (e.closest('#ai-pans') || e.closest('#ai-items')) return; e.addEventListener('input', render); e.addEventListener('change', render); });
    var b;
    if ((b = $('ai-copy'))) b.addEventListener('click', function () { copy(b); });
    if ((b = $('ai-dl'))) b.addEventListener('click', download);
    [['ai-claude', 'https://claude.ai/new?q='], ['ai-gpt', 'https://chatgpt.com/?q='], ['ai-google', 'https://www.google.com/search?udm=50&q='], ['ai-gemini', 'https://gemini.google.com/app'], ['ai-qwen', 'https://chat.qwen.ai/?q='], ['ai-grok', 'https://grok.com/?q=']].forEach(function (x) {
      var el = $(x[0]); if (el) el.addEventListener('click', function () { openIn(el, x[1]); });
    });
    if (harvestMode) {
      var later = function (ev) { if (ev && ev.target && ev.target.closest && ev.target.closest('#ai-root')) return; setTimeout(render, 120); };
      document.addEventListener('input', later); document.addEventListener('change', later); window.addEventListener('hashchange', later);
      document.addEventListener('click', function (ev) { if (ev.target.closest && ev.target.closest('.e-sub a')) later(); });
    }
    render();
  }
  api.update = function (s) { spec = s; render(); };
  api.harvest = harvest;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : globalThis);
