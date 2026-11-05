import React from 'react';
import { BUILDING_FILTERS } from '../../hooks/useDashboardState';

export default function DesktopFilterRibbon({ activeFilter, setActiveFilter }) {
  return (
    <section className="w-full bg-[#0B1E36] py-3.5 px-8 shrink-0 select-none z-20">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
        {BUILDING_FILTERS.map((filter) => {
          const isActive = activeFilter === filter.id;
          const displayLabel =
            filter.id === 'all' ? filter.label : filter.label.toUpperCase();

          return (
            <button
              key={filter.id}
              type="button"
              onClick={() => setActiveFilter(filter.id)}
              className={`flex-1 py-2 px-4 rounded-xl text-sm font-extrabold tracking-wider transition-all duration-200 active:scale-95 ${
                isActive
                  ? 'bg-[#E5EEF7] text-[#0B1E36] shadow-sm'
                  : 'bg-[#3B4C63] text-white hover:bg-[#4A5E78]'
              }`}
            >
              {displayLabel}
            </button>
          );
        })}
      </div>
    </section>
  );
}