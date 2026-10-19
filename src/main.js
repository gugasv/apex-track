/**
 * ApexTrack - GPX Studio & Interactive Track Editor
 * Main Application Orchestrator
 */

import './style.css';
import confetti from 'canvas-confetti';
import { MapManager } from './components/mapManager.js';
import { ElevationProfile } from './components/elevationProfile.js';
import { HistoryManager } from './components/history.js';
import { showToast } from './components/toast.js';
import { parseGPX, buildGPX, buildGeoJSON, buildKML } from './utils/gpx.js';
import { SAMPLE_TRACKS } from './utils/samples.js';
import {
  calculateTrackMetrics,
  formatDistance,
  formatElevation,
  formatDuration,
  douglasPeucker,
  smoothElevations,
  reverseTrack,
  interpolateTrackAtDistance
} from './utils/geo.js';
import { snapTrackToStreets } from './utils/routing.js';

class App {
  constructor() {
    this.trackName = 'Chamonix - Lac Blanc Alpine Loop';
    this.description = 'Scenic alpine circuit facing Mont Blanc';
    this.points = [];
    this.waypoints = [];
    this.metrics = null;
    this.unit = 'metric';
    this.selectedPointIndex = -1;

    // Temporary storage for waypoint placement modal
    this.pendingWaypointCoords = null;

    // Trip Simulation state
    this.isSimulating = false;
    this.simPlaying = false;
    this.simCurrentDist = 0;
    this.simSpeedMultiplier = 15;
    this.simFollowCamera = true;
    this.simAnimFrameId = null;
    this.simLastTimestamp = null;

    this.history = new HistoryManager(60);
    this.initDOM();
    this.initComponents();
    this.initListeners();
    this.initKeyboardShortcuts();
    this.initDragAndDrop();

    // Load initial sample track so user immediately has rich interactive data
    this.loadSample('lac_blanc', true);
  }

  initDOM() {
    // Route name input
    this.elRouteName = document.getElementById('route-name-input');

    // Stats elements
    this.elStatDist = document.getElementById('stat-distance');
    this.elStatGain = document.getElementById('stat-gain');
    this.elStatLoss = document.getElementById('stat-loss');
    this.elStatAltRange = document.getElementById('stat-altrange');
    this.elStatTime = document.getElementById('stat-time');
    this.elStatPoints = document.getElementById('stat-points');

    // Mode buttons
    this.modeButtons = document.querySelectorAll('.tool-btn');

    // History buttons
    this.btnUndo = document.getElementById('btn-undo');
    this.btnRedo = document.getElementById('btn-redo');

    // Elevation dock
    this.elevationDock = document.querySelector('.elevation-dock');
    this.btnToggleElevation = document.getElementById('btn-toggle-elevation');
    this.elevationToggleIcon = document.getElementById('elevation-toggle-icon');

    // Unit toggle buttons
    this.unitButtons = document.querySelectorAll('.unit-btn');

    // Point inspector
    this.pointInspector = document.getElementById('point-inspector');
    this.inspIndex = document.getElementById('insp-index');
    this.inspDist = document.getElementById('insp-dist');
    this.inspEle = document.getElementById('insp-ele-input');
    this.inspLat = document.getElementById('insp-lat');
    this.inspLon = document.getElementById('insp-lon');
    this.btnInspDelete = document.getElementById('btn-insp-delete');
    this.btnInspClose = document.getElementById('btn-insp-close');

    // Dialogs
    this.exportDialog = document.getElementById('export-dialog');
    this.simplifyDialog = document.getElementById('simplify-dialog');
    this.snapDialog = document.getElementById('snap-dialog');
    this.waypointDialog = document.getElementById('waypoint-dialog');

    // Samples dropdown
    this.btnSamplesMenu = document.getElementById('btn-samples-menu');
    this.samplesDropdown = document.getElementById('samples-dropdown');

    // Trip Simulation elements
    this.simulationBar = document.getElementById('simulation-bar');
    this.btnSimulateTrip = document.getElementById('btn-simulate-trip');
    this.btnSimClose = document.getElementById('btn-sim-close');
    this.btnSimPlayPause = document.getElementById('btn-sim-playpause');
    this.simIconPlay = document.getElementById('sim-icon-play');
    this.simIconPause = document.getElementById('sim-icon-pause');
    this.btnSimRestart = document.getElementById('btn-sim-restart');
    this.simProgressSlider = document.getElementById('sim-progress-slider');
    this.simProgressPct = document.getElementById('sim-progress-pct');
    this.simStatusBadge = document.getElementById('sim-status-badge');
    this.simTelSpeed = document.getElementById('sim-telemetry-speed');
    this.simTelTime = document.getElementById('sim-telemetry-time');
    this.simTelDist = document.getElementById('sim-telemetry-dist');
    this.simTelEle = document.getElementById('sim-telemetry-ele');
    this.simTelGrade = document.getElementById('sim-telemetry-grade');
    this.simCameraFollow = document.getElementById('sim-camera-follow');
    this.simSpeedButtons = document.querySelectorAll('.sim-speed-btn');
  }

