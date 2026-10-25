"""Инфографика статьи «Солнечные системы»: чистый SVG без встроенных стилей и скриптов (CSP сайта их не пропускает).
Числа берутся из solar_data.json, который считает та же модель, что и калькулятор (tools/estimates/solar_data.js)."""
import json
import math
from pathlib import Path

from art_figs import T, R, L, PL, arrow, fig, INK, RED, MUT, G1, G2, G3, SOFT
from art_vent_figs import TH, ru

D = json.loads((Path(__file__).parent / "solar_data.json").read_text(encoding="utf-8"))
MON = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"]


def f_steps():
    steps = [("1", ("Потребление", "и тариф"), ("профиль", "по часам")), ("2", ("Конструкция", ""), ("кровля, забор,", "навес")), ("3", ("Инвертор", ""), ("MPPT, DC/AC,", "защиты")),
             ("4", ("Накопитель", ""), ("под задачу,", "не для вида")), ("5", ("Сеть и учёт", ""), ("микрогенерация,", "УЗИП")), ("6", ("Деньги", ""), ("NPV,", "а не «срок»"))]
    b = ""
    for i, (n, t, sub) in enumerate(steps):
        x = 6 + i * 124
        b += R(x, 10, 112, 112, RED if i == 0 else INK)
        b += T(x + 10, 38, n, 24, "#fff", weight="700") + T(x + 10, 62, t[0], 13, "#fff", weight="700")
        if t[1]:
            b += T(x + 10, 78, t[1], 13, "#fff", weight="700")
        b += T(x + 10, 98, sub[0], 10.5, "#dcdde0") + T(x + 10, 111, sub[1], 10.5, "#dcdde0")
        if i < 5:
            b += arrow(x + 113, 66, x + 123, 66, G2, 2)
    return fig(760, 134, b, "Шесть шагов проекта солнечной станции", "Начинают с потребления и тарифа, а не с площади крыши: каждый следующий шаг опирается на предыдущий.")


def _chart_frame(w, h, ox, oy, pw, ph, ymax, step, unit, fmt_y=lambda v: ru(v, 0)):
    b = ""
    v = 0
    while v <= ymax + 1e-9:
        y = oy + ph - ph * v / ymax
        b += L(ox, y, ox + pw, y, "#e4e5e8", 1) + T(ox - 6, y + 4, fmt_y(v), 11, MUT, "end")
        v += step
    b += T(ox - 40, oy - 12, unit, 11, MUT)
    return b


