import React from 'react';
import { useViewport } from '../dashboard/hooks/useViewport';
import MobileTopBar from '../dashboard/components/MobileTopBar';
import DesktopTopNav from '../dashboard/components/desktop/DesktopTopNav';
import AboutBottomNav from './components/AboutBottomNav';
import AboutIntroCard from './components/AboutIntroCard';
import KeyFeatures from './components/KeyFeatures';
import OtherInformation from './components/OtherInformation';
import AboutFooter from './components/AboutFooter';
import { useStaffNav } from '../staff/StaffNavContext';
<<<<<<< HEAD
=======
import useMinLoading from '../loading/hooks/useMinLoading';
import AboutContentSkeleton from '../loading/components/AboutContentSkeleton';
>>>>>>> 73e09d3 (added skeletal loading and current location)

// About screen. Desktop-first: two columns on wide screens, single column
// inside the phone frame (matches the Figma) on small screens.
export default function AboutPage({ onBackToMap, onProfileClick }) {
  const { isDesktop } = useViewport(1024);
  const { openStaff } = useStaffNav();
<<<<<<< HEAD
=======
  // The About content is static, so the skeleton just shows for the minimum time
  const loading = useMinLoading(false);
>>>>>>> 73e09d3 (added skeletal loading and current location)

  const handleNav = (id) => {
    if (id === 'map') onBackToMap();
    if (id === 'staff') openStaff();
    // 'about' is the current page
  };

  if (isDesktop) {
    return (
      <div className="w-screen h-[100dvh] bg-[#F8F9F9] flex flex-col overflow-hidden">
        <DesktopTopNav activeNav="about" setActiveNav={handleNav} onProfileClick={onProfileClick} />
        <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col">
          {/* Single centered column, stacked top to bottom */}
<<<<<<< HEAD
          <div className="w-full max-w-3xl mx-auto px-8 py-10 space-y-8">
            <AboutIntroCard />
            <KeyFeatures />
            <OtherInformation />
          </div>
          <div className="mt-auto pb-6"><AboutFooter /></div>
=======
          {loading ? (
            <div className="w-full max-w-3xl mx-auto px-8 py-10">
              <AboutContentSkeleton />
            </div>
          ) : (
            <>
              <div className="w-full max-w-3xl mx-auto px-8 py-10 space-y-8">
                <AboutIntroCard />
                <KeyFeatures />
                <OtherInformation />
              </div>
              <div className="mt-auto pb-6"><AboutFooter /></div>
            </>
          )}
>>>>>>> 73e09d3 (added skeletal loading and current location)
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-[100dvh] max-w-md mx-auto bg-white flex flex-col overflow-hidden shadow-2xl">
      <MobileTopBar onProfileClick={onProfileClick} />
      <div className="flex-1 overflow-y-auto no-scrollbar px-5 pt-2 pb-4 space-y-5">
<<<<<<< HEAD
        <AboutIntroCard />
        <KeyFeatures />
        <OtherInformation />
        <AboutFooter />
=======
        {loading ? (
          <AboutContentSkeleton />
        ) : (
          <>
            <AboutIntroCard />
            <KeyFeatures />
            <OtherInformation />
            <AboutFooter />
          </>
        )}
>>>>>>> 73e09d3 (added skeletal loading and current location)
      </div>
      <AboutBottomNav onSelectNav={handleNav} />
    </div>
  );
}
