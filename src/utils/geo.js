/**
 * Geodetic and track manipulation math utilities
 */

const EARTH_RADIUS = 6371000; // in meters

export function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

export function toDegrees(radians) {
  return (radians * 180) / Math.PI;
}

/**
 * Calculates initial bearing (azimuth) in degrees from point 1 to point 2
 */
export function calculateBearing(lat1, lon1, lat2, lon2) {
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaLambda = toRadians(lon2 - lon1);

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

  const theta = Math.atan2(y, x);
  return (toDegrees(theta) + 360) % 360;
}

/**
 * Calculates geodesic distance between two points in meters using Haversine formula
 */
export function haversineDistance(lat1, lon1, lat2, lon2) {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS * c;
}

/**
 * Calculates perpendicular distance from a point P to a line segment AB in meters
 */
export function perpendicularDistance(point, lineStart, lineEnd) {
  // Approximate projection in Cartesian coordinates around lineStart
  const cosLat = Math.cos(toRadians((lineStart.lat + lineEnd.lat) / 2));
  const x1 = 0;
  const y1 = 0;
  const x2 = (lineEnd.lon - lineStart.lon) * cosLat;
  const y2 = lineEnd.lat - lineStart.lat;
  const xp = (point.lon - lineStart.lon) * cosLat;
  const yp = point.lat - lineStart.lat;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    return haversineDistance(point.lat, point.lon, lineStart.lat, lineStart.lon);
  }

  // Projection ratio t clamped to [0, 1]
  const t = Math.max(0, Math.min(1, (xp * dx + yp * dy) / lenSq));
  const projLon = lineStart.lon + (t * (lineEnd.lon - lineStart.lon));
  const projLat = lineStart.lat + (t * (lineEnd.lat - lineStart.lat));

  return haversineDistance(point.lat, point.lon, projLat, projLon);
}

/**
 * Douglas-Peucker line simplification algorithm
 * @param {Array} points - Array of points {lat, lon, ele, ...}
 * @param {number} tolerance - Tolerance in meters
 */
export function douglasPeucker(points, tolerance) {
  if (points.length <= 2) return [...points];

  let maxDist = 0;
  let index = 0;
  const end = points.length - 1;

  for (let i = 1; i < end; i++) {
    const dist = perpendicularDistance(points[i], points[0], points[end]);
    if (dist > maxDist) {
      maxDist = dist;
      index = i;
    }
  }

  if (maxDist > tolerance) {
    const left = douglasPeucker(points.slice(0, index + 1), tolerance);
    const right = douglasPeucker(points.slice(index), tolerance);
    return left.slice(0, left.length - 1).concat(right);
  } else {
    return [points[0], points[end]];
  }
}

/**
 * Calculates cumulative distance, elevation gain/loss, min/max alt for track points
 */
export function calculateTrackMetrics(points) {
  if (!points || points.length === 0) {
    return {
      totalDistance: 0,
      elevationGain: 0,
      elevationLoss: 0,
      minEle: 0,
      maxEle: 0,
      durationSeconds: 0,
      pointCount: 0,
      pointsWithDist: []
    };
  }

  let totalDist = 0;
  let gain = 0;
  let loss = 0;
  let minEle = points[0].ele ?? 0;
  let maxEle = points[0].ele ?? 0;

  const pointsWithDist = [{
    ...points[0],
    cumDist: 0,
    distDelta: 0
  }];

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const dist = haversineDistance(prev.lat, prev.lon, curr.lat, curr.lon);
    totalDist += dist;

    const prevEle = prev.ele ?? 0;
    const currEle = curr.ele ?? 0;
    const eleDiff = currEle - prevEle;

    // Threshold noise for GPS elevation bounce
    if (Math.abs(eleDiff) >= 0.5) {
      if (eleDiff > 0) gain += eleDiff;
      else loss += Math.abs(eleDiff);
    }

    if (curr.ele !== undefined && curr.ele !== null) {
      if (curr.ele < minEle) minEle = curr.ele;
      if (curr.ele > maxEle) maxEle = curr.ele;
    }

    pointsWithDist.push({
      ...curr,
      cumDist: totalDist,
      distDelta: dist
    });
  }

  // Calculate duration if timestamps are present
  let durationSeconds = 0;
  const firstTime = points[0].time ? new Date(points[0].time).getTime() : null;
  const lastTime = points[points.length - 1].time ? new Date(points[points.length - 1].time).getTime() : null;
  if (firstTime && lastTime && !isNaN(firstTime) && !isNaN(lastTime)) {
    durationSeconds = Math.max(0, Math.round((lastTime - firstTime) / 1000));
  } else {
    // Default estimate based on average hiking pace (4.2 km/h + 1h per 400m elevation gain - Tobler's hiking function approx)
    const hikeHours = (totalDist / 4200) + (gain / 400);
    durationSeconds = Math.round(hikeHours * 3600);
  }

  return {
    totalDistance: totalDist,
    elevationGain: Math.round(gain),
    elevationLoss: Math.round(loss),
    minEle: Math.round(minEle),
    maxEle: Math.round(maxEle),
    durationSeconds,
    pointCount: points.length,
    pointsWithDist
  };
}

