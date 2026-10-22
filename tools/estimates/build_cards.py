#!/usr/bin/env python3
"""Рисует скачиваемые карточки «Качество работ» (PNG и PDF с водяным знаком) в static/cards/.

Нужны Python-пакет playwright и Chromium. Запуск из корня репозитория:  python3 tools/estimates/build_cards.py
"""
import pathlib, sys, tempfile
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import cards as C
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).parent.parent.parent
OUT = ROOT / "static" / "cards"
WM = ('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><g transform="rotate(-24 300 200)">'
      '<text x="300" y="190" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="700" letter-spacing="2" fill="#1d1f23" fill-opacity="0.10">ТЭГА ПЛЮС</text>'
      '<text x="300" y="224" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="21" font-weight="700" letter-spacing="2" fill="#e3000f" fill-opacity="0.14">САЙТ В РАЗРАБОТКЕ</text></g></svg>')


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    tmp = pathlib.Path(tempfile.mkdtemp(prefix="cards-"))
    (tmp / "wm.svg").write_text(WM, encoding="utf-8")
    fonts = (ROOT / "static" / "fonts").as_uri()
    logo = (ROOT / "static" / "logo-ru.png").as_uri()
    with sync_playwright() as p:
        b = p.chromium.launch()
        for card in C.CARDS:
            f = tmp / f"{card['slug']}.html"
            f.write_text(C.standalone_html(card, fonts, logo, (tmp / "wm.svg").as_uri()), encoding="utf-8")
            pg = b.new_page(viewport={"width": 1080, "height": 900}, device_scale_factor=1.5)
            pg.goto(f.as_uri())
            pg.wait_for_load_state("networkidle")
            pg.evaluate("document.fonts.ready")
            h = pg.evaluate("document.querySelector('.sheet').getBoundingClientRect().height")
            pg.locator(".sheet").screenshot(path=str(OUT / f"{card['slug']}.png"))
            pg.pdf(path=str(OUT / f"{card['slug']}.pdf"), width="1080px", height=f"{int(h) + 2}px", print_background=True, margin=dict(top="0", right="0", bottom="0", left="0"))
            pg.close()
            print(card["slug"], int(h))
        b.close()


if __name__ == "__main__":
    main()
