import React from 'react';
import SplashScreen from './components/SplashScreen';
import DashboardMobileSkeleton from './components/DashboardMobileSkeleton';
import DashboardDesktopSkeleton from './components/DashboardDesktopSkeleton';
import { LAUNCH_TIMING } from './hooks/useLaunchSequence';

// Sits on top of the (already mounted) dashboard so Mapbox initialises underneath at full size.
//   splash        -> logo splash, opaque
//   splash-out    -> splash fades away, revealing the skeleton that was already waiting beneath it
//   skeleton      -> shimmering placeholders while the map + routing graph load
//   skeleton-out  -> skeleton fades, revealing the live map (pointer events already pass through)
export default function LaunchOverlay({ phase, isDesktop, isAdmin = false }) {
  if (phase === 'done') return null;

  const showSplash = phase === 'splash' || phase === 'splash-out';
  const skeletonVisible = phase === 'skeleton' || phase === 'skeleton-out';
  const skeletonLeaving = phase === 'skeleton-out';

  return (
    <>
      <div
        role={skeletonVisible ? 'status' : undefined}
        aria-label={skeletonVisible ? 'Loading campus map' : undefined}
        aria-hidden={!skeletonVisible}
        style={{ transitionDuration: `${LAUNCH_TIMING.skeletonFadeMs}ms` }}
        className={`fixed inset-0 z-[150] transition-opacity ease-out ${
          isDesktop ? 'bg-[#F8F9F9]' : 'bg-slate-900 flex items-center justify-center'
        } ${skeletonLeaving ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      >
        {isDesktop ? (
          <DashboardDesktopSkeleton />
        ) : (
          <DashboardMobileSkeleton />
        )}
      </div>

      {showSplash && <SplashScreen isLeaving={phase === 'splash-out'} />}
    </>
  );
}
