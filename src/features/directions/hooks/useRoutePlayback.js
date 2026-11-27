import { useCallback, useEffect, useRef, useState } from 'react';
import { pointAlong } from '../../navigation/services/geo';
import { GUIDE_METERS_PER_SECOND, GUIDE_MIN_STEP_MS, GUIDE_MAX_STEP_MS } from '../../navigation/constants';

// Speech rate for voice guidance (1 = browser default). Lower = slower.
const VOICE_RATE = 0.7;

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

  // Voice guidance: slower speech, and each step waits for its own utterance to finish.
  // Depends on the step's text (not the `steps` array) so a re-created steps array with the same
  // wording never cancels a sentence that is still being read.
  const stepText = steps?.[stepIndex]?.instruction || '';
  useEffect(() => {
    if (!canSpeak || !voice || !engaged || !stepText) {
      live.current.speaking = false;
      return undefined;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(stepText);
    utterance.rate = VOICE_RATE;
    utterance.pitch = 1.0;

    // Handlers of a cancelled utterance fire late; `active` stops them from clearing the flag of the
    // utterance that replaced them (which made the next step start before the sentence finished).
    let active = true;
    live.current.speaking = true;
    // Safety net in case mobile Chrome drops onend; scaled to the speech rate so it never fires mid-sentence
    const fallbackMs = Math.max(4000, ((stepText.length * 80) / VOICE_RATE) * 1.6);
    const guardTimer = window.setTimeout(() => {
      if (active) live.current.speaking = false;
    }, fallbackMs);

    const finish = () => {
      if (!active) return;
      window.clearTimeout(guardTimer);
      live.current.speaking = false;
    };
    utterance.onend = finish;
    utterance.onerror = finish;

    window.speechSynthesis.speak(utterance);
    return () => {
      active = false;
      window.clearTimeout(guardTimer);
      live.current.speaking = false;
      window.speechSynthesis.cancel();
    };
  }, [stepIndex, stepText, voice, engaged, canSpeak]);

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
