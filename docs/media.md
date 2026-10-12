# Portfolio media

- **Originals** stay on the owner's local server. They are never committed to git or uploaded as-is.
- **Web copies** are produced by `tools/prepare_media.py` (photo: WebP ≤1600 px + 480 px thumbnail; video: MP4 ≤720p; poster JPG). All metadata, including GPS, is removed.
- On the site they live on the persistent disk: `/data/media/<object-id>/…`, served at `/media/<object-id>/…` by Caddy (1-week cache).
- In `static/data/objects.json` photos are referenced as `/media/<object-id>/1.webp` (relative, so the storage can be moved to an S3-compatible bucket/CDN later by changing only the proxy).
- Disk: 10 GB at the start (a 1 GB web copy set holds ~3000 photos). It can be enlarged in Render, never reduced.

Upload (from the machine with the web copies), via the Render Shell or scp to the service: copy `OUT/<object-id>/` into `/data/media/`.
Before publishing an object: client's consent for photos and address; for sensitive objects show the district, not the exact point.
