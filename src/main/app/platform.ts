import type { OverlaySupport } from '@shared/domain/system';

const WINDOWS = process.platform === 'win32';
const MACOS = process.platform === 'darwin';
const LINUX = process.platform === 'linux';

/** True for a Wayland session, where several window-manager hints are not honoured. */
export function isWayland(): boolean {
  if (!LINUX) return false;
  return process.env.XDG_SESSION_TYPE === 'wayland' || !!process.env.WAYLAND_DISPLAY;
}

/**
 * What the running platform allows the overlay to do. Each flag mirrors a documented
 * Electron limitation, so the UI can say what is unavailable instead of failing quietly.
 */
export function overlaySupport(): OverlaySupport {
  const wayland = isWayland();
  return {
    // setAlwaysOnTop is ignored on Wayland; an unfocusable window stays on top instead.
    alwaysOnTop: !wayland,
    // setOpacity does nothing on Linux.
    opacity: WINDOWS || MACOS,
    // IgnoreMouseEventsOptions.forward is macOS and Windows only, so hovering to arm
    // the controls cannot work anywhere else.
    hover: WINDOWS || MACOS,
    // screen.getCursorScreenPoint is not supported on Wayland.
    cursor: !wayland,
  };
}
