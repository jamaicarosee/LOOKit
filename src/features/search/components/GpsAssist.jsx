import React, { useEffect, useMemo, useState } from 'react';
import { Building2, LocateFixed, MapPin } from 'lucide-react';
import { getAll, buildingAtFactory } from '../../navigation/services/locationService';
import { fetchCampusData } from '../../navigation/services/dataService';
import { haversine } from '../../navigation/services/geo';
import { FLOORS } from '../../navigation/constants';

const ordinal = (n) => ({ 1: '1st', 2: '2nd', 3: '3rd' }[n] || `${n}th`);

export default function GpsAssist({ inputs }) {
  const { gps, gpsFloor, setGpsFloor, gpsAnchor, setGpsAnchor } = inputs;
  const [rooms, setRooms] = useState([]);
  const [campusFeatures, setCampusFeatures] = useState([]);
  const [showOtherRooms, setShowOtherRooms] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getAll()
      .then((list) => !cancelled && setRooms(list.filter((l) => l.type === 'room' && l.coordinates)))
      .catch(() => {});
    fetchCampusData()
      .then((data) => !cancelled && setCampusFeatures(data?.campus?.features || []))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const activeCoord = gpsAnchor?.coord || gps.coord;

  // 1. Detect which building the user is inside
  const detectedBuilding = useMemo(() => {
    if (!activeCoord) return null;
    if (campusFeatures.length) {
      const detector = buildingAtFactory(campusFeatures);
      const hit = detector(activeCoord);
      if (hit) return hit;
    }
    let best = null;
    for (const r of rooms) {
      if (!r.building) continue;
      const d = haversine(activeCoord, r.coordinates);
      if (d <= 35 && (!best || d < best.d)) best = { d, building: r.building };
    }
    return best ? best.building : null;
  }, [activeCoord, campusFeatures, rooms]);

  useEffect(() => {
    setShowOtherRooms(false);
  }, [detectedBuilding, gpsFloor]);

  // 2. Floors available in that building
  const floors = useMemo(() => {
    const scoped = detectedBuilding ? rooms.filter((r) => r.building === detectedBuilding) : rooms;
    const present = [...new Set(scoped.map((r) => r.floor))].filter(Number.isFinite).sort((a, b) => a - b);
    return present.length ? present : FLOORS;
  }, [rooms, detectedBuilding]);

  useEffect(() => {
    if (floors.length && !floors.includes(gpsFloor)) {
      setGpsFloor(floors[0]);
    }
  }, [floors, gpsFloor, setGpsFloor]);

  // 3. Only rooms within 25m of your current dot on that building & floor (max 4 closest)
  const { nearbyRooms, hasMoreRooms } = useMemo(() => {
    if (!activeCoord) return { nearbyRooms: [], hasMoreRooms: false };

    const scoped = rooms
      .filter((r) => r.floor === gpsFloor)
      .filter((r) => !detectedBuilding || r.building === detectedBuilding)
      .map((r) => ({ room: r, d: haversine(activeCoord, r.coordinates) }))
      .sort((a, b) => a.d - b.d);

    if (showOtherRooms) {
      return { nearbyRooms: scoped, hasMoreRooms: false };
    }

    const strictClose = scoped.filter((x) => x.d <= 25).slice(0, 4);
    const list = strictClose.length ? strictClose : scoped.slice(0, 3);
    return {
      nearbyRooms: list,
      hasMoreRooms: scoped.length > list.length,
    };
  }, [rooms, activeCoord, gpsFloor, detectedBuilding, showOtherRooms]);

  const weak = gps.quality === 'weak' || (gps.accuracy && gps.accuracy > 45);
  const status = !gps.coord
    ? 'Detecting your current location…'
    : gpsAnchor
      ? `Anchored near ${gpsAnchor.name} (${ordinal(gpsFloor)} floor)`
      : weak
        ? `Weak indoor GPS signal (±${Math.round(gps.accuracy)} m) — tap a nearby room below to move your blue dot`
        : `Live GPS active · accuracy ±${Math.round(gps.accuracy)} m`;

  return (
    <div className="mt-2 space-y-2.5 px-1" aria-live="polite">
      <p role="status" className={`flex items-center gap-1.5 text-[11px] font-semibold ${weak && !gpsAnchor ? 'text-[#9A6B00]' : 'text-[#607289]'}`}>
        <LocateFixed className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {status}
      </p>

      {activeCoord && (
        <>
          <div className="flex items-center gap-2 rounded-lg border border-[#CBD8E8] bg-[#F2F6FB] px-2.5 py-2">
            <Building2 className="h-4 w-4 shrink-0 text-[#0B2545]" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#607289]">Detected Location</p>
              <p className="truncate text-xs font-bold text-[#0B2545]">
                {detectedBuilding ? `You are at ${detectedBuilding}` : 'Outdoor Campus Area'}
              </p>
            </div>
            {gpsAnchor && (
              <button
                type="button"
                onClick={() => setGpsAnchor(null)}
                className="shrink-0 rounded bg-white px-2 py-1 text-[10px] font-bold text-[#0B2545] shadow-sm"
              >
                Use raw GPS
              </button>
            )}
          </div>

          <div>
            <p className="mb-1 text-[11px] font-bold text-[#0B2545]">
              {detectedBuilding ? `Which floor of ${detectedBuilding} are you on?` : 'Which floor are you on?'}
            </p>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Your floor">
              {floors.map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={gpsFloor === f}
                  onClick={() => {
                    setGpsFloor(f);
                    setGpsAnchor(null);
                  }}
                  className={`min-w-[2.25rem] rounded-md px-2.5 py-1 text-[11px] font-bold ${
                    gpsFloor === f ? 'bg-[#0B2545] text-white' : 'bg-[#E5EEF7] text-[#0B2545]'
                  }`}
                >
                  {f}F
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1 text-[11px] font-bold text-[#0B2545]">
              Rooms near you ({ordinal(gpsFloor)} floor{detectedBuilding ? ` · ${detectedBuilding}` : ''})
            </p>
            {nearbyRooms.length === 0 ? (
              <p className="text-[10px] font-medium text-[#607289]">
                No mapped rooms within 25 m of your spot on {ordinal(gpsFloor)} floor.
              </p>
            ) : (
              <>
                <ul className="space-y-1">
                  {nearbyRooms.map(({ room, d }) => {
                    const selected = gpsAnchor?.id === room.id;
                    return (
                      <li key={room.id}>
                        <button
                          type="button"
                          onClick={() => {
                            if (room.floor) setGpsFloor(room.floor);
                            setGpsAnchor({ id: room.id, name: room.name, coord: room.coordinates, room });
                          }}
                          className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[11px] font-semibold transition ${
                            selected
                              ? 'bg-[#0B2545] text-white'
                              : 'bg-[#E5EEF7] text-[#0B2545] hover:bg-[#D5E2EE]'
                          }`}
                        >
                          <MapPin className={`h-3.5 w-3.5 shrink-0 ${selected ? 'text-[#F3DE8A]' : 'text-[#C9A227]'}`} aria-hidden="true" />
                          <span className="min-w-0 flex-1 truncate">
                            {room.name}
                            {room.fullName && room.fullName !== room.name ? ` · ${room.fullName}` : ''}
                          </span>
                          <span className={`shrink-0 text-[10px] ${selected ? 'text-white/80' : 'text-[#607289]'}`}>
                            ~{Math.round(d)} m
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>

                {hasMoreRooms && (
                  <button
                    type="button"
                    onClick={() => setShowOtherRooms(true)}
                    className="mt-1.5 text-[10px] font-bold text-[#0B2545] underline"
                  >
                    Not near these? Show other rooms on {ordinal(gpsFloor)} floor
                  </button>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
