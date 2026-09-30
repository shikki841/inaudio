import type { InaudioApi } from '@shared/ipc/api';

declare global {
  interface Window {
    inaudio: InaudioApi;
  }
}
