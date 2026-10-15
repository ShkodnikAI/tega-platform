# Materials database (calculator source data)

One JSON file per material card in `cards/`. Every number is either
- `declared` — taken from the manufacturer's technical data sheet (source URL, document date and access date are mandatory), or
- `derived` — computed from declared values by a formula written next to it, or
- `reference` — general technical knowledge, marked as such, never presented as a manufacturer figure.

Nothing is invented: a value the manufacturer does not state is `null` with the note "not stated".
Validate: `python3 tools/validate_materials.py` (checks required fields, sources, and that derived values match their formulas).
