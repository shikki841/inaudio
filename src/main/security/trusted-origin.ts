import type { IpcMainEvent, IpcMainInvokeEvent, WebFrameMain } from 'electron';
import { APP_HOST, APP_SCHEME } from './app-protocol';

function devOrigin(): string | null {
  if (!MAIN_WINDOW_VITE_DEV_SERVER_URL) return null;
  return new URL(MAIN_WINDOW_VITE_DEV_SERVER_URL).origin;
}

export function isTrustedUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    // Node's URL reports origin "null" for custom schemes, so match scheme + host.
    if (url.protocol === `${APP_SCHEME}:`) return url.host === APP_HOST;
    return url.origin === devOrigin();
  } catch {
    return false;
  }
}

export function isTrustedFrame(frame: WebFrameMain | null | undefined): boolean {
  return !!frame && frame.parent === null && isTrustedUrl(frame.url);
}

export function assertTrustedSender(event: IpcMainInvokeEvent | IpcMainEvent): void {
  if (!isTrustedFrame(event.senderFrame)) {
    throw new Error('Rejected IPC from untrusted frame');
  }
}