  initComponents() {
    // Initialize Map Manager
    this.mapManager = new MapManager('map-container', {
      onTrackModified: (newPoints) => {
        this.pushHistoryState();
        this.updatePoints(newPoints, false);
        showToast('Track points updated', 'info', 1500);
      },
      onPointSelected: (point, index) => {
        this.selectPoint(point, index);
      },
      onWaypointModified: (newWaypoints) => {
        this.pushHistoryState();
        this.waypoints = newWaypoints;
        showToast('Waypoints updated', 'info', 1500);
      },
      onRequestNewWaypoint: (lat, lon) => {
        this.openWaypointDialog(lat, lon);
      },
      onSplitTrack: (index) => {
        this.splitTrackAt(index);
      }
    });

    // Initialize Elevation Profile Canvas
    const canvas = document.getElementById('elevation-canvas');
    this.elevationProfile = new ElevationProfile(canvas, {
      unit: this.unit,
      onHoverPoint: (point) => {
        this.mapManager.setHoverPoint(point);
      },
      onSelectPoint: (point, index) => {
        this.selectPoint(point, index);
        this.mapManager.panTo(point.lat, point.lon);
      }
    });

    // History listener
    this.history.setListener(({ canUndo, canRedo }) => {
      this.btnUndo.disabled = !canUndo;
      this.btnRedo.disabled = !canRedo;
    });
  }

