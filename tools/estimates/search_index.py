"""Строит индекс поиска по сайту (static/search-index.json), который читает static/search.js.

Источник — реально сгенерированный текст страниц (без дублирования контента вручную):
для калькуляторов/статей вызывает их функции-строители из build.py и вытаскивает h1,
вводный абзац и заголовки разделов (h2/h3) регулярками из готовой HTML-строки. Для
страниц, которых build.py не генерирует (услуги, объекты, о компании, контакты, главная),
используется короткий курируемый список — эти страницы меняются редко.
Поиск сейчас только на русском (контент большинства статей — RU_ONLY), как и остальной
калькулятор; это ограничение явно показано в интерфейсе поиска, а не скрыто.

Запуск: отдельно не запускается, вызывается из build.py (main()) после сборки estimates.mlog.
"""
import html as _html
import json
import re

# Фиксированные страницы, которые build.py не генерирует (определены прямо в site/main.mlog).
STATIC_PAGES = [
    ("/", "Главная", "ТЭГА ПЛЮС: ремонтно-строительные работы в Минске и по Беларуси. Элегантный инженерный подход."),
    ("/uslugi", "Услуги", "Виды ремонтно-строительных работ, которые выполняет ООО «ТЭГА ПЛЮС»."),
    ("/portfolio", "Объекты", "Портфолио выполненных объектов с поиском по названию, городу и типу работ."),
    ("/o-kompanii", "О нас", "О компании ТЭГА ПЛЮС: более 20 лет опыта, более 1000 объектов."),
    ("/kontakty", "Контакты", "Адрес, телефон, факс, e-mail и реквизиты ООО «ТЭГА ПЛЮС»."),
]


def _strip(s):
    s = re.sub(r"<[^>]+>", " ", s)
    s = _html.unescape(s)
    return re.sub(r"\s+", " ", s).strip()


def _extract(page_html):
    h1 = re.search(r"<h1>(.*?)</h1>", page_html, re.S)
    lead = re.search(r'<p class="e-lead">(.*?)</p>', page_html, re.S)
    headings = re.findall(r"<h[23]>(.*?)</h[23]>", page_html, re.S)
    return (
        _strip(h1.group(1)) if h1 else "",
        _strip(lead.group(1)) if lead else "",
        [_strip(h) for h in headings],
    )


def build_index(build_py):
    """build_py — уже импортированный модуль build.py (чтобы не плодить циклический импорт)."""
    tabs_by_id = {k: p for k, p, _ in build_py.EST_TABS + build_py.ID_TABS + build_py.REF_TABS}
    routes = [
        ("hub", build_py.hub), ("rhub", build_py.ref_hub), ("vol", build_py.volumes), ("qual", build_py.quality),
        ("elec", build_py.elec), ("water", build_py.water), ("sewer", build_py.sewer), ("heat", build_py.heat),
        ("vent", build_py.vent), ("solar", build_py.solar), ("cond", build_py.cond), ("smart", build_py.smart),
        ("price", build_py.price), ("pond", build_py.pond), ("pool", build_py.pool), ("bath", build_py.bath),
        ("wind", build_py.wind), ("roof", build_py.roof), ("found", build_py.found), ("sten", build_py.sten), ("repair", build_py.repair),
        ("fin", build_py.otdelka), ("forms", build_py.forms),
        ("idhub", build_py.idoc_hub), ("idart", build_py.idoc_art), ("idact", build_py.idoc_act),
        ("idjourn", build_py.idoc_journ), ("idterm", build_py.idoc_term),
    ]

    entries = []
    for url, title, desc in STATIC_PAGES:
        entries.append({"url": url, "title": title, "text": desc})

    for key, fn in routes:
        url = tabs_by_id.get(key)
        if not url:
            continue
        title, lead, headings = _extract(fn())
        if not title:
            continue
        entries.append({"url": url, "title": title, "text": " ".join([lead] + headings)})

    import art_idoc_forms
    akty_url = tabs_by_id.get("idact", "/ispolnitelnaya-dokumentatsiya/akty")
    for f in art_idoc_forms.FORMS:
        entries.append({
            "url": akty_url, "title": f.get("short", ""),
            "text": " ".join(filter(None, [f.get("source", ""), f.get("perechen", ""), f.get("use", "")])),
        })

    return entries


def write_index(build_py, path):
    entries = build_index(build_py)
    path.write_text(json.dumps(entries, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return len(entries)
