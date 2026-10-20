/**
 * Interactive Leaflet Map Manager with full GPX editing capabilities
 */

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { escapeHtml } from '../utils/html.js';

// Fix Leaflet's default icon path issue with bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});

export class MapManager {
  constructor(mapContainerId, callbacks = {}) {
    this.containerId = mapContainerId;
    this.callbacks = callbacks;
    this.mode = 'select'; // 'select' | 'draw' | 'delete' | 'waypoint' | 'split'
    this.points = [];
    this.waypoints = [];
    this.selectedPointIndex = -1;

    this.layers = {
      comparisonPolyline: null,
      polyline: null,
      polylineGlow: null,
      vertexMarkers: L.layerGroup(),
      midpointMarkers: L.layerGroup(),
      startEndMarkers: L.layerGroup(),
      waypointMarkers: L.layerGroup(),
      hoverMarker: null,
      simMarker: null,
      simTraveledPolyline: null
    };

    this.initMap();
  }

  initMap() {
    // 5 base map tile layers
    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    });

    const topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      maxZoom: 17,
      attribution: 'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap'
    });

    const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
    });

    const dark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 20,
      attribution: '&copy; OpenStreetMap &copy; CARTO'
    });

    const cyclo = L.tileLayer('https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png', {
      maxZoom: 20,
      attribution: '&copy; CyclOSM &copy; OpenStreetMap'
    });

    this.map = L.map(this.containerId, {
      center: [46.5, 8.5], // Center of Alps
      zoom: 12,
      layers: [topo],
      zoomControl: false
    });

    // Custom sleek zoom control in top-right
    L.control.zoom({ position: 'topright' }).addTo(this.map);

    // Layer switcher
    const baseMaps = {
      "Topographic (Relief)": topo,
      "Satellite Imagery": satellite,
      "Dark Matter": dark,
      "Standard (OSM)": osm,
      "Cycling & Hiking": cyclo
    };
    L.control.layers(baseMaps, null, { position: 'topright' }).addTo(this.map);

    // Add layer groups to map
    this.layers.vertexMarkers.addTo(this.map);
    this.layers.midpointMarkers.addTo(this.map);
    this.layers.startEndMarkers.addTo(this.map);
    this.layers.waypointMarkers.addTo(this.map);

    // Hover marker on map (sync with elevation profile)
    const hoverIcon = L.divIcon({
      className: 'custom-hover-pin',
      html: '<div class="hover-pulse-beacon"></div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });
    this.layers.hoverMarker = L.marker([0, 0], { icon: hoverIcon, interactive: false });

    // Map click listeners for modes
    this.map.on('click', (e) => this.handleMapClick(e));
    this.map.on('zoomend moveend', () => this.updateVerticesLOD());
  }

  setMode(mode) {
    this.mode = mode;
    const container = document.getElementById(this.containerId);
    container.classList.remove('mode-select', 'mode-draw', 'mode-delete', 'mode-waypoint', 'mode-split');
    container.classList.add(`mode-${mode}`);

    // Re-render vertices for current mode
    this.renderVertices();
  }

  setData(points, waypoints, fitBounds = false) {
    this.stopSimulation();
    this.points = points || [];
    this.waypoints = waypoints || [];
    this.selectedPointIndex = -1;

    this.renderPolyline();
    this.renderVertices();
    this.renderStartEndMarkers();
    this.renderWaypoints();

    if (fitBounds && this.points.length > 0) {
      this.fitTrackBounds();
    }
  }

  fitTrackBounds() {
    if (!this.points || this.points.length === 0) return;
    const latLngs = this.points.map(p => [p.lat, p.lon]);
    const bounds = L.latLngBounds(latLngs);
    this.map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
  }

  renderPolyline() {
    // Remove existing polylines
    if (this.layers.polyline) this.map.removeLayer(this.layers.polyline);
    if (this.layers.polylineGlow) this.map.removeLayer(this.layers.polylineGlow);

    if (this.points.length < 2) return;

    const latLngs = this.points.map(p => [p.lat, p.lon]);

    // Outer subtle glow line
    this.layers.polylineGlow = L.polyline(latLngs, {
      color: '#ff6b35',
      weight: 8,
      opacity: 0.25,
      lineCap: 'round',
      lineJoin: 'round',
      interactive: false
    }).addTo(this.map);

    // Core crisp polyline
    this.layers.polyline = L.polyline(latLngs, {
      color: '#ff6b35',
      weight: 4,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round',
      interactive: true
    }).addTo(this.map);

    this.layers.polyline.on('click', (e) => {
      if (this.mode === 'draw') {
        this.insertPointNear(e.latlng);
      }
    });
  }

  setComparisonPoints(points) {
    if (this.layers.comparisonPolyline) {
      this.map.removeLayer(this.layers.comparisonPolyline);
      this.layers.comparisonPolyline = null;
    }

    if (!points || points.length < 2) return;

    const latLngs = points.map((p) => [p.lat, p.lon]);
    this.layers.comparisonPolyline = L.polyline(latLngs, {
      color: '#00e5ff',
      weight: 2.5,
      opacity: 0.65,
      dashArray: '6, 8',
      lineCap: 'round',
      lineJoin: 'round',
      interactive: false
    }).addTo(this.map);

    if (this.layers.polyline) {
      this.layers.polyline.bringToFront();
    }
  }

  renderStartEndMarkers() {
    this.layers.startEndMarkers.clearLayers();
    if (this.points.length === 0) return;

    // Start marker (Green)
    const startPt = this.points[0];
    const startIcon = L.divIcon({
      className: 'custom-track-endpoint start-endpoint',
      html: `<div class="endpoint-circle start"><span class="endpoint-label">START</span></div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
    const startMarker = L.marker([startPt.lat, startPt.lon], { icon: startIcon, zIndexOffset: 1000 })
      .bindTooltip(`<b>Start Point</b><br>Alt: ${startPt.ele ? startPt.ele + 'm' : 'N/A'}`);
    this.layers.startEndMarkers.addLayer(startMarker);

    // End marker (Red)
    if (this.points.length > 1) {
      const endPt = this.points[this.points.length - 1];
      const endIcon = L.divIcon({
        className: 'custom-track-endpoint end-endpoint',
        html: `<div class="endpoint-circle end"><span class="endpoint-label">END</span></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });
      const endMarker = L.marker([endPt.lat, endPt.lon], { icon: endIcon, zIndexOffset: 1000 })
        .bindTooltip(`<b>Finish Point</b><br>Alt: ${endPt.ele ? endPt.ele + 'm' : 'N/A'}`);
      this.layers.startEndMarkers.addLayer(endMarker);
    }
  }

  updateVerticesLOD() {
    if (this.points.length > 80) {
      this.renderVertices();
    }
  }

  renderVertices() {
    this.layers.vertexMarkers.clearLayers();
    this.layers.midpointMarkers.clearLayers();

    if (this.points.length === 0) return;

    const zoom = this.map.getZoom();
    const mapBounds = this.map.getBounds();

    // Determine sampling step to prevent UI lag on dense tracks
    let step = 1;
    if (this.points.length > 600 && zoom < 14) step = 8;
    else if (this.points.length > 300 && zoom < 14) step = 4;
    else if (this.points.length > 150 && zoom < 13) step = 2;

    for (let i = 0; i < this.points.length; i += step) {
      const pt = this.points[i];
      const latlng = L.latLng(pt.lat, pt.lon);

      // Viewport culling if track is large
      if (this.points.length > 100 && !mapBounds.contains(latlng)) {
        continue;
      }

      const isSelected = i === this.selectedPointIndex;
      const isStartOrEnd = i === 0 || i === this.points.length - 1;

      // Create vertex marker
      const markerClass = `vertex-handle ${this.mode === 'delete' ? 'delete-mode' : ''} ${isSelected ? 'selected' : ''}`;
      const icon = L.divIcon({
        className: markerClass,
        html: `<div class="vertex-dot ${isStartOrEnd ? 'endpoint-vertex' : ''}"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      });

      const marker = L.marker(latlng, {
        icon,
        draggable: this.mode === 'select',
        zIndexOffset: isSelected ? 500 : 100
      });

      // Drag event for moving vertices in select mode
      marker.on('drag', (e) => {
        const newPos = e.target.getLatLng();
        this.points[i].lat = Number(newPos.lat.toFixed(7));
        this.points[i].lon = Number(newPos.lng.toFixed(7));
        this.renderPolyline();
      });

      marker.on('dragend', () => {
        if (this.callbacks.onTrackModified) {
          this.callbacks.onTrackModified([...this.points]);
        }
      });

      // Click handling based on active tool mode
      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        if (this.mode === 'delete') {
          this.deletePoint(i);
        } else if (this.mode === 'split') {
          this.splitTrack(i);
        } else {
          this.selectPoint(i);
        }
      });

      this.layers.vertexMarkers.addLayer(marker);

      // Render midpoint '+' insertion handles between points when in select mode & zoomed in
      if (this.mode === 'select' && i < this.points.length - 1 && zoom >= 13) {
        const nextPt = this.points[i + 1];
        const midLat = (pt.lat + nextPt.lat) / 2;
        const midLon = (pt.lon + nextPt.lon) / 2;
        const midEle = (pt.ele !== null && nextPt.ele !== null) ? (pt.ele + nextPt.ele) / 2 : null;

        const midIcon = L.divIcon({
          className: 'midpoint-handle',
          html: `<div class="midpoint-plus">+</div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        });

        const midMarker = L.marker([midLat, midLon], {
          icon: midIcon,
          zIndexOffset: 50
        });

        midMarker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          this.insertPointAt(i + 1, midLat, midLon, midEle);
        });

        this.layers.midpointMarkers.addLayer(midMarker);
      }
    }
  }

  renderWaypoints() {
    this.layers.waypointMarkers.clearLayers();

    const symIcons = {
      Trailhead: '🚩',
      Summit: '⛰️',
      Viewpoint: '🔭',
      Water: '💧',
      Camp: '⛺',
      Food: '🍴',
      Danger: '⚠️',
      Flag: '📍'
    };

    this.waypoints.forEach((wpt, index) => {
      const iconChar = symIcons[wpt.sym] || '📍';
      const icon = L.divIcon({
        className: 'custom-waypoint-pin',
        html: `
          <div class="waypoint-badge">
            <span class="wpt-icon">${iconChar}</span>
            <span class="wpt-title">${escapeHtml(wpt.name || 'POI')}</span>
          </div>
        `,
        iconSize: [40, 36],
        iconAnchor: [20, 36]
      });

      const marker = L.marker([wpt.lat, wpt.lon], {
        icon,
        draggable: true
      });

      const popupContent = document.createElement('div');
      popupContent.className = 'wpt-popup';
      popupContent.innerHTML = `
        <h4 style="margin: 0 0 6px 0; color: #ff6b35;">${escapeHtml(wpt.name)}</h4>
        <p style="margin: 0 0 8px 0; font-size: 12px; color: #cbd5e1;">${escapeHtml(wpt.desc || 'No description')}</p>
        <div style="font-size: 11px; color: #94a3b8; margin-bottom: 8px;">
          Alt: ${wpt.ele ? wpt.ele + 'm' : 'N/A'}<br>
          Lat: ${wpt.lat.toFixed(5)}, Lon: ${wpt.lon.toFixed(5)}
        </div>
        <button id="del-wpt-${index}" class="btn-popup-delete">Delete Waypoint</button>
      `;

      marker.bindPopup(popupContent);

      marker.on('popupopen', () => {
        const delBtn = document.getElementById(`del-wpt-${index}`);
        if (delBtn) {
          delBtn.onclick = () => {
            this.deleteWaypoint(index);
          };
        }
      });

      marker.on('dragend', (e) => {
        const newPos = e.target.getLatLng();
        this.waypoints[index].lat = Number(newPos.lat.toFixed(7));
        this.waypoints[index].lon = Number(newPos.lng.toFixed(7));
        if (this.callbacks.onWaypointModified) {
          this.callbacks.onWaypointModified([...this.waypoints]);
        }
      });

      this.layers.waypointMarkers.addLayer(marker);
    });
  }

  handleMapClick(e) {
    if (this.mode === 'draw') {
      this.appendPoint(e.latlng.lat, e.latlng.lng);
    } else if (this.mode === 'waypoint') {
      if (this.callbacks.onRequestNewWaypoint) {
        this.callbacks.onRequestNewWaypoint(e.latlng.lat, e.latlng.lng);
      }
    }
  }

  appendPoint(lat, lon) {
    // Interpolate elevation from previous point if available
    const prevPt = this.points[this.points.length - 1];
    const ele = prevPt ? prevPt.ele : null;

    const newPt = {
      id: `pt_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      lat: Number(lat.toFixed(7)),
      lon: Number(lon.toFixed(7)),
      ele,
      time: new Date().toISOString()
    };

    this.points.push(newPt);
    this.renderPolyline();
    this.renderVertices();
    this.renderStartEndMarkers();

    if (this.callbacks.onTrackModified) {
      this.callbacks.onTrackModified([...this.points]);
    }
  }

  insertPointAt(index, lat, lon, ele) {
    const newPt = {
      id: `pt_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      lat: Number(lat.toFixed(7)),
      lon: Number(lon.toFixed(7)),
      ele: ele !== null ? Number(ele.toFixed(1)) : null,
      time: new Date().toISOString()
    };

    this.points.splice(index, 0, newPt);
    this.renderPolyline();
    this.renderVertices();

    if (this.callbacks.onTrackModified) {
      this.callbacks.onTrackModified([...this.points]);
    }

    this.selectPoint(index);
  }

  deletePoint(index) {
    if (this.points.length <= index) return;
    this.points.splice(index, 1);
    this.selectedPointIndex = -1;

    this.renderPolyline();
    this.renderVertices();
    this.renderStartEndMarkers();

    if (this.callbacks.onTrackModified) {
      this.callbacks.onTrackModified([...this.points]);
    }
  }

  splitTrack(index) {
    if (index <= 0 || index >= this.points.length - 1) return;
    if (this.callbacks.onSplitTrack) {
      this.callbacks.onSplitTrack(index);
    }
  }

  selectPoint(index) {
    this.selectedPointIndex = index;
    this.renderVertices();
    if (this.callbacks.onPointSelected) {
      this.callbacks.onPointSelected(this.points[index], index);
    }
  }

  addWaypoint(wpt) {
    this.waypoints.push(wpt);
    this.renderWaypoints();
    if (this.callbacks.onWaypointModified) {
      this.callbacks.onWaypointModified([...this.waypoints]);
    }
  }

  deleteWaypoint(index) {
    this.waypoints.splice(index, 1);
    this.renderWaypoints();
    if (this.callbacks.onWaypointModified) {
      this.callbacks.onWaypointModified([...this.waypoints]);
    }
  }

  setHoverPoint(point) {
    if (!point) {
      if (this.map.hasLayer(this.layers.hoverMarker)) {
        this.map.removeLayer(this.layers.hoverMarker);
      }
      return;
    }

    this.layers.hoverMarker.setLatLng([point.lat, point.lon]);
    if (!this.map.hasLayer(this.layers.hoverMarker)) {
      this.layers.hoverMarker.addTo(this.map);
    }
  }

  panTo(lat, lon, zoom = null) {
    if (zoom) {
      this.map.setView([lat, lon], zoom);
    } else {
      this.map.panTo([lat, lon]);
    }
  }

  updateSimulation(posData, followCamera = true) {
    if (!posData) {
      this.stopSimulation();
      return;
    }

    // 1. Update / Create traveled polyline
    if (!this.layers.simTraveledPolyline) {
      this.layers.simTraveledPolyline = L.polyline(posData.traveledCoords, {
        color: '#00e5ff',
        weight: 5,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false
      }).addTo(this.map);
    } else {
      this.layers.simTraveledPolyline.setLatLngs(posData.traveledCoords);
    }

    // 2. Update / Create traveler marker
    const bearing = posData.bearing || 0;
    if (!this.layers.simMarker) {
      const simIcon = L.divIcon({
        className: 'custom-sim-traveler',
        html: `
          <div class="sim-avatar-container">
            <div class="sim-pulse-ring"></div>
            <div class="sim-direction-arrow" style="transform: rotate(${bearing}deg);">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <circle cx="14" cy="14" r="12" fill="#0e1520" stroke="#00e5ff" stroke-width="2.5" />
                <path d="M14 6L20 20L14 16.5L8 20L14 6Z" fill="#00e5ff" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round"/>
              </svg>
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      this.layers.simMarker = L.marker([posData.lat, posData.lon], {
        icon: simIcon,
        zIndexOffset: 2000,
        interactive: false
      }).addTo(this.map);
    } else {
      this.layers.simMarker.setLatLng([posData.lat, posData.lon]);
      const arrowEl = this.layers.simMarker.getElement()?.querySelector('.sim-direction-arrow');
      if (arrowEl) {
        arrowEl.style.transform = `rotate(${bearing}deg)`;
      }
    }

    // 3. Smooth Camera Follow
    if (followCamera) {
      const bounds = this.map.getBounds();
      const padLat = (bounds.getNorth() - bounds.getSouth()) * 0.18;
      const padLng = (bounds.getEast() - bounds.getWest()) * 0.18;
      const innerBounds = L.latLngBounds(
        [bounds.getSouth() + padLat, bounds.getWest() + padLng],
        [bounds.getNorth() - padLat, bounds.getEast() - padLng]
      );
      if (!innerBounds.contains([posData.lat, posData.lon])) {
        this.map.panTo([posData.lat, posData.lon], { animate: true, duration: 0.35 });
      }
    }
  }

  stopSimulation() {
    if (this.layers.simMarker) {
      this.map.removeLayer(this.layers.simMarker);
      this.layers.simMarker = null;
    }
    if (this.layers.simTraveledPolyline) {
      this.map.removeLayer(this.layers.simTraveledPolyline);
      this.layers.simTraveledPolyline = null;
    }
  }
}

