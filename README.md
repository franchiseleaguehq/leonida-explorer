# Leonida Explorer

**Every Street. Every Secret. Every Discovery.**

A free GTA VI interactive map: Google-Maps-style navigation over Leonida
with MapGenie-style collectible tracking. No accounts, no ads, no paywalls,
no subscriptions — free for everyone, forever.

> Fan project. Not affiliated with or endorsed by Rockstar Games or
> Take-Two Interactive. Map data: "Open GTA 6 Map" (fbritoferreira),
> CC BY 4.0 — see `docs/DATA_SOURCES.md` for the full source/licensing
> audit, including what this map honestly can and cannot show.

## Run it

```bash
npm install
npm run dev        # development server
npm run build      # production build into dist/
npm run preview    # serve the production build locally
```

Deployment (not yet done — needs Johnny's own GitHub authorization):
`dist/` is a fully static site; it deploys as-is to GitHub Pages or
Cloudflare Pages. Before deploying, run `scripts/mirror-tiles.sh` and
point `src/config.ts` tile URLs at the local mirror (the CC BY 4.0 license
permits hosting the tiles; the current config loads them from the source
project's own GitHub Pages endpoint).

## Install on your phone (PWA)

Open the site → browser menu → **Add to Home Screen** (iPhone Safari:
Share → Add to Home Screen; Android Chrome: ⋮ → Install app). The app
shell, data and viewed map tiles cache for offline use.

## Data

- The dataset lives at `public/data/locations.json` — **separate from the
  code**; updating locations never requires rebuilding the app, just
  replacing that file.
- Regenerate it from the licensed source with `node scripts/import-data.mjs`.
- Record schema: `id, name, category, county, city, neighborhood, coords
  ([lat,lng] = [-y, x] in the 1024-unit map space), description, directions,
  reward, unlock, respawn, verification, source, sourceUrl, lastVerified`.
- Verification statuses: `verified` (in-game), `official` (documented),
  `community`, `unconfirmed`, `approximate`. **Nothing is invented to fill
  a category** — empty categories display "no data yet".
- Screenshots are intentionally excluded: the source license does not cover
  Rockstar/Take-Two material.

## Features (this phase)

- Leaflet map (CRS.Simple game coordinates), day/night layers, opens fit
  to the whole state; pan / pinch / wheel / double-tap zoom, zoom buttons,
  reset view, fullscreen, compass, live coordinate readout (in-game X/Y).
- Marker clustering; 32 categories with icons, colors, counts, per-category
  toggles, show/hide all, hide-discovered.
- 5,708 seeded locations from the licensed dataset (collectibles, weapons,
  vehicles, stunt jumps, safes, robberies, stores, services, landmarks…),
  each labeled with its honest verification status.
- Detail sheet: description, directions/reward/unlock/respawn where the
  data has them, source + coordinates, Mark as found, Save favorite,
  Copy coordinates, Share (deep link `#loc=<id>`), personal note,
  Report incorrect.
- Progress: overall + per-category %, saved on-device (localStorage),
  export/import JSON backup. Unlimited custom markers.
- Search with autocomplete across names, categories and places; selecting
  a result flies the map to it.
- Waypoint: set your in-game position, pick a destination — **straight-line
  guidance, labeled as such** (no verified routable road network exists
  yet; see DATA_SOURCES.md §5).
- PWA: manifest + service worker (app shell + tile/data caching).

## Not in this phase

- GitHub Pages deployment + public URL (needs the owner's GitHub auth).
- GTADB/YANIS base layer and GTADB landmarks import (licensed CC BY 4.0;
  local git mirror required — hotlinking is prohibited by their terms).
- Community submission/admin workflow (planned: moderated GitHub PR flow).
- Offline region packs beyond runtime caching.
