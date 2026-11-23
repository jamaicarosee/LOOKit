import React, { useEffect, useMemo, useState } from 'react';
import { LocateFixed, MapPin } from 'lucide-react';
import { getAll } from '../../navigation/services/locationService';
import { haversine } from '../../navigation/services/geo';
import { FLOORS, GPS_NEARBY_ROOMS_MAX_M } from '../../navigation/constants';

const ordinal = (n) => ({ 1: '1st', 2: '2nd', 3: '3rd' }[n] || `${n}th`);

// Shown under the From field while "Current Location" is the start. It reports GPS quality honestly and,
// because GPS cannot see floors or walls, lets the user (1) say which floor they are on and
// (2) tap the room they are standing near for an exact indoor start.
export default function GpsAssist({ inputs }) {
  const { gps, gpsFloor, setGpsFloor, selectFrom } = inputs;
  const [rooms, setRooms] = useState([]);
  const [showNearby, setShowNearby] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getAll().then((list) => !cancelled && setRooms(list.filter((l) => l.type === 'room' && l.coordinates))).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const floors = useMemo(() => {
    const present = [...new Set(rooms.map((r) => r.floor))].filter(Number.isFinite).sort((a, b) => a - b);
    return present.length ? present : FLOORS;
  }, [rooms]);

  const weak = gps.quality === 'weak';
  // Open the room list automatically when GPS is weak or the user is above the ground floor
  useEffect(() => {
    if (weak || gpsFloor > 1) setShowNearby(true);
  }, [weak, gpsFloor]);

  const nearby = useMemo(() => {
    if (!gps.coord) return [];
    return rooms
      .filter((r) => r.floor === gpsFloor)
      .map((r) => ({ room: r, d: haversine(gps.coord, r.coordinates) }))
      .filter((x) => x.d <= GPS_NEARBY_ROOMS_MAX_M)
      .sort((a, b) => a.d - b.d)
      .slice(0, 5);
  }, [rooms, gps.coord, gpsFloor]);

  const status = !gps.coord
    ? 'Getting a stable GPS fix…'
    : weak
      ? `Weak GPS signal (±${Math.round(gps.accuracy)} m), which is normal indoors.`
      : `Live GPS on · accuracy ±${Math.round(gps.accuracy)} m · your route updates as you walk`;

  return (
    <div className="mt-2 space-y-2 px-1" aria-live="polite">
      <p role="status" className={`flex items-center gap-1.5 text-[11px] font-semibold ${weak ? 'text-[#9A6B00]' : 'text-[#607289]'}`}>
        <LocateFixed className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {status}
      </p>

      {gps.coord && (
        <>
          <div>
            <p className="mb-1 text-[11px] font-bold text-[#0B2545]">Which floor are you on?</p>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Your floor">
              {floors.map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={gpsFloor === f}
                  onClick={() => setGpsFloor(f)}
                  className={`min-w-[2.25rem] rounded-md px-2.5 py-1 text-[11px] font-bold ${
                    gpsFloor === f ? 'bg-[#0B2545] text-white' : 'bg-[#E5EEF7] text-[#0B2545]'
                  }`}
                >
                  {f}F
                </button>
              ))}
            </div>
            {gpsFloor > 1 && (
              <p className="mt-1 text-[10px] font-medium text-[#607289]">
                GPS cannot detect floors. Your start is placed on the {ordinal(gpsFloor)} floor at the closest hallway. Pick a nearby room below for an exact start.
              </p>
            )}
          </div>

          {!showNearby ? (
            <button type="button" onClick={() => setShowNearby(true)} className="text-[11px] font-bold text-[#0B2545] underline">
              Not accurate? Pick the room you are near
            </button>
          ) : (
            <div>
              <p className="mb-1 text-[11px] font-bold text-[#0B2545]">Rooms near you · {ordinal(gpsFloor)} floor</p>
              {nearby.length === 0 ? (
                <p className="text-[10px] font-medium text-[#607289]">No rooms found near your position on this floor. Try another floor or search for your start above.</p>
              ) : (
                <ul className="space-y-1">
                  {nearby.map(({ room, d }) => (
                    <li key={room.id}>
                      <button
                        type="button"
                        onClick={() => selectFrom(room)}
                        className="flex w-full items-center gap-2 rounded-md bg-[#E5EEF7] px-2.5 py-1.5 text-left text-[11px] font-semibold text-[#0B2545] hover:bg-[#D5E2EE]"
                      >
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-[#C9A227]" aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate">
                          {room.name}
                          {room.fullName && room.fullName !== room.name ? ` · ${room.fullName}` : ''}
                        </span>
                        <span className="shrink-0 text-[10px] text-[#607289]">~{Math.round(d)} m</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