/**
 * Moving average smoothing filter for elevation to clean up barometric / GPS jitter
 */
export function smoothElevations(points, windowSize = 5) {
  if (!points || points.length < windowSize) return points;
  const halfWindow = Math.floor(windowSize / 2);
  return points.map((pt, i) => {
    if (pt.ele === undefined || pt.ele === null) return { ...pt };
    let sum = 0;
    let count = 0;
    for (let w = -halfWindow; w <= halfWindow; w++) {
      const idx = i + w;
      if (idx >= 0 && idx < points.length && points[idx].ele !== undefined && points[idx].ele !== null) {
        sum += points[idx].ele;
        count++;
      }
    }
    return {
      ...pt,
      ele: count > 0 ? Number((sum / count).toFixed(1)) : pt.ele
    };
  });
}

/**
 * Reverses track points and inverts timestamps realistically
 */
export function reverseTrack(points) {
  if (!points || points.length <= 1) return [...points];
  const reversed = [...points].reverse();
  
  // If original had timestamps, adjust timestamps so start point starts at original first time
  const hasTime = points.every(p => p.time);
  if (hasTime) {
    const startTime = new Date(points[0].time).getTime();
    const intervals = [];
    for (let i = 1; i < points.length; i++) {
      const t1 = new Date(points[i - 1].time).getTime();
      const t2 = new Date(points[i].time).getTime();
      intervals.push(Math.max(1000, t2 - t1));
    }
    intervals.reverse();

    let curTime = startTime;
    reversed[0] = { ...reversed[0], time: new Date(curTime).toISOString() };
    for (let i = 1; i < reversed.length; i++) {
      curTime += intervals[i - 1] || 2000;
      reversed[i] = { ...reversed[i], time: new Date(curTime).toISOString() };
    }
  }

  return reversed;
}

/**
 * Formats distance based on unit ('metric' or 'imperial')
 */
export function formatDistance(meters, unit = 'metric') {
  if (unit === 'imperial') {
    const miles = meters / 1609.344;
    return `${miles.toFixed(2)} mi`;
  }
  const km = meters / 1000;
  if (km < 1) {
    return `${Math.round(meters)} m`;
  }
  return `${km.toFixed(2)} km`;
}

/**
 * Formats elevation
 */
export function formatElevation(meters, unit = 'metric') {
  if (unit === 'imperial') {
    const feet = meters * 3.28084;
    return `${Math.round(feet)} ft`;
  }
  return `${Math.round(meters)} m`;
}

/**
 * Formats seconds into human duration (e.g. "2h 45m" or "34m")
 */
export function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '0m';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }
  return `${mins}m`;
}

/**
 * Interpolates track position, bearing, grade, elevation, elapsed time, and speed
 * at a given target cumulative distance (in meters).
 * Returns { lat, lon, ele, time, speedKmh, bearing, grade, progress, traveledCoords }
 */
