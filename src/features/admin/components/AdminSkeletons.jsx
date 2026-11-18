import React from 'react';
import SkeletonBlock from '../../loading/components/SkeletonBlock';

// Loading placeholders for the admin dashboard. Each one copies the layout of the real content
// (same card shape, spacing and avatar size) so nothing jumps when the data arrives.

const Loading = ({ label, className = '', children }) => (
  <div role="status" aria-label={label} aria-busy="true" className={className}>
    {children}
  </div>
);

// ---- Tab band (Overview, Map, Directory, Users, Audit Log) ----
const TAB_LABEL_WIDTHS = ['w-24', 'w-16', 'w-24', 'w-20', 'w-28'];

export function AdminTabsSkeleton({ desktop = true }) {
  if (desktop) {
    return (
      <Loading label="Loading admin sections" className="max-w-6xl mx-auto flex items-center justify-between gap-4">
        {TAB_LABEL_WIDTHS.map((_, i) => (
          <SkeletonBlock key={i} tone="dark" className="flex-1 h-9 rounded-xl" />
        ))}
      </Loading>
    );
  }
  return (
    <Loading label="Loading admin sections" className="flex items-center gap-2 overflow-hidden">
      {['w-[84px]', 'w-14', 'w-[84px]', 'w-[68px]', 'w-[92px]'].map((w, i) => (
        <SkeletonBlock key={i} tone="dark" className={`h-[27px] ${w} rounded-full shrink-0`} />
      ))}
    </Loading>
  );
}

// ---- Directory (staff cards) ----
export function StaffCardSkeleton() {
  return (
    <div className="w-full flex items-center gap-4 bg-white rounded-xl shadow-md px-4 py-3">
      <SkeletonBlock className="w-16 h-16 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1 space-y-2">
        <SkeletonBlock className="h-3.5 w-3/5 rounded" />
        <SkeletonBlock className="h-3 w-2/5 rounded" />
        <SkeletonBlock className="h-2.5 w-1/2 rounded" />
      </div>
    </div>
  );
}

export function StaffListSkeleton({ count = 5, headingClassName = 'h-3 w-40' }) {
  return (
    <Loading label="Loading staff" className="space-y-3 pb-6">
      <div className="mb-4 border-l-4 border-[#D4A017] pl-3">
        <SkeletonBlock className={`${headingClassName} rounded`} />
      </div>
      {Array.from({ length: count }, (_, i) => (
        <StaffCardSkeleton key={i} />
      ))}
    </Loading>
  );
}

// ---- Users (account cards) ----
export function UserCardSkeleton() {
  return (
    <div className="w-full flex items-center gap-4 bg-white rounded-xl shadow-md px-4 py-3">
      <SkeletonBlock className="w-12 h-12 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1 space-y-2">
        <SkeletonBlock className="h-3.5 w-1/2 rounded" />
        <SkeletonBlock className="h-3 w-3/5 rounded" />
        <div className="flex gap-1.5 pt-0.5">
          <SkeletonBlock className="h-4 w-12 rounded-full" />
          <SkeletonBlock className="h-4 w-14 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function UserListSkeleton({ count = 5 }) {
  return (
    <Loading label="Loading users" className="grid grid-cols-1 gap-3 pb-6">
      {Array.from({ length: count }, (_, i) => (
        <UserCardSkeleton key={i} />
      ))}
    </Loading>
  );
}

// Compact rows used by the Overview "Users" panel
export function UserRowsSkeleton({ count = 5 }) {
  return (
    <Loading label="Loading users" className="space-y-2">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-xl bg-white px-3 py-2 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <SkeletonBlock className="h-3.5 w-2/5 rounded" />
            <div className="flex shrink-0 gap-1.5">
              <SkeletonBlock className="h-4 w-10 rounded-full" />
              <SkeletonBlock className="h-4 w-12 rounded-full" />
            </div>
          </div>
          <SkeletonBlock className="mt-2 h-2.5 w-3/5 rounded" />
        </div>
      ))}
    </Loading>
  );
}

// ---- Audit log (table on desktop, cards on phone) ----
export function AuditLogSkeleton({ isDesktop = true, rows = 6 }) {
  if (isDesktop) {
    return (
      <Loading label="Loading audit log" className="overflow-hidden">
        <div className="flex gap-4 border-b border-slate-200 py-2.5">
          {['w-20', 'w-28', 'w-20', 'w-32', 'w-16'].map((w, i) => (
            <SkeletonBlock key={i} className={`h-2.5 ${w} rounded`} />
          ))}
        </div>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-start gap-4 border-b border-slate-100 py-3">
            <div className="w-20 shrink-0 space-y-1.5">
              <SkeletonBlock className="h-3 w-full rounded" />
              <SkeletonBlock className="h-2.5 w-3/4 rounded" />
            </div>
            <SkeletonBlock className="mt-0.5 h-3.5 w-28 shrink-0 rounded" />
            <SkeletonBlock className="mt-0.5 h-3.5 w-20 shrink-0 rounded" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <SkeletonBlock className="h-3.5 w-2/3 rounded" />
              <SkeletonBlock className="h-2.5 w-1/2 rounded" />
            </div>
            <SkeletonBlock className="h-5 w-16 shrink-0 rounded-full" />
          </div>
        ))}
      </Loading>
    );
  }

  return (
    <Loading label="Loading audit log" className="grid grid-cols-1 gap-3">
      {Array.from({ length: Math.min(rows, 4) }, (_, i) => (
        <div key={i} className="space-y-2 rounded-xl bg-white px-4 py-3 shadow-md">
          <div className="flex items-start justify-between gap-3">
            <SkeletonBlock className="h-2.5 w-32 rounded" />
            <SkeletonBlock className="h-5 w-16 rounded-full" />
          </div>
          <SkeletonBlock className="h-3.5 w-1/2 rounded" />
          <SkeletonBlock className="h-3 w-2/3 rounded" />
          <SkeletonBlock className="h-3 w-3/4 rounded" />
        </div>
      ))}
    </Loading>
  );
}

// ---- Map (Overview panel + Map tab) ----
// Sits on top of the map container until Mapbox has painted, then fades out.
export function MapCanvasSkeleton({ visible = true }) {
  return (
    <div
      aria-hidden={!visible}
      className={`absolute inset-0 z-10 transition-opacity duration-500 ease-out ${
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <SkeletonBlock className="w-full h-full" />
    </div>
  );
}

// ---- Whole Overview body (used while the admin chunk itself is downloading) ----
function PanelFrame({ children }) {
  return (
    <div className="min-w-0 rounded-md border border-[#0B2545] bg-[#F8F9F9]">
      <div className="flex items-center justify-between px-4 pt-4">
        <SkeletonBlock className="h-3.5 w-20 rounded" />
        <SkeletonBlock className="h-3 w-12 rounded" />
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export function OverviewSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <PanelFrame>
        <SkeletonBlock className="h-72 w-full rounded-xl" />
      </PanelFrame>
      <PanelFrame>
        <div className="max-h-72 overflow-hidden">
          <StaffListSkeleton count={3} />
        </div>
      </PanelFrame>
      <PanelFrame>
        <div className="max-h-72 overflow-hidden">
          <UserRowsSkeleton count={5} />
        </div>
      </PanelFrame>
    </div>
  );
}
