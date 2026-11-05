
import React, { useEffect, useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import ScreenShell from '../navigation/ScreenShell';
import { useViewport } from '../dashboard/hooks/useViewport';
import RouteForm from '../search/components/RouteForm';
import RouteMapPanel from './components/RouteMapPanel';
import PlayGuideBar from './components/PlayGuideBar';
import StepByStepPanel from './components/StepByStepPanel';
import DirectoryPanel from './components/DirectoryPanel';
import useRoute from './hooks/useRoute';
import useRoutePlayback from './hooks/useRoutePlayback';

export default function DirectionsMobileView({
  inputs,
  request,
  onBack,
  onStart,
  onPickDestination,
  onNavSelect,
  onProfileClick,
  isAuthenticated = false,
  requireLogin = () => false,
}) {
  const { isDesktop } = useViewport(1024);

  const { route, status } = useRoute(request);
  const playback = useRoutePlayback(route);

  const [activeFloor, setActiveFloor] = useState(1);
  const [focus, setFocus] = useState(null);

  // Check authentication before interactive navigation.
  const checkNavigationAccess = () => {
    if (!isAuthenticated) {
      requireLogin();
      return false;
    }

    return true;
  };

  useEffect(() => {
    if (route) {
      setActiveFloor(route.start.floor);
    }
  }, [route]);

  const guideFloor = playback.position?.floor;

  useEffect(() => {
    if (
      playback.engaged &&
      playback.isPlaying &&
      guideFloor
    ) {
      setActiveFloor(guideFloor);
    }
  }, [
    guideFloor,
    playback.engaged,
    playback.isPlaying,
  ]);

  const selectStep = (i) => {
    if (!checkNavigationAccess()) return;

    if (!route?.steps?.[i]) return;

    const step = route.steps[i];

    playback.goTo(i);
    setActiveFloor(step.floor);

    setFocus({
      coordinate: step.coordinate,
      nonce: Date.now(),
    });
  };

  const steps = route?.steps || [];
  const destination = request?.to || inputs.to;

  const warnings =
    route?.warnings?.length > 0 &&
    route.warnings.map((w) => (
      <div
        key={w}
        role="alert"
        className="flex gap-2 items-start rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] font-semibold text-amber-900"
      >
        <TriangleAlert className="w-4 h-4 shrink-0 mt-px" />
        <span>{w}</span>
      </div>
    ));

  const form = (
    <RouteForm
      inputs={inputs}
      onBack={onBack}
      onStart={onStart}
      isLoading={status === 'loading'}
    />
  );

  const mapPanel = (mapClassName) => (
    <RouteMapPanel
      route={route}
      status={status}
      activeFloor={activeFloor}
      onFloorChange={setActiveFloor}
      guide={isAuthenticated ? playback : null}
      focus={focus}
      hasRequest={!!request}
      mapClassName={mapClassName}
    />
  );

  // Guests can see the guide button but must log in.
  const guide = status === 'success' && (
    <div
      onClickCapture={(event) => {
        if (!isAuthenticated) {
          event.stopPropagation();
          requireLogin();
        }
      }}
    >
      <PlayGuideBar
        steps={steps}
        playback={playback}
      />
    </div>
  );

  const stepsPanel = (
    <StepByStepPanel
      steps={steps}
      status={status}
      activeIndex={
        isAuthenticated && playback.engaged
          ? playback.stepIndex
          : -1
      }
      onSelect={selectStep}
    />
  );

  const directory = (
    <DirectoryPanel
      destination={destination}
      onPick={onPickDestination}
    />
  );

  return (
    <ScreenShell
      isDesktop={isDesktop}
      onNavSelect={onNavSelect}
      onProfileClick={onProfileClick}
    >
      {isDesktop ? (
        <main className="flex-1 min-h-0 px-8 py-5">
          <div className="max-w-6xl mx-auto h-full grid grid-cols-[minmax(340px,420px)_1fr] gap-6">
            <div className="min-h-0 overflow-y-auto no-scrollbar space-y-3 pr-1">
              {form}
              {stepsPanel}
              {directory}
            </div>

            <div className="min-h-0 overflow-y-auto no-scrollbar space-y-3">
              {mapPanel('h-[58dvh] min-h-[320px]')}
              {warnings}
              {guide}
            </div>
          </div>
        </main>
      ) : (
        <main className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-5 pb-4 space-y-3">
          {form}
          {mapPanel()}
          {warnings}
          {guide}
          {stepsPanel}
          {directory}
        </main>
      )}
    </ScreenShell>
  );
}