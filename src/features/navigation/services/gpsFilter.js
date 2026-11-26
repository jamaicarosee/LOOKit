import { haversine } from './geo';

export function quickDistanceM(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return Infinity;
  return haversine(a, b);
}

const MAX_WALK_SPEED_MPS = 2.6; // Rejects indoor Wi-Fi teleports even if phone claims good accuracy

export function createGpsFilter() {
  let est = null; // { coord: [lng, lat], accuracy: number, timestamp: number }
  let consecutiveRejects = 0;

  function reset() {
    est = null;
    consecutiveRejects = 0;
  }

  // Supports both update(coord, accuracy, now, options) and update({ coord, accuracy, timestamp }, options)
  function update(arg1, arg2, arg3, arg4 = {}) {
    let coord, accuracy, now, options;
    if (Array.isArray(arg1)) {
      coord = arg1;
      accuracy = Number.isFinite(arg2) ? arg2 : 30;
      now = arg3 || Date.now();
      options = arg4 || {};
    } else if (arg1 && Array.isArray(arg1.coord)) {
      coord = arg1.coord;
      accuracy = Number.isFinite(arg1.accuracy) ? arg1.accuracy : 30;
      now = arg1.timestamp || Date.now();
      options = arg2 || {};
    } else {
      return est;
    }

    const [lng, lat] = coord;
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return est;
    const { snapToPath, crossesWall } = options;

    if (!est) {
      const snapped = snapToPath ? snapToPath([lng, lat]) : [lng, lat];
      est = { coord: snapped, accuracy, timestamp: now };
      return est;
    }

    const dtSec = Math.max(0.5, (now - est.timestamp) / 1000);
    const candidate = snapToPath ? snapToPath([lng, lat]) : [lng, lat];
    const dist = haversine(est.coord, candidate);
    const maxPlausibleDist = Math.max(7, MAX_WALK_SPEED_MPS * dtSec + Math.min(accuracy, 20) * 0.3);
    const wallBlocked = typeof crossesWall === 'function' && dist > 3 && crossesWall(est.coord, candidate);

    // Block sudden indoor Wi-Fi teleports or wall-crossing jumps (do NOT auto-accept after just 3 jumps)
    if (dist > maxPlausibleDist || wallBlocked) {
      consecutiveRejects += 1;
      if (consecutiveRejects < 6 || dtSec < 12) {
        return est;
      }
    }

    consecutiveRejects = 0;
    const alpha = Math.max(0.22, Math.min(0.65, 18 / Math.max(12, accuracy)));
    const blended = [
      est.coord[0] + alpha * (candidate[0] - est.coord[0]),
      est.coord[1] + alpha * (candidate[1] - est.coord[1]),
    ];
    const finalCoord = snapToPath ? snapToPath(blended) : blended;
    est = { coord: finalCoord, accuracy, timestamp: now };
    return est;
  }

  return {
    update,
    reset,
    get ready() {
      return est !== null;
    },
    current: () => est,
    getState: () => est,
  };
}
