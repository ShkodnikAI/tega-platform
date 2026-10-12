#!/usr/bin/env python3
"""Prepare compressed web media from original photos/videos (run on the owner's local server).

Originals are never modified or uploaded. For each object folder  SRC/<object-id>/  it writes
OUT/<object-id>/  with:
  N.webp        photo, long side <= 1600 px, quality 80
  N.thumb.webp  thumbnail, long side <= 480 px
  N.mp4         video, <= 720p, H.264 + AAC, faststart       (needs ffmpeg)
  N.jpg         video poster frame
All metadata (EXIF incl. GPS, camera, dates) is dropped: re-encoding writes only pixels.

Usage:  python3 tools/prepare_media.py SRC OUT [--object ID]
Requires: pip install pillow ; ffmpeg for videos.
Then upload OUT/* to the site disk (see docs/media.md).
"""
import argparse, shutil, subprocess, sys
from pathlib import Path
from PIL import Image, ImageOps

PHOTO = {".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff"}
VIDEO = {".mp4", ".mov", ".m4v", ".avi", ".mkv"}

def photo(src: Path, dst: Path, thumb: Path):
    with Image.open(src) as im:
        im = ImageOps.exif_transpose(im)          # apply rotation, then metadata is discarded
        im = im.convert("RGB")
        for out, side, q in ((dst, 1600, 80), (thumb, 480, 75)):
            c = im.copy(); c.thumbnail((side, side), Image.LANCZOS)
            c.save(out, "WEBP", quality=q, method=6)  # no exif/icc passed -> none written

def video(src: Path, dst: Path, poster: Path):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(src),
        "-map_metadata", "-1", "-vf", "scale='min(1280,iw)':-2", "-c:v", "libx264",
        "-crf", "26", "-preset", "medium", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k",
        "-movflags", "+faststart", str(dst)], check=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", "1", "-i", str(dst),
        "-frames:v", "1", "-map_metadata", "-1", "-q:v", "4", str(poster)], check=True)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src", type=Path); ap.add_argument("out", type=Path)
    ap.add_argument("--object", help="process only this object folder")
    a = ap.parse_args()
    folders = [a.src / a.object] if a.object else sorted(p for p in a.src.iterdir() if p.is_dir())
    for f in folders:
        out = a.out / f.name; out.mkdir(parents=True, exist_ok=True)
        files = sorted(p for p in f.iterdir() if p.is_file())
        n = 0
        for p in files:
            ext = p.suffix.lower()
            if ext in PHOTO:
                n += 1; photo(p, out / f"{n}.webp", out / f"{n}.thumb.webp")
            elif ext in VIDEO:
                if not shutil.which("ffmpeg"): print("ffmpeg not found, skip", p, file=sys.stderr); continue
                n += 1; video(p, out / f"{n}.mp4", out / f"{n}.jpg")
        print(f"{f.name}: {n} files")

if __name__ == "__main__":
    main()
