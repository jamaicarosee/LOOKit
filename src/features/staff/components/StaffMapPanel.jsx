import React from 'react';
import { X, MapPin, Info } from 'lucide-react';
import CampusMapPreview from '../../dashboard/components/CampusMapPreview';
import { getInitials } from '../data/staffData';

const NOT_EXACT_NOTE = {
  college: "This person's own office isn't on the map yet, so the college main office is shown.",
  building: "This person's own office isn't on the map yet, so the building is shown.",
};

function placeText(loc) {
  if (!loc) return '';
  if (loc.type === 'room') {
    const floor = loc.floor ? ` · Floor ${loc.floor}` : '';
    return `${loc.building}${floor}`;
  }
  return loc.fullName || loc.name;
}

/**
 * Campus map with the selected staff member's building highlighted,
 * plus a card showing where the office is and a "Show path" button.
 */
export default function StaffMapPanel({ staff, location, isDesktop, onClose, onShowPath }) {
  const isReady = location.status === 'ready' && location.result?.loc;
  const result = location.result;
  const roomName = result?.loc?.type === 'room' ? result.loc.fullName || result.loc.name : null;

  return (
    <div className="absolute inset-0 bg-[#F8F9F9]">
      {/* Map: the building the staff member is in is highlighted, the rest is dimmed */}
      <div className="absolute inset-0">
        <CampusMapPreview activeFilter={result?.filterId || 'all'} isDesktop={isDesktop} />
      </div>

      {/* Staff + location card */}
      <div
        className={`absolute z-40 bg-white rounded-2xl shadow-xl p-4 ${
          isDesktop ? 'left-6 bottom-6 w-full max-w-sm' : 'inset-x-3 bottom-3'
        }`}
      >
        <div className="flex items-start gap-3">
<<<<<<< HEAD
          <div className="w-12 h-12 shrink-0 rounded-xl bg-[#0B1E36] text-white flex items-center justify-center text-base font-extrabold">
            {getInitials(staff.name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold text-[#0B1E36] leading-snug">{staff.name}</p>
=======
          <div className="w-12 h-12 shrink-0 rounded-xl bg-[#0B2545] text-white flex items-center justify-center text-base font-extrabold">
            {getInitials(staff.name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold text-[#0B2545] leading-snug">{staff.name}</p>
>>>>>>> 73e09d3 (added skeletal loading and current location)
            {staff.position && <p className="text-xs text-slate-500">{staff.position}</p>}
            <p className="text-[11px] text-slate-400">{staff.office}</p>
          </div>
          <button
            type="button"
            aria-label="Close map"
            onClick={onClose}
<<<<<<< HEAD
            className="p-1 -mr-1 -mt-1 text-slate-400 hover:text-[#0B1E36] transition"
=======
            className="p-1 -mr-1 -mt-1 text-slate-400 hover:text-[#0B2545] transition"
>>>>>>> 73e09d3 (added skeletal loading and current location)
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-3 flex items-start gap-2 rounded-xl bg-[#E5EEF7] px-3 py-2.5">
          <MapPin className="w-4 h-4 mt-0.5 text-[#D4A017] shrink-0" />
<<<<<<< HEAD
          <div className="min-w-0 text-xs text-[#0B1E36]">
=======
          <div className="min-w-0 text-xs text-[#0B2545]">
>>>>>>> 73e09d3 (added skeletal loading and current location)
            {location.status === 'loading' && <p className="font-semibold">Finding location…</p>}
            {location.status === 'error' && (
              <p className="font-semibold">Couldn't load the campus map data. Try again.</p>
            )}
            {isReady && (
              <>
                <p className="font-bold">{placeText(result.loc)}</p>
                {roomName && <p className="text-slate-600">{roomName}</p>}
              </>
            )}
          </div>
        </div>

        {isReady && !result.exact && (
          <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-snug text-slate-500">
            <Info className="w-3.5 h-3.5 mt-px shrink-0" />
            {NOT_EXACT_NOTE[result.kind]}
          </p>
        )}

        <button
          type="button"
          disabled={!isReady}
          onClick={() => onShowPath(result.loc)}
<<<<<<< HEAD
          className="mt-3 w-full flex items-center justify-center rounded-xl bg-[#0B1E36] py-3 text-sm font-bold text-white transition hover:bg-[#152B47] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
=======
          className="mt-3 w-full flex items-center justify-center rounded-xl bg-[#0B2545] py-3 text-sm font-bold text-white transition hover:bg-[#141070] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
>>>>>>> 73e09d3 (added skeletal loading and current location)
        >
          Show path
        </button>
      </div>
    </div>
  );
}
