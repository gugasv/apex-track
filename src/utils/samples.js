/**
 * Built-in Sample GPX tracks for instant testing and demonstration
 */

// Chamonix - Lac Blanc Ridge Loop (Alps)
const LAC_BLANC_POINTS = [
  { lat: 45.9237, lon: 6.8694, ele: 1035, time: "2026-07-15T07:30:00Z" },
  { lat: 45.9268, lon: 6.8732, ele: 1120, time: "2026-07-15T07:44:00Z" },
  { lat: 45.9312, lon: 6.8778, ele: 1240, time: "2026-07-15T08:02:00Z" },
  { lat: 45.9355, lon: 6.8812, ele: 1390, time: "2026-07-15T08:24:00Z" },
  { lat: 45.9402, lon: 6.8835, ele: 1540, time: "2026-07-15T08:48:00Z" },
  { lat: 45.9451, lon: 6.8870, ele: 1710, time: "2026-07-15T09:15:00Z" },
  { lat: 45.9498, lon: 6.8905, ele: 1875, time: "2026-07-15T09:40:00Z" },
  { lat: 45.9542, lon: 6.8924, ele: 2040, time: "2026-07-15T10:06:00Z" },
  { lat: 45.9587, lon: 6.8962, ele: 2180, time: "2026-07-15T10:32:00Z" },
  { lat: 45.9615, lon: 6.9010, ele: 2280, time: "2026-07-15T10:50:00Z" },
  { lat: 45.9642, lon: 6.9065, ele: 2352, time: "2026-07-15T11:05:00Z" }, // Lac Blanc
  { lat: 45.9658, lon: 6.9120, ele: 2365, time: "2026-07-15T11:18:00Z" },
  { lat: 45.9620, lon: 6.9180, ele: 2240, time: "2026-07-15T11:35:00Z" },
  { lat: 45.9570, lon: 6.9205, ele: 2110, time: "2026-07-15T11:55:00Z" },
  { lat: 45.9515, lon: 6.9190, ele: 1980, time: "2026-07-15T12:15:00Z" },
  { lat: 45.9470, lon: 6.9150, ele: 1820, time: "2026-07-15T12:35:00Z" },
  { lat: 45.9410, lon: 6.9080, ele: 1640, time: "2026-07-15T12:58:00Z" },
  { lat: 45.9340, lon: 6.8990, ele: 1420, time: "2026-07-15T13:20:00Z" },
  { lat: 45.9280, lon: 6.8850, ele: 1210, time: "2026-07-15T13:42:00Z" },
  { lat: 45.9242, lon: 6.8710, ele: 1045, time: "2026-07-15T14:02:00Z" }
];

const LAC_BLANC_WAYPOINTS = [
  { lat: 45.9237, lon: 6.8694, ele: 1035, name: "Chamonix Trailhead", desc: "Start point at valley floor", sym: "Trailhead" },
  { lat: 45.9451, lon: 6.8870, ele: 1710, name: "Chalet de la Floria", desc: "Panoramic view cafe", sym: "Food" },
  { lat: 45.9642, lon: 6.9065, ele: 2352, name: "Refuge du Lac Blanc", desc: "Glacial alpine lake & Mont Blanc view", sym: "Summit" },
  { lat: 45.9515, lon: 6.9190, ele: 1980, name: "Flégère Ridge Spring", desc: "Natural water source", sym: "Water" }
];

// Yosemite Mist Trail & Nevada Falls (USA)
const YOSEMITE_POINTS = [
  { lat: 37.7326, lon: -119.5583, ele: 1225, time: "2026-06-10T08:00:00Z" },
  { lat: 37.7315, lon: -119.5512, ele: 1280, time: "2026-06-10T08:15:00Z" },
  { lat: 37.7302, lon: -119.5450, ele: 1350, time: "2026-06-10T08:32:00Z" },
  { lat: 37.7275, lon: -119.5420, ele: 1470, time: "2026-06-10T08:55:00Z" },
  { lat: 37.7260, lon: -119.5435, ele: 1540, time: "2026-06-10T09:12:00Z" }, // Vernal Fall
  { lat: 37.7245, lon: -119.5400, ele: 1610, time: "2026-06-10T09:30:00Z" },
  { lat: 37.7230, lon: -119.5340, ele: 1720, time: "2026-06-10T09:52:00Z" },
  { lat: 37.7205, lon: -119.5315, ele: 1810, time: "2026-06-10T10:15:00Z" },
  { lat: 37.7188, lon: -119.5328, ele: 1865, time: "2026-06-10T10:35:00Z" }, // Nevada Fall Top
  { lat: 37.7170, lon: -119.5370, ele: 1920, time: "2026-06-10T10:55:00Z" },
  { lat: 37.7210, lon: -119.5425, ele: 1780, time: "2026-06-10T11:20:00Z" },
  { lat: 37.7250, lon: -119.5475, ele: 1620, time: "2026-06-10T11:45:00Z" },
  { lat: 37.7290, lon: -119.5530, ele: 1410, time: "2026-06-10T12:05:00Z" },
  { lat: 37.7326, lon: -119.5583, ele: 1225, time: "2026-06-10T12:25:00Z" }
];

