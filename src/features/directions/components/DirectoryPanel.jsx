import React, { useEffect, useState } from 'react';
import { getBuildingDirectory, getDirectoryBuildings } from '../../navigation/services/locationService';

// "Directory" panel under the steps: rooms and offices of a building, grouped by floor
export default function DirectoryPanel({ destination, onPick }) {
  const [buildings, setBuildings] = useState([]);
  const [building, setBuilding] = useState(null);
  const [groups, setGroups] = useState([]);
  const [floor, setFloor] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    getDirectoryBuildings().then(setBuildings).catch(() => setFailed(true));
  }, []);

  // Follow the destination's building, otherwise the first one
  const destBuilding = destination?.building || null;
  const destFloor = destination?.floor || null;
  useEffect(() => {
    setBuilding(destBuilding && buildings.includes(destBuilding) ? destBuilding : buildings[0] || null);
  }, [destBuilding, buildings]);

  useEffect(() => {
    if (!building) return;
    getBuildingDirectory(building)
      .then((g) => {
        setGroups(g);
        const wanted = destBuilding === building ? destFloor : null;
        setFloor((cur) => (wanted && g.some((x) => x.floor === wanted) ? wanted : g.some((x) => x.floor === cur) ? cur : g[0]?.floor ?? null));
      })
      .catch(() => setFailed(true));
  }, [building, destBuilding, destFloor]);

  const rooms = groups.find((g) => g.floor === floor)?.rooms || [];
  const chip = (on) =>
    `shrink-0 h-8 px-3 rounded-full text-[11px] font-bold transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B1E36] ${on ? 'bg-[#0B1E36] text-white' : 'bg-white text-[#0B1E36]'}`;

  return (
    <section aria-label="Directory" className="rounded-xl bg-[#E5EBF5] p-3">
      <h3 className="text-sm font-black text-[#0B2545]">Directory</h3>
      <p className="text-[10px] font-medium text-[#607289] mb-2">Offices and rooms. Tap one to navigate there.</p>

      {failed && <p className="text-xs text-red-700 py-2">Couldn’t load the directory.</p>}

      {!failed && (
        <>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1.5" role="tablist" aria-label="Building">
            {buildings.map((b) => (
              <button key={b} type="button" role="tab" aria-selected={b === building} onClick={() => setBuilding(b)} className={chip(b === building)}>
                {b.replace(' Building', '')}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-2" role="tablist" aria-label="Floor">
            {groups.map((g) => (
              <button key={g.floor} type="button" role="tab" aria-selected={g.floor === floor} onClick={() => setFloor(g.floor)} className={chip(g.floor === floor)}>
                Floor {g.floor}
              </button>
            ))}
          </div>

          <ul className="max-h-[32dvh] overflow-y-auto no-scrollbar space-y-1.5">
            {rooms.map((r) => {
              const isDest = destination?.id === r.id;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => onPick(r)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left bg-white transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B1E36] ${isDest ? 'ring-2 ring-[#C9A227]' : ''}`}
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block text-xs font-bold text-[#0B2545] truncate">{r.name}</span>
                      <span className="block text-[10px] text-[#607289] truncate">
                        {r.fullName && r.fullName !== r.name ? r.fullName : r.category || 'Room'}
                      </span>
                    </span>
                    <span className="text-[10px] font-black text-white bg-[#0B1E36] rounded-full px-2.5 py-1 shrink-0">{isDest ? 'Here' : 'Go'}</span>
                  </button>
                </li>
              );
            })}
            {!rooms.length && buildings.length > 0 && <li className="text-xs text-[#607289] py-2">No rooms listed for this floor.</li>}
          </ul>
        </>
      )}
    </section>
  );
}
