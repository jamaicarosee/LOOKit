import React from 'react';
<<<<<<< HEAD
import { Building2, DoorClosed, Car, Landmark, RefreshCw } from 'lucide-react';

const ICONS = { building: Building2, room: DoorClosed, parking: Car, gate: Landmark };

function secondary(loc) {
=======
import { Building2, DoorClosed, Car, Landmark, LocateFixed, RefreshCw } from 'lucide-react';

const ICONS = { building: Building2, room: DoorClosed, parking: Car, gate: Landmark, gps: LocateFixed };

function secondary(loc) {
  if (loc.type === 'gps') return 'Use your live GPS position';
>>>>>>> 73e09d3 (added skeletal loading and current location)
  if (loc.type === 'room') return `${loc.fullName && loc.fullName !== loc.name ? `${loc.fullName} · ` : ''}${loc.building || 'Campus'}, Floor ${loc.floor}`;
  if (loc.type === 'building') return loc.floors ? `${loc.floors} floor${loc.floors > 1 ? 's' : ''}` : 'Campus area';
  return loc.type === 'gate' ? 'Campus gate' : 'Parking area';
}

// Autocomplete list; rendered absolutely so it never shifts the layout below
export default function LocationSuggestions({ id, results, isLoading, error, onRetry, query, highlightedIndex, onPick, onHover }) {
<<<<<<< HEAD
=======
  // The "Popular" heading goes above the first real place, below the pinned Current Location row
  const firstPopular = results.findIndex((r) => r.type !== 'gps');
>>>>>>> 73e09d3 (added skeletal loading and current location)
  return (
    <div
      className="absolute left-0 right-0 top-full mt-1 z-40 rounded-2xl bg-white border border-gray-200 shadow-xl overflow-hidden"
      onMouseDown={(e) => e.preventDefault()}
    >
<<<<<<< HEAD
      {error ? (
=======
      {error && (
>>>>>>> 73e09d3 (added skeletal loading and current location)
        <div className="flex items-center justify-between gap-2 px-4 py-3 text-xs text-red-700 bg-red-50">
          <span>Couldn’t load campus locations.</span>
          <button
            type="button"
            onClick={onRetry}
<<<<<<< HEAD
            className="flex items-center gap-1 font-bold text-[#0B1E36] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B1E36] rounded"
=======
            className="flex items-center gap-1 font-bold text-[#0B2545] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B2545] rounded"
>>>>>>> 73e09d3 (added skeletal loading and current location)
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
<<<<<<< HEAD
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
=======
      )}
      {/* Current Location is pinned first and works even when the location search is down */}
      {(!error || results.some((r) => r.type === 'gps')) && (
        <ul id={id} role="listbox" aria-label="Location suggestions" className="max-h-[38dvh] overflow-y-auto no-scrollbar">
          {results.map((loc, i) => {
            const Icon = ICONS[loc.type] || Building2;
            return (
              <React.Fragment key={loc.id}>
                {!query && i === firstPopular && (
                  <li role="presentation" className="px-4 pt-2.5 pb-1 text-[10px] font-black uppercase tracking-widest text-[#607289]">
                    Popular
                  </li>
                )}
                <li
                  id={`${id}-opt-${i}`}
                  role="option"
                  aria-selected={i === highlightedIndex}
                  onClick={() => onPick(loc)}
                  onMouseEnter={() => onHover(i)}
                  className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer min-h-[44px] ${i === highlightedIndex ? 'bg-[#E5EEF7]' : 'bg-white'}`}
                >
                  <span className="w-8 h-8 rounded-full bg-[#0B2545] text-white flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 stroke-[2.2]" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-bold text-[#0B2545] truncate">{loc.name}</span>
                    <span className="block text-[10px] font-medium text-[#607289] truncate">{secondary(loc)}</span>
                  </span>
                </li>
              </React.Fragment>
>>>>>>> 73e09d3 (added skeletal loading and current location)
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
