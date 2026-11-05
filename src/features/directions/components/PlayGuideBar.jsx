import React from 'react';
import { Play, Pause, SkipBack, SkipForward, RotateCcw, Volume2, VolumeX } from 'lucide-react';

const icon = 'w-4 h-4 stroke-[2.2]';
const small = 'w-10 h-10 rounded-full bg-white text-[#0B1E36] flex items-center justify-center shadow-sm active:scale-95 transition disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B1E36]';
const tiny = 'h-8 w-8 rounded-full bg-white text-[#0B1E36] flex items-center justify-center active:scale-95 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B1E36]';

// Play button under the route map: animates the guide marker through every step, stairs included
export default function PlayGuideBar({ steps, playback }) {
  if (!steps?.length) return null;
  const { stepIndex, progress, isPlaying, finished, speed, voice, canSpeak, engaged } = playback;
  const safeIndex = Math.min(stepIndex, steps.length - 1); // a new route can arrive a render before the reset
  const step = steps[safeIndex];
  const overall = Math.min(100, ((safeIndex + progress) / steps.length) * 100);
  const label = isPlaying ? 'Pause guide' : finished ? 'Replay guide' : engaged ? 'Resume guide' : 'Play guide';

  return (
    <section aria-label="Route guide" className="rounded-xl bg-[#E5EBF5] p-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={playback.toggle}
          aria-label={label}
          className="flex-1 h-11 rounded-xl bg-[#0B1E36] text-white text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition active:scale-95 hover:bg-[#152B47] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#0B1E36]"
        >
          {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
          {label}
        </button>
        <button type="button" onClick={playback.prev} disabled={stepIndex === 0} aria-label="Previous step" className={small}><SkipBack className={icon} /></button>
        <button type="button" onClick={playback.next} disabled={stepIndex >= steps.length - 1} aria-label="Next step" className={small}><SkipForward className={icon} /></button>
      </div>

      <div className="mt-2.5 h-1.5 rounded-full bg-white overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(overall)} aria-label="Guide progress">
        <div className="h-full bg-[#0B1E36]" style={{ width: `${overall}%` }} />
      </div>

      <p className="mt-2 text-xs font-semibold text-[#0B2545] min-h-[2.25rem]" aria-live="polite">
        <span className="text-[#607289]">Step {safeIndex + 1}/{steps.length} · </span>
        {step.instruction}
      </p>

      <div className="mt-1 flex items-center gap-2">
        <button type="button" onClick={() => playback.setSpeed(speed === 1 ? 2 : 1)} aria-label={`Playback speed ${speed}x`} className="h-8 px-3 rounded-full bg-white text-[11px] font-black text-[#0B1E36] active:scale-95 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B1E36]">
          {speed}x
        </button>
        <button type="button" onClick={playback.restart} aria-label="Restart guide" className={tiny}>
          <RotateCcw className="w-3.5 h-3.5 stroke-[2.2]" />
        </button>
        {canSpeak && (
          <button type="button" onClick={() => playback.setVoice(!voice)} aria-pressed={voice} aria-label={voice ? 'Turn voice guidance off' : 'Turn voice guidance on'} className={tiny}>
            {voice ? <Volume2 className="w-3.5 h-3.5 stroke-[2.2]" /> : <VolumeX className="w-3.5 h-3.5 stroke-[2.2]" />}
          </button>
        )}
      </div>
    </section>
  );
}
