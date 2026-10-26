import React from 'react';
import { MapPin, Users, LogOut } from 'lucide-react';

const NAV_ITEMS = [
  { id: 'map', label: 'Map', icon: MapPin },
  { id: 'staff', label: 'Staff', icon: Users },
  { id: 'signout', label: 'Sign Out', icon: LogOut },
];

export default function MobileBottomSheet({ activeNav, onSelectNav }) {
  return (
    <footer className="bg-white pt-4 pb-5 px-6 flex flex-col items-center justify-between border-t border-gray-100 shrink-0">
      {/* University Name */}
      <div className="text-center mb-4">
        <h1 className="text-lg font-black tracking-tight text-[#0B2545] leading-snug">
          Rizal Technological University
        </h1>
        <p className="text-[11px] font-bold tracking-widest text-[#1D3557] uppercase">
          PASIG CAMPUS
        </p>
      </div>

      {/* 3 Bottom Action Pill Buttons */}
      <nav className="grid grid-cols-3 gap-3.5 w-full max-w-xs">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeNav === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectNav(item.id)}
              className={`flex flex-col items-center justify-center py-3 px-2 rounded-2xl transition-all active:scale-95 shadow-sm ${
                isActive
                  ? 'bg-[#E5EEF7] text-[#0B1E36]'
                  : 'bg-[#0B1E36] text-white hover:bg-[#152B47]'
              }`}
            >
              <Icon className="w-5 h-5 mb-1 stroke-[2.2]" />
              <span className="text-[11px] font-bold tracking-tight">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </footer>
  );
}