#!/usr/bin/env node
/**
 * Import world geometry for Leonida Explorer:
 *   -> public/data/surface.json  (building footprints, parks, sand, urban, shallow)
 *   -> public/data/zones.json    (district polygons + landmass rings)
 *
 * Source: "Open GTA 6 Map" (fbritoferreira), CC BY 4.0 — same licensed
 * project as the basemap tiles, roads and labels (docs/DATA_SOURCES.md).
 *   - data/surface.json: GeoJSON polygons with a `layer` property:
 *     building (2,634), park, sand, urban, shallow, paved.
 *   - data/districts.json: 10 districts, each { name, x, y, rings }.
 *   - data/land.json: 762 landmass rings (coastline).
 * All coordinates are the project's own 1024-unit map space
 * ([x, y-from-top]); conversion to Leaflet is [-y, x].
 *
 * The app draws buildings/parks/sand as flat game-style blocks at deep
 * zoom, district rings as faint zone tints, and the land rings as the
 * glowing coastline outline — all vector, so they stay crisp where the
 * raster tiles (native z5) are only magnified.
 *
 * Output: flat [lat, lng, lat, lng, ...] rings, decimated + rounded.
 *
 * Usage: node scripts/import-world.mjs
 */
import { writeFile } from 'node:fs/promises';

const BASE = 'https://fbritoferreira.github.io/gta6/data';
const SURFACE_OUT = new URL('../public/data/surface.json', import.meta.url);
const ZONES_OUT = new URL('../public/data/zones.json', import.meta.url);

async function getJson(name) {
  const res = await fetch(`${BASE}/${name}`);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  return res.json();
}

function decimateRing(coords, gap) {
  const kept = [];
  let last = null;
  for (const [x, y] of coords) {
    if (!last || Math.hypot(x - last[0], y - last[1]) >= gap) {
      kept.push([x, y]);
      last = [x, y];
    }
  }
  // close the ring with the original final point
  const tail = coords[coords.length - 1];
  if (tail && kept.length && Math.hypot(tail[0] - kept[kept.length - 1][0], tail[1] - kept[kept.length - 1][1]) > 0.001) kept.push(tail);
  return kept;
}

function ringArea(pts) {
  let a = 0;
  for (let i = 1; i < pts.length; i++) a += pts[i - 1][0] * pts[i][1] - pts[i][0] * pts[i - 1][1];
  return Math.abs(a / 2);
}

function toFlat(pts) {
  const flat = [];
  for (const [x, y] of pts) flat.push(Math.round(-y * 100) / 100, Math.round(x * 100) / 100);
  return flat;
}

/* ---------- surface ---------- */
const surface = await getJson('surface.json');
const layers = { building: [], park: [], sand: [], urban: [], shallow: [], paved: [] };
for (const f of surface.features ?? []) {
  const layer = f?.properties?.layer;
  if (!layers[layer] || f?.geometry?.type !== 'Polygon') continue;
  const gap = layer === 'building' ? 0.04 : 0.08;
  const minArea = layer === 'building' ? 0.002 : 0.01;
  for (const ring of f.geometry.coordinates) {
    const kept = decimateRing(ring, gap);
    if (kept.length >= 4 && ringArea(kept) >= minArea) layers[layer].push(toFlat(kept));
  }
}
const surfaceOut = {
  source: 'Open GTA 6 Map (fbritoferreira), CC BY 4.0 — surface polygons (buildings, parks, sand, urban, shallow).',
  generated: new Date().toISOString().slice(0, 10),
  layers,
};
const surfaceJson = JSON.stringify(surfaceOut);
await writeFile(SURFACE_OUT, surfaceJson);
console.log('surface rings:', Object.fromEntries(Object.entries(layers).map(([k, v]) => [k, v.length])), `(${(surfaceJson.length / 1024).toFixed(0)} KiB)`);

/* ---------- zones: districts + land ---------- */
const districtsRaw = await getJson('districts.json');
const districts = [];
for (const d of districtsRaw) {
  const rings = [];
  for (const ring of d.rings ?? []) {
    const kept = decimateRing(ring, 0.15);
    if (kept.length >= 4) rings.push(toFlat(kept));
  }
  if (rings.length) districts.push({ name: d.name, rings });
}
const landRaw = await getJson('land.json');
const land = [];
for (const poly of landRaw) {
  // land.json items are polygons: arrays of rings (outer + any holes).
  const rings = Array.isArray(poly[0]?.[0]) ? poly : [poly];
  for (const ring of rings) {
    const kept = decimateRing(ring, 0.1);
    if (kept.length >= 4 && ringArea(kept) >= 0.05) land.push(toFlat(kept));
  }
}
const zonesOut = {
  source: 'Open GTA 6 Map (fbritoferreira), CC BY 4.0 — district polygons and landmass coastline rings.',
  generated: new Date().toISOString().slice(0, 10),
  districts,
  land,
};
const zonesJson = JSON.stringify(zonesOut);
await writeFile(ZONES_OUT, zonesJson);
console.log(`zones: ${districts.length} districts, ${land.length} land rings (${(zonesJson.length / 1024).toFixed(0)} KiB)`);
