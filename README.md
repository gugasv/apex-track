# ApexTrack - Interactive GPX Studio & Track Editor

[![Live Demo](https://img.shields.io/badge/Live%20Demo-https%3A%2F%2Fgugasv.github.io%2Fapex--track%2F-00e5ff?style=for-the-badge&logo=githubpages&logoColor=white)](https://gugasv.github.io/apex-track/)

**ApexTrack** is a modern, high-performance web application designed to load, visualize, edit, simplify, and export GPX tracks on top of interactive topographic and satellite maps with synchronized elevation profiles.

🌐 **Live URL**: [https://gugasv.github.io/apex-track/](https://gugasv.github.io/apex-track/)

---

## 🌟 Key Features

### 🗺️ Map & Visualization
- **Multi-Source Layer Switcher**:
  - OpenTopoMap (Detailed topographic contours & relief shading)
  - ESRI World Imagery (High-resolution satellite view)
  - CartoDB Dark Matter (Sleek high-contrast dark theme)
  - OpenStreetMap Standard
  - CyclOSM (Bicycle & hiking infrastructure)
- **Track Rendering**: Luminous polyline with start/finish custom badges and interactive vertex handles.
- **Dynamic Level-of-Detail (LOD)**: Smooth performance regardless of track size.

### ✏️ Interactive Track Editing
- **Move & Drag Vertices**: Click and drag any point along the track to adjust coordinates.
- **Mid-point Insertion Handles**: Click the `+` ghost buttons between adjacent vertices to add new points.
- **Freehand Draw Mode**: Click anywhere on the map to extend or draw routes from scratch.
- **Vertex Deletion**: Click points in delete mode or hit <kbd>Backspace</kbd> / <kbd>Delete</kbd> on a selected point.
- **Split & Trim**: Trim routes or split tracks at designated milestones.
- **Point Inspector**: View exact distance, latitude, longitude, and edit point elevation directly.

### 📍 Waypoints & POIs
- Place custom points of interest: **Summit** ⛰️, **Viewpoint** 🔭, **Water Source** 💧, **Campsite** ⛺, **Food / Refuge** 🍴, **Trailhead** 🚩, **Caution** ⚠️, and **Pins** 📍.
- Editable names, descriptions, and drag-and-drop repositioning.

### 📈 Synchronized Elevation Profile
- High-definition Retina canvas chart with gradient area fill.
- **Bidirectional Hover Sync**: Hovering the chart displays a glowing cursor on the map with distance, elevation, and slope grade % (`+X.X%`).
- Unit toggle: **Metric** (km / m) and **Imperial** (mi / ft).
- Collapsible bottom dock.

### 🎬 Trip Simulation & Telemetry Cockpit
- **Interactive Route Player**: Fly along the route from start to finish with sub-second smooth interpolation.
- **Dynamic Traveler Marker**: Real-time beacon with heading/bearing azimuth rotation pointing in the exact travel direction.
- **Traveled Path Visualization**: Glowing cyan polyline (`#00e5ff`) dynamically reveals the covered terrain behind the traveler.
- **Synchronized Profile Fill**: The elevation profile chart illuminates the traveled section in real-time with cursor tracking.
- **Live Cockpit Telemetry**: Readouts for instantaneous speed (km/h or mph), elapsed time, distance covered (% progress), current altitude, and slope/grade (`+X.X%`).
- **Interactive Scrubber & Multipliers**: Seek to any point along the trip with the scrubber slider, and speed up playback (`1x`, `5x`, `15x`, `50x`, `150x`).
- **Follow Camera Mode**: Smooth camera tracking keeping the traveler centered on the map.

### ⚡ Route Tools
- **Snap to Streets (Fill Gaps)**: Reconstructs street-accurate geometry between sparse GPS points using OpenStreetMap OSRM routing (Cycling, Walking/Running, Driving) with automatic jump-outlier filtering, smart river/bridge detour protection, dashed before/after comparison overlay, and distance-proportional timestamp interpolation.
- **Douglas-Peucker Simplification**: Interactive slider showing live point reduction percentage.
- **Elevation Smoothing**: Moving-average filter to eliminate GPS elevation noise.
- **Reverse Route**: Reverses track direction and adjusts timestamps realistically.
- **Undo / Redo**: Full state stack accessible via UI buttons and shortcuts (<kbd>Cmd+Z</kbd> / <kbd>Cmd+Shift+Z</kbd>).

### 💾 Import & Export
- **Import**: Drag-and-drop `.gpx`, `.xml`, or `.kml` files anywhere on screen or use the file picker.
- **Built-in Samples**: One-click demo routes (*Chamonix - Lac Blanc Loop*, *Yosemite Mist & Nevada Falls*, *Dolomites Tre Cime Loop*).
- **Export Formats**:
  - **GPX 1.1** (Standard for Garmin, Strava, Komoot, Wahoo)
  - **GeoJSON** (Web GIS, Mapbox, QGIS)
  - **KML** (Google Earth 3D flythroughs)
- **Pacing & Speed Recalculator**: Recompute timestamps for hiking (4.5 km/h), trail running (10 km/h), MTB (18 km/h), or road cycling (26 km/h).

---

## 🚀 Running Locally

The application is already running on the local Vite dev server:

```bash
npm run dev
```

Open your browser to: **[http://localhost:5173/](http://localhost:5173/)**

To create a production build:
```bash
npm run build
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| <kbd>Cmd+Z</kbd> / <kbd>Ctrl+Z</kbd> | Undo last change |
| <kbd>Cmd+Shift+Z</kbd> / <kbd>Ctrl+Y</kbd> | Redo change |
| <kbd>Delete</kbd> / <kbd>Backspace</kbd> | Delete currently selected point |
| <kbd>Escape</kbd> | Deselect point / Exit simulation / Return to Move mode |
| <kbd>Space</kbd> | Play / Pause Trip Simulation |
| <kbd>←</kbd> / <kbd>→</kbd> | Seek trip backward / forward |

