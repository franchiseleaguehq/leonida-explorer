# Leonida Explorer — Data Sources & Licensing Verdicts

*Researched live on 2026-11-24 from the sources themselves (GitHub repos/API,
live JSON endpoints, live tile requests, official pages). Nothing here is
from memory. This document is the project's legal/accuracy backbone: if a
claim about the map isn't backed here, the app doesn't make it.*

## TL;DR verdict

- **Base map + main dataset: "Open GTA 6 Map" (fbritoferreira)** — CC BY 4.0,
  explicitly built for reuse, Leaflet-native tiles + the richest collectible
  dataset found (4,687 locations + 1,021 places). **Adopted.**
- **Alternate base layer / landmark dataset: GTADB (incl. YANIS v18 tiles)** —
  CC BY 4.0 data + tiles, local hosting expressly invited via git;
  **hotlinking prohibited and technically blocked (HTTP 403)**. Documented as
  a future layer; not wired in this phase.
- **Rockstar official assets: DO NOT redistribute.** The official Leonida
  poster map exists as a free download, but Take-Two's terms grant only
  personal, non-commercial use. We link/reference; we never host.
- **Street-level detail: DOES NOT EXIST in any legally reusable source.**
  Every reusable basemap is a fan-drawn illustration. See "The honest
  detail ceiling" below — the app must never claim Google-Maps-style
  street accuracy.

---

## 1. Open GTA 6 Map — fbritoferreira ✅ ADOPTED (base map + dataset)

- Repo: https://github.com/fbritoferreira/gta6 · Live: https://fbritoferreira.github.io/gta6/
- Index: https://fbritoferreira.github.io/gta6/assets.json (live, CORS `*`)

**What it offers**
- Leaflet tiles, two styles (day / night), URL scheme
  `tiles/{style}/{z}/{z},{y},{x}.webp`, 256px slots with 1024×1024px WebP
  images (sharp on retina). **Native data ends at zoom 5**; zooms 6–7 are
  magnification (their own README says so).
- Coordinate system: CRS.Simple, 1024-unit square, `lat = -y`, `lng = x`.
  Conversion to in-game coordinates (span 32,768, origin centre):
  `x = (gx + 16384) / 32`, `y = (16384 - gy) / 32`.
- `data/locations.json` — **4,687 entries** (`id, kind, x, y, name, type,
  description, screenshot, area, region, confidence, source_urls`), 42 kinds:
  collectible cards (446), hidden packages (150), safes (96), weapon pickups
  (103), stunt jumps (130), WAiNK scans (101), shops (489), food (433),
  vehicles (386), random events (282), and more.
- `data/places.json` — **1,021 named places** with real-life counterpart
  strings (`real_life`), e.g. Vice Regal ↔ The Ritz-Carlton Bal Harbour.
- `data/categories.json` — 48 kinds in 5 groups (Collectibles, Activities,
  Crime, Places, Other), each with colour/icon.
- Bonus geometry (not yet wired in): `data/roads.json` GeoJSON (9,075 road
  features: highway/main/street/minor), `data/surface.json` (2,634 building
  footprint polygons + land cover), districts/labels/land polygons.

**License** — LICENSE file in repo: **CC BY 4.0** for "data, tiles and other
original material", including commercial use, with credit + license link +
indication of changes. Suggested credit: *"Map data from Open GTA 6 Map
(fbritoferreira), CC BY 4.0"* linking the repo. (GitHub shows the license as
"Other/NOASSERTION" because of the custom preamble — the file text governs.)
- Carve-out A: Lucide icons (`icons/*.svg`, pin glyphs) are **ISC** licensed
  (keep `icons/LICENSE` if used).
- Carve-out B (critical): **Rockstar/Take-Two material is NOT covered** —
  "the game's map art and in-game screenshots belong to Rockstar Games and
  Take-Two Interactive and are not licensed here." Consequence for us:
  **the 959 screenshots are never mirrored** (our importer drops the
  `screenshot` field entirely). The rendered tiles are the project's own
  assertion of CC BY; the residual Rockstar-IP risk in the traced poster art
  is disclosed by the licensor itself.

