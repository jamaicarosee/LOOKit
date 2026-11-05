import React from 'react';
import { Building2, DoorClosed, Car, Landmark, RefreshCw } from 'lucide-react';

const ICONS = { building: Building2, room: DoorClosed, parking: Car, gate: Landmark };

function secondary(loc) {
  if (loc.type === 'room') return `${loc.fullName && loc.fullName !== loc.name ? `${loc.fullName} · ` : ''}${loc.building || 'Campus'}, Floor ${loc.floor}`;
  if (loc.type === 'building') return loc.floors ? `${loc.floors} floor${loc.floors > 1 ? 's' : ''}` : 'Campus area';
  return loc.type === 'gate' ? 'Campus gate' : 'Parking area';
}

// Autocomplete list; rendered absolutely so it never shifts the layout below
export default function LocationSuggestions({ id, results, isLoading, error, onRetry, query, highlightedIndex, onPick, onHover }) {
  return (
    <div
      className="absolute left-0 right-0 top-full mt-1 z-40 rounded-2xl bg-white border border-gray-200 shadow-xl overflow-hidden"
      onMouseDown={(e) => e.preventDefault()}
    >
      {error ? (
        <div className="flex items-center justify-between gap-2 px-4 py-3 text-xs text-red-700 bg-red-50">
          <span>Couldn’t load campus locations.</span>
          <button
            type="button"
            onClick={onRetry}
            className="flex items-center gap-1 font-bold text-[#0B1E36] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B1E36] rounded"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      ) : (
        <ul id={id} role="listbox" aria-label="Location suggestions" className="max-h-[38dvh] overflow-y-auto no-scrollbar">
          {!query && results.length > 0 && (
            <li role="presentation" className="px-4 pt-2.5 pb-1 text-[10px] font-black uppercase tracking-widest text-[#607289]">
              Popular
            </li>
          )}
          {results.map((loc, i) => {
            const Icon = ICONS[loc.type] || Building2;
            return (
              <li
                key={loc.id}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={i === highlightedIndex}
                onClick={() => onPick(loc)}
                onMouseEnter={() => onHover(i)}
                className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer min-h-[44px] ${i === highlightedIndex ? 'bg-[#E5EEF7]' : 'bg-white'}`}
              >
                <span className="w-8 h-8 rounded-full bg-[#0B1E36] text-white flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 stroke-[2.2]" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-bold text-[#0B2545] truncate">{loc.name}</span>
                  <span className="block text-[10px] font-medium text-[#607289] truncate">{secondary(loc)}</span>
                </span>
              </li>
            );
          })}
          {!results.length && !isLoading && query && (
            <li role="presentation" className="px-4 py-3 text-xs text-[#607289]">
              No results for ‘{query}’
            </li>
          )}
          {isLoading && !results.length && (
            <li role="presentation" className="px-4 py-3 text-xs text-[#607289]">Searching…</li>
          )}
        </ul>
      )}
    </div>
  );
}
