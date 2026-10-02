import { useEffect, useRef, useState } from 'react';
import { cn } from '@renderer/lib/cn';
import { formatDuration } from '@renderer/lib/format';

/** Elapsed recording time. `startedAt` is 0 outside a recording, where nothing is shown. */
export function Timer({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startedAt) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [startedAt]);

  if (!startedAt) return null;
  return (
    <span className="shrink-0 font-mono text-xs text-muted tabular-nums">
      {formatDuration(Math.max(0, now - startedAt))}
    </span>
  );
}

const BAR_COUNT = 6;
const BAR_MIN = 3;
const BAR_MAX = 16;
/** Matches the cadence the capturing window reports levels at. */
const SHIFT_MS = 100;

/**
 * Six bars of recent input peaks, the narrow sibling of the dictation page meter. Shifted
 * on a timer rather than on each push so the bars keep moving at one speed whatever
 * cadence the reports arrive at.
 */
export function LevelBars({
  level,
  active,
  animate,
}: {
  level: number;
  active: boolean;
  animate: boolean;
}) {
  const [peaks, setPeaks] = useState<number[]>(() => Array<number>(BAR_COUNT).fill(0));
  const latest = useRef(level);
  latest.current = active ? level : 0;

  useEffect(() => {
    if (!active) {
      setPeaks(Array<number>(BAR_COUNT).fill(0));
      return;
    }
    const id = setInterval(() => {
      setPeaks((previous) => [...previous.slice(1), latest.current]);
    }, SHIFT_MS);
    return () => clearInterval(id);
  }, [active]);

  return (
    <span aria-hidden className="flex h-4 shrink-0 items-end gap-[2px]">
      {peaks.map((peak, index) => (
        <span
          key={index}
          className={cn(
            'block w-[3px] rounded-[2px]',
            active ? 'bg-record' : 'bg-line-strong',
            animate && 'transition-[height] duration-100 ease-out',
          )}
          // The square root lifts quiet speech clear of the floor without clipping peaks.
          style={{ height: `${BAR_MIN + Math.round(Math.sqrt(Math.min(1, Math.max(0, peak))) * (BAR_MAX - BAR_MIN))}px` }}
        />
      ))}
    </span>
  );
}
