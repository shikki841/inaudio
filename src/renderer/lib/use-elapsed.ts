import { useEffect, useState } from 'react';

/** Milliseconds since `startedAt`, ticking four times a second; 0 while nothing has started. */
export function useElapsed(startedAt: number | null | undefined): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [startedAt]);
  return startedAt ? Math.max(0, now - startedAt) : 0;
}
