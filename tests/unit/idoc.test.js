/* Проверка заполняемых актов.  Запуск: node tests/unit/idoc.test.js */
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const C = require('../../static/idoc-core.js');
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(__dirname + '/../../static/idoc-data.js', 'utf8'), ctx);
const D = ctx.window.IDOC_DATA;

assert.strictEqual(D.forms.length, 13, 'число форм');
const ids = D.forms.map(f => f.id);
assert.strictEqual(new Set(ids).size, ids.length, 'id форм уникальны');
const groups = D.groups.map(g => g.id);

D.forms.forEach(f => {
  assert(groups.includes(f.group), f.id + ': группа');
  assert(f.source && f.use && f.perechen, f.id + ': метаданные');
  const fs_ = C.fields(f);
  assert(fs_.length >= 5, f.id + ': полей мало');
  const keys = fs_.map(x => x.key);
  assert.strictEqual(new Set(keys).size, keys.length, f.id + ': ключи полей уникальны');
  fs_.forEach(x => assert(x.label && x.label.length > 2, f.id + ': нет подписи у ' + x.key));
  const html = C.renderHtml(f, {}), txt = C.renderText(f, {});
  assert(!html.includes('[[') && !txt.includes('[['), f.id + ': остались необработанные поля');
  assert(html.includes('idoc-signs'), f.id + ': нет подписей');
  assert(txt.includes(f.source), f.id + ': нет источника в тексте');
  const p0 = C.progress(f, {});
  assert.strictEqual(p0.filled, 0);
  assert.strictEqual(p0.total, fs_.length);
});

const l = D.forms.find(f => f.id === 'sn-l');
// одно и то же поле «Наименование работ» в заголовке и в п. 1 вводится один раз
assert.strictEqual(C.fields(l).filter(x => x.key === 'rab').length, 1);
let h = C.renderHtml(l, { rab: 'Устройство гидроизоляции', _date: '2026-11-16', narush: 'отсутствуют' });
assert(h.includes('Устройство гидроизоляции'));
assert((h.match(/Устройство гидроизоляции/g) || []).length === 2, 'значение в заголовке и в п. 1');
assert(h.includes('«16» ноября 2026 г.'));
assert(h.includes('<u>отсутствуют</u>') && !h.includes('<u>допущены</u>'));
assert(C.renderHtml(l, {}).includes('«____» ______________ 20___ г.'));
assert(C.renderText(l, { narush: 'допущены' }).includes('допущены нарушения'));
assert(C.renderText(l, {}).includes('отсутствуют/допущены'));

// экранирование
h = C.renderHtml(l, { rab: '<script>alert(1)</script>', pod: '"><img src=x onerror=1>' });
assert(!h.includes('<script>') && !h.includes('<img') && h.includes('&lt;script&gt;'));

// «ненужное зачеркнуть»
const b = D.forms.find(f => f.id === 'vk-b');
h = C.renderHtml(b, { sys: 'канализации' });
assert(h.includes('<s>(водостоков)</s>') && !h.includes('<s>канализации</s>'));
assert(!C.renderHtml(b, {}).includes('<s>'));
assert(C.fields(b).filter(x => x.key === 'sys').length === 1);

// дата и город
const k = D.forms.find(f => f.id === 'vk-k');
assert(C.fields(k)[0].key === '_city');
h = C.renderHtml(k, { _city: 'Минск', _date: '2027-01-05' });
assert(h.includes('Минск') && h.includes('«05» января 2027 г.'));
assert(C.renderText(k, { _date: '2027-13-40' }).includes('«____»'));

// прогресс
const p = C.progress(k, { _city: 'Минск', pm: '0,9', mn: ' ' });
assert.strictEqual(p.filled, 2);

// парсер
const t = C.parse('а [[x|Метка|подпись|ml]] б [[?y|Выбор|да¦нет]] в');
assert.strictEqual(t.length, 5);
assert(t[1].ml === true && t[1].cap === 'подпись');
assert(t[3].kind === 'u' && t[3].opts.length === 2);
console.log('idoc: ok (' + D.forms.length + ' форм)');
