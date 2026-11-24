#!/usr/bin/env node
/**
 * Import map LABELS for Leonida Explorer -> public/data/labels.json.
 *
 * Two licensed sources (both CC BY 4.0 — see docs/DATA_SOURCES.md):
 *
 * 1. "Open GTA 6 Map" (fbritoferreira) — the adopted basemap project:
 *    - data/labels.json: label anchor points for the 10 districts.
 *    - data/routes.json: highway route references (I-97, US-35, SR-1A, ...)
 *      at points along each route.
 *    - NOTE: its data/roads.json (9,075 road features) carries ONLY a
 *      `kind` property — zero named roads. The source itself states the
 *      map has no street names. No street-name labels are generated.
 *
 * 2. GTADB landmarks (rolux/gtadb.org, "GTA VI Landmarks Data (CC BY 4.0)
 *    — https://map.gtadb.org") — map/data/6/landmarks.json, distributed
 *    via git (hotlinking their live endpoints is prohibited; this script
 *    downloads the dataset file once and the app hosts the output).
 *    Each record is an array whose first element is the composite string
 *    "Place name, Area, City" (any part may be "?" = unnamed):
 *    - tier "landmark": records whose place name is present (not "?"),
 *      verbatim, at the record's coordinates.
 *    - tier "neighborhood": distinct Area strings backed by >= 8 landmark
 *      records, placed at the centroid of those records. District names
 *      already covered by the fbritoferreira district labels are skipped
 *      to avoid duplicates. These are the dataset's own area descriptors,
 *      verbatim — a few are street-named areas (e.g. "Catalan Blvd"),
 *      which is how the source records them.
 *    GTADB coordinates are in-game units (span +/-16384); conversion to
 *    the app's map-unit space is x = (gx + 16384) / 32, y = (16384 - gy) / 32,
 *    then Leaflet [lat, lng] = [-y, x]. (Cross-validated: GTADB L1
 *    "Vice Regal" converts to exactly the fbritoferreira place coords.)
 *
 * Usage: node scripts/import-labels.mjs
 */
import { writeFile } from 'node:fs/promises';

const FBRITO = 'https://fbritoferreira.github.io/gta6';
const GTADB_RAW = 'https://raw.githubusercontent.com/rolux/gtadb.org/master/map/data/6/landmarks.json';
const OUT = new URL('../public/data/labels.json', import.meta.url);
const NEIGHBORHOOD_MIN_RECORDS = 8;
// Poster-corroborated areas: names transcribed from Johnny's photos of the
// official Leonida poster (2026-11-24 cross-check). The poster is NOT a
// data source — names and coordinates below still come 100% verbatim from
// GTADB records. The list is used only as an inclusion filter: a GTADB
// area string that the official poster independently confirms as a real
// named place is labeled even below the usual 8-record threshold.
const POSTER_CORROBORATED = new Set([
  'Grayson', 'Grassrivers', 'Mount Kalaga National Park', 'Emerald Springs',
  'Hyde Island', 'Frampton Islands', 'Zephyr Islands', 'Draper Island',
  'Maroon Key', 'Goose Key', 'Belpoint',
]);

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

const labels = [];
const push = (name, tier, x, y, source) => labels.push({ name, tier, coords: [-y, x], source });

/* ---- fbritoferreira: districts + highway refs ---- */
const [fbLabels, fbRoutes] = await Promise.all([
  getJson(`${FBRITO}/data/labels.json`),
  getJson(`${FBRITO}/data/routes.json`),
]);
for (const l of fbLabels) push(l.name, 'district', l.x, l.y, 'fbrito');
for (const r of fbRoutes) push(r.ref, 'highway', r.x, r.y, 'fbrito');
const districtNames = new Set(fbLabels.map((l) => l.name));

/* ---- GTADB: named landmarks + area (neighborhood) labels ---- */
const gtadb = await getJson(GTADB_RAW);
const records = Object.values(gtadb);
const toMap = (gx, gy) => [(gx + 16384) / 32, (16384 - gy) / 32];

let landmarkCount = 0;
const areas = new Map(); // area name -> {sx, sy, n}
for (const rec of records) {
  const [composite, game] = rec;
  if (!Array.isArray(game) || !Number.isFinite(game[0]) || !Number.isFinite(game[1])) continue;
  const parts = String(composite).split(',').map((s) => s.trim());
  const [mx, my] = toMap(game[0], game[1]);
  const place = parts[0];
  if (place && place !== '?') {
    push(place, 'landmark', mx, my, 'gtadb');
    landmarkCount += 1;
  }
  const area = parts[1];
  if (area && area !== '?' && area !== 'Leonida' && !districtNames.has(area)) {
    const a = areas.get(area) ?? { sx: 0, sy: 0, n: 0 };
    a.sx += mx; a.sy += my; a.n += 1;
    areas.set(area, a);
  }
}
let neighborhoodCount = 0;
for (const [name, a] of areas) {
  if (a.n < NEIGHBORHOOD_MIN_RECORDS && !POSTER_CORROBORATED.has(name)) continue;
  push(name, 'neighborhood', a.sx / a.n, a.sy / a.n, 'gtadb');
  neighborhoodCount += 1;
}

const counts = {};
for (const l of labels) counts[l.tier] = (counts[l.tier] ?? 0) + 1;

const doc = {
  dataset: 'leonida-explorer-labels',
  version: 1,
  generatedAt: new Date().toISOString(),
  attribution:
    'District & highway labels: Open GTA 6 Map (fbritoferreira), CC BY 4.0 — https://github.com/fbritoferreira/gta6 · Landmark & area labels: GTA VI Landmarks Data (CC BY 4.0) — https://map.gtadb.org',
  note: 'Every label is a verbatim name from the cited licensed source data. No street names exist in any licensed dataset (the fbritoferreira road geometry carries no name property at all), so no street-name labels are included. Coordinates are Leaflet [lat,lng] in the app map-unit space.',
  counts,
  labels,
};
await writeFile(OUT, JSON.stringify(doc, null, 1));
console.log(`Wrote ${labels.length} labels:`, counts, `(GTADB records read: ${records.length})`);
