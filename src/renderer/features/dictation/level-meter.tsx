import { useEffect, useRef, useState } from 'react';

const BARS = 24;

/** Scrolling bar meter of recent input peaks. */
export function LevelMeter({ level, active }: { level: number; active: boolean }) {
  const [history, setHistory] = useState<number[]>(() => Array(BARS).fill(0));
  const latest = useRef(level);
  latest.current = level;

  useEffect(() => {
    if (!active) {
      setHistory(Array(BARS).fill(0));
      return;
    }
    const id = setInterval(() => setHistory((h) => [...h.slice(1), latest.current]), 60);
    return () => clearInterval(id);
  }, [active]);

  return (
    <div aria-hidden className="flex h-8 items-center gap-[3px]">
      {history.map((v, i) => (
        <span
          key={i}
          className={active ? 'w-1 rounded-full bg-record' : 'w-1 rounded-full bg-line-strong'}
          style={{ height: `${Math.max(4, Math.min(32, Math.sqrt(v) * 40))}px` }}
        />
      ))}
    </div>
  );
}
