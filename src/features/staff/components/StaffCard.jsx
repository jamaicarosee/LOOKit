import React from 'react';
import { MapPin } from 'lucide-react';
import { getInitials } from '../data/staffData';

export default function StaffCard({ staff, onSelect, selected = false }) {
  return (
    <button
      type="button"
      onClick={() => onSelect?.(staff)}
      aria-pressed={selected}
      className={`w-full flex items-center gap-4 bg-white rounded-xl shadow-md px-4 py-3 text-left hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-200 ${
        selected ? 'ring-2 ring-[#D4A017]' : ''
      }`}
    >
      {/* Initials avatar */}
      <div className="w-16 h-16 shrink-0 rounded-xl bg-[#0B1E36] text-white flex items-center justify-center text-xl font-extrabold tracking-wide">
        {getInitials(staff.name)}
      </div>

      {/* Details */}
      <div className="min-w-0">
        <p className="text-sm font-extrabold text-[#0B1E36] truncate">{staff.name}</p>
        {staff.position && (
          <p className="text-xs text-slate-400 truncate">{staff.position}</p>
        )}
        <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-500 truncate">
          <MapPin className="w-3 h-3 text-[#D4A017] shrink-0" />
          <span className="truncate">{staff.office}</span>
        </p>
      </div>
    </button>
  );
}
