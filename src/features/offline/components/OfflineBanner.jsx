import React from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export default function OfflineBanner() {
  const { isOffline, justReconnected } = useOnlineStatus();

  if (!isOffline && !justReconnected) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-3 z-[190] flex justify-center px-3"
    >
      {isOffline ? (
        <div className="flex items-center gap-2 rounded-full bg-[#102747] px-4 py-2 text-[12px] font-medium text-white shadow-lg ring-1 ring-white/15">
          <WifiOff className="h-3.5 w-3.5 shrink-0 text-white" />
          <span>You are currently offline</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-[12px] font-medium text-white shadow-lg">
          <Wifi className="h-3.5 w-3.5 shrink-0 text-white" />
          <span>Back online</span>
        </div>
      )}
    </div>
  );
}