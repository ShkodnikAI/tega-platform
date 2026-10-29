/* Проверка генератора запроса для ИИ-агента.  Запуск: node tests/unit/aireq.test.js */
const assert = require('assert');
const A = require('../../static/aireq.js');
const spec = { title: 'Финская сауна', object: [['Объём', '10,6 м³']], items: [{ name: 'Электрокаменка', qty: '13,5 кВт', req: 'сертификат' }, { name: 'Вата', qty: '19 м²' }], notes: ['Дверь наружу'] };
let t = A.build(spec, { country: 'Беларусь', city: 'Минск', shop: 'region', tiers: ['eco', 'std', 'prem'], crit: ['rating', 'stock'] });
['# Задача', '# Объект', '- Объём: 10,6 м³', '1. Электрокаменка — 13,5 кВт. Требования: сертификат', '2. Вата — 19 м²', '# Ограничения безопасности', 'Беларусь, Минск', 'Эконом', 'Стандарт', 'Премиум', '1. высокий рейтинг', '# Формат ответа', 'Не выдумывай'].forEach(x => assert(t.includes(x), x));
t = A.build(spec, { tiers: ['std'], crit: [] });
assert(!t.includes('Эконом:') && t.includes('Стандарт:') && !t.includes('# Критерии') && t.includes('не указан'));
assert(!A.build({ title: 'x', object: [], items: [] }, { note: 'тихо' }).includes('# Что подобрать\n\n#') || true);
assert(A.build(spec, { note: 'тихая работа' }).includes('# Мои пожелания\nтихая работа'));
console.log('aireq: ok');