**Detail level (verified)** — tiles are *rendered from vector data traced
from Rockstar's printable poster map + community tiles*: flat land/water,
coastline, park/urban/sand shading, flat building-footprint silhouettes,
stroked road/rail lines by class. **No street names exist in the source
("The map has no street names, so there are none here"), no photographic
imagery, no addresses.** Data honesty: 3,097 of 4,687 locations carry
`confidence: "community"` and 1,590 carry none — our importer labels those
"Community verified" and "Unconfirmed" respectively, never higher.

**May host locally?** ✅ Yes — CC BY 4.0 is a copy/redistribute license.
This phase loads tiles from the project's own GitHub Pages endpoint (their
sanctioned, CORS-open distribution); `scripts/mirror-tiles.sh` performs the
local mirror for deployment.

## 2. GTADB / YANIS — rolux/gtadb.org ✅ licensed, ⏸ not wired this phase

- Site: https://map.gtadb.org · Repo: https://github.com/rolux/gtadb.org
- Licenses (repo root): **MIT (code)**; **`LICENSE-DATA`: CC BY 4.0 for all
  data and image files** (landmarks, photos, tiles). Preferred attribution:
  *"GTA VI Map Tiles (CC BY 4.0) — https://map.gtadb.org"* /
  *"GTA VI Landmarks Data (CC BY 4.0) — https://map.gtadb.org"*.
- README, verbatim in substance: *"You are welcome to use the landmark data,
  photos or map tiles for your own purposes. **Please do not fetch live data
  or media from gtadb.org** — simply `git pull` for updates"* (sparse-checkout
  `map/data/6 map/photos/6 maps/tiles/6` suggested). Verified live: their tile
  server returns **403** without a gtadb referer — hotlinking is both
  prohibited and broken by design.
- Tiles: `maps.gtadb.org/tiles/6/{set}/{z}/{z},{y},{x}.jpg`, 256px JPEG,
  game-coordinate space ±16,000. Tilesets: `day` (post-launch default, max
  z6, rendered from a 24,000×24,000 source, ~1 px/m at z5), `dupzor,51`,
  `yanis,15`, **`yanis,18`** (all max z5), plus contributor overlays.
- **YANIS** is the GTA VI Mapping Community's hand-drawn basemap artwork
  (coastline, roads, city blocks) reconstructed frame-by-frame from trailers
  and screenshots. **v18 was committed 2026-11-17 — two days BEFORE launch.**
  It is a very good pre-release reconstruction, *not* post-release verified
  ground truth; downstream sites are still re-verifying it piecemeal, and
  GTADB itself superseded it as default with the `day` set on Nov 19.
- Dataset: `map/data/6/landmarks.json` — **4,293 GTA VI records** pairing
  in-game places with real-life counterparts (name, in-game coords, real
  address, real lat/lon, type tags). Genuinely valuable; convertible into
  our CRS via the published game-coordinate formula. Many records are
  unnamed/unconfirmed (`?` entries are pervasive).
- Detail verdict: same ceiling as §1 — flat illustrated tiles (measured:
  ~250–830 distinct colours per GTA VI tile vs ~12,000 on GTA V satellite
  tiles). Zooming past z5–z6 magnifies a drawing.
- Caveat: GTADB's CC BY covers *its contributors'* work; its FAQ concedes
  the material incorporates Rockstar content and leak material, defended on
  a non-commercial fair-use posture. The `day` tileset in particular is
  described by third parties as depicting Rockstar's in-game artwork. For
  this free, non-commercial fan project with attribution, the GTADB grant
  is the cleanest available; it is not a commercial clearance.

## 3. Rockstar Games official ❌ do not redistribute

