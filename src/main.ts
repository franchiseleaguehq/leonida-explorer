import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import './styles.css';
import { MAP_CONFIG, LABELS_CONFIG, WORLD_CONFIG } from './config';
import { CATEGORIES, CATEGORY_MAP } from './categories';
import { VERIFICATION_LABELS, type GameLocation, type UserState } from './types';
import { loadState, saveState, exportState, importState } from './store';

/* ================= state ================= */
let state: UserState = loadState();
let locations: GameLocation[] = [];
let selected: GameLocation | null = null;
let origin: L.LatLng | null = null;
let waypointLine: L.LayerGroup | null = null;
let pendingTap: 'marker' | 'origin' | null = null;

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;

/* ================= map ================= */
const SIZE = MAP_CONFIG.mapSize;
// Leaflet space: lat = -y (so lat runs -SIZE..0), lng = x (0..SIZE).
const bounds = L.latLngBounds([-SIZE, 0], [0, SIZE]);

const map = L.map('map', {
  crs: L.CRS.Simple,
  minZoom: -4,
  maxZoom: MAP_CONFIG.maxZoom,
  zoomControl: false,
  attributionControl: true,
  wheelPxPerZoomLevel: 90,
  zoomSnap: 0.25,
  zoomDelta: 0.5,
  maxBounds: bounds.pad(0.25),
  maxBoundsViscosity: 0.6,
});
map.attributionControl.setPrefix(false);

const dayLayer = L.tileLayer(MAP_CONFIG.tileUrlDay, {
  bounds,
  tileSize: 256,
  minZoom: -4,
  minNativeZoom: 0,
  maxNativeZoom: MAP_CONFIG.maxNativeZoom,
  maxZoom: MAP_CONFIG.maxZoom,
  attribution: MAP_CONFIG.attribution,
});
const nightLayer = L.tileLayer(MAP_CONFIG.tileUrlNight, {
  bounds,
  tileSize: 256,
  minZoom: -4,
  minNativeZoom: 0,
  maxNativeZoom: MAP_CONFIG.maxNativeZoom,
  maxZoom: MAP_CONFIG.maxZoom,
  attribution: MAP_CONFIG.attribution,
});
nightLayer.addTo(map); // the dark base is the default — it is the in-game look
$('#map').classList.add('dark-base');
// The illustrated tiles carry their own painted roads, slightly drifted
// from the source vector centrelines (the art pass moved them). Dimming
// the dark base lets the crisp vector network read as THE roads, the
// way the in-game map presents them.
map.on('baselayerchange', (e) => {
  $('#map').classList.toggle('dark-base', e.layer === nightLayer);
});

/* ---- labels layer (verbatim names from licensed data; see config) ---- */
map.createPane('labels');
const labelsPane = map.getPane('labels');
if (labelsPane) {
  labelsPane.style.zIndex = '450'; // above tiles, below location pins
  labelsPane.style.pointerEvents = 'none';
}
type LabelTier = 'district' | 'highway' | 'neighborhood' | 'landmark';
interface MapLabel {
  name: string;
  tier: LabelTier;
  coords: [number, number];
  source: string;
}
let labelData: MapLabel[] = [];
const districtLabels = L.layerGroup();
const highwayLabels = L.layerGroup();
const neighborhoodLabels = L.layerGroup();
const landmarkLabels = L.layerGroup();
const labelsLayer = L.layerGroup([districtLabels, highwayLabels], {
  attribution: LABELS_CONFIG.attribution,
});
labelsLayer.addTo(map); // ON by default

function labelMarker(rec: MapLabel): L.Marker {
  return L.marker(rec.coords, {
    pane: 'labels',
    interactive: false,
    keyboard: false,
    icon: L.divIcon({
      className: 'label-wrap',
      html: `<div class="map-label lbl-${rec.tier}">${escapeHtml(rec.name)}</div>`,
    }),
  });
}

function renderLandmarkLabels(): void {
  landmarkLabels.clearLayers();
  const b = map.getBounds().pad(0.1);
  for (const rec of labelData) {
    if (rec.tier === 'landmark' && b.contains(rec.coords)) landmarkLabels.addLayer(labelMarker(rec));
  }
}

