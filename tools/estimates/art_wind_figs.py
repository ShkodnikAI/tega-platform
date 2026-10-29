"""Рисунки статьи «Ветрогенераторы»: чистый SVG без встроенных стилей и скриптов (CSP сайта их не пропускает).
Выработка посчитана той же моделью, что и калькулятор (static/wind-model.js): Вейбулл k = 2, ВЭУ 3 кВт (старт 3 м/с, номинал 11 м/с, останов 25 м/с), потери системы 15 %."""
import math
from art_figs import T, R, L, PL, arrow, fig, INK, RED, MUT, G1, G2, G3, SOFT
from art_vent_figs import TH, ru

PR, VR, VCI, VCO, ETA, K = 3.0, 11.0, 3.0, 25.0, 0.85, 2.0


def power(v, pr=PR, vr=VR, vci=VCI, vco=VCO):
    if v < vci or v > vco:
        return 0.0
    if v >= vr:
        return pr
    return pr * (v ** 3 - vci ** 3) / (vr ** 3 - vci ** 3)


def pdf(v, vmean, k=K):
    c = vmean / math.gamma(1 + 1 / k)
    return 0.0 if v <= 0 else (k / c) * (v / c) ** (k - 1) * math.exp(-((v / c) ** k))


def mean_power(vmean, pr=PR):
    dv = 0.05
    s, v = 0.0, dv / 2
    while v < 45:
        s += power(v, pr) * pdf(v, vmean) * dv
        v += dv
    return s


def annual(vmean, pr=PR):
    return mean_power(vmean, pr) * 8760 * ETA


def cf(vmean, pr=PR):
    return annual(vmean, pr) / (pr * 8760)


def hub(v10, h, alpha=0.2, h0=10.0):
    return v10 * (h / h0) ** alpha


def f_steps():
    steps = [("1", "Замер ветра", "на высоте ступицы"), ("2", "Место и высота", "выше препятствий"), ("3", "Выбор ВЭУ", "по кривой мощности"),
             ("4", "Мачта", "и фундамент"), ("5", "Электрика", "и защита от шторма"), ("6", "Оформление", "и пуск")]
    b = ""
    for i, (n, t, s) in enumerate(steps):
        x = 6 + i * 125
        col = RED if i == 0 else INK
        b += R(x, 14, 115, 96, col) + T(x + 12, 42, n, 22, "#fff", "start", "700") + T(x + 12, 66, t, 13, "#fff", "start", "700") + T(x + 12, 86, s, 10.5, "#dcdde0")
        if i < 5:
            b += arrow(x + 116, 62, x + 124, 62, MUT, 2)
    b += T(6, 136, "Первый шаг не «выбрать ветряк», а измерить ветер: без замера или карты ветров все следующие шаги гадание.", 12, MUT)
    return fig(760, 150, b, "Шесть шагов при выборе ветроустановки", "Порядок решений: сначала ветер, потом место и мачта, и только потом модель ветряка и электрика.")


def f_cube():
    ox, oy, w, h = 70, 20, 620, 220
    def X(v): return ox + v / 14 * w
    def Y(p): return oy + h - p * h
    b = R(ox, oy, w, h, SOFT, G3, 1)
    for p in (0.25, 0.5, 0.75, 1.0):
        b += L(ox, Y(p), ox + w, Y(p), G3, 1, "3 4") + T(ox - 8, Y(p) + 4, f"{int(p * 100)} %", 11, MUT, "end")
    for v in range(0, 15, 2):
        b += T(X(v), oy + h + 16, str(v), 11, MUT, "middle")
    pts = [(X(v / 10), Y(min(1.0, (v / 10 / 11) ** 3))) for v in range(0, 141)]
    b += PL(pts, INK, 3)
    for v, col, lab in ((5.5, RED, "5,5 м/с: 12,5 % номинала"), (11, G1, "11 м/с: номинал")):
        b += L(X(v), Y(min(1.0, (v / 11) ** 3)), X(v), oy + h, col, 2, "4 3")
    b += R(X(5.5) - 4, Y(0.125) - 4, 8, 8, RED) + TH(X(5.5) + 12, Y(0.125) - 8, "5,5 м/с: 12,5 % номинала (3 кВт дают около 0,4 кВт)", 12, RED, "start", "700")
    b += TH(X(11) - 8, Y(1.0) - 8, "11 м/с: номинал", 12, INK, "end", "700")
    b += T(ox + w, oy + h + 36, "скорость ветра, м/с", 11, MUT, "end")
    return fig(760, 290, b, "Куб скорости: мощность ветра", "Мощность ветра растёт как куб скорости: вдвое меньше ветер, в восемь раз меньше мощность. Кривая показывает долю потока, которую можно взять при номинале на 11 м/с.")


