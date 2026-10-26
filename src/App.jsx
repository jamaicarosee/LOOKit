import React from 'react';
import DashboardMobileView from './features/dashboard/DashboardMobileView';

export default function App() {
  return (
    <main className="w-screen h-[100dvh] bg-slate-900 flex items-center justify-center overflow-hidden">
      <DashboardMobileView />
    </main>
  );
}