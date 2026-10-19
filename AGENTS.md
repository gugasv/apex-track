# AGENTS.md — ApexTrack (GPX Studio & Interactive Track Editor)

This document provides context, architecture guidelines, data structures, and domain rules for AI coding agents working on **ApexTrack** (`/Users/gustavovieira/Development/anti/trackeditor`).

---

## 1. Project Overview & Tech Stack
* **Purpose:** Client-side interactive GPX/KML/GeoJSON track editor, visualizer, street-snapper, and exporter tailored for cycling, running, hiking, and Google Maps Timeline reconstructions (e.g., Strava/Garmin exports).
* **Stack:** Vanilla ES Modules (`type: "module"`), Vite (`^8.3.4`), Leaflet (`^1.9.4`), HTML5 `<canvas>` (Elevation Profile), HTML5 `<dialog>` modals, and CSS Custom Properties (Dark Glassmorphism UI).
* **Zero Backend Dependency:** All file parsing, geospatial math, street routing, and file exports run 100% in the browser.
* **Commands:**
  * `npm run dev` — Start local Vite dev server (`http://localhost:5173/`)
  * `npm run build` — Production bundle check (`dist/`)
  * `npm run preview` — Preview production build locally

---

## 2. Directory & Module Architecture

```text
trackeditor/
├── index.html                  # App shell, Top Nav, Stats HUD, Elevation Dock, and <dialog> modals
├── src/
│   ├── main.js                 # App class orchestrating state, DOM events, modals, Undo/Redo, and I/O
│   ├── style.css               # Design tokens, glassmorphism panels, Leaflet overrides, responsive rules
│   ├── components/
│   │   ├── mapManager.js       # Leaflet instance, tile layers, LOD vertex markers, midpoint '+', comparison overlay
│   │   ├── elevationProfile.js # Retina 2D Canvas elevation & slope grade chart with bidirectional hover sync
│   │   ├── history.js          # Undo/Redo state stack (HistoryManager)
│   │   └── toast.js            # Non-blocking toast notification helper (showToast)
│   └── utils/
│       ├── geo.js              # Haversine distance, Douglas-Peucker simplification, elevation smoothing, metrics
│       ├── routing.js          # OSRM street-snapping (snapTrackToStreets), jump outlier filter, detour guard
│       ├── gpx.js              # DOMParser GPX reader and GPX 1.1 / GeoJSON / KML serializers
│       └── samples.js          # Built-in demo tracks (Lac Blanc, Yosemite, Tre Cime)
```

---

## 3. Core Data Models & Invariants

### Track Point (`this.points[i]`)
Every point in `App.points` (after `calculateTrackMetrics`) has the shape:
```js
{
  id: string,          // Unique identifier e.g. "pt_0_172934..."
  lat: number,         // Latitude in decimal degrees (7 decimal places precision)
  lon: number,         // Longitude in decimal degrees (7 decimal places precision)
  ele: number | null,  // Elevation in meters (1 decimal place) or null
  time: string | null, // ISO 8601 UTC timestamp string ("YYYY-MM-DDTHH:MM:SSZ") or null
  cumDist: number,     // Cumulative distance in meters from point 0 (computed by calculateTrackMetrics)
  distDelta: number    // Distance in meters from point i-1 (computed by calculateTrackMetrics)
}
```

### Waypoint / POI (`this.waypoints[i]`)
```js
{
  id: string,
  lat: number,
  lon: number,
  ele: number | null,
  name: string,
  desc: string,
  sym: 'Summit' | 'Viewpoint' | 'Water' | 'Camp' | 'Food' | 'Trailhead' | 'Danger' | 'Flag'
}
```

### State Mutation Rules
1. **Always Push History Before Mutating:** Before modifying `this.points`, `this.waypoints`, `this.trackName`, or `this.description`, call `this.pushHistoryState()` so `Cmd+Z` / `Ctrl+Z` can restore the prior state.
2. **Always Recompute Metrics via `this.updatePoints(newPoints, fitBounds)`:** Never mutate `this.points` without calling `this.updatePoints()`, which recalculates `cumDist`, `distDelta`, total distance, elevation gain/loss, and synchronizes both `MapManager` and `ElevationProfile`.

---

