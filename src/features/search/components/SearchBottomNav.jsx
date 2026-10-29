import React from 'react';
import { MapPin, Users, LogOut } from 'lucide-react';

const NAV_ITEMS = [
  { id: 'map', label: 'Map', icon: MapPin },
  { id: 'staff', label: 'Staff', icon: Users },
  { id: 'signout', label: 'Sign Out', icon: LogOut },
];

// Same look as the dashboard dock but without the university title block
export default function SearchBottomNav({ onSelectNav }) {
  return (
    <footer className="bg-white pt-3 pb-5 px-6 flex justify-center border-t border-gray-100 shrink-0">
      <nav className="grid grid-cols-3 gap-3.5 w-full max-w-xs">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectNav(item.id)}
              className="flex flex-col items-center justify-center py-3 px-2 rounded-2xl bg-[#0B1E36] text-white hover:bg-[#152B47] transition-all active:scale-95 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#0B1E36]"
            >
              <Icon className="w-5 h-5 mb-1 stroke-[2.2]" />
              <span className="text-[11px] font-bold tracking-tight">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </footer>
  );
}