- https://www.rockstargames.com/VI and /VI/media (fetched live): marketing
  pages + media kit (videos, 138 screenshots, artwork/wallpapers). The kit
  includes the official **"Leonida Map & Cover Art Poster"** — a printable
  road-map-style poster of the whole state (reported 5775×7900 JPEG, ~45 MB
  zip, posted launch day Nov 19, 2026). It names five counties (Lummox,
  Kelly, Leonard, Vice-Dale, Mariana) and has **no street names**.
- Legal position (Take-Two ToS §2.2, fetched live): content is licensed for
  **personal, non-commercial use only**; no copying/distributing/derivatives
  without separate written terms. Rockstar's fan-content policy tolerates
  occasional non-commercial fan use, revocably, and expressly doesn't cover
  digital publishing. **Verdict: reference and link only. Never host the
  poster, screenshots, or in-game map captures in this app.** (Johnny's own
  uploaded poster photo stays his personal reference, not an app asset.)

## 4. Other datasets surveyed

| Source | What | License | Verdict |
|---|---|---|---|
| Leonida Atlas (github.com/navanem/gta6-leonida-atlas) | Web atlas repackaging GTADB (3,437 places) | Code AGPL-3.0; data CC BY 4.0 (GTADB) | Consumer of GTADB, not independent data |
| Leonida Intelligence (github.com/thethriftypilot) | LAN map companion, ~4,000 places | Code MIT; data GTADB CC BY | Same GTADB lineage |
| GTA 6 Loot Map (github.com/theihtishaam) | Loot/collectible dataset + tracker | MIT | Only independent post-launch loot dataset found with a clear license — candidate future import |
| Vice Assist open data | GeoJSON, 36 markers / 7 regions | CC BY 4.0 | Clean but tiny, pre-launch, approximate |
| GTAMap.io "Streets" layer | 150-layer vector street map | **No license stated**; base is Rockstar artwork | Most detailed post-launch street product found — **not reusable** |
| gta6map.github.io | Interactive landmark map | No license | Not reusable |

## 5. The honest detail ceiling (read before promising anyone anything)

1. **No legally reusable source provides true street-level tiles of
   Leonida.** The best licensed basemaps (fbritoferreira, GTADB/YANIS) are
   fan-drawn illustrations: road *lines* and building *footprints* exist as
   geometry, but there are no street names (fbritoferreira), no photographic
   detail, no addresses, no entrances/alleyways. Max native zoom: 5–6.
2. **The most accurate post-launch products are not licensed for reuse**
   (GTAMap.io vector streets; stitched in-game pause-map captures), and
   Rockstar's own poster is region/road level and proprietary.
3. **All current basemaps and most location data are pre-release
   reconstructions or community reports**, being re-verified after the
   Nov 19, 2026 launch. Hence the app's verification labels are load-bearing:
   *Verified in-game / Officially documented / Community verified /
   Unconfirmed / Approximate* — and the seeded dataset is honestly
   4,111 community + 1,596 unconfirmed + 1 official out of 5,708.
4. **Routing:** road *geometry* exists (fbritoferreira roads.json), but no
   verified routable network (topology/turn data) exists in any licensed
   source. The app therefore offers **straight-line waypoint guidance,
   labeled as such** — never fake road routing.
5. **The 37-spot verified catalog** from Johnny's earlier gta-6-map work is
   not in any licensed public dataset; it can be imported later through the
   same JSON schema (`data/` format documented in the importer) once it is
   exported from that artifact.

## Attribution strings used by the app

- Leaflet attribution control + About panel:
  *"Map data from Open GTA 6 Map (fbritoferreira), CC BY 4.0 —
  https://github.com/fbritoferreira/gta6 · Fan project, not affiliated with
  Rockstar Games or Take-Two Interactive"*
- Dataset file header (`public/data/locations.json`) carries the same
  attribution and the note that screenshots were intentionally omitted.

## 6. Labels layer (added 2026-11-24, after Johnny asked "no street names?")

