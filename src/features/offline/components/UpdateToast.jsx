import React, { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { applyServiceWorkerUpdate, initServiceWorker } from '../services/swRegistration';

export default function UpdateToast() {
  const [needRefresh, setNeedRefresh] = useState(false);

  useEffect(() => {
    initServiceWorker({
      onNeedRefresh: () => setNeedRefresh(true),
    });
  }, []);

  if (!needRefresh) return null;

  return (
    <div
      role="alert"
      className="fixed bottom-4 right-4 z-[195] flex max-w-[340px] items-center gap-3 rounded-2xl bg-[#102747] px-4 py-3 text-white shadow-xl ring-1 ring-white/15"
    >
      <RefreshCw className="h-4 w-4 shrink-0 text-white" />
      <div className="flex-1 text-[12px] leading-snug">
        <p className="font-semibold">Update available</p>
        <p className="text-white/75">Refresh to load the latest version of LOOKit.</p>
      </div>
      <button
        type="button"
        onClick={applyServiceWorkerUpdate}
        className="rounded-lg bg-white px-3 py-1.5 text-[12px] font-bold text-[#102747] transition hover:bg-white/90"
      >
        Refresh
      </button>
      <button
        type="button"
        aria-label="Dismiss update notification"
        onClick={() => setNeedRefresh(false)}
        className="rounded-md p-1 text-white/70 transition hover:bg-white/10 hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}