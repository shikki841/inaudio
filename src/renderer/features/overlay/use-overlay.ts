import { useCallback, useEffect, useRef, useState } from 'react';
import type { OverlayState } from '@shared/domain/system';
import { api } from '@renderer/lib/api';

/** The state the main process last pushed, or null until the first push arrives. */
export function useOverlayState(): OverlayState | null {
  const [state, setState] = useState<OverlayState | null>(null);
  // Subscribing during the first effect still beats the push, which the main process sends
  // on `did-finish-load` — after module scripts have run.
  useEffect(() => api.events.onOverlayState(setState), []);
  return state;
}

/**
 * Reports the pointer being over the pill. The main process is the only thing that can
 * turn mouse events back on under click-through, and it decides from this whether the pill
 * is armed. Attach the handlers to the pill, never to the root: the root includes the
 * transparent padding, which is not part of the control.
 */
export function useHoverReport(): {
  onMouseEnter(): void;
  onMouseMove(): void;
  onMouseLeave(): void;
} {
  const hovering = useRef(false);
  const report = useCallback((next: boolean) => {
    if (hovering.current === next) return;
    hovering.current = next;
    api.overlay.hover(next);
  }, []);
  const enter = useCallback(() => report(true), [report]);

  // A pointer that leaves the window faster than React sees the leave event would strand
  // hover as true, and the pill would stay armed for good.
  useEffect(() => {
    const leave = () => report(false);
    document.documentElement.addEventListener('mouseleave', leave);
    window.addEventListener('blur', leave);
    return () => {
      document.documentElement.removeEventListener('mouseleave', leave);
      window.removeEventListener('blur', leave);
    };
  }, [report]);

  // Click-through forwards mouse moves rather than enter events, so both arm the pill.
  return { onMouseEnter: enter, onMouseMove: enter, onMouseLeave: useCallback(() => report(false), [report]) };
}

/**
 * One open panel at a time, and the main process is told whenever that changes: the window
 * is only as tall as the pill until it grants room, and the overlay never resizes itself.
 */
export function useMenuRoom(): {
  openId: string | null;
  isOpen(id: string): boolean;
  change(id: string, open: boolean): void;
  close(): void;
} {
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    api.overlay.menu(openId !== null);
  }, [openId]);

  const change = useCallback((id: string, open: boolean) => {
    // Radix reports the close of a panel that another one replaced, so a stale id must not
    // clear whichever panel is open now.
    setOpenId((current) => (open ? id : current === id ? null : current));
  }, []);

  return {
    openId,
    isOpen: useCallback((id: string) => openId === id, [openId]),
    change,
    close: useCallback(() => setOpenId(null), []),
  };
}

/**
 * Mirrors the main process rule that reaching idle drops the open menu. Both sides apply it
 * to the same event, so the window never keeps room for a panel the renderer has closed —
 * or the reverse.
 */
export function useCloseOnIdle(phase: OverlayState['phase'] | undefined, close: () => void): void {
  const previous = useRef(phase);
  useEffect(() => {
    if (previous.current !== undefined && previous.current !== 'idle' && phase === 'idle') close();
    previous.current = phase;
  }, [phase, close]);
}