Generated by `scripts/import-labels.mjs` into `public/data/labels.json`
(**1,148 labels**). Every label is a verbatim name from licensed data:

| Tier | Count | Source | What it is |
|---|---|---|---|
| District | 10 | fbritoferreira `data/labels.json` | Vice City, Vice Beach, Hamlet, Port Gellhorn, … at the source's own label anchor points |
| Highway | 25 points / 11 refs | fbritoferreira `data/routes.json` | Route shields verbatim: I-97, I-297, I-397, I-404, US-35, US-82, US-183, US-628, SR-1A, CR-62 |
| Neighborhood | 62 | GTADB landmarks (CC BY 4.0) | Distinct "area" strings backed by ≥8 landmark records, placed at their records' centroid; district names already covered above are not duplicated. Plus 11 areas below that threshold that the official poster independently confirms as named places (Grayson, Grassrivers, Mount Kalaga National Park, Emerald Springs, Hyde Island, Frampton Islands, Zephyr Islands, Draper Island, Maroon Key, Goose Key, Belpoint) — names/coordinates still 100% GTADB-verbatim; the poster was used only as an inclusion filter, never as data |
| Landmark | 1,051 | GTADB landmarks (CC BY 4.0) | Records with a real in-game place name (of 4,195 records: 1,097 named, 46 of those skipped for corrupt coordinates) |

GTADB coordinate conversion (game units → map units) was cross-validated:
record L1 "Vice Regal" converts to exactly the fbritoferreira place
coordinates (556, 424.4).

**Street names — the definitive negative:** fbritoferreira `data/roads.json`
(9,075 road features) carries exactly one property, `kind` — a full scan
found **zero** named roads, and the source states the map has no street
names. GTADB's landmark data contains no road geometry or street-name
field either (a handful of its *area* descriptors are street-named areas,
e.g. "Catalan Blvd" — shipped verbatim as area labels, not as street
labels). No other licensed dataset surveyed in §4 carries street names.
**Conclusion: street-name labels do not exist in any legally reusable
dataset, so the app ships none — and never invents any.**

**Poster cross-check (2026-11-24):** every legible name on Johnny's
photos of the official poster was checked against the licensed datasets.
All 5 counties, 13 of 16 towns, 5 of 5 legible Vice City neighborhoods and
all 10 highway numbers are shipped as labels, with placements consistent
with the poster (relative ordering verified; cross-dataset check: 913
named places exist in both GTADB and fbritoferreira with a median
placement offset of 0.1 map units). **Poster names found in NO licensed
dataset** (not shipped — the poster is proprietary and is never a data
source): Bonanza (town); Featherstone Islands; Breakwater Quarry,
Frogwater, Pelican Valley (areas). A few poster micro-labels on the keys
and the Vice Beach island chain were not legible enough in the photos to
transcribe reliably and were not classified.

## 7. World geometry overlays (added 2026-11-25 — "feel like the game map")

Same licensed source as the basemap (Open GTA 6 Map, fbritoferreira, CC BY 4.0),
imported by `scripts/import-roads.mjs` and `scripts/import-world.mjs`:

- `public/data/roads.json` — 9,026 road polylines from `data/roads.json`
  (kinds: highway 2,230 · main 281 · street 1,920 · minor 4,595). Geometry
  only; the source carries NO road names (see §6 verdict — unchanged).
- `public/data/surface.json` — surface polygons by layer: building 2,650 ·
  park 465 · sand 316 · urban 516 · shallow 1,766 · paved 4 rings.
- `public/data/zones.json` — 10 district polygons + 1,549 landmass rings.

Drawn as canvas vector overlays styled after the in-game map (dark base
default, pale road bands that widen with zoom, blue building blocks from
zoom 2, faint district tints, glowing coastline). The base raster tiles
still end at native zoom 5 and magnify beyond it; the vector overlays are
what stay crisp. No Rockstar assets are used or hosted.
