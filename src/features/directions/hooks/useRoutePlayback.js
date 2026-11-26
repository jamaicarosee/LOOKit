import { useCallback, useEffect, useRef, useState } from 'react';
import { pointAlong } from '../../navigation/services/geo';
import { GUIDE_METERS_PER_SECOND, GUIDE_MIN_STEP_MS, GUIDE_MAX_STEP_MS } from '../../navigation/constants';

function stepDuration(step) {
  if (step.type === 'stairs-up' || step.type === 'stairs-down') return 3200;
  if (step.type === 'arrive' || step.type === 'note') return 3000;
  if (!step.distanceMeters) return 2200;
  const ms = (step.distanceMeters / GUIDE_METERS_PER_SECOND) * 1000;
  return Math.max(GUIDE_MIN_STEP_MS, Math.min(GUIDE_MAX_STEP_MS, ms));
}

export default function useRoutePlayback(route) {
  const steps = route?.steps;
  const [stepIndex, setStepIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [engaged, setEngaged] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [voice, setVoice] = useState(false);

  const live = useRef({ index: 0, progress: 0, speed: 1, speaking: false });
  live.current.speed = speed;
  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;

  useEffect(() => {
    live.current.index = 0;
    live.current.progress = 0;
    live.current.speaking = false;
    setStepIndex(0);
    setProgress(0);
    setIsPlaying(false);
    setEngaged(false);
  }, [route]);

  // Animation loop: waits for active voice utterance to finish before advancing to next step
  useEffect(() => {
    if (!isPlaying || !steps?.length) return undefined;
    let raf = 0;
    let last = performance.now();
    let lastPaint = 0;
    const tick = (now) => {
      const l = live.current;
      const dur = stepDuration(steps[l.index]);
      const nextProg = l.progress + ((now - last) * l.speed) / dur;
      last = now;

      if (nextProg >= 1) {
        // Hold at 0.98 while speech synthesis is still reading the current step
        if (voice && canSpeak && l.speaking) {
          l.progress = 0.98;
        } else if (l.index >= steps.length - 1) {
          l.progress = 1;
          setProgress(1);
          setIsPlaying(false);
          return;
        } else {
          l.index += 1;
          l.progress = 0;
          setStepIndex(l.index);
        }
      } else {
        l.progress = nextProg;
      }

      if (now - lastPaint > 33) {
        lastPaint = now;
        setProgress(l.progress);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, steps, voice, canSpeak]);

  // Voice guidance at 0.85x speed with onend synchronization
  useEffect(() => {
    if (!canSpeak || !voice || !engaged || !steps?.[stepIndex]) {
      live.current.speaking = false;
      return undefined;
    }
    window.speechSynthesis.cancel();
    const text = steps[stepIndex].instruction || '';
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.85;
    utterance.pitch = 1.0;

    live.current.speaking = true;
    // Safety timeout in case mobile Chrome drops onend event
    const fallbackMs = Math.max(3000, text.length * 95);
    const guardTimer = window.setTimeout(() => {
      live.current.speaking = false;
    }, fallbackMs);

    utterance.onend = () => {
      window.clearTimeout(guardTimer);
      live.current.speaking = false;
    };
    utterance.onerror = () => {
      window.clearTimeout(guardTimer);
      live.current.speaking = false;
    };

    window.speechSynthesis.speak(utterance);
    return () => {
      window.clearTimeout(guardTimer);
      live.current.speaking = false;
      window.speechSynthesis.cancel();
    };
  }, [stepIndex, voice, engaged, canSpeak, steps]);

  const goTo = useCallback(
    (i) => {
      const idx = Math.max(0, Math.min(i, (steps?.length || 1) - 1));
      live.current.index = idx;
      live.current.progress = 0;
      live.current.speaking = false;
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
  const pause = useCallback(() => {
    live.current.speaking = false;
    setIsPlaying(false);
  }, []);
  const toggle = useCallback(() => (isPlaying ? pause() : play()), [isPlaying, play, pause]);
  const next = useCallback(() => goTo(live.current.index + 1), [goTo]);
  const prev = useCallback(() => goTo(live.current.index - 1), [goTo]);
  const restart = useCallback(() => {
    goTo(0);
    setIsPlaying(true);
  }, [goTo]);

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