function updateLabelTiers(): void {
  const z = map.getZoom();
  if (z >= LABELS_CONFIG.neighborhoodMinZoom) {
    if (!labelsLayer.hasLayer(neighborhoodLabels)) labelsLayer.addLayer(neighborhoodLabels);
  } else {
    labelsLayer.removeLayer(neighborhoodLabels);
  }
  if (z >= LABELS_CONFIG.landmarkMinZoom) {
    if (!labelsLayer.hasLayer(landmarkLabels)) labelsLayer.addLayer(landmarkLabels);
    renderLandmarkLabels();
  } else {
    labelsLayer.removeLayer(landmarkLabels);
  }
}
map.on('zoomend moveend', updateLabelTiers);

async function loadLabels(): Promise<void> {
  try {
    const res = await fetch(LABELS_CONFIG.dataUrl);
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as { labels: MapLabel[] };
    labelData = Array.isArray(data.labels) ? data.labels : [];
  } catch {
    labelData = [];
  }
  for (const rec of labelData) {
    if (rec.tier === 'district') districtLabels.addLayer(labelMarker(rec));
    else if (rec.tier === 'highway') highwayLabels.addLayer(labelMarker(rec));
    else if (rec.tier === 'neighborhood') neighborhoodLabels.addLayer(labelMarker(rec));
  }
  updateLabelTiers();
}

/* ---- world geometry (roads / buildings / zones) ----
   Vector overlays in the style of the in-game map, drawn from the same
   licensed source as the base tiles (see WORLD_CONFIG). Canvas-rendered
   so they stay crisp at deep zoom where the raster tiles only magnify. */
map.createPane('world');
const worldPane = map.getPane('world');
if (worldPane) {
  worldPane.style.zIndex = '420'; // above tiles, below roads
  worldPane.style.pointerEvents = 'none';
}
map.createPane('roads');
const roadsPane = map.getPane('roads');
if (roadsPane) {
  roadsPane.style.zIndex = '435'; // above world, below labels (450)
  roadsPane.style.pointerEvents = 'none';
}
const worldRenderer = L.canvas({ pane: 'world' });
const roadsRenderer = L.canvas({ pane: 'roads' });

const worldBase = L.layerGroup(); // coastline glow, district tints, parks, sand, urban, shallow
const worldDeep = L.layerGroup(); // building footprints + paved (deep zoom only)
const worldGroup = L.layerGroup([worldBase], { attribution: WORLD_CONFIG.attribution });
worldGroup.addTo(map); // ON by default
const roadsGroup = L.layerGroup([], { attribution: WORLD_CONFIG.attribution });
roadsGroup.addTo(map); // ON by default

type RoadKind = 'highway' | 'main' | 'street' | 'minor';
const ROAD_CORE: Record<RoadKind, { color: string; opacity: number }> = {
  highway: { color: '#f2f6fc', opacity: 0.98 },
  main: { color: '#dde8f5', opacity: 0.95 },
  street: { color: '#c6d5e8', opacity: 0.85 },
  minor: { color: '#a5b9d4', opacity: 0.7 },
};
const roadCore: Record<RoadKind, L.Polyline[]> = { highway: [], main: [], street: [], minor: [] };
const roadCasing: L.Polyline[] = []; // dark edge under major roads
const roadKindGroups: Record<RoadKind, L.LayerGroup> = {
  highway: L.layerGroup(),
  main: L.layerGroup(),
  street: L.layerGroup(),
  minor: L.layerGroup(),
};
for (const g of Object.values(roadKindGroups)) roadsGroup.addLayer(g);
const casingGroup = L.layerGroup();
roadsGroup.addLayer(casingGroup);

function flatToLatLngs(flat: number[]): L.LatLng[] {
  const pts: L.LatLng[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) pts.push(L.latLng(flat[i], flat[i + 1]));
  return pts;
}

/** Zoom buckets for road band widths — the deeper the zoom, the wider
    the pale street bands, like the in-game map. -1 = not applied yet. */
