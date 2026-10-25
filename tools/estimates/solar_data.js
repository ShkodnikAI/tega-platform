// Генерирует solar_data.json для статьи (цифры считает та же модель, что и калькулятор на странице).
const S = require('../../static/solar-model.js');
const fs = require('fs');
const W = [0.25, 0.45, 0.30];
function yieldOf(ar) {
  const a = Object.assign({ n: 100, type: 'm550', tight: false }, ar);
  const dc = S.arrayDC(a, { dcLoss: 0.03, shade: 0 }), kwp = a.n * S.MODULES[a.type].p / 1000, mon = [];
  for (let m = 0; m < 12; m++) { let s = 0; for (let j = 0; j < 3; j++) for (let h = 0; h < 24; h++) s += dc[m][j][h] * W[j] * S.DAYS[m]; mon.push(s / kwp * 0.975); }
  return { mon, year: mon.reduce((x, y) => x + y, 0) };
}
const cases = {
  roofS35: yieldOf({ tilt: 35, az: 0 }), roofS15: yieldOf({ tilt: 15, az: 0 }), roofS45: yieldOf({ tilt: 45, az: 0 }), roofSW35: yieldOf({ tilt: 35, az: 45 }),
  roofE15: yieldOf({ tilt: 15, az: -90 }), carport: yieldOf({ tilt: 10, az: 0 }),
  fenceS: yieldOf({ tilt: 90, az: 0, type: 'b580' }), fenceEW: yieldOf({ tilt: 90, az: 90, type: 'b580' }), facadeS: yieldOf({ tilt: 90, az: 0, type: 'm550' }), facadeEW: yieldOf({ tilt: 90, az: 90, type: 'm550' }),
  roofS35tight: yieldOf({ tilt: 35, az: 0, tight: true })
};
const base = { load: 6000, profile: 'evening', season: 'usual', shift: 0, tariff: 'a', scheme: 'one', buyback: 0.10, growth: 0.06, disc: 0.08, phases: 1, tmin: -25, dcac: 1.25, battery: 0, reserve: 0.2, dist: 15, distAc: 10, shade: 0.03, dcLoss: 0.03 };
const A = (n, t, tilt, az) => ({ n: n, type: t, tilt: tilt, az: az, tight: false });
const N = { n: 0, type: 'm550', tilt: 35, az: 0 };
const sc = {
  s1: { name: 'Дом 5 кВт, вечерний профиль, без батареи', o: { load: 5000, arrays: [A(9, 'm550', 35, 0), N, N] } },
  s2: { name: 'Дом 5 кВт, днём дома, без батареи', o: { load: 5000, profile: 'home', arrays: [A(9, 'm550', 35, 0), N, N] } },
  s3: { name: 'Дом 10 кВт, днём дома, без батареи, двухзонный', o: { load: 9000, profile: 'home', scheme: 'two', arrays: [A(18, 'm550', 35, 0), N, N] } },
  s4: { name: 'Дом 10 кВт + батарея 10 кВт·ч, двухзонный', o: { load: 9000, profile: 'home', scheme: 'two', battery: 10, arrays: [A(18, 'm550', 35, 0), N, N] } },
  s5: { name: 'Кровля 6,6 + забор 5,8 кВтп + батарея 10 кВт·ч', o: { load: 9000, profile: 'home', scheme: 'two', season: 'heat', phases: 3, battery: 10, arrays: [A(12, 'm550', 35, 0), N, A(10, 'b580', 90, 90)] } },
  s6: { name: 'Хозяйство 30 кВт днём, без батареи (юрлицо)', o: { load: 40000, profile: 'day', season: 'flat', tariff: 'b', phases: 3, arrays: [A(54, 'm550', 30, 0), N, N] } }
};
const scen = {};
for (const k in sc) {
  const cfg = Object.assign({}, base, sc[k].o), r = S.configure(cfg), s = r.sim, e = r.econ;
  scen[k] = { name: sc[k].name, kwp: s.kwp, gen: s.genY, self: s.selfY / s.genY, cover: s.selfY / s.loadY, exp: s.expY / s.genY, sav: s.savings, capex: r.bom.byn, usd: r.bom.usd, pay: e.pay, npv: e.npv, irr: e.irr, cum: e.cum, inv: r.pick.inv.name, cycles: s.cycles, load: cfg.load, bat: cfg.battery,
    capexParts: { mod: r.bom.lines.filter(l => l.grp === 'Модули').reduce((x, l) => x + l.sum, 0), mount: r.bom.lines.filter(l => l.grp === 'Монтаж').reduce((x, l) => x + l.sum, 0), inv: r.bom.invUsd, bat: r.bom.batUsd, prot: r.bom.lines.filter(l => l.grp === 'Защита и коммутация' || l.grp === 'Учёт и мониторинг').reduce((x, l) => x + l.sum, 0), work: r.bom.lines.filter(l => l.grp === 'Работы').reduce((x, l) => x + l.sum, 0) } };
  if (k === 's5') { scen[k].day = { jan: r.sim.day[0].map(h => [h.pv, h.load, h.soc]), jul: r.sim.day[6].map(h => [h.pv, h.load, h.soc]) }; }
  if (k === 's4') { scen[k].day = { jan: r.sim.day[0].map(h => [h.pv, h.load, h.soc]), jul: r.sim.day[6].map(h => [h.pv, h.load, h.soc]) }; }
}
// батарея: вклад в NPV при разных тарифах
const batEff = {};
[['one', 'a'], ['two', 'a'], ['three', 'a']].forEach(([sch, t]) => {
  const c0 = Object.assign({}, base, { load: 9000, profile: 'home', scheme: sch, tariff: t, arrays: [A(18, 'm550', 35, 0), N, N] });
  const r0 = S.configure(c0), r1 = S.configure(Object.assign({}, c0, { battery: 10 }));
  batEff[sch] = { npv0: r0.econ.npv, npv1: r1.econ.npv, pay0: r0.econ.pay, pay1: r1.econ.pay };
});
fs.writeFileSync(__dirname + '/solar_data.json', JSON.stringify({ cases, scen, batEff, months: S.MONTHS, horiz: S.MON_H }, null, 1));
console.log(Object.keys(cases).map(k => k + ' ' + cases[k].year.toFixed(0)).join('\n'));
for (const k in scen) console.log(k, scen[k].kwp.toFixed(1), (scen[k].self * 100).toFixed(0) + '%', scen[k].sav.toFixed(0), scen[k].capex.toFixed(0), scen[k].pay && scen[k].pay.toFixed(1), scen[k].npv.toFixed(0), scen[k].irr && (scen[k].irr * 100).toFixed(1));
console.log(JSON.stringify(batEff));
