import React from 'react';
import { MapPin, Users, Info } from 'lucide-react';
import { useAdminNav } from '../../admin/AdminNavContext';
import { ADMIN_NAV_ITEM } from '../../admin/adminNavItem';

const NAV_ITEMS = [
  { id: 'map', label: 'Map', icon: MapPin },
  { id: 'staff', label: 'Staff', icon: Users },
  { id: 'about', label: 'About', icon: Info },
];

export default function AboutBottomNav({ activeNav = 'about', onSelectNav }) {
  const { openAdmin, isAdmin } = useAdminNav();
  const navItems = isAdmin ? [...NAV_ITEMS, ADMIN_NAV_ITEM] : NAV_ITEMS;
  return (
    <footer className="bg-white pt-3 pb-5 px-6 flex justify-center border-t border-gray-100 shrink-0">
      <nav className={`grid ${isAdmin ? 'grid-cols-4 gap-2.5' : 'grid-cols-3 gap-3.5'} w-full max-w-xs`}>
        {navItems.map(({ id, label, icon: Icon }) => {
          const isActive = activeNav === id;
          return (
            <button
              key={id}
              type="button"
              aria-current={isActive ? 'page' : undefined}
              onClick={() => (id === 'admin' ? openAdmin() : onSelectNav(id))}
              className={`flex flex-col items-center justify-center py-3 px-2 rounded-2xl transition-all active:scale-95 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#0B1E36] ${
                isActive ? 'bg-[#E5EEF7] text-[#0B1E36]' : 'bg-[#0B1E36] text-white hover:bg-[#152B47]'
              }`}
            >
              <Icon className="w-5 h-5 mb-1 stroke-[2.2]" />
              <span className="text-[11px] font-bold tracking-tight">{label}</span>
            </button>
          );
        })}
      </nav>
    </footer>
  );
}