let roadBucket = -1;
function applyRoadBucket(): void {
  const z = map.getZoom();
  const bucket = z < 0.5 ? 0 : z < 2 ? 1 : z < 4 ? 2 : 3;
  const showStreet = bucket >= 1;
  const showMinor = bucket >= 2;
  if (showStreet && !roadsGroup.hasLayer(roadKindGroups.street)) roadsGroup.addLayer(roadKindGroups.street);
  if (!showStreet && roadsGroup.hasLayer(roadKindGroups.street)) roadsGroup.removeLayer(roadKindGroups.street);
  if (showMinor && !roadsGroup.hasLayer(roadKindGroups.minor)) roadsGroup.addLayer(roadKindGroups.minor);
  if (!showMinor && roadsGroup.hasLayer(roadKindGroups.minor)) roadsGroup.removeLayer(roadKindGroups.minor);
  if (bucket === roadBucket) return;
  roadBucket = bucket;
  const coreW: Record<RoadKind, number> = [
    { highway: 1.6, main: 1.2, street: 1, minor: 1 },
    { highway: 2.6, main: 2, street: 1.3, minor: 1 },
    { highway: 6, main: 5, street: 3.5, minor: 2 },
    { highway: 9, main: 7.5, street: 5.5, minor: 3.5 },
  ][bucket];
  (Object.keys(roadCore) as RoadKind[]).forEach((kind) => {
    for (const line of roadCore[kind]) line.setStyle({ weight: coreW[kind] });
  });
  for (const line of roadCasing) {
    const kind = (line.options as { roadKind?: RoadKind }).roadKind ?? 'main';
    line.setStyle({ weight: coreW[kind] + 2.2 });
  }
}

function updateWorldTiers(): void {
  const showDeep = map.getZoom() >= WORLD_CONFIG.buildingsMinZoom;
  if (showDeep && !worldGroup.hasLayer(worldDeep)) worldGroup.addLayer(worldDeep);
  if (!showDeep && worldGroup.hasLayer(worldDeep)) worldGroup.removeLayer(worldDeep);
  applyRoadBucket();
}
map.on('zoomend', updateWorldTiers);

const DISTRICT_TINTS = ['#38d9c5', '#f05ca9', '#ff9b54', '#7be495', '#c05ce0', '#4a90d9', '#e8c832', '#d94f4f', '#4fd9c0', '#5c7bf0'];

