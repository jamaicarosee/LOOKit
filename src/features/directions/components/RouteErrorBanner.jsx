import React from 'react';
import { TriangleAlert, WifiOff } from 'lucide-react';

export default function RouteErrorBanner({ error }) {
  if (!error) return null;

  const isOffline = error.code === 'OFFLINE_ROUTE_UNAVAILABLE';
  const message =
    error.message || 'Something went wrong while computing the route.';

  if (isOffline) {
    return (
      <div
        role="alert"
        className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] font-semibold text-amber-900"
      >
        <WifiOff className="mt-px h-4 w-4 shrink-0 text-amber-700" />
        <span>{message}</span>
      </div>
    );
  }

  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[11px] font-semibold text-red-800"
    >
      <TriangleAlert className="mt-px h-4 w-4 shrink-0 text-red-600" />
      <span>{message}</span>
    </div>
  );
}