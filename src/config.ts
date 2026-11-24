// Map source configuration — set from the data-source research verdict
// (see docs/DATA_SOURCES.md).
//
// Base map: "Open GTA 6 Map" by fbritoferreira — Leaflet tiles in a
// 1024-unit CRS.Simple game-coordinate space, CC BY 4.0, explicitly
// published for reuse. Tiles load from the project's own GitHub Pages
// endpoint (their sanctioned distribution, CORS-open); for deployment,
// scripts/mirror-tiles.sh downloads the same tiles so they can be
// hosted locally under the same license.
//
// HONEST LIMIT: the base map is a fan-drawn illustrated map traced from
// Rockstar's official poster + community mapping. Native tile data ends
// at zoom 5. There are no street names and no photographic detail in any
// legally reusable source — see docs/DATA_SOURCES.md.

export const MAP_CONFIG = {
  mode: 'tiles' as 'image' | 'tiles',
  // {z},{y},{x} filename scheme is the source's own (see assets.json).
  tileUrlDay: 'https://fbritoferreira.github.io/gta6/tiles/day/{z}/{z},{y},{x}.webp',
  tileUrlNight: 'https://fbritoferreira.github.io/gta6/tiles/night/{z}/{z},{y},{x}.webp',
  imageUrl: '',
  /** Map space: 1024 x 1024 units. Leaflet coords: lat = -y, lng = x. */
  mapSize: 1024,
  /** 1 map unit = 32 game units; game coords span -16384..16384, origin centre. */
  gameUnitsPerMapUnit: 32,
  maxNativeZoom: 5,
  maxZoom: 7, // beyond native 5 is magnification — the UI never claims otherwise
  attribution:
    'Map data from Open GTA 6 Map (fbritoferreira), CC BY 4.0 — https://github.com/fbritoferreira/gta6 · Fan project, not affiliated with Rockstar Games or Take-Two Interactive',
  sourceName: 'Open GTA 6 Map (fbritoferreira)',
};
