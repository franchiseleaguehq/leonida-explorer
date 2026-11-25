#!/usr/bin/env node
/**
 * Import road geometry for Leonida Explorer -> public/data/roads.json.
 *
 * Source: "Open GTA 6 Map" (fbritoferreira), CC BY 4.0 — the same licensed
 * project as the basemap tiles (see docs/DATA_SOURCES.md). Its
 * data/roads.json holds 9,075 LineString features with ONLY a `kind`
 * property (highway / main / street / minor) — geometry only, no names
 * exist in the source. Coordinates are in the project's own 1024-unit
 * map space ([x, y-from-top]); conversion to Leaflet is [-y, x], the
 * same convention the tiles and labels use.
 *
 * The app draws these as a crisp vector overlay so the road network
 * stays sharp at deep zoom even where the raster tiles (native z5)
 * are only magnified. Geometry is decimated (points closer than
 * ~0.08 units to the last kept point are dropped) and rounded to 2
 * decimals — invisible at any zoom the app allows, ~5x smaller file.
 *
 * Output shape: { kinds: { highway: [flatPolyline, ...], ... } } where
 * each polyline is a flat [lat, lng, lat, lng, ...] array.
 *
 * Usage: node scripts/import-roads.mjs
 */
import { writeFile } from 'node:fs/promises';

const SRC = 'https://fbritoferreira.github.io/gta6/data/roads.json';
const OUT = new URL('../public/data/roads.json', import.meta.url);
const MIN_POINT_GAP = 0.08; // map units
const MIN_LENGTH = 0.25; // map units; micro-segments are invisible

const res = await fetch(SRC);
if (!res.ok) throw new Error(`${SRC}: HTTP ${res.status}`);
const geo = await res.json();
const features = Array.isArray(geo.features) ? geo.features : [];

const kinds = { highway: [], main: [], street: [], minor: [] };
let keptPoints = 0;
let totalPoints = 0;

for (const f of features) {
  const kind = f?.properties?.kind;
  if (!kinds[kind] || f?.geometry?.type !== 'LineString') continue;
  const coords = f.geometry.coordinates;
  totalPoints += coords.length;
  const kept = [];
  let last = null;
  for (const [x, y] of coords) {
    if (!last || Math.hypot(x - last[0], y - last[1]) >= MIN_POINT_GAP) {
      kept.push([x, y]);
      last = [x, y];
    }
  }
  const tail = coords[coords.length - 1];
  if (tail && kept[kept.length - 1] !== tail && Math.hypot(tail[0] - kept[kept.length - 1][0], tail[1] - kept[kept.length - 1][1]) > 0.001) {
    kept.push(tail);
  }
  if (kept.length < 2) continue;
  let len = 0;
  for (let i = 1; i < kept.length; i++) len += Math.hypot(kept[i][0] - kept[i - 1][0], kept[i][1] - kept[i - 1][1]);
  if (len < MIN_LENGTH) continue;
  const flat = [];
  for (const [x, y] of kept) {
    flat.push(Math.round(-y * 100) / 100, Math.round(x * 100) / 100);
  }
  keptPoints += kept.length;
  kinds[kind].push(flat);
}

const out = {
  source: 'Open GTA 6 Map (fbritoferreira), CC BY 4.0 — road geometry only; the source carries no road names.',
  generated: new Date().toISOString().slice(0, 10),
  kinds,
};
const json = JSON.stringify(out);
await writeFile(OUT, json);
const counts = Object.fromEntries(Object.entries(kinds).map(([k, v]) => [k, v.length]));
console.log('roads per kind:', counts);
console.log(`points: ${totalPoints} -> ${keptPoints}; file: ${(json.length / 1024).toFixed(0)} KiB`);