## 4. Street Snapping & Gap Filling (`src/utils/routing.js`)

Sparse GPS logs (such as Google Maps Timeline exports where fixes occur every 1–5 minutes) produce straight lines that cut across buildings and under-report distance. `snapTrackToStreets(points, options)` solves this with four critical rules that agents must preserve when modifying routing logic:

1. **OSRM Public Profiles:**
   * `bike`: `https://routing.openstreetmap.de/routed-bike/route/v1/driving`
   * `foot`: `https://routing.openstreetmap.de/routed-foot/route/v1/driving`
   * `car`: `https://routing.openstreetmap.de/routed-car/route/v1/driving`
   * Requests must batch waypoints into chunks (`CHUNK_SIZE = 35` with 1-point overlap between consecutive chunks) and pass `?overview=full&geometries=geojson&steps=true`.
2. **Jump Outlier Filtering (`filterJumpOutliers`):**
   * Raw mobile traces often contain single-point Wi-Fi/Cell triangulation spikes (e.g., jumping 4 km away for one reading and immediately returning). Filter out single-point out-and-back spikes before calling OSRM so OSRM does not route a 9 km detour.
3. **Smart Detour Guard:**
   * Waterfront points (e.g., piers/promenades) or noisy urban points can snap onto the opposite bank of a river/estuary or a one-way bridge, causing OSRM to route a multi-kilometer loop.
   * For each sub-leg `oleg` between $W_i$ and $W_{i+1}$, compare `oleg.distance` against `directDist = haversineDistance(W_i, W_{i+1})`. If `oleg.distance > Math.max(directDist * 3.0, directDist + 450)`, reject the OSRM sub-leg geometry and fall back to linear interpolation between $W_i$ and $W_{i+1}$.
4. **Distance-Proportional Timestamp & Elevation Interpolation + Monotonicity:**
   * Interpolate `time` and `ele` along each sub-leg's street geometry proportionally to cumulative Haversine distance (`cumDist[k] / totalSubDist`).
   * **Strava / Garmin Requirement:** GPX `<time>` values must be strictly increasing (`t[k] > t[k-1]`, minimum `+1000ms` step). Duplicate or out-of-order timestamps cause Strava to miscalculate moving time or reject the upload.

---

## 5. UI, Styling & Accessibility Conventions
* **Modals:** Use native HTML `<dialog class="modal-dialog glass-panel">` opened via `.showModal()` and closed via `.close()`.
* **Performance / LOD:** `MapManager.renderVertices()` uses zoom-based sampling (`step = 1 | 2 | 4 | 8`) and viewport culling (`mapBounds.contains(latlng)`) when `this.points.length > 100`. Keep this intact so street-snapped tracks with 1,000+ points remain 60fps smooth.
* **Comparison Overlay:** `MapManager.setComparisonPoints(points)` renders a non-interactive dashed cyan polyline (`#00e5ff`, `dashArray: '6, 8'`) below the main `#ff6b35` polyline so users can visually inspect where gaps were filled. Clear this overlay (`setComparisonPoints(null)`) on Undo, Clear, or file load.

---

## 6. Trip Simulation & Telemetry Cockpit
* **Simulation Loop (`App.simLoop`):** Driven by `requestAnimationFrame` and `interpolateTrackAtDistance(this.points, targetDist)` in `src/utils/geo.js`.
* **Telemetry Data:** Computes instantaneous speed, elapsed duration, distance traveled, percentage, current elevation, bearing azimuth (0-360°), and slope grade (%) continuously.
* **Map Synchronization (`MapManager.updateSimulation`):**
  * `simMarker`: Custom styled marker with rotating SVG directional chevron matching route bearing.
  * `simTraveledPolyline`: Dynamic cyan polyline (`#00e5ff`, weight 5) displaying covered terrain.
  * Smooth camera tracking automatically follows traveler when `Follow Camera` is toggled.
* **Elevation Synchronization (`ElevationProfile.setSimulationDist`):** Fills the area under the elevation profile curve up to the traveler's position with cyan glow and places a vertical tracking cursor.
* **Cleanup Invariant:** When editing or loading tracks, always ensure `stopSimulation()` and `clearSimulation()` are invoked to prevent ghost markers or stale animation loops.