async function loadWorld(): Promise<void> {
  try {
    const [roadsRes, surfaceRes, zonesRes] = await Promise.all([
      fetch(WORLD_CONFIG.roadsUrl),
      fetch(WORLD_CONFIG.surfaceUrl),
      fetch(WORLD_CONFIG.zonesUrl),
    ]);
    if (roadsRes.ok) {
      const data = (await roadsRes.json()) as { kinds: Record<RoadKind, number[][]> };
      (Object.keys(roadCore) as RoadKind[]).forEach((kind) => {
        for (const flat of data.kinds[kind] ?? []) {
          const pts = flatToLatLngs(flat);
          if (pts.length < 2) continue;
          if (kind === 'highway' || kind === 'main') {
            const casing = L.polyline(pts, {
              pane: 'roads',
              renderer: roadsRenderer,
              color: '#0a1220',
              opacity: 0.5,
              weight: 4,
              interactive: false,
            });
            (casing.options as { roadKind?: RoadKind }).roadKind = kind;
            roadCasing.push(casing);
            casingGroup.addLayer(casing);
          }
          const core = L.polyline(pts, {
            pane: 'roads',
            renderer: roadsRenderer,
            color: ROAD_CORE[kind].color,
            opacity: ROAD_CORE[kind].opacity,
            weight: 2,
            interactive: false,
          });
          roadCore[kind].push(core);
          roadKindGroups[kind].addLayer(core);
        }
      });
    }
    if (zonesRes.ok) {
      const zones = (await zonesRes.json()) as {
        districts: { name: string; rings: number[][] }[];
        land: number[][];
      };
      zones.districts.forEach((d, i) => {
        const tint = DISTRICT_TINTS[i % DISTRICT_TINTS.length];
        for (const ring of d.rings) {
          worldBase.addLayer(
            L.polygon(flatToLatLngs(ring), {
              pane: 'world',
              renderer: worldRenderer,
              color: tint,
              opacity: 0.16,
              weight: 1,
              fillColor: tint,
              fillOpacity: 0.05,
              interactive: false,
            }),
          );
        }
      });
      // coastline glow: a wide faint pass under a bright thin pass
      for (const ring of zones.land) {
        worldBase.addLayer(
          L.polygon(flatToLatLngs(ring), {
            pane: 'world',
            renderer: worldRenderer,
            color: '#cfe2ff',
            opacity: 0.1,
            weight: 6,
            fill: false,
            interactive: false,
          }),
        );
      }
      for (const ring of zones.land) {
        worldBase.addLayer(
          L.polygon(flatToLatLngs(ring), {
            pane: 'world',
            renderer: worldRenderer,
            color: '#e8f1ff',
            opacity: 0.5,
            weight: 1.6,
            fill: false,
            interactive: false,
          }),
        );
      }
    }
    if (surfaceRes.ok) {
      const surface = (await surfaceRes.json()) as { layers: Record<string, number[][]> };
      const SURFACE_STYLE: Record<string, { base: boolean; style: L.PolylineOptions }> = {
        shallow: { base: true, style: { color: '#33507e', opacity: 0, weight: 0, fillColor: '#33507e', fillOpacity: 0.25 } },
        urban: { base: true, style: { color: '#6f87b8', opacity: 0, weight: 0, fillColor: '#6f87b8', fillOpacity: 0.1 } },
        park: { base: true, style: { color: '#1e9e62', opacity: 0, weight: 0, fillColor: '#1e9e62', fillOpacity: 0.8 } },
        sand: { base: true, style: { color: '#8a826f', opacity: 0, weight: 0, fillColor: '#8a826f', fillOpacity: 0.85 } },
        paved: { base: false, style: { color: '#7d8aa0', opacity: 0, weight: 0, fillColor: '#7d8aa0', fillOpacity: 0.5 } },
        building: {
          base: false,
          style: { color: '#2e4d8f', opacity: 0.9, weight: 1, fillColor: '#4a72c2', fillOpacity: 0.92 },
        },
      };
      for (const [layer, rings] of Object.entries(surface.layers)) {
        const cfg = SURFACE_STYLE[layer];
        if (!cfg) continue;
        const target = cfg.base ? worldBase : worldDeep;
        for (const ring of rings) {
          target.addLayer(
            L.polygon(flatToLatLngs(ring), { pane: 'world', renderer: worldRenderer, interactive: false, ...cfg.style }),
          );
        }
      }
    }
  } catch {
    /* overlays are an enhancement — the base map still works without them */
  }
  roadBucket = -1;
  updateWorldTiers();
}

L.control
  .layers(
    { 'Dark map': nightLayer, 'Day map': dayLayer },
    { Labels: labelsLayer, Roads: roadsGroup, 'Buildings & zones': worldGroup },
    { position: 'bottomright' },
  )
  .addTo(map);
map.fitBounds(bounds);
// Exposed for debugging/support (harmless; standard practice for map apps).
(window as unknown as { __leMap: L.Map }).__leMap = map;

const cluster = L.markerClusterGroup({
  maxClusterRadius: 45,
  spiderfyOnMaxZoom: true,
  showCoverageOnHover: false,
  disableClusteringAtZoom: 4,
  iconCreateFunction: (c) =>
    L.divIcon({
      className: 'le-cluster',
      html: `<div>${c.getChildCount()}</div>`,
      iconSize: [36, 36],
    }),
});
map.addLayer(cluster);

const customLayer = L.layerGroup().addTo(map);
const playerIcon = L.divIcon({
  className: 'player-wrap',
  html: '<div class="player-blip">▲</div>',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});
const originMarker = L.marker([0, 0], { draggable: true, title: 'Your in-game position', icon: playerIcon });

function pinIcon(loc: GameLocation): L.DivIcon {
  const cat = CATEGORY_MAP[loc.category] ?? CATEGORY_MAP.other;
  const found = state.found[loc.id] ? ' is-found' : '';
  return L.divIcon({
    className: 'pin-wrap',
    html: `<div class="pin${found}" style="background:${cat.color}"><span>${cat.glyph}</span></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 26],
  });
}

function renderMarkers(): void {
  cluster.clearLayers();
  for (const loc of locations) {
    if (state.hiddenCategories[loc.category]) continue;
    if (state.hideFound && state.found[loc.id]) continue;
    const m = L.marker(loc.coords, { icon: pinIcon(loc), title: loc.name });
    m.on('click', () => openDetail(loc));
    cluster.addLayer(m);
  }
  renderCustomMarkers();
}

function renderCustomMarkers(): void {
  customLayer.clearLayers();
  for (const cm of state.customMarkers) {
    const m = L.marker(cm.coords, {
      icon: L.divIcon({
        className: 'pin-wrap',
        html: `<div class="pin is-custom"><span>✚</span></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      }),
      title: cm.name,
    });
    m.bindPopup(`<b>${escapeHtml(cm.name)}</b>${cm.note ? `<br>${escapeHtml(cm.note)}` : ''}<br><button onclick="window.__leDeleteCustom('${cm.id}')">Delete marker</button>`);
    customLayer.addLayer(m);
  }
  renderSaved();
}

