import type { InaudioApi } from '@shared/ipc/api';

/** The preload bridge. The only way the renderer reaches the main process. */
export const api: InaudioApi = window.inaudio;

export function errorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  // ipcRenderer.invoke prefixes remote errors with the channel name.
  return raw.replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
}
