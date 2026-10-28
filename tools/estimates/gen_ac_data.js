// Данные для рисунков статьи «Кондиционирование»: считает ту же модель, что и калькулятор (static/ac-model.js).
// Запуск: node tools/estimates/gen_ac_data.js > tools/estimates/ac_data.json
const M = require('../../static/ac-model.js');
const base = { height: 2.7, roof: 'none', glassType: 'd2', shade: 'none', wallType: 'new', tin: 24, tmax: 30, swing: 10, infil: 0.3, fresh: 0, reserve: 10,
  f2: { az: 180, glass: 0, wall: 0 } };
const rooms = {
  sleep: Object.assign({}, base, { name: 'Спальня 14 м², окно на восток', area: 14, profile: 'sleep', people: 2, equip: 50, light: 30, shade: 'blind', f1: { az: -90, glass: 2, wall: 7 } }),
  south: Object.assign({}, base, { name: 'Гостиная 25 м², южное окно 8 м²', area: 25, profile: 'day', people: 3, equip: 300, light: 150, f1: { az: 0, glass: 8, wall: 6 } }),
  attic: Object.assign({}, base, { name: 'Мансарда 22 м², скат', area: 22, height: 2.5, roof: 'mans', wallType: 'frame', profile: 'eve', people: 2, equip: 250, light: 100, f1: { az: 90, glass: 4, wall: 5 } })
};
const out = {};
for (const k in rooms) {
  const r = M.calc(rooms[k]);
  out[k] = { name: rooms[k].name, hours: r.rows.map(x => Math.round(x.total)), peakW: Math.round(r.peakW), peakHour: r.peakHour, nominal: r.nominal, byArea: r.byArea,
    parts: Object.fromEntries(Object.entries(r.parts).map(([a, b]) => [a, Math.round(b)])) };
}
// влияние защиты от солнца на гостиную
const sh = {};
for (const s of ['none', 'blind', 'film', 'out']) sh[s] = Math.round(M.calc(Object.assign({}, rooms.south, { shade: s })).peakW);
out.shade = sh;
console.log(JSON.stringify(out, null, 1));
