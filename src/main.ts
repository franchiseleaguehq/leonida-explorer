import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import './styles.css';
import { MAP_CONFIG } from './config';
import { CATEGORIES, CATEGORY_MAP } from './categories';
import { VERIFICATION_LABELS, type GameLocation, type UserState } from './types';
import { loadState, saveState, exportState, importState } from './store';

/* ================= state ================= */
let state: UserState = loadState();
let locations: GameLocation[] = [];
let selected: GameLocation | null = null;
let origin: L.LatLng | null = null;
let waypointLine: L.Polyline | null = null;
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
dayLayer.addTo(map);
L.control.layers({ 'Day map': dayLayer, 'Night map': nightLayer }, undefined, { position: 'bottomright' }).addTo(map);
map.fitBounds(bounds);
// Exposed for debugging/support (harmless; standard practice for map apps).
(window as unknown as { __leMap: L.Map }).__leMap = map;

const cluster = L.markerClusterGroup({
  maxClusterRadius: 55,
  spiderfyOnMaxZoom: true,
  showCoverageOnHover: false,
});
map.addLayer(cluster);

const customLayer = L.layerGroup().addTo(map);
const originMarker = L.marker([0, 0], { draggable: true, title: 'Your in-game position' });

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
  waypointLine = L.polyline([origin, dest], { color: '#F05CA9', weight: 3, dashArray: '8 8' }).addTo(map);
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
  $('#coord-readout').textContent = `X ${gx} · Y ${gy} · zoom ${map.getZoom().toFixed(1)}×`;
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
$('#attribution-line').textContent = MAP_CONFIG.attribution || '';
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
