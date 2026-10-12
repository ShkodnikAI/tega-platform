# Findings while building on Metalogos v0.30.1 (HEAD 34a6370)

Facts verified by running the binary; candidates for naryads.

1. **False positive in the onX lint** (`src/semantic.rs`, `detect_xss_payload`): `content=` in
   `<meta ... content="...">` is read as an `onX=` handler (`on` + letters + `=`, no word boundary).
   Any string containing `content=` fails `mlog check`. Workaround: `content = "..."`.
2. **`render()` always escapes and `| safe` is not supported** (`src/builtins/http.rs:43`), although a
   `template Layout` example uses `{{ content | safe }}`. Nested Html composed through `render()` is escaped.
   Use `template_render()` with `{{{ raw }}}`.
3. **`respond()` / `respond_html()` accept String only**; an Html value must be returned directly (`return Page(...)`).
4. **Top-level `entity` is not visible inside `server { route ... }`** (value is Unit there). Use patterns.
5. **`middleware: [security_headers]`**: a plain GET showed no security headers in `curl -i`; to be re-verified.
6. String literals may contain raw newlines; embedded `"` must be escaped.