const YOSEMITE_WAYPOINTS = [
  { lat: 37.7326, lon: -119.5583, ele: 1225, name: "Happy Isles Trailhead", desc: "Shuttle stop & gear check", sym: "Trailhead" },
  { lat: 37.7260, lon: -119.5435, ele: 1540, name: "Vernal Fall Footbridge", desc: "Mist spray & rainbow lookout", sym: "Viewpoint" },
  { lat: 37.7188, lon: -119.5328, ele: 1865, name: "Top of Nevada Fall", desc: "Granite apron overlooking canyon", sym: "Summit" }
];

// Dolomites Tre Cime di Lavaredo Loop (Italy)
const TRE_CIME_POINTS = [
  { lat: 46.6124, lon: 12.2952, ele: 2320, time: "2026-08-01T09:00:00Z" },
  { lat: 46.6135, lon: 12.3020, ele: 2340, time: "2026-08-01T09:18:00Z" },
  { lat: 46.6152, lon: 12.3105, ele: 2370, time: "2026-08-01T09:36:00Z" },
  { lat: 46.6180, lon: 12.3150, ele: 2454, time: "2026-08-01T09:58:00Z" }, // Forcella Lavaredo
  { lat: 46.6235, lon: 12.3135, ele: 2405, time: "2026-08-01T10:20:00Z" },
  { lat: 46.6288, lon: 12.3082, ele: 2438, time: "2026-08-01T10:45:00Z" }, // Rifugio Locatelli
  { lat: 46.6265, lon: 12.2980, ele: 2360, time: "2026-08-01T11:10:00Z" },
  { lat: 46.6210, lon: 12.2905, ele: 2240, time: "2026-08-01T11:32:00Z" }, // Pian de Lava
  { lat: 46.6160, lon: 12.2880, ele: 2280, time: "2026-08-01T11:55:00Z" },
  { lat: 46.6124, lon: 12.2952, ele: 2320, time: "2026-08-01T12:15:00Z" }
];

const TRE_CIME_WAYPOINTS = [
  { lat: 46.6124, lon: 12.2952, ele: 2320, name: "Rifugio Auronzo", desc: "Southern base camp", sym: "Trailhead" },
  { lat: 46.6180, lon: 12.3150, ele: 2454, name: "Forcella Lavaredo", desc: "High pass directly beneath Cima Grande", sym: "Viewpoint" },
  { lat: 46.6288, lon: 12.3082, ele: 2438, name: "Rifugio Locatelli (Dreizinnenhütte)", desc: "Iconic northern north-face panorama", sym: "Summit" }
];

export const SAMPLE_TRACKS = [
  {
    id: "lac_blanc",
    name: "Chamonix - Lac Blanc Alpine Loop",
    description: "High altitude circuit in the French Alps facing Mont Blanc.",
    points: LAC_BLANC_POINTS.map((pt, i) => ({ ...pt, id: `sm_lb_${i}` })),
    waypoints: LAC_BLANC_WAYPOINTS.map((w, i) => ({ ...w, id: `sm_lb_w_${i}` }))
  },
  {
    id: "yosemite",
    name: "Yosemite Mist & Nevada Falls Trail",
    description: "Spectacular waterfall hike up the Merced River canyon.",
    points: YOSEMITE_POINTS.map((pt, i) => ({ ...pt, id: `sm_yo_${i}` })),
    waypoints: YOSEMITE_WAYPOINTS.map((w, i) => ({ ...w, id: `sm_yo_w_${i}` }))
  },
  {
    id: "tre_cime",
    name: "Dolomites - Tre Cime di Lavaredo Loop",
    description: "World-famous circumambulation of the three iconic limestone towers.",
    points: TRE_CIME_POINTS.map((pt, i) => ({ ...pt, id: `sm_tc_${i}` })),
    waypoints: TRE_CIME_WAYPOINTS.map((w, i) => ({ ...w, id: `sm_tc_w_${i}` }))
  }
];
