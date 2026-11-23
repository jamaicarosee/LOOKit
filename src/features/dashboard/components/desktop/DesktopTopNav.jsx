import React, { useEffect, useState } from 'react';
import { MapPin, Users, Info, User } from 'lucide-react';
import { useAboutNav } from '../../../about/AboutNavContext';
import { useStaffNav } from '../../../staff/StaffNavContext';
import { useAdminNav } from '../../../admin/AdminNavContext';
import { useAuth } from '../../../login/context/AuthContext';
import { ADMIN_NAV_ITEM } from '../../../admin/adminNavItem';
import { DesktopNavTabsSkeleton } from '../../../loading/components/NavSkeletons';
import useNavLoading from '../../../loading/hooks/useNavLoading';

const NAV_ITEMS = [
  { id: 'map', label: 'Map', icon: MapPin },
  { id: 'staff', label: 'Staff', icon: Users },
  { id: 'about', label: 'About', icon: Info },
];

export default function DesktopTopNav({ activeNav, setActiveNav, onProfileClick }) {
  const { openAbout } = useAboutNav();
  const { openStaff } = useStaffNav();
  const { openAdmin, isAdmin, authLoading } = useAdminNav();
  const { user, profile } = useAuth();
  const navLoading = useNavLoading(authLoading);
  const navItems = isAdmin ? [...NAV_ITEMS, ADMIN_NAV_ITEM] : NAV_ITEMS;

  const [avatarError, setAvatarError] = useState(false);

  const metadata = user?.user_metadata || {};
  const displayName =
    profile?.full_name ||
    metadata.full_name ||
    metadata.name ||
    user?.full_name ||
    user?.name ||
    'LOOKit User';
  const profilePicture =
    profile?.avatar_url ||
    metadata.avatar_url ||
    metadata.picture ||
    '';

  useEffect(() => {
    setAvatarError(false);
  }, [profilePicture]);

  return (
    <header className="w-full h-20 bg-[#0B2545] px-8 flex items-center justify-between shrink-0 select-none z-20">
      {/* Left: Clipped Brand Logo */}
      <div className="h-12 w-40 overflow-hidden flex items-center justify-start">
        <img
          src="/lookit_logo_desktop.png"
          alt="LOOKit Logo"
          className="w-40 max-w-none object-cover object-center pointer-events-none"
        />
      </div>

      {/* Center: Navigation Action Tabs */}
      {navLoading ? (
        <DesktopNavTabsSkeleton activeIndex={navItems.findIndex((i) => i.id === activeNav)} />
      ) : (
      <nav className={`flex items-center ${isAdmin ? 'gap-8 lg:gap-12' : 'gap-12 lg:gap-16'}`}>
        {navItems.map((item) => {
          const IconComponent = item.icon;
          const isActive = activeNav === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.id === 'about') openAbout();
                else if (item.id === 'staff') openStaff();
                else if (item.id === 'admin') openAdmin();
                else setActiveNav(item.id);
              }}
              className={`flex flex-col items-center justify-center transition-all duration-200 ${
                isActive
                  ? 'bg-[#E5EEF7] text-[#0B2545] px-9 py-1.5 rounded-2xl shadow-sm font-semibold'
                  : 'text-white/90 hover:text-white px-4 py-1.5 font-medium'
              }`}
            >
              <IconComponent className="w-5 h-5 stroke-[2]" />
              <span className="text-xs mt-0.5 tracking-wide">{item.label}</span>
            </button>
          );
        })}
      </nav>
      )}

      {/* Right: User Profile Pill Button */}
      <button
        type="button"
        aria-label="User Profile"
        onClick={onProfileClick}
        className="w-11 h-11 rounded-full bg-[#E5EEF7] text-[#0B2545] flex items-center justify-center overflow-hidden shadow-sm hover:bg-[#D5E2EE] active:scale-95 transition"
      >
        {profilePicture && !avatarError ? (
          <img
            src={profilePicture}
            alt={`${displayName}'s profile`}
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
            onError={() => setAvatarError(true)}
          />
        ) : (
          <User className="w-5 h-5 stroke-[2]" />
        )}
      </button>
    </header>
  );
}