(window as unknown as { __leDeleteCustom: (id: string) => void }).__leDeleteCustom = (id) => {
  state.customMarkers = state.customMarkers.filter((m) => m.id !== id);
  persist();
  renderCustomMarkers();
};

/* ================= data ================= */
async function loadLocations(): Promise<void> {
  try {
    const res = await fetch('./data/locations.json');
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as { locations: GameLocation[] };
    locations = Array.isArray(data.locations) ? data.locations : [];
  } catch {
    locations = [];
  }
  renderAll();
}

/* ================= UI: categories / progress / saved ================= */
function counts(): Map<string, { total: number; found: number }> {
  const mapCounts = new Map<string, { total: number; found: number }>();
  for (const c of CATEGORIES) mapCounts.set(c.id, { total: 0, found: 0 });
  for (const loc of locations) {
    const entry = mapCounts.get(loc.category) ?? { total: 0, found: 0 };
    entry.total += 1;
    if (state.found[loc.id]) entry.found += 1;
    mapCounts.set(loc.category, entry);
  }
  return mapCounts;
}

function renderCategories(): void {
  const c = counts();
  const list = $('#category-list');
  list.innerHTML = '';
  for (const cat of CATEGORIES) {
    const n = c.get(cat.id) ?? { total: 0, found: 0 };
    const row = document.createElement('div');
    row.className = 'cat-row' + (state.hiddenCategories[cat.id] ? ' off' : '');
    row.innerHTML = `
      <span class="cat-dot" style="background:${cat.color}">${cat.glyph}</span>
      <span class="cat-name">${cat.label}</span>
      <span class="cat-count${n.total === 0 ? ' empty' : ''}">${n.total === 0 ? 'no data yet' : `${n.found}/${n.total}`}</span>`;
    row.title = n.total === 0 ? 'No sourced locations yet — this category is not backfilled with invented data.' : 'Tap to show/hide';
    row.addEventListener('click', () => {
      state.hiddenCategories[cat.id] = !state.hiddenCategories[cat.id];
      if (!state.hiddenCategories[cat.id]) delete state.hiddenCategories[cat.id];
      persist();
      renderCategories();
      renderMarkers();
    });
    list.appendChild(row);
  }
}

function renderProgress(): void {
  const total = locations.length;
  const found = locations.filter((l) => state.found[l.id]).length;
  const pct = total ? Math.round((found / total) * 100) : 0;
  $('#progress-chip').textContent = `${pct}%`;
  $('#progress-summary').innerHTML = `
    <div style="font-size:15px"><b>${found}</b> of <b>${total}</b> locations discovered · <b>${pct}%</b> complete</div>
    <div class="prog-bar"><div style="width:${pct}%"></div></div>
    <div class="hint">${total - found} remaining. Progress is saved on this device only — export a backup to keep it safe.</div>`;
  const c = counts();
  const wrap = $('#progress-categories');
  wrap.innerHTML = '';
  for (const cat of CATEGORIES) {
    const n = c.get(cat.id) ?? { total: 0, found: 0 };
    if (n.total === 0) continue;
    const p = Math.round((n.found / n.total) * 100);
    const row = document.createElement('div');
    row.innerHTML = `<div class="prog-row"><span>${cat.label}</span><span>${n.found}/${n.total} · ${p}%</span></div>
      <div class="prog-bar"><div style="width:${p}%"></div></div>`;
    wrap.appendChild(row);
  }
}

