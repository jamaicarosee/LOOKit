export const MAPBOX_CONFIG = {
  style: "mapbox://styles/mapbox/light-v11",
  centerAnchor: [121.09999, 14.57309],
  maxBounds: [
    [121.09499, 14.56809], // Southwest boundary
    [121.10499, 14.57809], // Northeast boundary
  ],
  minZoom: 16.5,
  cameraPresets: {
    isometric3D: {
      zoom: 17.6,
      pitch: 55,
      bearing: -15,
    },
    planimetric2D: {
      zoom: 17.5,
      pitch: 0,
      bearing: 0,
    },
  },
  buildingColors: {
    MAE: "#E67E22",
    CED: "#2980B9",
    CAS: "#27AE60",
    JAVIER: "#F1C40F",
    LANDING: "#E5E8E8",
    BUFFER: "#BDC3C7",
    TREADS: "#D5D8DC",
    PWD_RAMP: "#A2D9CE",
  },
};