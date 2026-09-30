import { app, powerMonitor, systemPreferences } from 'electron';
import type { PermissionState, SystemStatus } from '@shared/domain/system';
import type { AppPaths } from '../app/paths';
import type { InferenceHost } from './inference-host';
import type { ModelManager } from './model-manager';
import type { ShortcutService } from './shortcuts';
import type { TextInserter } from './text-insertion';

function microphonePermission(): PermissionState {
  if (process.platform !== 'darwin' && process.platform !== 'win32') return 'unknown';
  try {
    return systemPreferences.getMediaAccessStatus('microphone') as PermissionState;
  } catch {
    return 'unknown';
  }
}

export function collectSystemStatus(deps: {
  paths: AppPaths;
  models: ModelManager;
  inference: InferenceHost;
  shortcuts: ShortcutService;
  inserter: TextInserter;
}): SystemStatus {
  return {
    platform: process.platform,
    arch: process.arch,
    appVersion: app.getVersion(),
    electronVersion: process.versions.electron,
    microphonePermission: microphonePermission(),
    accessibilityTrusted:
      process.platform === 'darwin' ? systemPreferences.isTrustedAccessibilityClient(false) : null,
    insertion: deps.inserter.support(),
    shortcuts: deps.shortcuts.current(),
    dataDir: deps.paths.data,
    modelsDir: deps.paths.models,
    models: deps.models.list(),
    worker: deps.inference.getHealth(),
    onBattery: powerMonitor.isOnBatteryPower(),
  };
}