function renderSaved(): void {
  const favs = locations.filter((l) => state.favorites[l.id]);
  const favList = $('#favorites-list');
  favList.innerHTML = favs.length
    ? ''
    : '<div class="empty-note">No favorites yet — open a location and tap ☆ Save.</div>';
  for (const loc of favs) favList.appendChild(savedRow(loc));
  const customList = $('#custom-list');
  customList.innerHTML = state.customMarkers.length
    ? ''
    : '<div class="empty-note">No personal markers yet.</div>';
  for (const cm of state.customMarkers) {
    const row = document.createElement('div');
    row.className = 'saved-item';
    row.innerHTML = `<span>✚ ${escapeHtml(cm.name)}</span><span>${fmtCoords(cm.coords)}</span>`;
    row.addEventListener('click', () => {
      map.flyTo(cm.coords, Math.max(map.getZoom(), 2));
      closeSidebarMobile();
    });
    customList.appendChild(row);
  }
}

function savedRow(loc: GameLocation): HTMLElement {
  const row = document.createElement('div');
  row.className = 'saved-item';
  row.innerHTML = `<span>${escapeHtml(loc.name)}</span><span>${CATEGORY_MAP[loc.category]?.label ?? ''}</span>`;
  row.addEventListener('click', () => {
    flyToLocation(loc);
    closeSidebarMobile();
  });
  return row;
}

function renderAll(): void {
  renderCategories();
  renderProgress();
  renderMarkers();
}

function persist(): void {
  saveState(state);
}

/* ================= detail sheet ================= */
function flyToLocation(loc: GameLocation): void {
  map.flyTo(loc.coords, Math.max(map.getZoom(), 2.5), { duration: 0.8 });
  openDetail(loc);
}

function openDetail(loc: GameLocation): void {
  selected = loc;
  const sheet = $('#detail-sheet');
  const cat = CATEGORY_MAP[loc.category] ?? CATEGORY_MAP.other;
  const isFound = !!state.found[loc.id];
  const isFav = !!state.favorites[loc.id];
  const place = [loc.neighborhood, loc.city, loc.county].filter(Boolean).join(' · ');
  const field = (label: string, value?: string) =>
    value ? `<div class="field"><b>${label}</b>${escapeHtml(value)}</div>` : '';
  $('#detail-content').innerHTML = `
    <h2>${escapeHtml(loc.name)}</h2>
    <div class="meta">
      <span class="badge ${loc.verification}">${VERIFICATION_LABELS[loc.verification]}</span>
      <span style="color:${cat.color}">● ${cat.label}</span>
      ${place ? ` · ${escapeHtml(place)}` : ''}
    </div>
    <div class="field"><b>Coordinates</b>${fmtCoords(loc.coords)} (in-game coordinates)</div>
    ${field('About', loc.description)}
    ${field('How to find it', loc.directions)}
    ${field('Reward', loc.reward)}
    ${field('Unlock / conditions', loc.unlock)}
    ${field('Respawn', loc.respawn)}
    <div class="field"><b>Source</b>${escapeHtml(loc.source)}${loc.lastVerified ? ` · last verified ${escapeHtml(loc.lastVerified)}` : ''}</div>
    <div class="detail-actions">
      <button class="action-btn ${isFound ? 'found' : ''}" id="d-found">${isFound ? '✓ Found — tap to undo' : 'Mark as found'}</button>
      <button class="action-btn" id="d-fav">${isFav ? '★ Saved' : '☆ Save'}</button>
      <button class="action-btn" id="d-waypoint">Set waypoint</button>
      <button class="action-btn" id="d-copy">Copy coordinates</button>
      <button class="action-btn" id="d-share">Share</button>
      <button class="action-btn ghost" id="d-report">Report incorrect</button>
    </div>
    <div class="field"><b>Your note</b>
      <textarea id="d-note" placeholder="Add a personal note…">${escapeHtml(state.notes[loc.id] ?? '')}</textarea>
    </div>`;
  sheet.hidden = false;

  $('#d-found').addEventListener('click', () => {
    if (state.found[loc.id]) delete state.found[loc.id];
    else state.found[loc.id] = true;
    persist();
    renderAll();
    openDetail(loc);
  });
  $('#d-fav').addEventListener('click', () => {
    if (state.favorites[loc.id]) delete state.favorites[loc.id];
    else state.favorites[loc.id] = true;
    persist();
    renderAll();
    openDetail(loc);
  });
  $('#d-copy').addEventListener('click', async () => {
    await navigator.clipboard?.writeText(`${loc.name} — ${fmtCoords(loc.coords)}`);
  });
  $('#d-share').addEventListener('click', async () => {
    const url = `${location.origin}${location.pathname}#loc=${loc.id}`;
    if (navigator.share) await navigator.share({ title: loc.name, url }).catch(() => undefined);
    else await navigator.clipboard?.writeText(url);
  });
  $('#d-waypoint').addEventListener('click', () => updateWaypoint(L.latLng(loc.coords), loc.name));
  $('#d-report').addEventListener('click', async () => {
    const text = `Incorrect location report\nName: ${loc.name}\nID: ${loc.id}\nCoords: ${fmtCoords(loc.coords)}\nSource: ${loc.source}\nProblem: `;
    await navigator.clipboard?.writeText(text);
    alert('Report copied — paste it into a project issue or submission with what is wrong.');
  });
  $('#d-note').addEventListener('change', (e) => {
    const v = (e.target as HTMLTextAreaElement).value.trim();
    if (v) state.notes[loc.id] = v;
    else delete state.notes[loc.id];
    persist();
  });
}

