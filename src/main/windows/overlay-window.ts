import { BrowserWindow } from 'electron';
import path from 'node:path';
import type { Settings } from '@shared/domain/settings';
import { APP_ORIGIN } from '../security/app-protocol';
import { overlaySupport } from '../app/platform';

/** Transparent room around the pill so its CSS drop shadow is not clipped. */
export const OVERLAY_PAD = 16;
/** Height of the pill itself; matches the overlay stylesheet. */
export const OVERLAY_PILL_HEIGHT = 44;
/** Extra height granted while a dropdown or popover is open. */
export const OVERLAY_MENU_SPACE = 248;
/** Distance from the edge of the work area. */
export const OVERLAY_MARGIN = 24;
/**
 * Extra width granted while an error line is shown. A configuration small enough to fit
 * "Ready" has no room for a sentence, and a truncated failure reason is no use at all.
 */
export const OVERLAY_MESSAGE_SPACE = 184;
/**
 * Extra width granted while the pointer has armed the pill. The controls take more room
 * than the readout they stand in for, and the smallest configuration has none to spare.
 */
export const OVERLAY_CONTROLS_SPACE = 96;

/**
 * Pill width for a given configuration. The main process owns every pixel of overlay
 * geometry, so the renderer only ever fills the box it is given.
 */
export function overlayPillWidth(overlay: Settings['overlay']): number {
  let width = 168;
  if (overlay.showTimer) width += 52;
  if (overlay.showLevel) width += 48;
  if (overlay.showModel) width += 112;
  if (overlay.showLanguage) width += 56;
  return width;
}

/** What the pill currently needs room for, beyond the configured sections. */
export interface OverlayExtent {
  /** A dropdown or popover is open and the panel has to fit inside the window. */
  menuOpen: boolean;
  /** An error line is shown and has to be readable rather than clipped. */
  message: boolean;
  /** The pointer has armed the pill, so it is showing controls instead of a readout. */
  controls: boolean;
}

export function overlaySize(
  overlay: Settings['overlay'],
  extent: OverlayExtent,
): { width: number; height: number } {
  return {
    width:
      overlayPillWidth(overlay) +
      OVERLAY_PAD * 2 +
      (extent.message ? OVERLAY_MESSAGE_SPACE : 0) +
      (extent.controls ? OVERLAY_CONTROLS_SPACE : 0),
    height: OVERLAY_PILL_HEIGHT + OVERLAY_PAD * 2 + (extent.menuOpen ? OVERLAY_MENU_SPACE : 0),
  };
}

/**
 * The floating recording surface: frameless, transparent, never focusable so it cannot
 * take focus away from the application receiving dictated text.
 */
export function createOverlayWindow(overlay: Settings['overlay']): BrowserWindow {
  const support = overlaySupport();
  const { width, height } = overlaySize(overlay, {
    menuOpen: false,
    message: false,
    controls: false,
  });

  const win = new BrowserWindow({
    width,
    height,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    closable: false,
    skipTaskbar: true,
    // Never steal focus: the window being dictated into has to keep it.
    focusable: false,
    alwaysOnTop: support.alwaysOnTop,
    acceptFirstMouse: true,
    roundedCorners: false,
    title: 'Inaudio overlay',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      spellcheck: false,
      // The overlay keeps animating while the main window is hidden.
      backgroundThrottling: false,
      devTools: !!MAIN_WINDOW_VITE_DEV_SERVER_URL,
    },
  });

  if (support.alwaysOnTop) {
    // Float above full-screen windows as well as ordinary ones.
    win.setAlwaysOnTop(true, 'screen-saver');
  }
  if (process.platform !== 'win32') {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void win.loadURL(new URL('overlay.html', MAIN_WINDOW_VITE_DEV_SERVER_URL).href);
  } else {
    void win.loadURL(`${APP_ORIGIN}/overlay.html`);
  }
  return win;
}
