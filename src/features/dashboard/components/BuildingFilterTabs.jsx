import React from 'react';
import { BUILDING_FILTERS } from '../hooks/useDashboardState';

export default function BuildingFilterTabs({ activeFilter, onSelectFilter }) {
  return (
    <div className="bg-[#0B1E36] px-4 py-2.5 shrink-0 shadow-sm">
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
        {BUILDING_FILTERS.map((item) => {
          const isActive = activeFilter === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectFilter(item.id)}
              className={`px-4 py-1 rounded-full text-[11px] font-bold tracking-wide shrink-0 transition-all border ${
                isActive
                  ? 'bg-[#E5EEF7] text-[#0B1E36] border-[#E5EEF7] shadow-sm'
                  : 'bg-[#2E4259] text-white border-white/10 hover:bg-[#3B536E]'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}