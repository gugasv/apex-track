/**
 * GPX, GeoJSON, and KML Parser and Serializer
 */

/**
 * Parses GPX XML text into structured data
 * @param {string} gpxText 
 * @returns {{ name: string, description: string, points: Array, waypoints: Array }}
 */
export function parseGPX(gpxText) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(gpxText, 'application/xml');

  // Check for parser errors
  const parseError = xml.querySelector('parsererror');
  if (parseError) {
    throw new Error('Invalid XML format: ' + parseError.textContent.slice(0, 100));
  }

  // Extract metadata / track name
  let trackName = 'Edited Route';
  const nameEl = xml.querySelector('trk > name') || xml.querySelector('metadata > name') || xml.querySelector('name');
  if (nameEl && nameEl.textContent.trim()) {
    trackName = nameEl.textContent.trim();
  }

  let description = '';
  const descEl = xml.querySelector('trk > desc') || xml.querySelector('metadata > desc') || xml.querySelector('desc');
  if (descEl && descEl.textContent.trim()) {
    description = descEl.textContent.trim();
  }

  // Extract track points
  const points = [];
  const trkpts = xml.querySelectorAll('trkpt');

  if (trkpts.length > 0) {
    trkpts.forEach((pt, index) => {
      const lat = parseFloat(pt.getAttribute('lat'));
      const lon = parseFloat(pt.getAttribute('lon'));
      if (isNaN(lat) || isNaN(lon)) return;

      const eleNode = pt.querySelector('ele');
      const timeNode = pt.querySelector('time');

      const ele = eleNode ? parseFloat(eleNode.textContent) : null;
      const time = timeNode ? timeNode.textContent.trim() : null;

      points.push({
        id: `pt_${index}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        lat,
        lon,
        ele: isNaN(ele) ? null : ele,
        time: time || null
      });
    });
  } else {
    // Fallback: check for route points <rtept>
    const rtepts = xml.querySelectorAll('rtept');
    rtepts.forEach((pt, index) => {
      const lat = parseFloat(pt.getAttribute('lat'));
      const lon = parseFloat(pt.getAttribute('lon'));
      if (isNaN(lat) || isNaN(lon)) return;

      const eleNode = pt.querySelector('ele');
      const timeNode = pt.querySelector('time');

      points.push({
        id: `pt_${index}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        lat,
        lon,
        ele: eleNode ? parseFloat(eleNode.textContent) : null,
        time: timeNode ? timeNode.textContent.trim() : null
      });
    });
  }

  // Extract waypoints <wpt>
  const waypoints = [];
  const wpts = xml.querySelectorAll('wpt');
  wpts.forEach((wpt, index) => {
    const lat = parseFloat(wpt.getAttribute('lat'));
    const lon = parseFloat(wpt.getAttribute('lon'));
    if (isNaN(lat) || isNaN(lon)) return;

    const nameNode = wpt.querySelector('name');
    const descNode = wpt.querySelector('desc');
    const symNode = wpt.querySelector('sym');
    const eleNode = wpt.querySelector('ele');

    waypoints.push({
      id: `wpt_${index}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      lat,
      lon,
      ele: eleNode ? parseFloat(eleNode.textContent) : null,
      name: nameNode ? nameNode.textContent.trim() : `Point ${index + 1}`,
      desc: descNode ? descNode.textContent.trim() : '',
      sym: symNode ? symNode.textContent.trim() : 'Flag'
    });
  });

  return {
    name: trackName,
    description,
    points,
    waypoints
  };
}

/**
 * Builds standard GPX 1.1 XML string
 */
export function buildGPX({ name, description, points, waypoints, recalculateSpeed = 0 }) {
  const safeName = escapeXml(name || 'Track');
  const safeDesc = escapeXml(description || 'Exported with ApexTrack GPX Editor');
  const nowIso = new Date().toISOString();

  // If recalculateSpeed is given (in km/h), compute timestamps based on distance
  let exportPoints = points;
  if (recalculateSpeed > 0) {
    const speedMps = (recalculateSpeed * 1000) / 3600;
    let baseTime = Date.now();
    let cumDist = 0;
    exportPoints = points.map((p, i) => {
      if (i > 0) {
        cumDist += (p.distDelta || 0);
      }
      const ptTime = new Date(baseTime + Math.round((cumDist / speedMps) * 1000)).toISOString();
      return { ...p, time: ptTime };
    });
  }

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="ApexTrack GPX Studio - https://github.com"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${safeName}</name>
    <desc>${safeDesc}</desc>
    <time>${nowIso}</time>
  </metadata>
`;

  // Waypoints
  if (waypoints && waypoints.length > 0) {
    waypoints.forEach(wpt => {
      xml += `  <wpt lat="${wpt.lat.toFixed(7)}" lon="${wpt.lon.toFixed(7)}">
    ${wpt.ele !== null && wpt.ele !== undefined ? `<ele>${Number(wpt.ele).toFixed(1)}</ele>` : ''}
    <name>${escapeXml(wpt.name || 'Waypoint')}</name>
    ${wpt.desc ? `<desc>${escapeXml(wpt.desc)}</desc>` : ''}
    ${wpt.sym ? `<sym>${escapeXml(wpt.sym)}</sym>` : ''}
  </wpt>
`;
    });
  }

  // Track & Segments
  xml += `  <trk>
    <name>${safeName}</name>
    <trkseg>
`;

  exportPoints.forEach(pt => {
    xml += `      <trkpt lat="${pt.lat.toFixed(7)}" lon="${pt.lon.toFixed(7)}">
`;
    if (pt.ele !== null && pt.ele !== undefined && !isNaN(pt.ele)) {
      xml += `        <ele>${Number(pt.ele).toFixed(1)}</ele>
`;
    }
    if (pt.time) {
      xml += `        <time>${pt.time}</time>
`;
    }
    xml += `      </trkpt>
`;
  });

  xml += `    </trkseg>
  </trk>
</gpx>`;

  return xml;
}

/**
 * Builds GeoJSON FeatureCollection
 */
export function buildGeoJSON({ name, description, points, waypoints }) {
  const coordinates = points.map(p => {
    if (p.ele !== null && p.ele !== undefined) {
      return [Number(p.lon.toFixed(7)), Number(p.lat.toFixed(7)), Number(p.ele.toFixed(1))];
    }
    return [Number(p.lon.toFixed(7)), Number(p.lat.toFixed(7))];
  });

  const features = [
    {
      type: 'Feature',
      properties: {
        name: name || 'Track',
        description: description || '',
        stroke: '#ff6b35',
        'stroke-width': 4,
        'stroke-opacity': 0.9
      },
      geometry: {
        type: 'LineString',
        coordinates
      }
    }
  ];

  if (waypoints && waypoints.length > 0) {
    waypoints.forEach(wpt => {
      features.push({
        type: 'Feature',
        properties: {
          name: wpt.name,
          description: wpt.desc,
          symbol: wpt.sym
        },
        geometry: {
          type: 'Point',
          coordinates: [
            Number(wpt.lon.toFixed(7)),
            Number(wpt.lat.toFixed(7)),
            wpt.ele ? Number(wpt.ele.toFixed(1)) : 0
          ]
        }
      });
    });
  }

  return JSON.stringify({
    type: 'FeatureCollection',
    features
  }, null, 2);
}

/**
 * Builds KML string
 */
export function buildKML({ name, description, points, waypoints }) {
  const safeName = escapeXml(name || 'Track');
  const safeDesc = escapeXml(description || '');

  const coordsStr = points.map(p => 
    `${p.lon.toFixed(7)},${p.lat.toFixed(7)},${p.ele !== null && p.ele !== undefined ? p.ele.toFixed(1) : 0}`
  ).join(' ');

  let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${safeName}</name>
    <description>${safeDesc}</description>
    <Style id="trackLine">
      <LineStyle>
        <color>ff186bff</color>
        <width>4</width>
      </LineStyle>
    </Style>
    <Placemark>
      <name>${safeName}</name>
      <styleUrl>#trackLine</styleUrl>
      <LineString>
        <extrude>1</extrude>
        <tessellate>1</tessellate>
        <altitudeMode>clampToGround</altitudeMode>
        <coordinates>${coordsStr}</coordinates>
      </LineString>
    </Placemark>
`;

  if (waypoints && waypoints.length > 0) {
    waypoints.forEach(wpt => {
      kml += `    <Placemark>
      <name>${escapeXml(wpt.name)}</name>
      ${wpt.desc ? `<description>${escapeXml(wpt.desc)}</description>` : ''}
      <Point>
        <coordinates>${wpt.lon.toFixed(7)},${wpt.lat.toFixed(7)},${wpt.ele || 0}</coordinates>
      </Point>
    </Placemark>
`;
    });
  }

  kml += `  </Document>
</kml>`;

  return kml;
}

function escapeXml(unsafe) {
  return String(unsafe).replace(/[<>&'"]/g, c => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}
