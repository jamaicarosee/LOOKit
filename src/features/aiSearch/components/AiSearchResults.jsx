import React from 'react';
import { Building2, Car, DoorClosed, Info, Landmark, RefreshCw, Sparkles, User, X } from 'lucide-react';

const LOCATION_ICONS = { building: Building2, room: DoorClosed, parking: Car, gate: Landmark };

// Where the place / person is, from catalog data only (never from model text)
function detailLine(match) {
  const item = match.item || {};
  if (match.category === 'staff') return [item.position, item.office].filter(Boolean).join(' · ');
  if (item.type === 'room') return `${item.building || 'Campus'}${item.floor ? `, Floor ${item.floor}` : ''}`;
  if (item.type === 'building') return 'Campus building';
  return item.type === 'gate' ? 'Campus gate' : 'Parking area';
}

function confidenceLabel(c) {
  if (c == null) return null;
  if (c >= 0.75) return 'Strong match';
  if (c >= 0.45) return 'Good match';
  return 'Possible match';
}

// Results of a Smart search. Rendered absolutely (like LocationSuggestions) so it never shifts the layout.
// `search` is the object returned by useAiSearch(); `onPick(match)` decides what a pick does on each screen.
export default function AiSearchResults({
  search,
  onPick,
  className = 'left-0 right-0 top-full mt-1',
  innerClassName = '',
}) {
  if (!search.open) return null;
  const { status, matches, notice, error } = search;

  return (
    <div className={`absolute z-40 ${className}`} onMouseDown={(e) => e.preventDefault()}>
      <div
        role="region"
        aria-label="Smart search results"
        aria-live="polite"
        className={`mx-auto w-full rounded-2xl bg-white border border-gray-200 shadow-xl overflow-hidden ${innerClassName}`}
      >
        <div className="flex items-center justify-between gap-2 px-4 pt-2.5 pb-1">
          <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#607289]">
            <Sparkles className="w-3.5 h-3.5 stroke-[2.2] text-[#A8830F]" /> Smart search
          </span>
          <button
            type="button"
            onClick={search.close}
            aria-label="Close smart search results"
            className="w-7 h-7 -mr-1.5 rounded-full flex items-center justify-center text-[#4A5568] active:scale-95 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B2545]"
          >
            <X className="w-4 h-4 stroke-[2.2]" />
          </button>
        </div>

        {status === 'loading' && <p className="px-4 py-3 text-xs text-[#607289]">Searching…</p>}

        {notice && (
          <p role="status" className="mx-3 mb-1 flex items-start gap-1.5 rounded-xl bg-[#FFF6DD] px-3 py-2 text-[11px] font-semibold text-[#7A5C00]">
            <Info className="w-3.5 h-3.5 mt-px shrink-0" /> {notice}
          </p>
        )}

        {status === 'error' && (
          <div role="alert" className="flex items-center justify-between gap-2 px-4 py-3 text-xs text-red-700 bg-red-50">
            <span>{error}</span>
            {search.query.length >= 3 && (
              <button
                type="button"
                onClick={search.retry}
                className="flex items-center gap-1 font-bold text-[#0B2545] shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B2545] rounded"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Retry
              </button>
            )}
          </div>
        )}

        {(status === 'ready' || status === 'rate_limited') && matches.length === 0 && (
          <p className="px-4 py-3 text-xs text-[#607289]">
            No matching places or staff for ‘{search.query}’. Try different words.
          </p>
        )}

        {matches.length > 0 && (
          <ul className="max-h-[42dvh] overflow-y-auto no-scrollbar">
            {matches.map((match) => {
              const Icon = match.category === 'staff' ? User : LOCATION_ICONS[match.item?.type] || Building2;
              const label = search.fallbackUsed ? null : confidenceLabel(match.confidence);
              return (
                <li key={match.id}>
                  <button
                    type="button"
                    onClick={() => onPick(match)}
                    className="w-full flex items-start gap-3 px-4 py-2.5 min-h-[44px] text-left bg-white hover:bg-[#E5EEF7] focus-visible:outline-none focus-visible:bg-[#E5EEF7]"
                  >
                    <span className="w-8 h-8 mt-0.5 rounded-full bg-[#0B2545] text-white flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 stroke-[2.2]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="block text-xs font-bold text-[#0B2545] truncate">{match.item?.name}</span>
                        {label && <span className="shrink-0 text-[10px] font-bold text-[#A8830F]">{label}</span>}
                      </span>
                      <span className="block text-[10px] font-medium text-[#607289] truncate">{detailLine(match)}</span>
                      <span className="block text-[11px] text-[#4A5568] leading-snug">{match.reason}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <p className="px-4 py-2 text-[10px] text-[#607289] border-t border-gray-100">
          Questions are processed by Google Gemini. Don’t include personal details.
        </p>
      </div>
    </div>
  );
}
