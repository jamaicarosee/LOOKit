import React from 'react';
import { Footprints } from 'lucide-react';

export default function RouteSummaryChip({ route }) {
  const min = Math.max(1, Math.round(route.durationSeconds / 60));
  const floors = route.floors.length > 1 ? ` · ${route.floors.length} floors` : '';
  return (
    <div className="absolute left-2 bottom-2 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/95 shadow text-[11px] font-bold text-[#0B1E36] pointer-events-none">
      <Footprints className="w-3.5 h-3.5 stroke-[2.2]" />
      {route.distanceMeters} m · {min} min{floors}
    </div>
  );
}
