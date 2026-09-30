import { app, session, shell, type WebContents } from 'electron';
import { isTrustedUrl } from './trusted-origin';

const ALLOWED_PERMISSIONS = new Set(['media', 'speaker-selection', 'clipboard-sanitized-write']);

/** Session-wide permission, navigation and window-creation policy. */
export function applySessionPolicy(): void {
  const ses = session.defaultSession;

  ses.setPermissionRequestHandler((webContents, permission, callback, details) => {
    if (!isTrustedUrl(webContents.getURL()) || !ALLOWED_PERMISSIONS.has(permission)) {
      callback(false);
      return;
    }
    if (permission === 'media') {
      const types = 'mediaTypes' in details ? (details.mediaTypes ?? []) : [];
      // Microphone only. Camera and screen capture are never granted.
      callback(types.length > 0 && types.every((t) => t === 'audio'));
      return;
    }
    callback(true);
  });

  ses.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
    if (!webContents || !isTrustedUrl(requestingOrigin)) return false;
    return ALLOWED_PERMISSIONS.has(permission);
  });

  ses.setDevicePermissionHandler(() => false);

  // No remote content is ever loaded by the renderer.
  ses.webRequest.onBeforeRequest((details, callback) => {
    const url = details.url;
    const allowed =
      isTrustedUrl(url) ||
      url.startsWith('devtools://') ||
      url.startsWith('data:') ||
      url.startsWith('blob:') ||
      url.startsWith('chrome-extension://') ||
      (!!MAIN_WINDOW_VITE_DEV_SERVER_URL && url.startsWith('ws://localhost'));
    callback({ cancel: !allowed });
  });

  app.on('web-contents-created', (_event, contents) => lockDownContents(contents));
}

function lockDownContents(contents: WebContents): void {
  contents.on('will-navigate', (event, url) => {
    if (!isTrustedUrl(url)) event.preventDefault();
  });
  contents.on('will-redirect', (event, url) => {
    if (!isTrustedUrl(url)) event.preventDefault();
  });
  contents.on('will-attach-webview', (event) => event.preventDefault());
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
}

/** The only path to the system browser. Callers pass allow-listed constants. */
export async function openTrustedExternal(url: string): Promise<void> {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') throw new Error('Only https links can be opened');
  await shell.openExternal(parsed.toString());
}
