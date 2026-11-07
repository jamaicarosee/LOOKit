import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useViewport } from '../dashboard/hooks/useViewport';
import DesktopTopNav from '../dashboard/components/desktop/DesktopTopNav';
import MobileTopBar from '../dashboard/components/MobileTopBar';
import MobileBottomSheet from '../dashboard/components/MobileBottomSheet';
import { ADMIN_SECTIONS } from './adminSections';
import Overview from './sections/Overview';
import MapEditor from './sections/MapEditor';
import Users from './sections/Users';
import Staff from './sections/Staff';
import AuditLog from './sections/AuditLog';

const VIEWS = { overview: Overview, map: MapEditor, users: Users, staff: Staff, audit: AuditLog };


// Admin dashboard. Same top navigation as the Staff page, then the back button + "Admin" title,
<<<<<<< HEAD
// then the tab band (Map, Directory, then the rest). Phone: top bar, scrollable tabs and the bottom nav.
// App.jsx only renders this for admins; Supabase policies still decide who can write.
export default function AdminScreen({ onBackToMap, onProfileClick }) {
  const { isDesktop } = useViewport(1024);
  const [section, setSection] = useState('map');
=======
// then the tab band (Overview, Map, Directory, Users, Audit Log). Phone: top bar, scrollable tabs and the bottom nav.
// App.jsx only renders this for admins; Supabase policies still decide who can write.
export default function AdminScreen({ onBackToMap, onProfileClick }) {
  const { isDesktop } = useViewport(1024);
  const [section, setSection] = useState('overview');
>>>>>>> d6a3a47 (updated user, overview, audit logs)

  const View = VIEWS[section];

  // Only "map" needs handling here: the Admin button is already on this page
  const handleNav = (id) => {
    if (id === 'map') onBackToMap();
  };

  const backButton = (
    <button
      type="button"
      onClick={onBackToMap}
      aria-label="Back to map"
      className="w-10 h-10 shrink-0 rounded-full bg-white border border-gray-200 text-[#0B1E36] flex items-center justify-center shadow-sm active:scale-95 transition"
    >
      <ArrowLeft className="w-5 h-5 stroke-[2.2]" />
    </button>
  );

  // Same look as the home dashboard's building filters (All / M.A.E / CED ...):
  // a navy band with pill buttons, light-blue for the active one.
  const renderTabs = (desktop) => (
    <nav
      aria-label="Admin sections"
      className={
        desktop
          ? 'max-w-6xl mx-auto flex items-center justify-between gap-4'
          : 'flex items-center gap-2 overflow-x-auto no-scrollbar'
      }
    >
      {ADMIN_SECTIONS.map(({ id, label }) => {
        const active = id === section;
        const style = desktop
          ? `flex-1 py-2 px-4 rounded-xl text-sm font-extrabold tracking-wider uppercase transition-all duration-200 active:scale-95 ${
              active ? 'bg-[#E5EEF7] text-[#0B1E36] shadow-sm' : 'bg-[#3B4C63] text-white hover:bg-[#4A5E78]'
            }`
          : `px-4 py-1 rounded-full text-[11px] font-bold tracking-wide shrink-0 transition-all border ${
              active
                ? 'bg-[#E5EEF7] text-[#0B1E36] border-[#E5EEF7] shadow-sm'
                : 'bg-[#2E4259] text-white border-white/10 hover:bg-[#3B536E]'
            }`;
        return (
          <button
            key={id}
            type="button"
            aria-current={active ? 'page' : undefined}
            onClick={() => setSection(id)}
            className={style}
          >
            {label}
          </button>
        );
      })}
    </nav>
  );

  if (isDesktop) {
    return (
      <div className="w-screen h-[100dvh] bg-white flex flex-col overflow-hidden">
        <DesktopTopNav activeNav="admin" setActiveNav={handleNav} onProfileClick={onProfileClick} />
        <div className="shrink-0 bg-white px-8 lg:px-16 py-4">
          <div className="max-w-6xl mx-auto flex items-center gap-4">
            {backButton}
            <h1 className="text-2xl font-black uppercase tracking-tight text-[#0B1E36]">Admin</h1>
          </div>
        </div>
        <section className="w-full bg-[#0B1E36] py-3.5 px-8 shrink-0 select-none z-20">{renderTabs(true)}</section>
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-8 lg:px-16 py-6">
<<<<<<< HEAD
            <View isDesktop />
=======
            <View isDesktop onNavigate={setSection} />
>>>>>>> d6a3a47 (updated user, overview, audit logs)
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-[100dvh] max-w-md mx-auto bg-white flex flex-col overflow-hidden shadow-2xl">
      <MobileTopBar onProfileClick={onProfileClick} />
      <div className="flex items-center gap-3 px-5 pt-1 pb-3 shrink-0">
        {backButton}
        <h1 className="text-lg font-black uppercase tracking-tight text-[#0B2545]">Admin</h1>
      </div>
      <div className="bg-[#0B1E36] px-4 py-2.5 shrink-0 shadow-sm">{renderTabs(false)}</div>
      <div className="flex-1 min-h-0 overflow-y-auto bg-[#F8F9F9] px-5 py-5">
<<<<<<< HEAD
        <View isDesktop={false} />
=======
        <View isDesktop={false} onNavigate={setSection} />
>>>>>>> d6a3a47 (updated user, overview, audit logs)
      </div>
      <MobileBottomSheet activeNav="admin" onSelectNav={handleNav} />
    </div>
  );
}
