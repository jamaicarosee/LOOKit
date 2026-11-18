import { useCallback, useEffect, useRef, useState } from 'react';
import { pointAlong } from '../../navigation/services/geo';
import { GUIDE_METERS_PER_SECOND, GUIDE_MIN_STEP_MS, GUIDE_MAX_STEP_MS } from '../../navigation/constants';

// How long (ms at 1x) the guide spends on a step
function stepDuration(step) {
  if (step.type === 'stairs-up' || step.type === 'stairs-down') return 3000;
  if (step.type === 'arrive') return 2500;
  if (!step.distanceMeters) return 1500;
  const ms = (step.distanceMeters / GUIDE_METERS_PER_SECOND) * 1000;
  return Math.max(GUIDE_MIN_STEP_MS, Math.min(GUIDE_MAX_STEP_MS, ms));
}

// "Play guide": walks a marker along every step (including stairs and floor changes)
export default function useRoutePlayback(route) {
  const steps = route?.steps;
  const [stepIndex, setStepIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [engaged, setEngaged] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [voice, setVoice] = useState(false);

  const live = useRef({ index: 0, progress: 0, speed: 1 });
  live.current.speed = speed;
  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;

  // New route -> back to the start
  useEffect(() => {
    live.current.index = 0;
    live.current.progress = 0;
    setStepIndex(0);
    setProgress(0);
    setIsPlaying(false);
    setEngaged(false);
  }, [route]);

  // Animation loop
  useEffect(() => {
    if (!isPlaying || !steps?.length) return undefined;
    let raf = 0;
    let last = performance.now();
    let lastPaint = 0;
    const tick = (now) => {
      const l = live.current;
      l.progress += ((now - last) * l.speed) / stepDuration(steps[l.index]);
      last = now;
      if (l.progress >= 1) {
        if (l.index >= steps.length - 1) {
          l.progress = 1;
          setProgress(1);
          setIsPlaying(false);
          return;
        }
        l.index += 1;
        l.progress = 0;
        setStepIndex(l.index);
      }
      if (now - lastPaint > 33) {
        lastPaint = now;
        setProgress(l.progress);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, steps]);

  // Optional voice guidance
  useEffect(() => {
    if (!canSpeak || !voice || !engaged || !steps?.[stepIndex]) return undefined;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(steps[stepIndex].instruction));
    return () => window.speechSynthesis.cancel();
  }, [stepIndex, voice, engaged, canSpeak, steps]);

  const goTo = useCallback(
    (i) => {
      const idx = Math.max(0, Math.min(i, (steps?.length || 1) - 1));
      live.current.index = idx;
      live.current.progress = 0;
      setStepIndex(idx);
      setProgress(0);
      setEngaged(true);
    },
    [steps],
  );

  const play = useCallback(() => {
    if (!steps?.length) return;
    if (live.current.index >= steps.length - 1 && live.current.progress >= 1) goTo(0);
    setEngaged(true);
    setIsPlaying(true);
  }, [steps, goTo]);
  const pause = useCallback(() => setIsPlaying(false), []);
  const toggle = useCallback(() => (isPlaying ? pause() : play()), [isPlaying, play, pause]);
  const next = useCallback(() => goTo(live.current.index + 1), [goTo]);
  const prev = useCallback(() => goTo(live.current.index - 1), [goTo]);
  const restart = useCallback(() => {
    goTo(0);
    setIsPlaying(true);
  }, [goTo]);

  // Marker position for the current frame
  const step = steps?.[Math.min(stepIndex, (steps?.length || 1) - 1)];
  let position = null;
  if (step) {
    const vertical = step.type === 'stairs-up' || step.type === 'stairs-down';
    const along = step.coords?.length > 1 ? pointAlong(step.coords, progress) : null;
    position = {
      coordinate: vertical && progress > 0.5 && step.coordTo ? step.coordTo : along ? along.point : step.coordinate,
      floor: vertical && progress > 0.5 ? step.floorTo : step.floor,
      vertical,
    };
  }

  return {
    stepIndex, progress, position, isPlaying, engaged, speed, voice, canSpeak,
    finished: !!steps?.length && stepIndex >= steps.length - 1 && progress >= 1,
    play, pause, toggle, next, prev, restart, goTo, setSpeed, setVoice,
  };
}
