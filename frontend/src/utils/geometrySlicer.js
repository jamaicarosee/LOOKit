/**
 * RTU Pasig Campus - Procedural 3D Staircase & Sloped PWD Ramp Slicing Engine
 * File: src_floor1/utils/geometry-slicer.js
 *
 * Procedurally slices unified boundary definitions from 'structures_f1.json'
 * into 3D step tread polygons ('stair_tread') and smooth incline cross-sections
 * ('pwd_ramp') at runtime in memory.
 */

const DEFAULT_STAIR_COLOR = '#D5D8DC';
const DEFAULT_STAIR_OUTLINE = '#AEB6BF';
const DEFAULT_RAMP_COLOR = '#A0E7E5';
const DEFAULT_RAMP_OUTLINE = '#48C9B0';
const CAMPUS_NAME = 'Rizal Technological University - Pasig Branch';

/**
 * Converts a [minLon, minLat, maxLon, maxLat] bounding box into a closed
 * counter-clockwise GeoJSON Polygon ring.
 */
export function boundsToClosedRing([minLon, minLat, maxLon, maxLat]) {
  const w = Number(minLon.toFixed(8));
  const s = Number(minLat.toFixed(8));
  const e = Number(maxLon.toFixed(8));
  const n = Number(maxLat.toFixed(8));
  return [
    [w, n],
    [w, s],
    [e, s],
    [e, n],
    [w, n]
  ];
}

/**
 * Extracts [minLon, minLat, maxLon, maxLat] from either a structure's 'bounds'
 * array or its unified GeoJSON Polygon 'geometry'.
 */
export function extractBounds(structure) {
  if (Array.isArray(structure.bounds) && structure.bounds.length === 4) {
    return structure.bounds;
  }
  const ring = structure.geometry?.coordinates?.[0] || [];
  const lons = ring.map((pt) => pt[0]);
  const lats = ring.map((pt) => pt[1]);
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
}

/**
 * Linearly subdivides a rectangular geographic bounding box into 'count' narrow
 * parallel slices along the specified cardinal direction ('north'|'south'|'east'|'west').
 */
export function sliceBoundingBox(bounds, count, direction) {
  const [minLon, minLat, maxLon, maxLat] = bounds;
  const dir = (direction || 'north').toLowerCase();
  const boxes = [];

  if (dir === 'north' || dir === 'south') {
    const stepLat = (maxLat - minLat) / count;
    for (let i = 0; i < count; i++) {
      const sLat = dir === 'north' ? minLat + i * stepLat : maxLat - (i + 1) * stepLat;
      const nLat = dir === 'north' ? minLat + (i + 1) * stepLat : maxLat - i * stepLat;
      boxes.push([minLon, Math.min(sLat, nLat), maxLon, Math.max(sLat, nLat)]);
    }
  } else {
    const stepLon = (maxLon - minLon) / count;
    for (let i = 0; i < count; i++) {
      const wLon = dir === 'east' ? minLon + i * stepLon : maxLon - (i + 1) * stepLon;
      const eLon = dir === 'east' ? minLon + (i + 1) * stepLon : maxLon - i * stepLon;
      boxes.push([Math.min(wLon, eLon), minLat, Math.max(wLon, eLon), maxLat]);
    }
  }

  return boxes;
}

/**
 * Procedurally slices a single staircase definition into progressive 3D
 * 'stair_tread' GeoJSON Polygon features.
 */
