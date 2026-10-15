# Библиотека норм НРР-2022 (приватные данные)

Нормы, технические части и каталог материалов берутся из SmrPro и **не хранятся в открытом виде** нигде:
ни в публичном репозитории, ни в `tega-content`.

## Поток данных

```
ПК владельца                      GitHub (приватный tega-content)         Render (контейнер сайта)
D:\SmrPro\Base\NRR2022            Releases: norms-YYYYMMDD-HHMM           при старте:
  update-norms.ps1  ──age──►        norms.zip.age (только шифртекст) ──►    скачать, расшифровать в RAM (/dev/shm),
  (rscer, mat, meh, tech)                                                   tools/norms/build.py -> norms.json
```

* Шифрование: [age](https://github.com/FiloSottile/age), публичным ключом. Приватный ключ знает только владелец
  и хранит его в переменной окружения Render `NORMS_AGE_KEY`. Потерян ключ — данные не восстановить (источник остаётся в SmrPro).
* Расшифрованные данные живут только в памяти контейнера (`/dev/shm`), на диск не пишутся.
* Сайт отдаёт посетителю только результаты расчёта, а не таблицы норм (ограничение частоты запросов обязательно).

## Обновление (на ПК владельца)

```powershell
winget install FiloSottile.age ; winget install GitHub.cli ; gh auth login   # один раз
.\tools\norms\update-norms.ps1 -PublicKey age1xxxx... -DeployHook "https://api.render.com/deploy/srv-...?key=..."
```

## Формат (`tools/norms/build.py` -> `norms.json`)

* `works[]`: `code`, `name`, `per` + `unit` (на какой объём), `labor_h` (чел.-ч), `grade` (разряд), `labor_machinist_h`,
  `materials[]` (`code`, `qty` на `per`), `machines[]` (`code`, `hours`), `replaceable[]` (заменяемые материалы), `scope[]` (состав работ).
* `materials{}` и `machines{}` — справочники по кодам (название, единица).
* Читалка таблиц FoxPro без зависимостей — `tools/norms/vfp.py`. Тесты на синтетических таблицах — `tests/norms/test_norms.py`.

## В контейнере

`deploy/entrypoint.sh` в фоне запускает `tools/norms/fetch.py` (сайт не ждёт). Нужны переменные Render:
`NORMS_AGE_KEY` (приватный ключ age), `CONTENT_READ_TOKEN` (fine-grained токен, только Contents: read для `tega-content`).
Источник: последний релиз с `norms.zip.age`, иначе файл `norms/norms.zip.age` в ветке `main` (`CONTENT_REF`).
Результат — `/dev/shm/norms/norms.json.gz` (gzip: tmpfs хоста мал, а json ~95 МБ); сырые таблицы удаляются сразу после сборки. Без переменных шаг пропускается.
В логе только счётчики (`[norms] ready: N works…`), содержимое и ключ не пишутся.

## Ещё не сделано

* Модель калькулятора поверх `norms.json` (API с ограничением частоты).
* Разбор технических частей (RTF): коэффициенты, правила определения объёмов, матрицы операций.
* Модель калькулятора поверх библиотеки.

Лицензия: нормы НРР — собственность РНТЦ; условия использования проверяет владелец. На сайте тексты технических частей дословно не воспроизводятся.
