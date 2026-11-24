#!/usr/bin/env bash
# Mirror the "Open GTA 6 Map" tiles locally for deployment.
# License: CC BY 4.0 — credit "Open GTA 6 Map" and link
# https://github.com/fbritoferreira/gta6 wherever the map is shown.
# After mirroring, set MAP_CONFIG tile URLs in src/config.ts to
# './tiles/day/{z}/{z},{y},{x}.webp' and './tiles/night/...'.
#
# ~9,000 tiles per style (1024px WebP). Blank/off-land tiles 404 — expected.
set -u
BASE="https://fbritoferreira.github.io/gta6/tiles"
DEST="${1:-public/tiles}"
for style in day night; do
  for z in 0 1 2 3 4 5; do
    max=$(( (1 << z) * 4 - 1 ))   # 1024 units / 256px tiles, offset grid tops out higher; brute range is safe (404s skipped)
    for ((y=0; y<=max+100; y++)); do
      for ((x=0; x<=max+100; x++)); do
        url="$BASE/$style/$z/$z,$y,$x.webp"
        out="$DEST/$style/$z/$z,$y,$x.webp"
        [ -f "$out" ] || curl -sf "$url" -o "$out" --create-dirs || true
      done
    done
  done
done
echo "Mirror complete into $DEST (note: brute-force range fetches many 404s; a smarter route is the repo git tree listing)."