  initListeners() {
    // Route name rename
    this.elRouteName.addEventListener('change', (e) => {
      this.trackName = e.target.value.trim() || 'Untitled Track';
      showToast(`Route renamed to "${this.trackName}"`, 'info', 2000);
    });

    // Tool Mode switching
    this.modeButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        this.setMode(mode);
      });
    });

    // History controls
    this.btnUndo.addEventListener('click', () => this.undo());
    this.btnRedo.addEventListener('click', () => this.redo());

    // File input
    const fileInput = document.getElementById('gpx-file-input');
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        this.loadFile(file);
      }
      fileInput.value = '';
    });

    // Sample routes dropdown toggle
    this.btnSamplesMenu.addEventListener('click', (e) => {
      e.stopPropagation();
      this.samplesDropdown.classList.toggle('show');
    });

    document.addEventListener('click', () => {
      this.samplesDropdown.classList.remove('show');
    });

    this.samplesDropdown.querySelectorAll('.dropdown-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        const sampleId = item.dataset.sample;
        this.loadSample(sampleId, true);
        this.samplesDropdown.classList.remove('show');
      });
    });

    // Unit toggle
    this.unitButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.unitButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.unit = btn.dataset.unit;
        this.elevationProfile.setUnit(this.unit);
        this.updateStatsDisplay();
      });
    });

    // Elevation Dock Collapse / Expand
    this.btnToggleElevation.addEventListener('click', () => {
      this.elevationDock.classList.toggle('collapsed');
      const isCollapsed = this.elevationDock.classList.contains('collapsed');
      this.elevationToggleIcon.innerHTML = isCollapsed
        ? '<polyline points="18 15 12 9 6 15"/>'
        : '<polyline points="6 9 12 15 18 9"/>';
      setTimeout(() => {
        this.mapManager.map.invalidateSize();
        this.elevationProfile.resize();
        this.elevationProfile.render();
      }, 280);
    });

    // HUD Actions
    document.getElementById('btn-reverse').addEventListener('click', () => this.reverseTrack());
    document.getElementById('btn-smooth-ele').addEventListener('click', () => this.smoothElevation());
    document.getElementById('btn-fit-map').addEventListener('click', () => this.mapManager.fitTrackBounds());
    document.getElementById('btn-clear-track').addEventListener('click', () => this.clearTrack());

    // Inspector events
    this.btnInspClose.addEventListener('click', () => this.closeInspector());
    this.btnInspDelete.addEventListener('click', () => {
      if (this.selectedPointIndex >= 0) {
        this.pushHistoryState();
        this.mapManager.deletePoint(this.selectedPointIndex);
        this.closeInspector();
        showToast('Point deleted', 'info', 1500);
      }
    });

    this.inspEle.addEventListener('change', (e) => {
      if (this.selectedPointIndex >= 0 && this.points[this.selectedPointIndex]) {
        this.pushHistoryState();
        const newEle = parseFloat(e.target.value);
        this.points[this.selectedPointIndex].ele = isNaN(newEle) ? null : newEle;
        this.updatePoints(this.points, false);
      }
    });

    // Simplify Modal
    document.getElementById('btn-simplify-modal').addEventListener('click', () => this.openSimplifyModal());
    document.getElementById('btn-close-simplify').addEventListener('click', () => this.simplifyDialog.close());
    document.getElementById('btn-cancel-simplify').addEventListener('click', () => this.simplifyDialog.close());
    document.getElementById('simplify-tolerance').addEventListener('input', (e) => this.handleSimplifySlider(e));
    document.getElementById('btn-confirm-simplify').addEventListener('click', () => this.applySimplify());

    // Snap to Streets Modal
    document.getElementById('btn-snap-modal').addEventListener('click', () => this.openSnapModal());
    document.getElementById('btn-close-snap').addEventListener('click', () => this.snapDialog.close());
    document.getElementById('btn-cancel-snap').addEventListener('click', () => this.snapDialog.close());
    document.getElementById('btn-confirm-snap').addEventListener('click', () => this.applySnapToStreets());

    // Waypoint Modal
    document.getElementById('btn-close-wpt-dialog').addEventListener('click', () => this.waypointDialog.close());
    document.getElementById('btn-cancel-wpt').addEventListener('click', () => this.waypointDialog.close());
    document.getElementById('btn-confirm-wpt').addEventListener('click', () => this.confirmWaypoint());

    // Export Modal
    document.getElementById('btn-export-open').addEventListener('click', () => this.openExportModal());
    document.getElementById('btn-close-export').addEventListener('click', () => this.exportDialog.close());
    document.getElementById('btn-cancel-export').addEventListener('click', () => this.exportDialog.close());
    document.getElementById('btn-confirm-export').addEventListener('click', () => this.executeExport());

    // Trip Simulation controls
    this.btnSimulateTrip.addEventListener('click', () => this.openSimulation());
    this.btnSimClose.addEventListener('click', () => this.closeSimulation());
    this.btnSimPlayPause.addEventListener('click', () => this.toggleSimPlayPause());
    this.btnSimRestart.addEventListener('click', () => {
      this.seekSimulation(0);
      this.playSimulation();
    });
    this.simProgressSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      const totalDist = this.metrics?.totalDistance || 0;
      const targetDist = (val / 1000) * totalDist;
      this.seekSimulation(targetDist);
    });
    this.simSpeedButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.simSpeedButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.simSpeedMultiplier = parseFloat(btn.dataset.speed) || 15;
      });
    });
    this.simCameraFollow.addEventListener('change', (e) => {
      this.simFollowCamera = e.target.checked;
    });
  }

  initKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Ignore shortcuts if inside inputs or textareas
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
        return;
      }

      // Simulation shortcuts
      if (this.isSimulating) {
        if (e.code === 'Space') {
          e.preventDefault();
          this.toggleSimPlayPause();
          return;
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          const step = (this.metrics?.totalDistance || 1000) * 0.02;
          this.seekSimulation(this.simCurrentDist + step);
          return;
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          const step = (this.metrics?.totalDistance || 1000) * 0.02;
          this.seekSimulation(this.simCurrentDist - step);
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          this.closeSimulation();
          return;
        }
      }

      // Undo: Ctrl+Z / Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        this.undo();
      }

      // Redo: Ctrl+Shift+Z / Cmd+Shift+Z / Ctrl+Y
      if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && e.shiftKey) ||
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y')
      ) {
        e.preventDefault();
        this.redo();
      }

      // Delete key: delete selected point
      if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedPointIndex >= 0) {
        e.preventDefault();
        this.pushHistoryState();
        this.mapManager.deletePoint(this.selectedPointIndex);
        this.closeInspector();
        showToast('Point deleted', 'info', 1500);
      }

      // Escape key: close inspector or return to select mode
      if (e.key === 'Escape') {
        this.closeInspector();
        this.setMode('select');
      }
    });
  }

  initDragAndDrop() {
    const overlay = document.getElementById('drop-overlay');
    let dragCounter = 0;

    window.addEventListener('dragenter', (e) => {
      e.preventDefault();
      dragCounter++;
      overlay.classList.add('active');
    });

    window.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        overlay.classList.remove('active');
      }
    });

    window.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    window.addEventListener('drop', (e) => {
      e.preventDefault();
      dragCounter = 0;
      overlay.classList.remove('active');

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        this.loadFile(e.dataTransfer.files[0]);
      }
    });
  }

  setMode(mode) {
    this.modeButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    this.mapManager.setMode(mode);

    const modeLabels = {
      select: 'Move & Drag Points',
      draw: 'Click map to draw/extend route',
      delete: 'Click any point to delete it',
      waypoint: 'Click map to place a POI'
    };
    showToast(modeLabels[mode] || mode, 'info', 1800);
  }

  pushHistoryState() {
    this.history.push({
      points: JSON.parse(JSON.stringify(this.points)),
      waypoints: JSON.parse(JSON.stringify(this.waypoints)),
      trackName: this.trackName,
      description: this.description
    });
  }

  undo() {
    const previous = this.history.undo({
      points: this.points,
      waypoints: this.waypoints,
      trackName: this.trackName,
      description: this.description
    });

    if (previous) {
      this.points = previous.points;
      this.waypoints = previous.waypoints;
      this.trackName = previous.trackName;
      this.description = previous.description;
      this.elRouteName.value = this.trackName;
      this.mapManager.setComparisonPoints(null);
      this.updatePoints(this.points, false);
      this.mapManager.renderWaypoints();
      this.closeInspector();
      showToast('Undo applied', 'info', 1500);
    }
  }

  redo() {
    const next = this.history.redo({
      points: this.points,
      waypoints: this.waypoints,
      trackName: this.trackName,
      description: this.description
    });

    if (next) {
      this.points = next.points;
      this.waypoints = next.waypoints;
      this.trackName = next.trackName;
      this.description = next.description;
      this.elRouteName.value = this.trackName;
      this.updatePoints(this.points, false);
      this.mapManager.renderWaypoints();
      this.closeInspector();
      showToast('Redo applied', 'info', 1500);
    }
  }

  loadFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const parsed = parseGPX(text);

        if (!parsed.points || parsed.points.length === 0) {
          showToast('No track points found in this file', 'warning', 3000);
          return;
        }

        this.pushHistoryState();
        this.trackName = parsed.name || file.name.replace(/\.[^/.]+$/, '');
        this.description = parsed.description || '';
        this.elRouteName.value = this.trackName;
        this.waypoints = parsed.waypoints || [];
        this.mapManager.setComparisonPoints(null);

        this.updatePoints(parsed.points, true);
        showToast(`Loaded "${this.trackName}" with ${parsed.points.length} points!`, 'success', 3500);
      } catch (err) {
        console.error(err);
        showToast('Error parsing GPX file: ' + err.message, 'error', 4000);
      }
    };
    reader.readAsText(file);
  }

  loadSample(sampleId, fitBounds = false) {
    const sample = SAMPLE_TRACKS.find((s) => s.id === sampleId);
    if (!sample) return;

    this.pushHistoryState();
    this.trackName = sample.name;
    this.description = sample.description;
    this.elRouteName.value = this.trackName;
    this.waypoints = JSON.parse(JSON.stringify(sample.waypoints));
    this.mapManager.setComparisonPoints(null);

    this.updatePoints(JSON.parse(JSON.stringify(sample.points)), fitBounds);
    showToast(`Loaded ${sample.name}`, 'success', 2500);
  }

  updatePoints(points, fitBounds = false) {
    if (this.isSimulating) {
      this.closeSimulation();
    }
    this.metrics = calculateTrackMetrics(points);
    this.points = this.metrics.pointsWithDist;

    this.mapManager.setData(this.points, this.waypoints, fitBounds);
    this.elevationProfile.setData(this.points, this.metrics);
    this.updateStatsDisplay();
  }

  updateStatsDisplay() {
    if (!this.metrics) return;

    this.elStatDist.textContent = formatDistance(this.metrics.totalDistance, this.unit);
    this.elStatGain.textContent = `+${formatElevation(this.metrics.elevationGain, this.unit)}`;
    this.elStatLoss.textContent = `-${formatElevation(this.metrics.elevationLoss, this.unit)}`;
    this.elStatAltRange.textContent = `${formatElevation(this.metrics.minEle, this.unit)} - ${formatElevation(this.metrics.maxEle, this.unit)}`;
    this.elStatTime.textContent = formatDuration(this.metrics.durationSeconds);
    this.elStatPoints.textContent = this.points.length;
  }

  selectPoint(point, index) {
    this.selectedPointIndex = index;
    if (!point) {
      this.closeInspector();
      return;
    }

    this.inspIndex.textContent = `#${index + 1}`;
    this.inspDist.textContent = formatDistance(point.cumDist ?? 0, this.unit);
    this.inspEle.value = point.ele ?? 0;
    this.inspLat.textContent = point.lat.toFixed(5);
    this.inspLon.textContent = point.lon.toFixed(5);

    this.pointInspector.style.display = 'flex';
    this.elevationProfile.setHoverFromMap(index);
  }

  closeInspector() {
    this.selectedPointIndex = -1;
    this.pointInspector.style.display = 'none';
    this.elevationProfile.setHoverFromMap(-1);
    this.mapManager.selectedPointIndex = -1;
    this.mapManager.renderVertices();
  }

  reverseTrack() {
    if (this.points.length < 2) return;
    this.pushHistoryState();
    const reversed = reverseTrack(this.points);
    this.updatePoints(reversed, false);
    showToast('Track direction reversed', 'success', 2000);
  }

  smoothElevation() {
    if (this.points.length < 5) return;
    this.pushHistoryState();
    const smoothed = smoothElevations(this.points, 5);
    this.updatePoints(smoothed, false);
    showToast('Elevation profile smoothed', 'success', 2000);
  }

  clearTrack() {
    if (!confirm('Are you sure you want to clear the entire track?')) return;
    this.pushHistoryState();
    this.points = [];
    this.waypoints = [];
    this.mapManager.setComparisonPoints(null);
    this.updatePoints([], false);
    this.closeInspector();
    showToast('Track cleared. Switch to Draw mode to create a new track.', 'info', 3000);
  }

  splitTrackAt(index) {
    if (index <= 0 || index >= this.points.length - 1) return;
    if (confirm(`Split track at point #${index + 1}? This will keep the first segment up to this point.`)) {
      this.pushHistoryState();
      const firstHalf = this.points.slice(0, index + 1);
      this.updatePoints(firstHalf, false);
      showToast(`Track trimmed to point #${index + 1}`, 'success', 2500);
    }
  }

  // --- Simplify Modal Handlers ---
  openSimplifyModal() {
    if (this.points.length < 3) {
      showToast('Need at least 3 points to simplify', 'warning', 2000);
      return;
    }
    const origCount = this.points.length;
    document.getElementById('simplify-orig-pts').textContent = origCount;
    this.handleSimplifySlider({ target: document.getElementById('simplify-tolerance') });
    this.simplifyDialog.showModal();
  }

  handleSimplifySlider(e) {
    const tolerance = parseFloat(e.target.value);
    document.getElementById('simplify-tolerance-val').textContent = `${tolerance} m`;

    const simplified = douglasPeucker(this.points, tolerance);
    const newCount = simplified.length;
    const reduction = Math.round(((this.points.length - newCount) / this.points.length) * 100);

    document.getElementById('simplify-new-pts').textContent = newCount;
    document.getElementById('simplify-reduction-pct').textContent = `-${reduction}%`;
  }

  applySimplify() {
    const tolerance = parseFloat(document.getElementById('simplify-tolerance').value);
    this.pushHistoryState();
    const simplified = douglasPeucker(this.points, tolerance);
    this.updatePoints(simplified, false);
    this.simplifyDialog.close();
    showToast(`Track simplified from ${this.points.length} points!`, 'success', 2500);
  }

  // --- Snap to Streets (Fill Gaps) Modal Handlers ---
  openSnapModal() {
    if (this.points.length < 2) {
      showToast('Need at least 2 points to snap to streets', 'warning', 2000);
      return;
    }
    const progressBox = document.getElementById('snap-progress-box');
    const confirmBtn = document.getElementById('btn-confirm-snap');
    progressBox.style.display = 'none';
    confirmBtn.disabled = false;
    this.snapDialog.showModal();
  }

  async applySnapToStreets() {
    if (this.points.length < 2) return;

    const profile = document.querySelector('input[name="snap-profile"]:checked')?.value || 'bike';
    const filterOutliers = document.getElementById('snap-filter-outliers').checked;
    const detourGuard = document.getElementById('snap-detour-guard').checked;
    const showOverlay = document.getElementById('snap-show-overlay').checked;

    const progressBox = document.getElementById('snap-progress-box');
    const progressText = document.getElementById('snap-progress-text');
    const progressPct = document.getElementById('snap-progress-pct');
    const progressFill = document.getElementById('snap-progress-bar-fill');
    const confirmBtn = document.getElementById('btn-confirm-snap');

    progressBox.style.display = 'flex';
    confirmBtn.disabled = true;

    try {
      const originalSnapshot = JSON.parse(JSON.stringify(this.points));
      const { points: snappedPoints, stats } = await snapTrackToStreets(this.points, {
        profile,
        filterOutliers,
        detourGuard,
        onProgress: (done, total) => {
          const pct = Math.round((done / Math.max(1, total)) * 100);
          progressText.textContent =
            done < total
              ? `Routing street segment batch ${done + 1} of ${total}...`
              : 'Finalizing timestamps & geometry...';
          progressPct.textContent = `${pct}%`;
          progressFill.style.width = `${pct}%`;
        }
      });

      this.pushHistoryState();
      this.mapManager.setComparisonPoints(showOverlay ? originalSnapshot : null);
      this.updatePoints(snappedPoints, false);
      this.snapDialog.close();

      showToast(
        `Snapped to streets: ${stats.originalPoints} ➔ ${stats.snappedPoints} pts` +
          (stats.outliersRemoved > 0 ? ` (${stats.outliersRemoved} jumps removed)` : ''),
        'success',
        4000
      );
    } catch (err) {
      console.error(err);
      showToast('Street routing failed: ' + err.message, 'error', 4000);
    } finally {
      confirmBtn.disabled = false;
    }
  }

  // --- Waypoint Modal Handlers ---
  openWaypointDialog(lat, lon) {
    this.pendingWaypointCoords = { lat, lon };
    document.getElementById('wpt-name-input').value = '';
    document.getElementById('wpt-desc-input').value = '';
    document.getElementById('wpt-coords-display').textContent = `Lat: ${lat.toFixed(5)}, Lon: ${lon.toFixed(5)}`;
    this.waypointDialog.showModal();
  }

  confirmWaypoint() {
    if (!this.pendingWaypointCoords) return;
    const name = document.getElementById('wpt-name-input').value.trim() || 'POI';
    const sym = document.getElementById('wpt-sym-select').value;
    const desc = document.getElementById('wpt-desc-input').value.trim();

    this.pushHistoryState();
    const wpt = {
      id: `wpt_${Date.now()}`,
      lat: Number(this.pendingWaypointCoords.lat.toFixed(7)),
      lon: Number(this.pendingWaypointCoords.lon.toFixed(7)),
      ele: null,
      name,
      desc,
      sym
    };

    this.mapManager.addWaypoint(wpt);
    this.waypointDialog.close();
    this.setMode('select');
    showToast(`Waypoint "${name}" placed`, 'success', 2000);
  }

  // --- Export Modal Handlers ---
  openExportModal() {
    if (this.points.length === 0) {
      showToast('No track points to export', 'warning', 2000);
      return;
    }
    const cleanFilename = this.trackName.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    document.getElementById('export-filename').value = cleanFilename;
    this.exportDialog.showModal();
  }

  executeExport() {
    const format = document.querySelector('input[name="export-format"]:checked').value;
    const filename = document.getElementById('export-filename').value.trim() || 'route';
    const speed = parseFloat(document.getElementById('export-speed-select').value);
    const includeWpt = document.getElementById('export-include-wpt').checked;

    const exportWaypoints = includeWpt ? this.waypoints : [];

    let fileContent = '';
    let mimeType = 'text/plain';
    let fileExtension = 'gpx';

    if (format === 'gpx') {
      fileContent = buildGPX({
        name: this.trackName,
        description: this.description,
        points: this.points,
        waypoints: exportWaypoints,
        recalculateSpeed: speed
      });
      mimeType = 'application/gpx+xml';
      fileExtension = 'gpx';
    } else if (format === 'geojson') {
      fileContent = buildGeoJSON({
        name: this.trackName,
        description: this.description,
        points: this.points,
        waypoints: exportWaypoints
      });
      mimeType = 'application/geo+json';
      fileExtension = 'geojson';
    } else if (format === 'kml') {
      fileContent = buildKML({
        name: this.trackName,
        description: this.description,
        points: this.points,
        waypoints: exportWaypoints
      });
      mimeType = 'application/vnd.google-earth.kml+xml';
      fileExtension = 'kml';
    }

    // Trigger download
    const blob = new Blob([fileContent], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.${fileExtension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.exportDialog.close();

    // Trigger celebratory confetti
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 }
    });

    showToast(`Exported "${filename}.${fileExtension}" successfully!`, 'success', 3500);
  }

  // --- Trip Simulation Methods ---
  openSimulation() {
    if (this.points.length < 2) {
      showToast('Need at least 2 track points to simulate trip', 'warning', 2500);
      return;
    }

    // Ensure elevation dock is open for synchronized profile display
    if (this.elevationDock.classList.contains('collapsed')) {
      this.elevationDock.classList.remove('collapsed');
      this.elevationToggleIcon.innerHTML = '<polyline points="6 9 12 15 18 9"/>';
      setTimeout(() => {
        this.mapManager.map.invalidateSize();
        this.elevationProfile.resize();
        this.elevationProfile.render();
      }, 280);
    }

    this.isSimulating = true;
    this.simulationBar.style.display = 'flex';
    this.seekSimulation(0);
    this.playSimulation();
    showToast('Trip simulation started. Press Space to play/pause.', 'info', 2500);
  }

  closeSimulation() {
    this.pauseSimulation();
    this.isSimulating = false;
    this.simulationBar.style.display = 'none';
    this.mapManager.stopSimulation();
    this.elevationProfile.clearSimulation();
  }

  toggleSimPlayPause() {
    if (this.simPlaying) {
      this.pauseSimulation();
    } else {
      this.playSimulation();
    }
  }

  playSimulation() {
    const totalDist = this.metrics?.totalDistance || 0;
    if (this.simCurrentDist >= totalDist - 1) {
      this.simCurrentDist = 0;
    }
    this.simPlaying = true;
    this.simIconPlay.style.display = 'none';
    this.simIconPause.style.display = 'block';
    this.simStatusBadge.textContent = 'RUNNING';
    this.simStatusBadge.className = 'sim-badge';
    this.simLastTimestamp = performance.now();
    this.simAnimFrameId = requestAnimationFrame((t) => this.simLoop(t));
  }

  pauseSimulation() {
    this.simPlaying = false;
    if (this.simAnimFrameId) {
      cancelAnimationFrame(this.simAnimFrameId);
      this.simAnimFrameId = null;
    }
    this.simIconPlay.style.display = 'block';
    this.simIconPause.style.display = 'none';
    this.simStatusBadge.textContent = 'PAUSED';
    this.simStatusBadge.className = 'sim-badge paused';
  }

  simLoop(timestamp) {
    if (!this.simPlaying) return;

    const deltaSec = Math.min(0.2, (timestamp - this.simLastTimestamp) / 1000);
    this.simLastTimestamp = timestamp;

    const totalDist = this.metrics?.totalDistance || 1;
    const currentPos = interpolateTrackAtDistance(this.points, this.simCurrentDist);
    const speedKmh = currentPos?.speedKmh && currentPos.speedKmh > 0 ? currentPos.speedKmh : 15;
    const speedMps = (speedKmh * 1000) / 3600;

    const moveMeters = speedMps * this.simSpeedMultiplier * deltaSec;
    this.simCurrentDist += moveMeters;

    if (this.simCurrentDist >= totalDist) {
      this.simCurrentDist = totalDist;
      this.renderSimulationStep(this.simCurrentDist);
      this.pauseSimulation();
      this.simStatusBadge.textContent = 'FINISHED';
      this.simStatusBadge.className = 'sim-badge finished';
      showToast('Trip simulation completed!', 'success', 2500);
      return;
    }

    this.renderSimulationStep(this.simCurrentDist);
    this.simAnimFrameId = requestAnimationFrame((t) => this.simLoop(t));
  }

  seekSimulation(targetDist) {
    const totalDist = this.metrics?.totalDistance || 0;
    this.simCurrentDist = Math.max(0, Math.min(totalDist, targetDist));
    this.renderSimulationStep(this.simCurrentDist);
  }

  renderSimulationStep(targetDist) {
    const pos = interpolateTrackAtDistance(this.points, targetDist);
    if (!pos) return;

    const totalDist = this.metrics?.totalDistance || 1;

    // 1. Scrubber slider & badge
    const pct = Math.min(100, Math.max(0, (targetDist / totalDist) * 100));
    this.simProgressSlider.value = Math.round((targetDist / totalDist) * 1000);
    this.simProgressPct.textContent = `${pct.toFixed(1)}%`;

    // 2. Cockpit telemetry readouts
    const speedUnit = this.unit === 'imperial' ? 'mph' : 'km/h';
    const dispSpeed = this.unit === 'imperial' ? (pos.speedKmh * 0.621371).toFixed(1) : pos.speedKmh.toFixed(1);
    this.simTelSpeed.textContent = `${dispSpeed} ${speedUnit}`;

    // Time readout
    if (pos.time && this.points[0]?.time) {
      const startMs = new Date(this.points[0].time).getTime();
      const curMs = new Date(pos.time).getTime();
      const elapsedSec = Math.max(0, Math.round((curMs - startMs) / 1000));
      this.simTelTime.textContent = formatDuration(elapsedSec);
    } else {
      const estTotalSec = this.metrics?.durationSeconds || 3600;
      const elapsedSec = Math.round((targetDist / totalDist) * estTotalSec);
      this.simTelTime.textContent = formatDuration(elapsedSec);
    }

    this.simTelDist.textContent = `${formatDistance(targetDist, this.unit)} / ${formatDistance(totalDist, this.unit)}`;
    this.simTelEle.textContent = formatElevation(pos.ele, this.unit);

    const gradePrefix = pos.grade > 0 ? '+' : '';
    this.simTelGrade.textContent = `${gradePrefix}${pos.grade.toFixed(1)}%`;
    if (pos.grade > 8) {
      this.simTelGrade.style.color = '#ff6b35';
    } else if (pos.grade < -5) {
      this.simTelGrade.style.color = '#34d399';
    } else {
      this.simTelGrade.style.color = '#ffffff';
    }

    // 3. Update map traveler marker & traveled polyline
    this.mapManager.updateSimulation(pos, this.simFollowCamera);

    // 4. Update elevation profile cursor and traveled area
    this.elevationProfile.setSimulationDist(targetDist);
  }
}

// Start application once DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  new App();
});
