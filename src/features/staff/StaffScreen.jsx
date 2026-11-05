import React, { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useViewport } from '../dashboard/hooks/useViewport';
import DesktopTopNav from '../dashboard/components/desktop/DesktopTopNav';
import MobileTopBar from '../dashboard/components/MobileTopBar';
import MobileBottomSheet from '../dashboard/components/MobileBottomSheet';
import StaffSearchBar from './components/StaffSearchBar';
import StaffMapPanel from './components/StaffMapPanel';
import StaffDirectoryDesktop from './StaffDirectoryDesktop';
import StaffDirectoryMobile from './StaffDirectoryMobile';
import useStaffLocation from './hooks/useStaffLocation';
<<<<<<< HEAD
<<<<<<< HEAD
=======
import useStaffData from './hooks/useStaffData';
>>>>>>> bc9a15c (admin dashboard improved interface)
=======
import useStaffData from './hooks/useStaffData';
>>>>>>> fb8d2b8 (updated admin dashboard)

/**
 * Staff Directory screen (only reachable when logged in; App.jsx checks the login).
 *  - Desktop: full-width list. Clicking a person splits the screen: list on the left, map on the right.
 *  - Mobile:  list. Clicking a person opens the map full-screen with a card at the bottom.
 * "Show path" hands the office to the existing Directions flow through `onShowPath`.
 */
export default function StaffScreen({ onBackToMap, onProfileClick, onShowPath }) {
  const { isDesktop } = useViewport(1024);
  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const location = useStaffLocation(selected);
<<<<<<< HEAD
<<<<<<< HEAD
=======
  const { staff } = useStaffData(); // Supabase, falls back to the built-in list
>>>>>>> bc9a15c (admin dashboard improved interface)
=======
  const { staff } = useStaffData(); // Supabase, falls back to the built-in list
>>>>>>> fb8d2b8 (updated admin dashboard)

  const closeSelection = () => setSelected(null);

  // Escape closes the map card
  useEffect(() => {
    if (!selected) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  // Only "map" needs handling here: the Staff button is already on this page
  const handleNav = (id) => {
    if (id === 'map') onBackToMap();
  };

  const mapPanel = selected && (
    <StaffMapPanel
      staff={selected}
      location={location}
      isDesktop={isDesktop}
      onClose={closeSelection}
      onShowPath={onShowPath}
    />
  );

  if (isDesktop) {
    return (
      <div className="w-screen h-[100dvh] bg-[#F8F9F9] flex flex-col overflow-hidden">
        <DesktopTopNav activeNav="staff" setActiveNav={handleNav} onProfileClick={onProfileClick} />
        <StaffSearchBar value={searchQuery} onChange={setSearchQuery} isDesktop />

        <div className="flex flex-1 min-h-0">
          <div
            className={`flex flex-col min-h-0 ${
              selected ? 'w-[44%] min-w-[380px] max-w-[640px] shrink-0 border-r border-slate-200' : 'flex-1'
            }`}
          >
            <StaffDirectoryDesktop
<<<<<<< HEAD
<<<<<<< HEAD
=======
              staff={staff}
>>>>>>> bc9a15c (admin dashboard improved interface)
=======
              staff={staff}
>>>>>>> fb8d2b8 (updated admin dashboard)
              searchQuery={searchQuery}
              onSelectStaff={setSelected}
              selectedId={selected?.id}
              split={Boolean(selected)}
            />
          </div>

          {selected && <div className="relative flex-1 min-w-0">{mapPanel}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-[100dvh] max-w-md mx-auto bg-white flex flex-col overflow-hidden shadow-2xl">
      <MobileTopBar onProfileClick={onProfileClick} />

      {selected ? (
        <>
          {/* Same look as the "Search" header: round arrow button + bold uppercase title */}
          <button
            type="button"
            onClick={closeSelection}
            aria-label="Back to staff list"
            className="flex items-center gap-3 px-5 pt-1 pb-3 bg-white shrink-0 text-left"
          >
            <span className="w-10 h-10 rounded-full bg-white border border-gray-200 text-[#0B1E36] flex items-center justify-center shadow-sm">
              <ArrowLeft className="w-5 h-5 stroke-[2.2]" />
            </span>
            <span className="text-lg font-black uppercase tracking-tight text-[#0B2545]">Back</span>
          </button>
          <div className="relative flex-1 min-h-0">{mapPanel}</div>
        </>
      ) : (
        <>
          <StaffSearchBar value={searchQuery} onChange={setSearchQuery} />
<<<<<<< HEAD
<<<<<<< HEAD
          <StaffDirectoryMobile searchQuery={searchQuery} onSelectStaff={setSelected} />
=======
          <StaffDirectoryMobile staff={staff} searchQuery={searchQuery} onSelectStaff={setSelected} />
>>>>>>> bc9a15c (admin dashboard improved interface)
=======
          <StaffDirectoryMobile staff={staff} searchQuery={searchQuery} onSelectStaff={setSelected} />
>>>>>>> fb8d2b8 (updated admin dashboard)
        </>
      )}

      <MobileBottomSheet activeNav="staff" onSelectNav={handleNav} />
    </div>
  );
}
