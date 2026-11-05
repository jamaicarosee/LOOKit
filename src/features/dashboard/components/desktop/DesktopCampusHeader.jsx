import React from 'react';

export default function DesktopCampusHeader({ isHidden = false }) {
  return (
    <div
      className={`
        absolute top-5 left-1/2 -translate-x-1/2 z-20
        w-full max-w-3xl px-8 text-center
        bg-transparent select-none pointer-events-none
        transition-all duration-500 ease-in-out
        ${
          isHidden
            ? '-translate-y-12 opacity-0'
            : 'translate-y-0 opacity-100'
        }
      `}
    >
      <h1 className="text-3xl lg:text-4xl font-black text-[#0B1E36] tracking-tight drop-shadow-[0_2px_4px_rgba(248,249,249,0.95)]">
        Rizal Technological University
      </h1>
      <p className="text-lg lg:text-xl font-medium text-[#0B1E36] tracking-widest uppercase mt-1 drop-shadow-[0_1px_3px_rgba(248,249,249,0.95)]">
        PASIG CAMPUS
      </p>
    </div>
  );
}