$('#detail-close').addEventListener('click', () => {
  $('#detail-sheet').hidden = true;
  selected = null;
});

/* ================= waypoint ================= */
function updateWaypoint(dest: L.LatLng, destName: string): void {
  if (!origin) {
    $('#waypoint-info').textContent = 'Set your in-game position first (Settings → Set my in-game position), then set a waypoint.';
    openSidebarSection('settings');
    return;
  }
  if (waypointLine) waypointLine.remove();
  // GPS route in the game's style: a solid purple line with a soft edge.
  waypointLine = L.layerGroup([
    L.polyline([origin, dest], { color: '#ffffff', opacity: 0.3, weight: 8 }),
    L.polyline([origin, dest], { color: '#c05ce0', opacity: 0.95, weight: 4 }),
  ]).addTo(map);
  const dist = Math.round(origin.distanceTo(dest) * MAP_CONFIG.gameUnitsPerMapUnit);
  $('#waypoint-info').textContent = `Waypoint: ${destName} — straight-line distance ≈ ${dist.toLocaleString()} m in-game. (Straight-line guidance only; no verified road-network routing data exists for Leonida.)`;
  map.flyToBounds(L.latLngBounds([origin, dest]).pad(0.15), { duration: 0.8 });
}

originMarker.on('dragend', () => {
  origin = originMarker.getLatLng();
  if (selected) updateWaypoint(L.latLng(selected.coords), selected.name);
});

/* ================= map events ================= */
map.on('mousemove', (e: L.LeafletMouseEvent) => {
  const { gx, gy } = toGame([e.latlng.lat, e.latlng.lng]);
  $('#coord-readout').textContent = `X ${gx} · Y ${gy} · zoom ${map.getZoom().toFixed(1)}`;
});
map.on('click', (e: L.LeafletMouseEvent) => {
  if (pendingTap === 'marker') {
    pendingTap = null;
    const name = prompt('Name for your marker:') ?? 'My marker';
    state.customMarkers.push({
      id: `custom-${Date.now()}`,
      name: name || 'My marker',
      coords: [e.latlng.lat, e.latlng.lng],
      createdAt: new Date().toISOString(),
    });
    persist();
    renderCustomMarkers();
  } else if (pendingTap === 'origin') {
    pendingTap = null;
    origin = e.latlng;
    originMarker.setLatLng(e.latlng).addTo(map);
    $('#waypoint-info').textContent = `Position set at ${fmtCoords([e.latlng.lat, e.latlng.lng])}. Now open any location and tap “Set waypoint”.`;
  }
});

$('#zoom-in').addEventListener('click', () => map.zoomIn());
$('#zoom-out').addEventListener('click', () => map.zoomOut());
$('#reset-view').addEventListener('click', () => map.flyToBounds(bounds, { duration: 0.8 }));
$('#fullscreen').addEventListener('click', () => {
  const wrap = $('#map-wrap');
  if (document.fullscreenElement) void document.exitFullscreen();
  else void wrap.requestFullscreen?.();
});

