import React from 'react';
import { MapPin, Users, Info } from 'lucide-react';
import { useAboutNav } from '../../about/AboutNavContext';
import { useStaffNav } from '../../staff/StaffNavContext';
import { useAdminNav } from '../../admin/AdminNavContext';
import { ADMIN_NAV_ITEM } from '../../admin/adminNavItem';

const NAV_ITEMS = [
  { id: 'map', label: 'Map', icon: MapPin },
  { id: 'staff', label: 'Staff', icon: Users },
  { id: 'about', label: 'About', icon: Info },
];

export default function MobileBottomSheet({ activeNav, onSelectNav }) {
  const { openAbout } = useAboutNav();
  const { openStaff } = useStaffNav();
  const { openAdmin, isAdmin } = useAdminNav();
  const navItems = isAdmin ? [...NAV_ITEMS, ADMIN_NAV_ITEM] : NAV_ITEMS;
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
      <nav className={`grid ${isAdmin ? 'grid-cols-4 gap-2.5' : 'grid-cols-3 gap-3.5'} w-full max-w-xs`}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeNav === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.id === 'about') openAbout();
                else if (item.id === 'staff') openStaff();
                else if (item.id === 'admin') openAdmin();
                else onSelectNav(item.id);
              }}
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