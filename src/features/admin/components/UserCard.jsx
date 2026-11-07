import React from 'react';
import { getInitials } from '../../staff/data/staffData';
import StatusPill from './StatusPill';

// User card for the Users tab. Same look as StaffCard (white card, navy avatar, gold selection ring).
export default function UserCard({ user, onSelect, selected = false }) {
  const name = user.full_name || user.email;
  return (
    <button
      type="button"
      onClick={() => onSelect?.(user)}
      aria-pressed={selected}
      className={`w-full flex items-center gap-4 bg-white rounded-xl shadow-md px-4 py-3 text-left hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-200 ${
        selected ? 'ring-2 ring-[#D4A017]' : ''
      } ${user.is_active ? '' : 'opacity-70'}`}
    >
      <div className="w-12 h-12 shrink-0 rounded-xl bg-[#0B1E36] text-white flex items-center justify-center text-lg font-extrabold tracking-wide">
        {getInitials(name)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-extrabold text-[#0B1E36] truncate">{name}</p>
        <p className="text-xs text-slate-400 truncate">{user.email}</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          <StatusPill tone="info">{user.role}</StatusPill>
          <StatusPill tone={user.is_active ? 'success' : 'muted'}>{user.is_active ? 'Active' : 'Inactive'}</StatusPill>
        </div>
      </div>
    </button>
  );
}
