#!/usr/bin/env node
/**
 * Import the "Open GTA 6 Map" dataset (fbritoferreira, CC BY 4.0) into
 * Leonida Explorer's dataset format at public/data/locations.json.
 *
 * - Source coordinates are map units (x, y) on a 1024-unit square.
 *   Ours are Leaflet [lat, lng] = [-y, x] in CRS.Simple space.
 * - The source `confidence` field maps to our verification statuses;
 *   entries with no confidence claim are labeled "unconfirmed" — never
 *   upgraded.
 * - The source `screenshot` field is deliberately DROPPED: the source
 *   license expressly does not cover Rockstar/Take-Two material, which
 *   includes in-game screenshots.
 *
 * Usage: node scripts/import-data.mjs [sourceBaseUrl]
 */
import { writeFile } from 'node:fs/promises';

const BASE = process.argv[2] ?? 'https://fbritoferreira.github.io/gta6';
const OUT = new URL('../public/data/locations.json', import.meta.url);

const KIND_TO_CATEGORY = {
  // Collectibles
  flamingo: 'collectible', card: 'collectible', waink: 'collectible',
  magazine: 'collectible', kenton: 'collectible', playlist: 'collectible',
  package: 'collectible', meteorite: 'collectible', bottle: 'collectible',
  bookswap: 'collectible', mural: 'collectible', streetart: 'collectible',
  underwater: 'underwater', treasure: 'treasure-hunt', vehicle: 'vehicle-rare',
  // Activities
  meditation: 'activity', hoop: 'activity', bret: 'activity', race: 'activity',
  drone: 'activity', range: 'activity', arcade: 'activity', bridge: 'activity',
  knife: 'activity', basejump: 'activity', fishing: 'activity',
  hunting: 'activity', leisure: 'activity', stunt: 'stunt-jump',
  event: 'random-encounter',
  // Crime
  gang: 'gang-territory', bank: 'robbery', smash: 'robbery', store: 'robbery',
  safe: 'robbery', towatm: 'robbery', fence: 'business', payday: 'business',
  weapon: 'weapon-rare',
  // Places
  safehouse: 'safehouse', food: 'restaurant', hotel: 'landmark',
  transport: 'other', nature: 'landmark', building: 'landmark',
  other: 'other',
};

function shopCategory(type = '') {
  const t = type.toLowerCase();
  if (t.includes('cloth')) return 'store-clothing';
  if (t.includes('ammu') || t.includes('weapon') || t.includes('gun')) return 'store-weapon';
  if (t.includes('gas') || t.includes('fuel')) return 'gas-station';
  if (t.includes('garage') || t.includes('mechanic') || t.includes('pay n spray')) return 'garage';
  return 'business';
}
function civicCategory(type = '', name = '') {
  const t = `${type} ${name}`.toLowerCase();
  if (t.includes('police') || t.includes('sheriff')) return 'police';
  if (t.includes('hospital') || t.includes('medical')) return 'hospital';
  return 'business';
}
function categoryFor(kind, type, name) {
  if (kind === 'shop') return shopCategory(type);
  if (kind === 'civic') return civicCategory(type, name);
  return KIND_TO_CATEGORY[kind] ?? 'other';
}

const CONFIDENCE_TO_VERIFICATION = {
  community: 'community',
  unverified: 'unconfirmed',
  press: 'official',
  verified: 'verified',
  official: 'official',
};

const REGION_NAMES = {
  vice: 'Vice City', keys: 'Leonida Keys', gellhorn: 'Port Gellhorn',
  hamlet: 'Hamlet', ambrosia: 'Ambrosia', capri: 'Capri', watson: 'Watson Bay',
  kalaga: 'Mount Kalaga', grassrivers: 'Grassrivers',
  leonard: 'Leonard County', lummox: 'Lummox County',
};

async function getJson(path) {
  const res = await fetch(`${BASE}/${path}`);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

const [rawLocations, rawPlaces] = await Promise.all([getJson('data/locations.json'), getJson('data/places.json')]);
const locList = Array.isArray(rawLocations) ? rawLocations : rawLocations.locations;
const placeList = Array.isArray(rawPlaces) ? rawPlaces : rawPlaces.places;

const out = [];
const seen = new Set();
function push(rec) {
  if (seen.has(rec.id)) rec.id = `${rec.id}-b`;
  seen.add(rec.id);
  out.push(rec);
}

for (const l of locList) {
  if (typeof l.x !== 'number' || typeof l.y !== 'number') continue;
  push({
    id: l.id,
    name: l.name || l.type || l.id,
    category: categoryFor(l.kind, l.type, l.name),
    county: l.region ? (REGION_NAMES[l.region] ?? l.region) : undefined,
    city: l.area ?? undefined,
    coords: [-l.y, l.x],
    description: l.description || (l.type ? `Type: ${l.type}` : undefined),
    verification: CONFIDENCE_TO_VERIFICATION[l.confidence] ?? 'unconfirmed',
    source: 'Open GTA 6 Map (fbritoferreira) — locations',
    sourceUrl: `${BASE}/data/locations.json`,
  });
}
for (const p of placeList) {
  if (typeof p.x !== 'number' || typeof p.y !== 'number') continue;
  const bits = [];
  if (p.real_life) bits.push(`Real-life counterpart: ${p.real_life}`);
  if (p.service) bits.push(`Service: ${p.service}`);
  push({
    id: `place-${p.id}`,
    name: p.name || p.id,
    category: categoryFor(p.kind, '', p.name),
    city: p.area ?? undefined,
    coords: [-p.y, p.x],
    description: bits.length ? bits.join(' · ') : undefined,
    verification: CONFIDENCE_TO_VERIFICATION[p.confidence] ?? 'unconfirmed',
    source: 'Open GTA 6 Map (fbritoferreira) — places',
    sourceUrl: `${BASE}/data/places.json`,
  });
}

const doc = {
  dataset: 'leonida-explorer',
  version: 1,
  generatedAt: new Date().toISOString(),
  attribution: 'Map data from Open GTA 6 Map (fbritoferreira), CC BY 4.0 — https://github.com/fbritoferreira/gta6',
  note: 'Coordinates are Leaflet [lat,lng] = [-y, x] in the source map-unit space. Screenshots intentionally omitted (Rockstar/Take-Two material is not covered by the source CC BY license).',
  count: out.length,
  locations: out,
};
await writeFile(OUT, JSON.stringify(doc, null, 1));
console.log(`Wrote ${out.length} locations (${locList.length} source locations, ${placeList.length} source places)`);
