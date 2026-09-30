import type { ModelStatus } from './models';

export type PermissionState = 'granted' | 'denied' | 'restricted' | 'not-determined' | 'unknown';

export type WorkerState = 'starting' | 'ready' | 'busy' | 'crashed' | 'stopped';

export interface WorkerHealth {
  state: WorkerState;
  pid?: number;
  restarts: number;
  lastError?: string;
  loadedStt?: string;
  loadedTts?: string;
}

export type InsertionSupport =
  | { available: true; method: string }
  | { available: false; reason: string };

export interface SystemStatus {
  platform: NodeJS.Platform;
  arch: string;
  appVersion: string;
  electronVersion: string;
  microphonePermission: PermissionState;
  accessibilityTrusted: boolean | null;
  insertion: InsertionSupport;
  shortcuts: { dictation: boolean; readAloud: boolean };
  dataDir: string;
  modelsDir: string;
  models: ModelStatus[];
  worker: WorkerHealth;
  onBattery: boolean;
}

export type DictationPhase = 'idle' | 'listening' | 'transcribing' | 'inserting' | 'error';

export interface ModelProgressEvent {
  id: string;
  state: ModelStatus['state'];
  bytesDone: number;
  bytesTotal: number;
  error?: string;
}

export type AppCommand =
  | 'dictation:toggle'
  | 'dictation:start'
  | 'dictation:stop'
  | 'dictation:cancel'
  | 'read-aloud:clipboard'
  | 'navigate:dictation'
  | 'navigate:history'
  | 'navigate:read-aloud'
  | 'navigate:models'
  | 'navigate:audio'
  | 'navigate:settings';
