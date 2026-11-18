import React from 'react';
import SkeletonBlock from './SkeletonBlock';

// Placeholders for the nav bar (Map, Staff, About and the admin-only Admin button).
// Each tab is drawn like the real one: an icon shape stacked over a label bar.
// Shown while auth is still resolving (the Admin button's presence is unknown until the profile
// arrives) and for a short minimum time after a screen mounts (see useNavLoading).
const LABEL_WIDTHS = ['w-6', 'w-8', 'w-8', 'w-9']; // Map, Staff, About, Admin

// One tab: icon + label centered inside the tab shape
function TabContent({ inner, iconClass, labelClass, labelWidth, gap }) {
  return (
    <div className={`relative h-full flex flex-col items-center justify-center ${gap}`}>
      <SkeletonBlock tone={inner} className={`${iconClass} rounded-md`} />
      <SkeletonBlock tone={inner} className={`${labelClass} ${labelWidth} rounded`} />
    </div>
  );
}

// Desktop top nav tabs, drawn on the navy header. The active tab is wider and light, like the real one.
export function DesktopNavTabsSkeleton({ activeIndex = -1 }) {
  return (
    <nav
      role="status"
      aria-label="Loading navigation"
      className="flex items-center gap-8 lg:gap-12"
    >
      {LABEL_WIDTHS.map((labelWidth, i) => {
        const active = i === activeIndex;
        return (
          <SkeletonBlock
            key={i}
            tone={active ? 'light' : 'dark'}
            className={`h-[50px] ${active ? 'w-[104px]' : 'w-16'} rounded-2xl`}
          >
            <TabContent
              inner={active ? 'lightInner' : 'darkInner'}
              iconClass="w-5 h-5"
              labelClass="h-2"
              labelWidth={labelWidth}
              gap="gap-1.5"
            />
          </SkeletonBlock>
        );
      })}
    </nav>
  );
}

// Phone bottom dock tiles, drawn on white (same size as the real navy tiles).
export function MobileNavTilesSkeleton() {
  return (
    <nav
      role="status"
      aria-label="Loading navigation"
      className="grid grid-cols-4 gap-2.5 w-full max-w-xs"
    >
      {LABEL_WIDTHS.map((labelWidth, i) => (
        <SkeletonBlock key={i} className="h-[65px] rounded-2xl">
          <TabContent
            inner="lightInner"
            iconClass="w-5 h-5"
            labelClass="h-2"
            labelWidth={labelWidth}
            gap="gap-1.5"
          />
        </SkeletonBlock>
      ))}
    </nav>
  );
}
