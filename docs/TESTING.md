# Leonida Explorer — Test Report (2026-11-24, this phase)

Environment: production build (`npm run build`, tsc clean) served by
`vite preview`, driven in headless Chromium (Playwright) at iPhone
portrait 390×844 and landscape 844×390.

## Passed (real browser, real interactions)

- Page loads, Leaflet map initialises, opens fit to the whole state.
- **Tiles render**: with tile bytes supplied to the browser, 16/16 z0
  tiles at fit view; 24 loaded at zoom 1.5; 8 at zoom 4; 11 after a drag
  pan; Night layer swaps correctly (`tiles/night/…`). Screenshots confirm
  the real illustrated geography (island shape, roads, building
  footprints at z4) in both layers. Zero JS page errors.
  - Two real bugs were found and fixed by this testing:
    1. Tile layer zoom clamping (negative map zooms requested
       nonexistent negative tile zooms) — fixed with
       `minZoom -4 + minNativeZoom 0 + maxNativeZoom 5`.
    2. Same area: layer `minZoom` guard initially suppressed all tile
       loading below map zoom 0 — fixed in the same change.
- All **32 categories** render with counts; Hide all → 0 markers;
  Show all restores.
- Markers/clusters render; zoom controls change zoom; drag pan works;
  coordinate readout updates (in-game X/Y + zoom).
- Search ("Vice Regal") → autocomplete → detail sheet opens with
  verification badge, source attribution, coordinates.
- **Mark as found** flips state, writes localStorage, **survives reload**;
  deep link `#loc=<id>` reopens the same location still marked found;
  progress summary counts it ("1 of 5708").
- PWA: manifest linked; service worker registers.
- Landscape viewport renders without horizontal scrolling.

## Sandbox caveats (not app defects)

- This VM's headless Chromium has no direct internet (egress proxy
  tunnel is unreliable from the browser, and the app's own service
  worker intercepts tile fetches once registered). Tile rendering was
  therefore verified by fulfilling the browser's tile requests with the
  real bytes of the exact URLs the app requests (each also curl-verified
  HTTP 200 from the shell). On a real device/network the SW path is the
  intended offline-caching behaviour.
- The "brand header" check in the harness fails by design: at ≤860px
  the CSS intentionally hides the wordmark text (the "LE" mark remains)
  to give the search bar room.
- **Not tested**: real iPhone Safari / Android Chrome devices, physical
  pinch gestures (Chromium's synthetic pan/zoom controls were used),
  install prompt UX on-device, offline mode on a real phone. These need
  the deployed URL + Johnny's phone — the exact gap the deployment phase
  closes.
