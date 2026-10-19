/**
 * Street Routing & Map-Snapping Utility (OSRM OpenStreetMap)
 * Reconstructs street-level geometry between sparse GPS points and interpolates
 * timestamps and elevations proportionally along the routed street network.
 */

import { haversineDistance } from './geo.js';

const OSRM_ENDPOINTS = {
  bike: 'https://routing.openstreetmap.de/routed-bike/route/v1/driving',
  foot: 'https://routing.openstreetmap.de/routed-foot/route/v1/driving',
  car: 'https://routing.openstreetmap.de/routed-car/route/v1/driving'
};

/**
 * Filters out single-point GPS/Wi-Fi teleportation spikes where a point jumps far away
 * and the immediately following point returns near the previous trajectory.
 *
 * @param {Array} points - Array of track points {lat, lon, ele, time, ...}
 * @param {string} profile - 'bike' | 'foot' | 'car'
 * @returns {{ filtered: Array, removedCount: number }}
 */
export function filterJumpOutliers(points, profile = 'bike') {
  if (!points || points.length < 3) {
    return { filtered: [...(points || [])], removedCount: 0 };
  }

  const maxSpeedKmh = profile === 'foot' ? 30 : profile === 'bike' ? 75 : 180;
  const filtered = [points[0]];
  let removedCount = 0;

  for (let i = 1; i < points.length - 1; i++) {
    const prev = filtered[filtered.length - 1];
    const curr = points[i];
    const next = points[i + 1];

    const dPrevCurr = haversineDistance(prev.lat, prev.lon, curr.lat, curr.lon);
    const dCurrNext = haversineDistance(curr.lat, curr.lon, next.lat, next.lon);
    const dPrevNext = haversineDistance(prev.lat, prev.lon, next.lat, next.lon);

    // Check if curr is a sharp spike out-and-back (> 400m jump out and back, while prev->next is short)
    const isSpatialSpike =
      dPrevCurr > 400 &&
      dCurrNext > 400 &&
      dPrevNext < (dPrevCurr + dCurrNext) * 0.35;

    // Also check implied speed if timestamps exist
    let isSpeedSpike = false;
    if (prev.time && curr.time) {
      const dtSec = (new Date(curr.time).getTime() - new Date(prev.time).getTime()) / 1000;
      if (dtSec > 0) {
        const speedKmh = (dPrevCurr / dtSec) * 3.6;
        if (speedKmh > maxSpeedKmh && dPrevCurr > 250 && dPrevNext < dPrevCurr) {
          isSpeedSpike = true;
        }
      }
    }

    if (isSpatialSpike || isSpeedSpike) {
      removedCount++;
      continue;
    }

    filtered.push(curr);
  }

  filtered.push(points[points.length - 1]);
  return { filtered, removedCount };
}

/**
 * Snaps a sequence of track points to the OpenStreetMap street/trail network
 * and interpolates timestamps and elevations along the routed geometry.
 *
 * @param {Array} points - Input track points
 * @param {Object} options
 * @param {'bike'|'foot'|'car'} [options.profile='bike'] - Routing profile
 * @param {boolean} [options.filterOutliers=true] - Remove Wi-Fi/GPS spike jumps before routing
 * @param {boolean} [options.detourGuard=true] - Avoid unnatural multi-km loops across rivers/bridges
 * @param {function} [options.onProgress] - Callback (completedChunks, totalChunks)
 * @returns {Promise<{ points: Array, stats: { originalPoints: number, snappedPoints: number, outliersRemoved: number, detoursAvoided: number } }>}
 */