/* ================= search ================= */
const searchInput = $<HTMLInputElement>('#search');
const searchResults = $('#search-results');
searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim().toLowerCase();
  if (q.length < 2) {
    searchResults.hidden = true;
    return;
  }
  const hits = locations
    .filter((l) =>
      [l.name, l.category, CATEGORY_MAP[l.category]?.label, l.city, l.county, l.neighborhood]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    )
    .slice(0, 12);
  searchResults.innerHTML = '';
  for (const loc of hits) {
    const item = document.createElement('div');
    item.className = 'search-item';
    item.innerHTML = `<span>${escapeHtml(loc.name)}</span><span class="cat">${CATEGORY_MAP[loc.category]?.label ?? ''}${loc.city ? ` · ${escapeHtml(loc.city)}` : ''}</span>`;
    item.addEventListener('click', () => {
      searchResults.hidden = true;
      searchInput.value = loc.name;
      flyToLocation(loc);
    });
    searchResults.appendChild(item);
  }
  searchResults.hidden = hits.length === 0;
});
document.addEventListener('click', (e) => {
  if (!$('#search-wrap').contains(e.target as Node)) searchResults.hidden = true;
});

/* ================= sidebar / nav ================= */
function closeSidebarMobile(): void {
  if (window.innerWidth <= 860) $('#sidebar').classList.remove('open');
}
function openSidebarSection(id: string): void {
  $('#sidebar').classList.add('open');
  document.getElementById(`section-${id}`)?.scrollIntoView({ block: 'start' });
}
document.querySelectorAll<HTMLButtonElement>('#bottom-nav button').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#bottom-nav button').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const nav = btn.dataset.nav!;
    if (nav === 'explore') closeSidebarMobile();
    else openSidebarSection(nav);
  });
});

$('#show-all').addEventListener('click', () => {
  state.hiddenCategories = {};
  persist();
  renderCategories();
  renderMarkers();
});
$('#hide-all').addEventListener('click', () => {
  for (const c of CATEGORIES) state.hiddenCategories[c.id] = true;
  persist();
  renderCategories();
  renderMarkers();
});
$('#hide-found').addEventListener('change', (e) => {
  state.hideFound = (e.target as HTMLInputElement).checked;
  persist();
  renderMarkers();
});
($('#hide-found') as HTMLInputElement).checked = state.hideFound;

$('#add-marker-mode').addEventListener('click', () => {
  pendingTap = 'marker';
  closeSidebarMobile();
  alert('Tap anywhere on the map to drop your marker.');
});
$('#set-origin-mode').addEventListener('click', () => {
  pendingTap = 'origin';
  closeSidebarMobile();
  alert('Tap the map where your character is standing in-game.');
});
$('#clear-waypoint').addEventListener('click', () => {
  if (waypointLine) waypointLine.remove();
  waypointLine = null;
  origin = null;
  originMarker.remove();
  $('#waypoint-info').textContent = '';
});

/* ================= export / import ================= */
$('#export-btn').addEventListener('click', () => {
  const blob = new Blob([exportState(state)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'leonida-explorer-backup.json';
  a.click();
  URL.revokeObjectURL(a.href);
});
$('#import-file').addEventListener('change', async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    state = importState(await file.text());
    persist();
    renderAll();
    alert('Backup imported.');
  } catch {
    alert('That file is not a Leonida Explorer backup.');
  }
});

/* ================= helpers ================= */
function toGame(c: [number, number]): { gx: number; gy: number } {
  const x = c[1];
  const y = -c[0];
  const k = MAP_CONFIG.gameUnitsPerMapUnit;
  return { gx: Math.round(x * k - 16384), gy: Math.round(16384 - y * k) };
}
function fmtCoords(c: [number, number]): string {
  const { gx, gy } = toGame(c);
  return `X ${gx}, Y ${gy}`;
}
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
}

/* ================= boot ================= */
$('#attribution-line').textContent = `${MAP_CONFIG.attribution} · ${LABELS_CONFIG.attribution} · ${WORLD_CONFIG.attribution}`;
void loadLabels();
void loadWorld();
void loadLocations().then(() => {
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
  const id = hash.get('loc');
  const loc = id ? locations.find((l) => l.id === id) : undefined;
  if (loc) flyToLocation(loc);
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  });
}