export function sliceStaircaseStructure(structure) {
  const features = [];
  const stepInc = structure.step_increment ?? 0.2;
  const totalSteps = structure.steps || 8;
  const isDown = structure.type === 'stairs_down';
  const startH = structure.start_height ?? (isDown ? (structure.total_height ?? 3.5) : stepInc);
  const targetH = structure.target_height ?? (isDown ? (structure.target_landing ?? 0.0) : +(totalSteps * stepInc).toFixed(2));
  const floorLevel = structure.floor_level ?? 1;

  const createTreadFeature = (stepNum, height, box) => ({
    type: 'Feature',
    properties: {
      feature_type: 'stair_tread',
      indoor: 'staircase',
      floor_level: 1,
      level: '1',
      type: 'stair_tread',
      code: `${structure.id}-T${String(stepNum).padStart(2, '0')}`,
      staircase_id: structure.id,
      step_number: stepNum,
      label: '', // Staircase text labels intentionally excluded
      name: `${structure.name} (Step ${stepNum})`,
      full_name: `${structure.full_name || structure.name} — Step ${stepNum} (${height}m)`,
      building: structure.building,
      height: Number(height.toFixed(2)),
      color: DEFAULT_STAIR_COLOR,
      outline_color: DEFAULT_STAIR_OUTLINE,
      'fill-extrusion-opacity': 0.9,
      campus: CAMPUS_NAME
    },
    geometry: {
      type: 'Polygon',
      coordinates: [boundsToClosedRing(box)]
    }
  });

  // Case 1: U-Turn / Multi-flight staircase with explicit flight segments
  if (Array.isArray(structure.flights) && structure.flights.length > 0) {
    for (const flight of structure.flights) {
      if (flight.kind === 'landing') {
        features.push(createTreadFeature(flight.step_number, flight.height, flight.bounds));
      } else {
        const subBoxes = sliceBoundingBox(flight.bounds, flight.steps, flight.direction);
        const hasRange = flight.start_height !== undefined && flight.target_height !== undefined;
        subBoxes.forEach((box, idx) => {
          const stepNum = (flight.start_step || 1) + idx;
          const height = hasRange && flight.steps > 1
            ? Number((flight.start_height + (idx / (flight.steps - 1)) * (flight.target_height - flight.start_height)).toFixed(2))
            : +(stepNum * stepInc).toFixed(2);
          features.push(createTreadFeature(stepNum, height, box));
        });
      }
    }
    return features;
  }

  // Case 2: Single / Continuous ascending flight across unified bounds
  const bounds = extractBounds(structure);
  const sliceBoxes = sliceBoundingBox(bounds, totalSteps, structure.direction);
  const isContinuous = structure.layout === 'continuous';

  sliceBoxes.forEach((box, idx) => {
    const stepNum = idx + 1;
    const height = isContinuous && totalSteps > 1
      ? startH + (idx / (totalSteps - 1)) * (targetH - startH)
      : stepNum * stepInc;
    features.push(createTreadFeature(stepNum, height, box));
  });

  return features;
}

/**
 * Procedurally slices a single PWD ramp definition into smooth progressive 3D
 * 'pwd_ramp' incline GeoJSON Polygon features.
 */
export function sliceRampStructure(structure) {
  const bounds = extractBounds(structure);
  const sliceCount = structure.slices || 12;
  const startH = structure.start_height ?? 0.05;
  const targetH = structure.target_height ?? 1.2;
  const labelSliceIndex = Math.floor(sliceCount / 2);
  const sliceBoxes = sliceBoundingBox(bounds, sliceCount, structure.direction);

  return sliceBoxes.map((box, idx) => {
    const sliceNum = idx + 1;
    const ratio = sliceCount > 1 ? idx / (sliceCount - 1) : 1;
    const height = Number((startH + ratio * (targetH - startH)).toFixed(2));
    const isCenterSlice = sliceNum === labelSliceIndex;

    return {
      type: 'Feature',
      properties: {
        feature_type: 'pwd_ramp',
        indoor: 'ramp',
        floor_level: 1,
        level: '1',
        type: 'pwd_ramp',
        code: `${structure.id}-S${String(sliceNum).padStart(2, '0')}`,
        ramp_id: structure.id,
        slice_number: sliceNum,
        label: isCenterSlice ? (structure.label || 'PWD RAMP') : '',
        name: structure.name,
        full_name: `${structure.full_name || structure.name} — Incline Section ${sliceNum} (${height}m)`,
        building: structure.building,
        height,
        color: DEFAULT_RAMP_COLOR,
        outline_color: DEFAULT_RAMP_OUTLINE,
        'fill-extrusion-opacity': 0.88,
        campus: CAMPUS_NAME
      },
      geometry: {
        type: 'Polygon',
        coordinates: [boundsToClosedRing(box)]
      }
    };
  });
}

/**
 * Processes an array of unified structural definitions ('structures_f1.json')
 * and returns a GeoJSON FeatureCollection of all 3D stair treads and PWD ramps.
 */
export function generateStructuresGeoJson(structures = []) {
  const features = [];

  for (const item of structures) {
    if (item.type === 'stairs' || item.type === 'stairs_down') {
      features.push(...sliceStaircaseStructure(item));
    } else if (item.type === 'ramp') {
      features.push(...sliceRampStructure(item));
    }
  }

  features.forEach((feat, idx) => {
    feat.id = idx + 1000;
  });

  return {
    type: 'FeatureCollection',
    features
  };
}

