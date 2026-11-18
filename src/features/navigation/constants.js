// Shared constants for the Search / Directions flow

// --- Colors (match the dashboard tokens) ---
export const COLORS = {
<<<<<<< HEAD
  navy: '#0B1E36',
  navyHover: '#152B47',
=======
  navy: '#0B2545',
  navyHover: '#141070',
>>>>>>> 73e09d3 (added skeletal loading and current location)
  lightBlue: '#E5EEF7',
  panel: '#E5EBF5',
  gold: '#C9A227',
  emergency: '#D64545',
  pwd: '#2B9E8A',
};

// --- Routing ---
export const USE_REMOTE_ROUTING = true; // Connected to FastAPI backend
export const API_BASE_URL =
  import.meta.env?.VITE_FASTAPI_BASE_URL || import.meta.env?.VITE_API_BASE_URL || '';
export const WALKING_SPEED_MPS = 1.25;
export const RAMP_SPEED_MPS = 0.9;
export const STAIRS_SECONDS_PER_FLOOR = 22;
export const STAIRS_LENGTH_M = 12; // horizontal run assumed for one flight between floors

// Floors that have GeoJSON in /data/floor{n}/
export const FLOORS = [1, 2, 3, 4, 5, 6];

// --- Map ---
export const RTU_PASIG_CENTER = [121.09999, 14.57309];
export const MAPBOX_TOKEN =
  import.meta.env?.VITE_MAPBOX_ACCESS_TOKEN || import.meta.env?.VITE_MAPBOX_TOKEN || '';

// --- Play guide ---
export const GUIDE_METERS_PER_SECOND = 7; // animation speed along a step (1x)
export const GUIDE_MIN_STEP_MS = 1600;
<<<<<<< HEAD
export const GUIDE_MAX_STEP_MS = 6000;
=======
export const GUIDE_MAX_STEP_MS = 6000;

// --- Current Location (GPS) ---
export const CURRENT_LOCATION_ID = 'current-location';
export const CURRENT_LOCATION_LABEL = 'Current Location (GPS)';
export const GPS_MIN_MOVE_M = 3; // ignore fixes closer than this to the last one (jitter while standing still)
export const GPS_MIN_INTERVAL_MS = 1500; // and fixes arriving faster than this
export const GPS_MAX_ACCURACY_M = 100; // after the first fix, fixes less accurate than this are ignored
export const GPS_SNAP_MAX_M = 150; // further than this from any walkway = not on campus, no route
export const GPS_OFF_PATH_WARN_M = 25; // further than this from a walkway: route starts at the nearest one, with a warning
>>>>>>> 73e09d3 (added skeletal loading and current location)
