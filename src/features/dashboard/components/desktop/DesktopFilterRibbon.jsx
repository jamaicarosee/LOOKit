import React from 'react';
import { BUILDING_FILTERS } from '../../hooks/useDashboardState';

export default function DesktopFilterRibbon({ activeFilter, setActiveFilter }) {
  return (
    <section className="w-full bg-white border-b border-slate-200 py-2 px-8 shrink-0 select-none z-20">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
        {BUILDING_FILTERS.map((filter) => {
          const isActive = activeFilter === filter.id;
          const displayLabel =
            filter.id === 'all' ? filter.label : filter.label.toUpperCase();

          return (
            <button
              key={filter.id}
              type="button"
              onClick={() => setActiveFilter(filter.id)}
              className={`flex-1 py-1.5 px-4 rounded-xl text-xs font-extrabold tracking-wider transition-all duration-200 active:scale-95 ${
                isActive
                  ? 'bg-[#0B2545] text-white shadow-sm'
                  : 'bg-[#E5EEF7] text-[#0B2545] hover:bg-[#D5E3F0]'
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
