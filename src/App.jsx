import React from 'react';
import DashboardMobileView from './features/dashboard/DashboardMobileView';
import DashboardDesktopView from './features/dashboard/DashboardDesktopView';
import { useViewport } from './features/dashboard/hooks/useViewport';

export default function App() {
  const { isDesktop } = useViewport(1024);

  if (isDesktop) {
    return (
      <main className="w-screen h-[100dvh] bg-[#F8F9F9] overflow-hidden">
        <DashboardDesktopView />
      </main>
    );
  }

  return (
    <main className="w-screen h-[100dvh] bg-slate-900 flex items-center justify-center overflow-hidden">
      <DashboardMobileView />
    </main>
  );
}
