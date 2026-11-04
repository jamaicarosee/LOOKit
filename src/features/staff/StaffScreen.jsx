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
          <button
            type="button"
            onClick={closeSelection}
            className="flex items-center gap-2 px-5 py-2.5 bg-white text-sm font-bold text-[#0B1E36] border-b border-gray-100 shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to staff list
          </button>
          <div className="relative flex-1 min-h-0">{mapPanel}</div>
        </>
      ) : (
        <>
          <StaffSearchBar value={searchQuery} onChange={setSearchQuery} />
          <StaffDirectoryMobile searchQuery={searchQuery} onSelectStaff={setSelected} />
        </>
      )}

      <MobileBottomSheet activeNav="staff" onSelectNav={handleNav} />
    </div>
  );
}
