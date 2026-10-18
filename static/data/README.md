# objects.json — completed objects shown on the portfolio map

Array of objects. Only public information: do not publish exact client addresses without consent
(use `place` for a street/district-level description and approximate coordinates).

```json
{
  "id": "unique-latin-slug",
  "title": "Name of the object",
  "type": "Work type (office / retail / industrial / ...)",
  "year": 2024,
  "area_m2": 850,
  "city": "Минск",
  "place": "Public description of the location",
  "lat": 53.9006,
  "lng": 27.5590,
  "summary": "Two or three sentences: the task, what was done.",
  "photos": ["/media/<id>/1.webp"]
}
```

# feed.json — news and articles for the home page carousel

Array; the carousel shows the 5 newest records of feed.json + objects.json (by `date`).
Text fields may be a string or `{"ru": "...", "be": "...", "en": "..."}`.

```json
{ "kind": "news | article", "title": "Заголовок", "summary": "Одна-две строки",
  "date": "2026-10-18", "url": "/novosti/slug", "image": "/media/news/slug.webp" }
```
