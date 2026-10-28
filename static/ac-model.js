/* Модель теплопритоков помещения в жаркий день для Минска (почасовой расчёт).
   Солнце: положение по широте 53,9° и долготе 27,6°, ясное небо (модель ASHRAE, 21 июля).
   Стены и кровля: температура «солнце-воздух» с запаздыванием и затуханием колебаний.
   Расчёт ориентировочный, для выбора класса кондиционера и разговора с проектировщиком. */
(function (root) {
  'use strict';

  var PI = Math.PI, RAD = PI / 180;
  var LAT = 53.9 * RAD, LON = 27.56, TZ = 3;
  var DOY = 202; /* 21 июля */
  var CLEAR = { A: 1085, B: 0.207, C: 0.136 };
  var RHO_G = 0.2;

  var GLASS = {
    d1: { name: 'Однокамерный стеклопакет', g: 0.70, u: 2.7 },
    d2: { name: 'Двухкамерный стеклопакет', g: 0.60, u: 1.8 },
    low: { name: 'Энергосберегающий (low-e)', g: 0.45, u: 1.2 },
    sun: { name: 'Солнцезащитный', g: 0.30, u: 1.3 }
  };
  var SHADE = {
    none: { name: 'Без защиты', k: 1.0 },
    blind: { name: 'Внутренние жалюзи или шторы', k: 0.65 },
    film: { name: 'Плёнка или светлые жалюзи снаружи изнутри', k: 0.5 },
    out: { name: 'Наружные ставни, маркиза, ролеты', k: 0.25 }
  };
  var WALL = {
    new: { name: 'Новый дом, утеплённая стена', u: 0.28, lag: 8, dec: 0.30 },
    brick: { name: 'Кирпич или блок без утепления', u: 1.1, lag: 8, dec: 0.30 },
    panel: { name: 'Панельный дом', u: 1.0, lag: 5, dec: 0.50 },
    frame: { name: 'Каркас, дерево', u: 0.30, lag: 3, dec: 0.70 }
  };
  var ROOF = {
    none: { name: 'Выше жилые помещения', u: 0, lag: 0, dec: 1, a: 0 },
    flat: { name: 'Плоская кровля, утеплённая', u: 0.25, lag: 5, dec: 0.40, a: 0.8 },
    attic: { name: 'Холодный чердак', u: 0.60, lag: 4, dec: 0.50, a: 0.7 },
    mans: { name: 'Мансарда, утеплённый скат', u: 0.35, lag: 2, dec: 0.75, a: 0.7 }
  };
  var PROFILE = {
    day: { name: 'Дома весь день (8–23 ч)', h: [8, 23] },
    eve: { name: 'Вечер и ночь (после работы, 17–24 ч)', h: [17, 24] },
    office: { name: 'Офис (9–18 ч)', h: [9, 18] },
    sleep: { name: 'Спальня (22–7 ч)', h: [22, 7] },
    all: { name: 'Круглосуточно', h: [0, 24] }
  };
  var SERIES = [2.0, 2.5, 3.5, 5.0, 7.0, 9.0, 12.0, 14.0, 16.0];

  function occ(profile, hour) {
    var p = PROFILE[profile] || PROFILE.day, a = p.h[0], b = p.h[1];
    var h = hour % 24;
    if (a < b) return (h >= a && h < b) ? 1 : 0;
    return (h >= a || h < b) ? 1 : 0;
  }

  /* положение солнца: часы по местному времени (UTC+3). Азимут от юга, запад положительный */
  function sunPos(clockHour) {
    var decl = 23.45 * Math.sin(2 * PI * (284 + DOY) / 365) * RAD;
    var B = 2 * PI * (DOY - 81) / 364;
    var eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
    var ts = clockHour - TZ + LON / 15 + eot / 60;
    var H = (ts - 12) * 15 * RAD;
    var sinB = Math.sin(LAT) * Math.sin(decl) + Math.cos(LAT) * Math.cos(decl) * Math.cos(H);
    var beta = Math.asin(Math.max(-1, Math.min(1, sinB)));
    var az = 0;
    if (sinB > 0.001) {
      var cosAz = (sinB * Math.sin(LAT) - Math.sin(decl)) / (Math.cos(beta) * Math.cos(LAT));
      az = Math.acos(Math.max(-1, Math.min(1, cosAz)));
      if (H < 0) az = -az;
    }
    return { sinB: sinB, beta: beta, az: az };
  }

  /* падающее излучение на вертикальную стену с азимутом gs (градусы, 0 юг, +запад) или на горизонталь */
  function irradiance(clockHour, gsDeg, horizontal) {
    var s = sunPos(clockHour);
    if (s.sinB <= 0.02) return { dir: 0, dif: 0, ref: 0, cos: 0, theta: 90 };
    var ebn = CLEAR.A * Math.exp(-CLEAR.B / s.sinB);
    var cosT, dif, ref;
    if (horizontal) {
      cosT = s.sinB;
      dif = CLEAR.C * ebn;
      ref = 0;
    } else {
      cosT = Math.cos(s.beta) * Math.cos(s.az - gsDeg * RAD);
      var Y = cosT > -0.2 ? Math.max(0.45, 0.55 + 0.437 * cosT + 0.313 * cosT * cosT) : 0.45;
      dif = CLEAR.C * ebn * Y;
      ref = ebn * (CLEAR.C + s.sinB) * RHO_G * 0.5;
    }
    var dir = ebn * Math.max(0, cosT);
    return { dir: dir, dif: dif, ref: ref, cos: Math.max(0, cosT), theta: Math.acos(Math.max(0, Math.min(1, cosT))) / RAD };
  }

  function iam(thetaDeg) { return 1 - Math.pow(Math.min(90, Math.max(0, thetaDeg)) / 90, 5); }

  function outT(hour, tmax, swing) { return tmax - swing / 2 * (1 - Math.cos(2 * PI * (hour - 15) / 24)); }

  /* влагосодержание, г/кг, для температуры точки росы */
  function dTd(td) { var pv = 0.6112 * Math.exp(17.62 * td / (243.12 + td)); return 622 * pv / (101.3 - pv); }
  function dRH(t, rh) { var pv = rh * 0.6112 * Math.exp(17.62 * t / (243.12 + t)); return 622 * pv / (101.3 - pv); }

  /* cfg: area, height, floors ('mid'|'top'), roof, tin, tmax, swing, profile,
          f1:{az, glass, wall}, f2:{az, glass, wall}, glassType, shade, wallType,
          people, equip(Вт), light(Вт), infil(1/ч), fresh(м³/ч на человека, 0 если нет), reserve(%) */
  function calc(cfg) {
    var area = cfg.area, vol = area * cfg.height;
    var g = GLASS[cfg.glassType] || GLASS.d2, sh = SHADE[cfg.shade] || SHADE.none, w = WALL[cfg.wallType] || WALL.new;
    var roof = ROOF[cfg.roof] || ROOF.none;
    var faces = [cfg.f1, cfg.f2].filter(function (f) { return f && (f.glass > 0 || f.wall > 0); });
    var hours = [], i;
    for (i = 0; i < 24; i++) hours.push(i);
    var Ti = cfg.tin, swing = cfg.swing, tmax = cfg.tmax;
    var dOut = dTd(15), dIn = dRH(Ti, 0.5);
    var alphaW = 0.6, hOut = 17;

    /* температура солнце-воздух для каждой стены и крыши на каждый час, затем среднее */
    function sa(face, h) {
      var ir = irradiance(h, face.az, false);
      return outT(h, tmax, swing) + alphaW * (ir.dir + ir.dif + ir.ref) / hOut;
    }
    function saRoof(h) {
      var ir = irradiance(h, 0, true);
      return outT(h, tmax, swing) + roof.a * (ir.dir + ir.dif) / hOut - 3.5;
    }
    var faceSa = faces.map(function (f) {
      var arr = hours.map(function (h) { return sa(f, h); });
      return { arr: arr, mean: arr.reduce(function (a, b) { return a + b; }, 0) / 24 };
    });
    var roofArr = hours.map(saRoof), roofMean = roofArr.reduce(function (a, b) { return a + b; }, 0) / 24;

    var rows = hours.map(function (h) {
      var r = { h: h, sun: 0, glassU: 0, wall: 0, roof: 0, people: 0, equip: 0, vent: 0, latent: 0, pLat: 0, vLat: 0 };
      faces.forEach(function (f, k) {
        var ir = irradiance(h, f.az, false);
        var gl = f.glass * 0.85;
        r.sun += gl * g.g * sh.k * (ir.dir * iam(ir.theta) + 0.9 * (ir.dif + ir.ref));
        r.glassU += f.glass * g.u * (outT(h, tmax, swing) - Ti);
        if (f.wall > 0) {
          var s = faceSa[k], lagIdx = ((h - w.lag) % 24 + 24) % 24;
          r.wall += w.u * f.wall * ((s.mean - Ti) + w.dec * (s.arr[lagIdx] - s.mean));
        }
      });
      if (roof.u > 0) {
        var li = ((h - roof.lag) % 24 + 24) % 24;
        r.roof = roof.u * area * ((roofMean - Ti) + roof.dec * (roofArr[li] - roofMean));
      }
      var o = occ(cfg.profile, h);
      r.people = cfg.people * 75 * o;
      r.equip = (cfg.equip + cfg.light) * o;
      var L = cfg.infil * vol + cfg.people * cfg.fresh * o;
      r.vent = 0.335 * L * (outT(h, tmax, swing) - Ti);
      r.pLat = cfg.people * 55 * o;
      r.vLat = L * 0.817 * Math.max(0, dOut - dIn);
      r.latent = r.pLat + r.vLat;
      r.sens = r.sun + r.glassU + r.wall + r.roof + r.people + r.equip + r.vent;
      r.total = Math.max(0, r.sens) + r.latent;
      return r;
    });

    /* пик ищем только в часы, когда кондиционер нужен: когда в помещении есть люди или работает техника */
    var peak = null;
    rows.forEach(function (r) { if (occ(cfg.profile, r.h) && (!peak || r.total > peak.total)) peak = r; });
    if (!peak) { peak = rows[0]; rows.forEach(function (r) { if (r.total > peak.total) peak = r; }); }
    var req = peak.total * (1 + (cfg.reserve || 0) / 100);
    var nom = null;
    for (i = 0; i < SERIES.length; i++) if (SERIES[i] * 1000 >= req) { nom = SERIES[i]; break; }
    return {
      rows: rows, peak: peak, peakW: peak.total, reqW: req, nominal: nom,
      sensible: Math.max(0, peak.sens), latent: peak.latent,
      shr: peak.total > 0 ? Math.max(0, peak.sens) / peak.total : 1,
      byArea: area * 100,
      parts: {
        'Солнце через окна': peak.sun, 'Тепло через окна': peak.glassU, 'Стены': peak.wall, 'Кровля, перекрытие': peak.roof,
        'Люди': peak.people + peak.pLat, 'Техника и свет': peak.equip, 'Свежий воздух и щели': peak.vent + peak.vLat
      },
      peakHour: peak.h, tOutPeak: outT(peak.h, tmax, swing)
    };
  }

  var api = {
    calc: calc, irradiance: irradiance, sunPos: sunPos, outT: outT, occ: occ, iam: iam,
    GLASS: GLASS, SHADE: SHADE, WALL: WALL, ROOF: ROOF, PROFILE: PROFILE, SERIES: SERIES, dTd: dTd, dRH: dRH
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.TegaAC = api;
})(typeof window !== 'undefined' ? window : globalThis);
