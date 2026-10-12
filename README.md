# tega-platform (public)

Engine of the TEGA PLUS website and AI platform, written in Metalogos (mlog).

Contains only code, templates, tests and synthetic fixtures.
It must NEVER contain: secrets, customer data, Telegram exports, real tender data,
private photos, or brand source files (.ai/.cdr). Those live in `tega-content` (private).

## Layout
- `site/` routes and pages (`mlog serve`)
- `agents/` consultant, tender-search agent, analytics
- `templates/` HTML templates
- `tests/` `.mlog` tests with `.expected` pairs (synthetic data only)
- `docs/` English-only documentation

## Rules
- All changes via pull request; CI (`mlog check`, `mlog audit`) must be green.
- Secrets only in server environment variables / GitHub Actions secrets.
- Docs in English.

## Licence

Proprietary, all rights reserved by ООО «ТЭГА ПЛЮС». See `LICENSE`.
