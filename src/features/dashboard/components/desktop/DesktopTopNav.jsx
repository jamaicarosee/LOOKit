import React from 'react';
import { MapPin, Users, LogOut, User } from 'lucide-react';

const NAV_ITEMS = [
  { id: 'map', label: 'Map', icon: MapPin },
  { id: 'staff', label: 'Staff', icon: Users },
  { id: 'signout', label: 'Sign Out', icon: LogOut },
];

export default function DesktopTopNav({ activeNav, setActiveNav }) {
  return (
    <header className="w-full h-20 bg-[#0B1E36] px-8 flex items-center justify-between shrink-0 select-none z-20">
      {/* Left: Clipped Brand Logo */}
      <div className="h-12 w-40 overflow-hidden flex items-center justify-start">
        <img
          src="/lookit_logo_desktop.png"
          alt="LOOKit Logo"
          className="w-40 max-w-none object-cover object-center pointer-events-none"
        />
      </div>

      {/* Center: Navigation Action Tabs */}
      <nav className="flex items-center gap-12 lg:gap-16">
        {NAV_ITEMS.map((item) => {
          const IconComponent = item.icon;
          const isActive = activeNav === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveNav(item.id)}
              className={`flex flex-col items-center justify-center transition-all duration-200 ${
                isActive
                  ? 'bg-[#E5EEF7] text-[#0B1E36] px-9 py-1.5 rounded-2xl shadow-sm font-semibold'
                  : 'text-white/90 hover:text-white px-4 py-1.5 font-medium'
              }`}
            >
              <IconComponent className="w-5 h-5 stroke-[2]" />
              <span className="text-xs mt-0.5 tracking-wide">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Right: User Profile Pill Button */}
      <button
        type="button"
        aria-label="User Profile"
        className="w-14 h-11 rounded-full bg-[#E5EEF7] text-[#0B1E36] flex items-center justify-center shadow-sm hover:bg-[#D5E2EE] active:scale-95 transition"
      >
        <User className="w-5 h-5 stroke-[2]" />
      </button>
    </header>
  );
}