def f_curve(vmean=5.5):
    ox, oy, w, h = 70, 20, 620, 220
    vmax = 26.0
    def X(v): return ox + v / vmax * w
    def Y(p): return oy + h - p / PR * h
    b = R(ox, oy, w, h, SOFT, G3, 1)
    for p in (0.5, 1.0, 1.5, 2.0, 2.5, 3.0):
        b += L(ox, Y(p), ox + w, Y(p), G3, 1, "3 4") + T(ox - 8, Y(p) + 4, ru(p, 1), 11, MUT, "end")
    for v in range(0, 27, 4):
        b += T(X(v), oy + h + 16, str(v), 11, MUT, "middle")
    # распределение Вейбулла
    pm = max(pdf(v / 10, vmean) for v in range(1, 260))
    for i in range(0, 260):
        v = i / 10
        hh = pdf(v + 0.05, vmean) / pm * 90
        b += R(X(v), oy + h - hh, X(0.1) - ox, hh, G3)
    pts = [(X(v / 10), Y(power(v / 10))) for v in range(0, 261)]
    b += PL(pts, INK, 3)
    b += L(X(vmean), oy, X(vmean), oy + h, RED, 2, "5 3") + TH(X(vmean) + 8, oy + 16, f"средняя скорость {ru(vmean, 1)} м/с", 12, RED, "start", "700")
    b += TH(X(15), Y(PR) - 8, "кривая мощности ВЭУ 3 кВт", 12, INK, "start", "700")
    b += TH(X(14), oy + h - 56, "серые столбцы: сколько часов дует каждый ветер", 12, MUT, "start")
    b += T(ox - 52, oy + 4, "кВт", 11, MUT, "end") + T(ox + w, oy + h + 36, "скорость ветра, м/с", 11, MUT, "end")
    e = annual(vmean)
    b += T(ox, oy + h + 52, f"Выработка за год: {ru(round(e, -1), 0)} кВт·ч, КИУМ {ru(cf(vmean) * 100, 0)} % (потери системы 15 %, Вейбулл k = 2)", 12, INK, "start", "700")
    return fig(760, 316, b, "Кривая мощности и распределение ветра", "Выработка это площадь под кривой, взвешенная повторяемостью ветров. Большая часть часов приходится на слабые ветры, где мощность мала.")


def f_yield():
    speeds = [4.0, 4.5, 5.0, 5.5, 6.0, 7.0]
    ox, oy = 150, 34
    mx = annual(7.0)
    sc = 420.0 / mx
    b = T(6, 20, "Годовая выработка ВЭУ 3 кВт по средней скорости на ступице", 13, INK, "start", "700")
    for i, v in enumerate(speeds):
        y = oy + i * 40
        e = annual(v)
        col = G3 if v < 4.5 else (INK if v <= 6 else RED)
        b += T(ox - 10, y + 20, f"{ru(v, 1)} м/с", 12, INK, "end", "700") + R(ox, y, max(2, e * sc), 28, col)
        b += T(ox + e * sc + 8, y + 19, f"{ru(round(e, -1), 0)} кВт·ч, КИУМ {ru(cf(v) * 100, 0)} %", 12, INK, "start", "700")
    b += T(6, oy + 6 * 40 + 14, "Серый: ниже 4,5 м/с выгоднее солнце. Чёрный: 4,5–6 м/с гибрид. Красный: выше 6 м/с ветер основной. Потери системы 15 %, Вейбулл k = 2.", 11, MUT)
    return fig(760, oy + 6 * 40 + 34, b, "Выработка ВЭУ 3 кВт по скорости ветра", "Пересчёт модели калькулятора. КИУМ 18 % достигается лишь при средней скорости около 5,5 м/с на ступице, на равнине он заметно ниже.")


def f_site():
    b = R(10, 10, 560, 250, SOFT, INK, 2.5)
    cx, cy, rad = 190, 140, 100
    b += f'<circle cx="{cx}" cy="{cy}" r="{rad}" fill="#fbe5e7" stroke="{RED}" stroke-width="2" stroke-dasharray="6 4"/>'
    b += f'<circle cx="{cx}" cy="{cy}" r="{rad * 1.4}" fill="none" stroke="{G1}" stroke-width="1.5" stroke-dasharray="3 5"/>'
    b += R(cx - 6, cy - 6, 12, 12, RED) + TH(cx + 12, cy + 4, "мачта", 12, INK, "start", "700")
    b += TH(cx - rad + 6, cy - rad - 6 + 20, "зона падения H + R", 12, RED, "start", "700")
    b += TH(cx + rad * 1.4 - 6, cy + 4 + 80, "лёд 1,5 (H + D)", 12, MUT, "end")
    b += R(440, 60, 110, 70, "#fff", INK, 2) + T(495, 100, "дом соседа", 12, INK, "middle", "700")
    b += R(440, 160, 110, 70, "#fff", INK, 2) + T(495, 200, "свой дом", 12, INK, "middle", "700")
    b += L(cx + rad, cy, 440, 95, G1, 1, "2 3") + T(330, 74, "30–50 м до окон", 12, INK, "middle", "700")
    b += T(580, 30, "Граница участка проходит", 12, MUT) + T(580, 48, "вне красной зоны:", 12, MUT) + T(580, 66, "мачта целиком падает", 12, MUT) + T(580, 84, "на свой участок.", 12, MUT)
    b += T(580, 120, "Ледяная зона больше", 12, MUT) + T(580, 138, "зоны падения: зимой", 12, MUT) + T(580, 156, "под обледенением ВЭУ", 12, MUT) + T(580, 174, "останавливают.", 12, MUT)
    return fig(760, 276, b, "План участка: зона падения, лёд и окна", "H высота ступицы, R радиус ротора, D диаметр. Ориентиры практики и зарубежных руководств, значения для своей площадки считает проектировщик.")
