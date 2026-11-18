import React, { useEffect, useRef, useState } from 'react';
import { LAUNCH_TIMING } from '../hooks/useLaunchSequence';

// Eyelids that blink over the two eyes in the logo PNG.
// Positions are in the cropped wordmark's pixel space (232x52): each eye is a ~37px circle.
// Lid color is the logo's own navy so a closed eye blends into the letter ring.
const EYE_LIDS = [
  { left: 33, top: 7.5 },
  { left: 79.5, top: 7.5 },
];
const EYE_LID_SIZE = 40;
const LOGO_NAVY = '#0B2545';

// Full-bleed launch splash: logo, app title and a subtle indeterminate loader.
// The logo PNG has transparent padding, so it is cropped to the wordmark (same idea as MobileTopBar).
export default function SplashScreen({ isLeaving = false }) {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const imgRef = useRef(null);

  // Covers a cached image whose load event fired before React attached onLoad
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) setImgLoaded(true);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading LOOKit"
      style={{ transitionDuration: `${LAUNCH_TIMING.splashFadeMs}ms` }}
      className={`fixed inset-0 z-[300] flex flex-col items-center justify-center bg-[#F8F9F9] px-6 select-none transition-opacity ease-out ${
        isLeaving ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div className="flex flex-col items-center animate-splash-in motion-reduce:animate-none">
        {/* LOOKIT LOGO */}
        <div className="relative h-[52px] w-[232px] overflow-hidden">
          {!imgError ? (
            <>
              <img
                ref={imgRef}
                src="/lookit_logo_mobile.png"
                alt="LOOKiT Logo"
                onLoad={() => setImgLoaded(true)}
                onError={() => setImgError(true)}
                className="absolute -left-[37px] -top-[130px] w-[316px] max-w-none pointer-events-none"
              />

              {/* Blinking eyelids: a navy lid slides down over each eye, then back up */}
              {imgLoaded &&
                EYE_LIDS.map(({ left, top }) => (
                  <span
                    key={left}
                    aria-hidden="true"
                    className="absolute overflow-hidden rounded-full pointer-events-none motion-reduce:hidden"
                    style={{ left, top, width: EYE_LID_SIZE, height: EYE_LID_SIZE }}
                  >
                    <span
                      className="block h-full w-full -translate-y-full animate-blink-lid"
                      style={{ backgroundColor: LOGO_NAVY, animationDelay: '350ms' }}
                    />
                  </span>
                ))}
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-4xl font-black tracking-tight text-[#0B1E36]">
              LOOKiT
            </div>
          )}
        </div>

        {/* App title (same type styles as the dashboard footer) */}
        <div className="text-center mt-6">
          <h1 className="text-lg font-black tracking-tight text-[#0B2545] leading-snug">
            Rizal Technological University
          </h1>
          <p className="text-[11px] font-bold tracking-widest text-[#0B2545] uppercase">
            PASIG CAMPUS
          </p>
        </div>

        {/* Subtle indeterminate loader */}
        <div className="relative mt-8 h-1 w-24 overflow-hidden rounded-full bg-[#E5EEF7]">
          <div className="absolute inset-y-0 left-0 w-2/5 rounded-full bg-[#0B1E36] animate-loading-slide motion-reduce:animate-none motion-reduce:w-full motion-reduce:opacity-30" />
        </div>
      </div>
    </div>
  );
}