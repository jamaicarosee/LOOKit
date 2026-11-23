// Light-weight GPS smoothing (a 1-D Kalman filter on latitude and longitude).
// Each fix is weighted by its reported accuracy, so a good reading pulls the estimate hard and a poor
// indoor one barely moves it. Between fixes the uncertainty grows a little (people walk), so the filter
// keeps following real movement.
//
//   const f = createGpsFilter();
//   const { coord, accuracy } = f.update([lng, lat], accuracyM, timestampMs);

const M_PER_DEG_LAT = 111320;

export function createGpsFilter({ walkSpeedMps = 1.4, minAccuracyM = 3 } = {}) {
  let lat = null;
  let lng = null;
  let variance = 0; // m^2
  let t = 0;

  return {
    update([lngIn, latIn], accuracy, at = Date.now()) {
      const acc = Math.max(Number.isFinite(accuracy) ? accuracy : 50, minAccuracyM);
      if (lat === null) {
        lat = latIn;
        lng = lngIn;
        variance = acc * acc;
        t = at;
      } else {
        const dt = Math.max((at - t) / 1000, 0);
        variance += dt * walkSpeedMps * walkSpeedMps; // uncertainty grows with time since the last fix
        const k = variance / (variance + acc * acc); // 0..1, how much to trust the new fix
        lat += k * (latIn - lat);
        lng += k * (lngIn - lng);
        variance = (1 - k) * variance;
        t = at;
      }
      return { coord: [lng, lat], accuracy: Math.max(Math.sqrt(variance), minAccuracyM) };
    },
    current() {
      return lat === null ? null : { coord: [lng, lat], accuracy: Math.max(Math.sqrt(variance), minAccuracyM) };
    },
    reset() {
      lat = null;
      lng = null;
      variance = 0;
      t = 0;
    },
    get ready() {
      return lat !== null;
    },
  };
}

// Distance in metres between two [lng, lat] points (small-distance approximation, plenty for jitter checks)
export function quickDistanceM(a, b) {
  const dLat = (b[1] - a[1]) * M_PER_DEG_LAT;
  const dLng = (b[0] - a[0]) * M_PER_DEG_LAT * Math.cos(((a[1] + b[1]) / 2) * (Math.PI / 180));
  return Math.hypot(dLat, dLng);
}
