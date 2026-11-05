import React, { useState } from 'react';
<<<<<<< HEAD
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { useViewport } from '../dashboard/hooks/useViewport';
import { useAuth } from '../login/context/AuthContext';
=======
import { ArrowLeft } from 'lucide-react';
import { useViewport } from '../dashboard/hooks/useViewport';
import DesktopTopNav from '../dashboard/components/desktop/DesktopTopNav';
import MobileTopBar from '../dashboard/components/MobileTopBar';
import MobileBottomSheet from '../dashboard/components/MobileBottomSheet';
>>>>>>> bc9a15c (admin dashboard improved interface)
import { ADMIN_SECTIONS } from './adminSections';
import Overview from './sections/Overview';
import MapEditor from './sections/MapEditor';
import Users from './sections/Users';
import Staff from './sections/Staff';
import AuditLog from './sections/AuditLog';

const VIEWS = { overview: Overview, map: MapEditor, users: Users, staff: Staff, audit: AuditLog };

<<<<<<< HEAD
// Admin dashboard shell. Desktop: sidebar + content. Phone: top bar + scrollable tabs
// inside the same max-w-md column as the other screens.
// App.jsx only renders this for admins; the backend still checks the role on every call.
export default function AdminScreen({ onBackToMap }) {
  const { isDesktop } = useViewport(1024);
  const { profile, user } = useAuth();
  const [section, setSection] = useState('overview');

  const View = VIEWS[section];
  const current = ADMIN_SECTIONS.find((s) => s.id === section);
  const email = profile?.email || user?.email || '';

  if (isDesktop) {
    return (
      <div className="w-screen h-[100dvh] bg-[#F8F9F9] flex overflow-hidden">
        <aside className="w-64 shrink-0 bg-[#0B1E36] text-white flex flex-col">
          <div className="h-20 px-6 flex items-center gap-3 border-b border-white/10">
            <span className="w-10 h-10 rounded-xl bg-[#E5EEF7] text-[#0B1E36] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <div className="leading-tight">
              <p className="text-base font-black tracking-tight">LOOKit</p>
              <p className="text-[11px] font-bold uppercase tracking-widest text-white/70">Admin</p>
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto no-scrollbar" aria-label="Admin sections">
            {ADMIN_SECTIONS.map(({ id, label, icon: Icon }) => {
              const active = id === section;
              return (
                <button
                  key={id}
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setSection(id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
                    active ? 'bg-[#E5EEF7] text-[#0B1E36]' : 'text-white/85 hover:bg-white/10'
                  }`}
                >
                  <Icon className="w-5 h-5 stroke-[2]" />
                  {label}
                </button>
              );
            })}
          </nav>

          <div className="p-4 border-t border-white/10 space-y-3">
            {email && <p className="px-1 text-xs text-white/60 truncate" title={email}>{email}</p>}
            <button
              type="button"
              onClick={onBackToMap}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-semibold transition"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to map
            </button>
          </div>
        </aside>

        <main className="flex-1 min-w-0 flex flex-col">
          <header className="h-20 shrink-0 px-8 flex items-center bg-white border-b border-slate-200">
            <h1 className="text-xl font-black tracking-tight text-[#0B1E36]">{current.label}</h1>
          </header>
          <div className="flex-1 min-h-0 overflow-y-auto p-8">
            <View />
          </div>
        </main>
=======
// Admin dashboard. Same top navigation as the Staff page, then the back button + "Admin" title,
// then the tab band (Map, Directory, then the rest). Phone: top bar, scrollable tabs and the bottom nav.
// App.jsx only renders this for admins; Supabase policies still decide who can write.
export default function AdminScreen({ onBackToMap, onProfileClick }) {
  const { isDesktop } = useViewport(1024);
  const [section, setSection] = useState('map');

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
            <View isDesktop />
          </div>
        </div>
>>>>>>> bc9a15c (admin dashboard improved interface)
      </div>
    );
  }

  return (
<<<<<<< HEAD
    <div className="w-full h-[100dvh] max-w-md mx-auto bg-[#F8F9F9] flex flex-col overflow-hidden shadow-2xl">
      <header className="bg-[#0B1E36] text-white px-4 h-16 flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={onBackToMap}
          aria-label="Back to map"
          className="w-10 h-10 rounded-full bg-[#E5EEF7] text-[#0B1E36] flex items-center justify-center active:scale-95 transition"
        >
          <ArrowLeft className="w-5 h-5 stroke-[2.2]" />
        </button>
        <div className="leading-tight">
          <p className="text-base font-black tracking-tight">LOOKit Admin</p>
          {email && <p className="text-[11px] text-white/60 truncate max-w-[220px]">{email}</p>}
        </div>
      </header>

      <nav className="bg-white border-b border-slate-200 flex overflow-x-auto no-scrollbar shrink-0" aria-label="Admin sections">
        {ADMIN_SECTIONS.map(({ id, label, icon: Icon }) => {
          const active = id === section;
          return (
            <button
              key={id}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => setSection(id)}
              className={`flex-1 min-w-[84px] flex flex-col items-center gap-1 px-3 py-2.5 text-[11px] font-bold border-b-2 transition ${
                active ? 'border-[#0B1E36] text-[#0B1E36]' : 'border-transparent text-slate-500'
              }`}
            >
              <Icon className="w-5 h-5 stroke-[2]" />
              {label}
            </button>
          );
        })}
      </nav>

      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        <h1 className="sr-only">{current.label}</h1>
        <View />
      </div>
=======
    <div className="w-full h-[100dvh] max-w-md mx-auto bg-white flex flex-col overflow-hidden shadow-2xl">
      <MobileTopBar onProfileClick={onProfileClick} />
      <div className="flex items-center gap-3 px-5 pt-1 pb-3 shrink-0">
        {backButton}
        <h1 className="text-lg font-black uppercase tracking-tight text-[#0B2545]">Admin</h1>
      </div>
      <div className="bg-[#0B1E36] px-4 py-2.5 shrink-0 shadow-sm">{renderTabs(false)}</div>
      <div className="flex-1 min-h-0 overflow-y-auto bg-[#F8F9F9] px-5 py-5">
        <View isDesktop={false} />
      </div>
      <MobileBottomSheet activeNav="admin" onSelectNav={handleNav} />
>>>>>>> bc9a15c (admin dashboard improved interface)
    </div>
  );
}