export function interpolateTrackAtDistance(points, targetDist) {
  if (!points || points.length === 0) {
    return null;
  }

  const totalDist = points[points.length - 1].cumDist ?? 0;
  const clampedDist = Math.max(0, Math.min(totalDist, targetDist));
  const progress = totalDist > 0 ? clampedDist / totalDist : 0;

  if (points.length === 1 || clampedDist <= 0) {
    const p0 = points[0];
    const p1 = points[1] || p0;
    const bearing = points.length > 1 ? calculateBearing(p0.lat, p0.lon, p1.lat, p1.lon) : 0;
    return {
      lat: p0.lat,
      lon: p0.lon,
      ele: p0.ele ?? 0,
      time: p0.time || null,
      speedKmh: 0,
      bearing,
      grade: 0,
      cumDist: 0,
      progress: 0,
      index: 0,
      traveledCoords: [[p0.lat, p0.lon]]
    };
  }

  if (clampedDist >= totalDist) {
    const pLast = points[points.length - 1];
    const pPrev = points[points.length - 2] || pLast;
    const bearing = calculateBearing(pPrev.lat, pPrev.lon, pLast.lat, pLast.lon);
    return {
      lat: pLast.lat,
      lon: pLast.lon,
      ele: pLast.ele ?? 0,
      time: pLast.time || null,
      speedKmh: 0,
      bearing,
      grade: 0,
      cumDist: totalDist,
      progress: 1,
      index: points.length - 1,
      traveledCoords: points.map((p) => [p.lat, p.lon])
    };
  }

  // Find segment [i - 1, i] containing clampedDist
  let i = 1;
  while (i < points.length && (points[i].cumDist ?? 0) < clampedDist) {
    i++;
  }

  const p1 = points[i - 1];
  const p2 = points[i];
  const segDist = (p2.cumDist ?? 0) - (p1.cumDist ?? 0);
  const ratio = segDist > 0 ? (clampedDist - (p1.cumDist ?? 0)) / segDist : 0;

  const lat = p1.lat + ratio * (p2.lat - p1.lat);
  const lon = p1.lon + ratio * (p2.lon - p1.lon);

  // Elevation interpolation
  let ele = p1.ele ?? 0;
  if (p1.ele !== null && p2.ele !== null && p1.ele !== undefined && p2.ele !== undefined) {
    ele = Number((p1.ele + ratio * (p2.ele - p1.ele)).toFixed(1));
  }

  // Bearing
  const bearing = calculateBearing(p1.lat, p1.lon, p2.lat, p2.lon);

  // Grade (% slope)
  let grade = 0;
  if (segDist > 1 && p1.ele !== null && p2.ele !== null) {
    grade = Number((((p2.ele - p1.ele) / segDist) * 100).toFixed(1));
  }

  // Time & Speed calculation
  let time = null;
  let speedKmh = 0;
  const t1 = p1.time ? new Date(p1.time).getTime() : null;
  const t2 = p2.time ? new Date(p2.time).getTime() : null;

  if (t1 !== null && t2 !== null && !isNaN(t1) && !isNaN(t2)) {
    const curTimeMs = Math.round(t1 + ratio * (t2 - t1));
    time = new Date(curTimeMs).toISOString();
    const dtSec = (t2 - t1) / 1000;
    if (dtSec > 0.5) {
      speedKmh = Number(((segDist / dtSec) * 3.6).toFixed(1));
    }
  } else {
    // Default estimated pace based on grade
    const baseSpeed = grade > 8 ? 3.5 : grade > 3 ? 4.2 : grade < -5 ? 4.8 : 5.0;
    speedKmh = baseSpeed;
  }

  // Build traveled coordinates array up to this interpolated position
  const traveledCoords = [];
  for (let k = 0; k < i; k++) {
    traveledCoords.push([points[k].lat, points[k].lon]);
  }
  traveledCoords.push([lat, lon]);

  return {
    lat: Number(lat.toFixed(7)),
    lon: Number(lon.toFixed(7)),
    ele,
    time,
    speedKmh,
    bearing: Math.round(bearing),
    grade,
    cumDist: clampedDist,
    progress,
    index: i - 1,
    traveledCoords
  };
}

