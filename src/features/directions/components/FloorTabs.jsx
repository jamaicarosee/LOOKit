import React from 'react';
import { FLOORS } from '../../navigation/constants';

// Floor selector for the route map; floors the route visits carry a gold dot
export default function FloorTabs({ activeFloor, routeFloors, onChange }) {
  return (
    <div role="tablist" aria-label="Map floor" className="flex gap-1 overflow-x-auto no-scrollbar py-0.5">
      {FLOORS.map((f) => {
        const active = f === activeFloor;
        const onRoute = routeFloors.includes(f);
        return (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={`Floor ${f}${onRoute ? ', on route' : ''}`}
            onClick={() => onChange(f)}
            className={`relative min-w-[32px] h-7 px-2 rounded-full text-[11px] font-bold transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B1E36] ${
              active ? 'bg-[#0B1E36] text-white' : 'bg-white/90 text-[#0B1E36] hover:bg-white'
            }`}
          >
            {f}F
            {onRoute && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#C9A227] border border-white" />}
          </button>
        );
      })}
    </div>
  );
}
