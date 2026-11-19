/* Проверка функции поиска по сайту (static/search.js): ранжирование по заголовку/тексту,
   отбор по всем словам запроса, обрезка по regex в norm().
   Запуск: node tests/unit/search.test.js */
const assert = require('assert');
const S = require('../../static/search.js');

const entries = [
  { url: '/spravochniki/fundamenty', title: 'Фундаменты: расчёт и статья', text: 'Подбор по грунтам тип фундамента армирование бетон' },
  { url: '/spravochniki/krysha', title: 'Кровля: расчёт и статья', text: 'Стропила обрешётка металлочерепица' },
  { url: '/ispolnitelnaya-dokumentatsiya/akty', title: 'Освидетельствование скрытых работ', text: 'акт перечень работ приёмка' },
  { url: '/', title: 'Главная', text: 'ТЭГА ПЛЮС ремонтно-строительные работы' },
];

/* слово из заголовка находится и ранжируется первым */
let r = S.searchIndex(entries, 'фундамент', 8);
assert.strictEqual(r.length, 1, 'находит ровно одну запись по "фундамент"');
assert.strictEqual(r[0].url, '/spravochniki/fundamenty');

/* слово только из текста тоже находит запись (поиск "везде", не только по title) */
r = S.searchIndex(entries, 'обрешётка', 8);
assert.strictEqual(r.length, 1, 'находит запись по слову из текста статьи');
assert.strictEqual(r[0].url, '/spravochniki/krysha');

/* запись из FORMS (деепричастное длинное название) находится по слову из середины */
r = S.searchIndex(entries, 'скрытых', 8);
assert.strictEqual(r.length, 1);
assert.strictEqual(r[0].url, '/ispolnitelnaya-dokumentatsiya/akty');

/* несколько слов — запись должна содержать оба (где-то: заголовок или текст) */
r = S.searchIndex(entries, 'фундамент бетон', 8);
assert.strictEqual(r.length, 1, 'двусловный запрос находит запись, где оба слова есть');
assert.strictEqual(r[0].url, '/spravochniki/fundamenty');

/* слово, которого нигде нет — пустой результат, не "все записи" */
r = S.searchIndex(entries, 'квантоход', 8);
assert.strictEqual(r.length, 0, 'несуществующее слово не возвращает ложных совпадений');

/* короткий запрос (1 символ) игнорируется, не возвращает весь индекс */
r = S.searchIndex(entries, 'а', 8);
assert.strictEqual(r.length, 0, 'однобуквенный запрос не ищет');

/* регистр не мешает совпадению */
r = S.searchIndex(entries, 'МЕТАЛЛОЧЕРЕПИЦА', 8);
assert.strictEqual(r.length, 1, 'регистр нормализуется');
assert.strictEqual(r[0].url, '/spravochniki/krysha');

/* ё приравнивается к е при нормализации */
assert.strictEqual(S.norm('щётка хомуты'), S.norm('щетка хомуты'), 'ё нормализуется в е');

/* лимит соблюдается */
const many = [];
for (let i = 0; i < 20; i++) many.push({ url: '/x' + i, title: 'Фундамент ' + i, text: '' });
r = S.searchIndex(many, 'фундамент', 5);
assert.strictEqual(r.length, 5, 'ограничение limit соблюдается');

console.log('search.test.js: ok');
