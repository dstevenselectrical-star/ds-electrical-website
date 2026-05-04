#!/usr/bin/env python3
"""
find-visual-dupes.py — detect visual duplicates in DS Electrical website photos.

Run BEFORE publishing any new gallery additions. Reports image PAIRS that look
the same even if their bytes differ (resized/recompressed/cropped copies).

Usage:
    /Users/danstevens/blueprint-sync/.venv/bin/python scripts/find-visual-dupes.py [--threshold 12]

A hamming distance of 0 = byte-perfect lookalike. <=12 = clearly the same photo.
Distances 13-25 = same scene but different shot — judgment call.
"""
import argparse
import glob
import os
import sys

try:
    from PIL import Image
except ImportError:
    sys.stderr.write("PIL/Pillow not installed. Use the blueprint-sync venv:\n")
    sys.stderr.write("  /Users/danstevens/blueprint-sync/.venv/bin/python scripts/find-visual-dupes.py\n")
    sys.exit(1)

BASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "photos")
BASE = os.path.normpath(BASE)


def dhash(path: str, hash_size: int = 10) -> int | None:
    """Difference hash, robust to resize / recompression."""
    try:
        with Image.open(path) as im:
            im = im.convert("L").resize((hash_size + 1, hash_size), Image.LANCZOS)
            pixels = list(im.getdata())
    except Exception:
        return None
    bits = 0
    for row in range(hash_size):
        for col in range(hash_size):
            left = pixels[row * (hash_size + 1) + col]
            right = pixels[row * (hash_size + 1) + col + 1]
            bits = (bits << 1) | (1 if left > right else 0)
    return bits


def hamming(a: int, b: int) -> int:
    return bin(a ^ b).count("1")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--threshold", type=int, default=12,
                    help="Max hamming distance to flag as a lookalike (default 12)")
    args = ap.parse_args()

    paths = sorted(
        glob.glob(os.path.join(BASE, "*.jpg")) +
        glob.glob(os.path.join(BASE, "gallery", "*.jpg"))
    )
    print(f"Hashing {len(paths)} photos in {BASE}…")
    hashes: list[tuple[str, int]] = []
    for p in paths:
        h = dhash(p)
        if h is not None:
            rel = os.path.relpath(p, BASE)
            hashes.append((rel, h))

    pairs = []
    for i in range(len(hashes)):
        for j in range(i + 1, len(hashes)):
            d = hamming(hashes[i][1], hashes[j][1])
            if d <= args.threshold:
                pairs.append((d, hashes[i][0], hashes[j][0]))

    pairs.sort()
    print(f"\nFound {len(pairs)} lookalike pairs (hamming <= {args.threshold}):")
    for d, a, b in pairs:
        marker = "BYTE-IDENTICAL-PIXELS" if d == 0 else "near-dup"
        print(f"  d={d:2d}  [{marker}]  {a}   <->   {b}")
    print()
    print("If any pair appears in gallery.html as separate items, remove one.")
    print("Cross-reference against gallery.html with:")
    print("  grep -E '<filename>' ../gallery.html")
    return 1 if pairs else 0


if __name__ == "__main__":
    sys.exit(main())