def f_months():
    ser = [("Кровля юг 35°", D["cases"]["roofS35"]["mon"], INK, ""), ("Забор bifacial, на юг", D["cases"]["fenceS"]["mon"], RED, ""),
           ("Забор bifacial, восток–запад", D["cases"]["fenceEW"]["mon"], G1, "6 4"), ("Кровля на восток 15°", D["cases"]["roofE15"]["mon"], G3, "")]
    ox, oy, pw, ph = 56, 30, 660, 230
    ymax = 160
    b = _chart_frame(760, 330, ox, oy, pw, ph, ymax, 40, "кВт·ч с 1 кВтп за месяц")
    for i in range(12):
        x = ox + pw * (i + 0.5) / 12
        b += T(x, oy + ph + 18, MON[i], 12, MUT, "middle")
    for name, vals, col, dash in ser:
        pts = [(round(ox + pw * (i + 0.5) / 12, 1), round(oy + ph - ph * v / ymax, 1)) for i, v in enumerate(vals)]
        b += PL(pts, col, 3, dash)
        for x, y in pts:
            b += f'<circle cx="{x}" cy="{y}" r="3.5" fill="{col}" stroke="#fff" stroke-width="1.2"/>'
    # легенда под графиком
    for k, (name, vals, col, dash) in enumerate(ser):
        x = ox + (k % 2) * 330
        y = oy + ph + 46 + (k // 2) * 20
        b += L(x, y - 4, x + 26, y - 4, col, 3, dash) + T(x + 32, y, f"{name}: {ru(sum(vals), 0)} за год", 12, INK)
    b += T(ox, oy + ph + 98, "Зимой вертикальный забор на юг даёт вдвое больше кровли, летом уступает почти на треть: кривые пересекаются дважды в год.", 12, MUT)
    return fig(760, 396, b, "Выработка 1 кВтп по месяцам для разных конструкций, Минск",
               "Расчёт по модели калькулятора: почасовая радиация Минска, снежное альбедо, потери на отражение и нагрев. Диапазон неопределённости ±10 %.")


def f_system():
    b = ""
    def box(x, y, w, h, t, s="", fill=INK, tc="#fff"):
        out = R(x, y, w, h, fill) + T(x + w / 2, y + (22 if s else h / 2 + 5), t, 13, tc, "middle", "700")
        if s:
            out += T(x + w / 2, y + 40, s, 10.5, "#dcdde0" if fill != SOFT else MUT, "middle")
        return out
    b += box(10, 12, 150, 56, "Кровля", "юг 30–35°, MPPT 1")
    b += box(10, 80, 150, 56, "Забор bifacial", "вертикаль, MPPT 2", RED)
    b += box(210, 40, 170, 70, "Гибридный инвертор", "MPPT · EPS · мониторинг", INK)
    b += arrow(162, 40, 208, 66, G2, 2.5) + arrow(162, 108, 208, 86, G2, 2.5)
    b += box(440, 8, 150, 48, "Дом", "дневная нагрузка", SOFT, INK)
    b += box(440, 66, 150, 48, "Батарея LFP", "вечер и резерв", SOFT, INK)
    b += box(440, 124, 150, 48, "Сеть", "учёт, излишки", SOFT, INK)
    b += R(440, 8, 150, 48, "none", INK, 1.5) + R(440, 66, 150, 48, "none", INK, 1.5) + R(440, 124, 150, 48, "none", INK, 1.5)
    b += arrow(382, 62, 438, 32, INK, 2.5) + arrow(382, 76, 438, 90, INK, 2.5) + arrow(382, 98, 438, 146, INK, 2.5)
    b += box(640, 8, 112, 48, "Электромобиль", "дневные излишки", SOFT, INK) + R(640, 8, 112, 48, "none", INK, 1.5)
    b += arrow(592, 32, 638, 32, G2, 2)
    b += T(10, 204, "Мощность массива подгоняют под дневное потребление, ёмкость батареи под вечернее, сеть остаётся страховкой.", 12, MUT)
    return fig(760, 214, b, "Схема энергодома: кровля, забор, гибридный инвертор, батарея, сеть", "Днём кровля и забор кормят дом, излишек заряжает батарею, вечером она отдаёт накопленное; при аварии сети инвертор уходит в резервный режим.")


def f_techmap():
    pts = [("AGM/GEL", 500, 155, 12, G3), ("Lead-carbon", 1200, 220, 12, G2), ("NMC", 3500, 450, 14, G1), ("Na-ion", 5000, 400, 14, MUT),
           ("LiFePO₄", 8000, 300, 20, RED), ("LTO", 17000, 1200, 14, INK), ("Ионистор", 750000, 6000, 22, INK)]
    ox, oy, pw, ph = 70, 30, 650, 250
    lx = lambda c: ox + pw * (math.log10(c) - 2.4) / (6.2 - 2.4)
    ly = lambda p: oy + ph - ph * (math.log10(p) - 2.0) / (4.0 - 2.0)
    b = ""
    for p in (100, 1000, 10000):
        b += L(ox, ly(p), ox + pw, ly(p), "#e4e5e8", 1) + T(ox - 6, ly(p) + 4, ru(p, 0), 11, MUT, "end")
    for c in (1000, 10000, 100000, 1000000):
        b += L(lx(c), oy, lx(c), oy + ph, "#e4e5e8", 1) + T(lx(c), oy + ph + 18, ru(c, 0), 11, MUT, "middle")
    b += T(ox, oy - 12, "€ за 1 кВт·ч запаса (розница, модуль)", 11, MUT) + T(ox + pw, oy + ph + 38, "циклов до 80 % ёмкости", 11, MUT, "end")
    place = {"AGM/GEL": ("r", 0, 4), "Lead-carbon": ("r", 0, 4), "NMC": ("l", 0, -4), "Na-ion": ("r", 0, -12), "LiFePO₄": ("r", 0, 22), "LTO": ("r", 0, 4), "Ионистор": ("l", 0, 4)}
    for name, c, p, r, col in pts:
        b += f'<circle cx="{lx(c):.1f}" cy="{ly(p):.1f}" r="{r}" fill="{col}" fill-opacity="0.88" stroke="#fff" stroke-width="1.5"/>'
        side, dx0, dy0 = place[name]
        dx = (-r - 6) if side == "l" else (r + 6)
        b += TH(round(lx(c) + dx, 1), round(ly(p) + dy0, 1), name, 12, INK, "end" if side == "l" else "start", "700")
    b += R(lx(3000), ly(400) - 4, 0, 0, "none")
    return fig(760, 318, b, "Карта технологий накопителей: цена за кВт·ч и ресурс в циклах (логарифмические оси)",
               "Выгодная покупка для дома живёт в зоне LiFePO₄. Ионистор в противоположном углу: миллионы циклов, но цена за кВт·ч выше на 1–2 порядка, поэтому он буфер для пиков, а не хранилище. Цены ориентировочные.")


def _day(b, ox, oy, pw, ph, data, title, ymax, soc=True):
    b += T(ox, oy - 10, title, 13, INK, "start", "700")
    for v in range(0, int(ymax) + 1, 2 if ymax > 6 else 1):
        y = oy + ph - ph * v / ymax
        b += L(ox, y, ox + pw, y, "#e4e5e8", 1) + T(ox - 6, y + 4, str(v), 10.5, MUT, "end")
    bw = pw / 24
    for h, (pv, ld, so) in enumerate(data):
        hh = ph * pv / ymax
        b += R(round(ox + h * bw + 1, 1), round(oy + ph - hh, 1), round(bw - 2, 1), round(hh, 1), G3)
        if h % 4 == 0:
            b += T(round(ox + h * bw + bw / 2, 1), oy + ph + 14, str(h), 10.5, MUT, "middle")
    b += PL([(round(ox + (h + 0.5) * bw, 1), round(oy + ph - ph * ld / ymax, 1)) for h, (pv, ld, so) in enumerate(data)], INK, 2.5)
    if soc:
        b += PL([(round(ox + (h + 0.5) * bw, 1), round(oy + ph - ph * so / 10.0, 1)) for h, (pv, ld, so) in enumerate(data)], RED, 2.2, "5 4")
    return b


def f_day():
    s = D["scen"]["s4"]["day"]
    ymax_j = 6
    ymax_w = 2
    b = _day("", 42, 40, 300, 170, s["jul"], "Июль, средний день, кВт", ymax_j) + _day("", 424, 40, 300, 170, s["jan"], "Январь, средний день, кВт", ymax_w)
    b += R(42, 238, 12, 12, G3) + T(60, 249, "выработка", 12, INK) + L(150, 244, 174, 244, INK, 2.5) + T(180, 249, "нагрузка дома", 12, INK)
    b += L(300, 244, 324, 244, RED, 2.2, "5 4") + T(330, 249, "заряд батареи (высота графика = 10 кВт·ч)", 12, INK) + T(724, 249, "час суток", 11, MUT, "end")
    return fig(760, 262, b, "Типовые сутки лета и зимы для дома 10 кВтп с батареей 10 кВт·ч",
               "Летом выработка с запасом закрывает дневную нагрузку, батарея заряжается к вечеру; зимой солнца едва хватает дому, батарея почти не работает. Расчёт: сценарий «дом 10 кВт + батарея, двухзонный тариф».")


def f_cash():
    sc = [("s1", "Дом 5 кВт, вечерний", MUT, ""), ("s2", "Дом 5 кВт, днём", INK, ""), ("s4", "10 кВт + батарея 10 кВт·ч", G1, "6 4"), ("s5", "Кровля + забор + батарея", G2, "2 3"), ("s6", "Хозяйство 30 кВт днём", RED, "")]
    ox, oy, pw, ph = 70, 30, 650, 220
    lo, hi, st = -50000, 150000, 50000
    X = lambda t: ox + pw * t / 25
    Y = lambda v: oy + ph - ph * (min(v, hi) - lo) / (hi - lo)
    b = ""
    for v in range(lo, hi + 1, st):
        b += L(ox, Y(v), ox + pw, Y(v), INK if v == 0 else "#e4e5e8", 1.4 if v == 0 else 1) + T(ox - 6, Y(v) + 4, ru(v / 1000, 0) + " тыс.", 11, MUT, "end")
    for t in (0, 5, 10, 15, 20, 25):
        b += T(X(t), oy + ph + 18, str(t), 11, MUT, "middle")
    b += T(ox, oy - 12, "накопленный поток, BYN", 11, MUT) + T(ox + pw, oy + ph + 36, "годы", 11, MUT, "end")
    for k, name, col, dash in sc:
        c = D["scen"][k]["cum"]
        b += PL([(round(X(t), 1), round(Y(v), 1)) for t, v in enumerate(c)], col, 3, dash)
    c6 = D["scen"]["s6"]["cum"]
    b += T(ox + pw - 4, oy + 34, f"30 кВт: +{ru(c6[-1] / 1000, 0)} тыс. к 25-му году", 11, RED, "end", "700")
    for i, (k, name, col, dash) in enumerate(sc):
        x = ox + (i % 2) * 300
        y = oy + ph + 58 + (i // 2) * 18
        pay = D["scen"][k]["pay"]
        b += L(x, y - 4, x + 24, y - 4, col, 3, dash) + T(x + 30, y, f"{name}: {ru(pay, 1) + ' лет' if pay else '—'}", 11.5, INK)
    return fig(760, 356, b, "Накопленный денежный поток за 25 лет для пяти сценариев",
               "Простая окупаемость в подписях. Замены инвертора (13-й год) и батареи учтены, тариф растёт на 6 % в год. Цены оборудования и тарифы задайте свои в калькуляторе.")


def f_capex():
    keys = ["s1", "s4", "s5", "s6"]
    parts = [("mod", "Модули", INK), ("mount", "Крепление и каркас", MUT), ("inv", "Инвертор", G1), ("bat", "Батарея", RED), ("prot", "Защиты и учёт", G2), ("work", "Монтаж и проект", G3)]
    ox, oy, bw, bh, gap = 170, 14, 470, 34, 16
    b = ""
    for i, k in enumerate(keys):
        sc = D["scen"][k]
        tot = sum(sc["capexParts"].values())
        y = oy + i * (bh + gap)
        short = {"s1": "Дом 5 кВт", "s4": "Дом 10 кВт + АКБ 10", "s5": "Кровля + забор + АКБ", "s6": "Хозяйство 30 кВт"}[k]
        b += T(ox - 10, y + 22, short, 12.5, INK, "end", "700")
        x = ox
        for pk, nm, col in parts:
            w = bw * sc["capexParts"][pk] / tot
            if w > 0.5:
                b += R(round(x, 1), y, round(w, 1), bh, col)
                share = sc["capexParts"][pk] / tot * 100
                if w > 36:
                    b += T(round(x + w / 2, 1), y + 22, f"{share:.0f}%", 11.5, "#fff" if col in (INK, MUT, G1, RED, G2) else INK, "middle", "700")
            x += w
        b += T(ox + bw + 6, y + 22, ru(sc['capex'] / 1000, 0) + ' тыс. BYN', 11.5, MUT)
    lx = 10
    for pk, nm, col in parts:
        b += R(lx, 232, 11, 11, col) + T(lx + 16, 242, nm, 11, INK)
        lx += 16 + len(nm) * 6.0 + 12
    return fig(760, 256, b, "Из чего складывается стоимость станции", "Батарея в гибридной системе съедает до трети бюджета: её ставят под резерв или зонный тариф, а не «чтобы была».")