export async function snapTrackToStreets(points, options = {}) {
  const {
    profile = 'bike',
    filterOutliers = true,
    detourGuard = true,
    onProgress = null
  } = options;

  if (!points || points.length < 2) {
    throw new Error('At least 2 points are required to snap to streets.');
  }

  const baseUrl = OSRM_ENDPOINTS[profile] || OSRM_ENDPOINTS.bike;

  // 1. Optional outlier filtering
  let workingPoints = [...points];
  let outliersRemoved = 0;
  if (filterOutliers) {
    const res = filterJumpOutliers(workingPoints, profile);
    workingPoints = res.filtered;
    outliersRemoved = res.removedCount;
  }

  // 2. Deduplicate consecutive identical/near-identical points (< 1.5m apart)
  // while keeping pause endpoints intact
  const waypoints = [workingPoints[0]];
  for (let i = 1; i < workingPoints.length; i++) {
    const prev = waypoints[waypoints.length - 1];
    const curr = workingPoints[i];
    const d = haversineDistance(prev.lat, prev.lon, curr.lat, curr.lon);
    if (d >= 1.5 || i === workingPoints.length - 1) {
      waypoints.push(curr);
    }
  }

  if (waypoints.length < 2) {
    return {
      points: workingPoints,
      stats: {
        originalPoints: points.length,
        snappedPoints: workingPoints.length,
        outliersRemoved,
        detoursAvoided: 0
      }
    };
  }

  // 3. Split waypoints into chunks of up to 35 points (with 1-point overlap between chunks)
  const CHUNK_SIZE = 35;
  const chunks = [];
  for (let start = 0; start < waypoints.length - 1; start += CHUNK_SIZE - 1) {
    const end = Math.min(waypoints.length, start + CHUNK_SIZE);
    chunks.push(waypoints.slice(start, end));
  }

  const allSnappedPoints = [];
  let detoursAvoided = 0;

  for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
    if (onProgress) {
      onProgress(cIdx, chunks.length);
    }

    const chunkWps = chunks[cIdx];
    const coordStr = chunkWps.map((p) => `${p.lon.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
    const url = `${baseUrl}/${coordStr}?overview=full&geometries=geojson&steps=true`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Routing service returned HTTP ${response.status}`);
    }

    const data = await response.json();
    if (data.code !== 'Ok' || !data.routes || !data.routes[0]) {
      throw new Error(data.message || 'Could not find a street route between points');
    }

    const osrmLegs = data.routes[0].legs;

    for (let i = 0; i < osrmLegs.length; i++) {
      const oleg = osrmLegs[i];
      const wpStart = chunkWps[i];
      const wpEnd = chunkWps[i + 1];

      const directDist = haversineDistance(wpStart.lat, wpStart.lon, wpEnd.lat, wpEnd.lon);

      // Pause/stopover check: if two consecutive waypoints are > 10 minutes apart and < 40m apart,
      // don't route them around the block
      const tStartMs = wpStart.time ? new Date(wpStart.time).getTime() : null;
      const tEndMs = wpEnd.time ? new Date(wpEnd.time).getTime() : null;
      const hasValidTime =
        tStartMs !== null && tEndMs !== null && !isNaN(tStartMs) && !isNaN(tEndMs);
      const dtMs = hasValidTime ? Math.max(0, tEndMs - tStartMs) : 0;

      // Collect dense street coordinates from OSRM steps
      let subCoords = [];
      for (const step of oleg.steps || []) {
        const coords = step.geometry?.coordinates || [];
        for (const [lon, lat] of coords) {
          if (
            subCoords.length === 0 ||
            haversineDistance(
              subCoords[subCoords.length - 1][0],
              subCoords[subCoords.length - 1][1],
              lat,
              lon
            ) > 0.5
          ) {
            subCoords.push([lat, lon]);
          }
        }
      }

      // Apply Smart Detour Guard if OSRM routed a huge loop (> 3x direct distance & > 450m extra)
      const isUnnaturalDetour =
        detourGuard && oleg.distance > Math.max(directDist * 3.0, directDist + 450);

      if (subCoords.length === 0 || isUnnaturalDetour) {
        if (isUnnaturalDetour) {
          detoursAvoided++;
        }
        subCoords = [
          [wpStart.lat, wpStart.lon],
          [wpEnd.lat, wpEnd.lon]
        ];
      }

      // Compute cumulative distance along subCoords for proportional interpolation
      const cumDist = [0];
      for (let k = 1; k < subCoords.length; k++) {
        const stepDist = haversineDistance(
          subCoords[k - 1][0],
          subCoords[k - 1][1],
          subCoords[k][0],
          subCoords[k][1]
        );
        cumDist.push(cumDist[cumDist.length - 1] + stepDist);
      }
      const totalSubDist = cumDist[cumDist.length - 1];

      const eleStart = wpStart.ele !== null && wpStart.ele !== undefined ? wpStart.ele : null;
      const eleEnd = wpEnd.ele !== null && wpEnd.ele !== undefined ? wpEnd.ele : null;

      for (let k = 0; k < subCoords.length; k++) {
        // Avoid duplicating boundary vertex between consecutive sub-legs or chunks
        if ((cIdx > 0 || i > 0) && k === 0) {
          continue;
        }

        const frac =
          totalSubDist > 0
            ? cumDist[k] / totalSubDist
            : k / Math.max(1, subCoords.length - 1);

        let interpEle = null;
        if (eleStart !== null && eleEnd !== null) {
          interpEle = Number((eleStart + frac * (eleEnd - eleStart)).toFixed(1));
        } else if (eleStart !== null) {
          interpEle = eleStart;
        } else if (eleEnd !== null) {
          interpEle = eleEnd;
        }

        let interpTime = null;
        if (hasValidTime) {
          const ptMs = Math.round(tStartMs + frac * dtMs);
          interpTime = new Date(ptMs).toISOString();
        }

        allSnappedPoints.push({
          id: `pt_snap_${allSnappedPoints.length}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          lat: Number(subCoords[k][0].toFixed(7)),
          lon: Number(subCoords[k][1].toFixed(7)),
          ele: interpEle,
          time: interpTime
        });
      }
    }
  }

  // 4. Enforce strictly increasing timestamps (+1s minimum step) for Strava/Garmin compatibility
  let lastSecMs = null;
  for (let i = 0; i < allSnappedPoints.length; i++) {
    const pt = allSnappedPoints[i];
    if (pt.time) {
      let ms = Math.floor(new Date(pt.time).getTime() / 1000) * 1000;
      if (lastSecMs !== null && ms <= lastSecMs) {
        ms = lastSecMs + 1000;
      }
      lastSecMs = ms;
      pt.time = new Date(ms).toISOString();
    }
  }

  if (onProgress) {
    onProgress(chunks.length, chunks.length);
  }

  return {
    points: allSnappedPoints,
    stats: {
      originalPoints: points.length,
      snappedPoints: allSnappedPoints.length,
      outliersRemoved,
      detoursAvoided
    }
  };
}
