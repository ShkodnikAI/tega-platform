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
    (spec.object || []).forEach(function (p) { out.push('- ' + p[0] + ': ' + p[1]); });
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
  var spec = null;
  function $(id) { return document.getElementById(id); }
  function opts() {
    var tiers = [], crit = [];
    ['eco', 'std', 'prem'].forEach(function (k) { var e = $('ai-t-' + k); if (e && e.checked) tiers.push(k); });
    Object.keys(CRIT).forEach(function (k) { var e = $('ai-c-' + k); if (e && e.checked) crit.push(k); });
    var city = $('ai-city') ? $('ai-city').value.trim() : '';
    return { country: $('ai-country') ? $('ai-country').value : '', city: city, shop: $('ai-shop') ? $('ai-shop').value : 'region', tiers: tiers, crit: crit,
      budget: $('ai-budget') ? $('ai-budget').value.trim() : '', note: $('ai-note') ? $('ai-note').value.trim() : '', currency: $('ai-cur') ? $('ai-cur').value : 'BYN' };
  }
  function render() {
    var box = $('ai-out'); if (!box) return;
    if (!spec) { box.textContent = 'Введите корректные данные расчёта на первой вкладке, запрос соберётся автоматически.'; return; }
    var o = opts();
    if (!o.tiers.length) { box.textContent = 'Выберите хотя бы одну категорию.'; return; }
    box.textContent = build(spec, o);
    var n = $('ai-len'); if (n) n.textContent = box.textContent.length + ' символов, ' + (spec.items || []).length + ' позиций';
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
    window.open(base + encodeURIComponent(t.length > 6000 ? t.slice(0, 6000) : t), '_blank', 'noopener');
  }
  function init() {
    var root_ = $('ai-root'); if (!root_) return;
    Array.prototype.forEach.call(root_.querySelectorAll('input, select, textarea'), function (e) { e.addEventListener('input', render); e.addEventListener('change', render); });
    var b;
    if ((b = $('ai-copy'))) b.addEventListener('click', function () { copy(b); });
    if ((b = $('ai-dl'))) b.addEventListener('click', download);
    if ((b = $('ai-claude'))) b.addEventListener('click', function () { openIn(b, 'https://claude.ai/new?q='); });
    if ((b = $('ai-gpt'))) b.addEventListener('click', function () { openIn(b, 'https://chatgpt.com/?q='); });
    render();
  }
  api.update = function (s) { spec = s; render(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : globalThis);
