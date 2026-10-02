import { clipboard, type BrowserWindow } from 'electron';
import {
  MODEL_CATALOG,
  MODEL_IDS,
  sttModelIdSchema,
  ttsModelIdSchema,
  type ModelId,
  type ModelStatus,
} from '@shared/domain/models';
import type { AudioDevice, AppCommand, SystemStatus } from '@shared/domain/system';
import { RESERVED_DEVICE_IDS, type SettingsPatch } from '@shared/domain/settings';
import { MAX_TRANSCRIPT_CHARS } from '@shared/domain/history';
import type { AppPaths } from '../app/paths';
import { DictationController } from './dictation-controller';
import { HistoryRepository } from './history-repository';
import { InferenceHost } from './inference-host';
import { ModelManager } from './model-manager';
import { OverlayController } from './overlay-controller';
import { SettingsStore } from './settings-store';
import type { ShortcutService } from './shortcuts';
import { collectSystemStatus } from './system-status';
import { TextInserter } from './text-insertion';
import type { TrayService } from './tray';

export interface Services {
  paths: AppPaths;
  settings: SettingsStore;
  history: HistoryRepository;
  models: ModelManager;
  inference: InferenceHost;
  inserter: TextInserter;
  shortcuts: ShortcutService;
  tray: TrayService;
  overlay: OverlayController;
  dictation: DictationController;
  /** Records the devices the capturing window can see, for the tray and the id allow-list. */
  reportDevices(devices: AudioDevice[]): void;
  /** The devices last reported, so the overlay can offer the same set the tray does. */
  listDevices(): AudioDevice[];
  /** Installed recognition models, in catalog order. */
  installedSttModels(): { id: ModelId; label: string }[];
  /** Validates a settings patch against the known devices before persisting it. */
  updateSettings(patch: SettingsPatch): Settings;
  window(): BrowserWindow | null;
  status(): SystemStatus;
  runModel<T>(id: ModelId, operation: () => Promise<T>): Promise<T>;
  ensureLoaded(id: ModelId): Promise<void>;
  unloadModel(id: ModelId): Promise<void>;
  activateModel(id: ModelId): Promise<void>;
  verifyModel(id: ModelId): Promise<void>;
  removeModel(id: ModelId): Promise<void>;
  modelStatuses(): ModelStatus[];
  dispose(): Promise<void>;
  readClipboard(): Promise<string>;
}

export function createServices(options: {
  paths: AppPaths;
  tray: TrayService;
  shortcuts: ShortcutService;
  window(): BrowserWindow | null;
  /** Delivers a command to the capturing window. Returns false when it cannot receive one. */
  command(command: AppCommand): boolean;
  /** Brings the capturing window back, because capture needs a live renderer. */
  showWindow(): void;
}): Services {
  const { paths } = options;
  const settings = new SettingsStore(paths.settings);
  const inference = new InferenceHost();
  const models = new ModelManager(paths.models, paths.downloads, (id) => inference.isLoaded(id));
  const history = new HistoryRepository(paths.database);
  const inserter = new TextInserter();
  // The capturing window is the only source of device ids, so its last report doubles as
  // the allow-list. Nothing else may name an input device.
  const reportedDevices: AudioDevice[] = [];
  function reportDevices(devices: AudioDevice[]): void {
    reportedDevices.length = 0;
    reportedDevices.push(...devices);
    options.tray.setDevices(reportedDevices);
  }
  /**
   * Rejects an input id the capturing window never enumerated. Reserved ids always pass,
   * and an empty report means the window has not enumerated yet, so nothing is rejected.
   */
  function knownInputDevice(id: string): boolean {
    if (RESERVED_DEVICE_IDS.includes(id)) return true;
    if (!reportedDevices.length) return true;
    return reportedDevices.some((device) => device.id === id);
  }
  function applySettings(patch: SettingsPatch): Settings {
    const deviceId = patch.audio?.inputDeviceId;
    if (deviceId !== undefined && !knownInputDevice(deviceId)) {
      throw new Error('Unknown input device');
    }
    return settings.update(patch);
  }
  const overlay = new OverlayController({
    settings: () => settings.get(),
    window: options.window,
    // The overlay offers exactly what the tray offers: the last enumeration this process
    // received, and the recognition models actually on disk.
    devices: () => reportedDevices,
    models: () =>
      models
        .list()
        .filter((model) => model.kind === 'stt' && models.isInstalled(model.id))
        .map((model) => ({ id: model.id, label: model.name })),
  });
  const dictation = new DictationController({
    settings: () => settings.get(),
    command: options.command,
    showWindow: options.showWindow,
    overlay,
    onState: (state) => options.tray.setPhase(state.phase, state.startedAt),
  });
  type Lifecycle = Pick<ModelStatus, 'loadState' | 'health' | 'lastUsedAt' | 'error'>;
  const lifecycle = new Map<ModelId, Lifecycle>();
  let queue: Promise<unknown> = Promise.resolve();
  let closing = false;
  let idleTimer: NodeJS.Timeout | undefined;
  function serial<T>(operation: () => Promise<T>): Promise<T> {
    if (closing) return Promise.reject(new Error('Application is shutting down'));
    const job = queue.then(operation);
    queue = job.catch(() => undefined);
    return job;
  }
  function state(id: ModelId): Lifecycle {
    let value = lifecycle.get(id);
    if (!value) {
      value = { loadState: 'unloaded', health: 'unchecked' };
      lifecycle.set(id, value);
    }
    return value;
  }
  function modelStatuses(): ModelStatus[] {
    const current = settings.get();
    return models.list().map((model) => {
      const value = state(model.id);
      const installed = models.isInstalled(model.id);
      const loaded = inference.isLoaded(model.id);
      return { ...model, ...value, error: value.error ?? model.error, installed, loaded,
        active: current[model.kind].modelId === model.id,
        loadState: loaded && value.loadState !== 'unloading' ? 'loaded' : value.loadState === 'loaded' ? 'unloaded' : value.loadState,
        health: installed ? value.health : 'unavailable',
      };
    });
  }
  function notify(): void {
    options.tray.setModels(modelStatuses());
    inference.emit('health', inference.getHealth());
  }
  function scheduleIdle(): void {
    clearTimeout(idleTimer);
    if (closing || !settings.get().system.autoUnload) return;
    const loaded = MODEL_IDS.filter((id) => inference.isLoaded(id));
    if (!loaded.length) return;
    const latestUse = Math.max(...loaded.map((id) => state(id).lastUsedAt ?? Date.now()));
    const delay = Math.max(1, latestUse + settings.get().system.idleMinutes * 60_000 - Date.now());
    idleTimer = setTimeout(() => {
      void serial(async () => {
        const current = settings.get().system;
        const resident = MODEL_IDS.filter((id) => inference.isLoaded(id));
        if (current.autoUnload && resident.length && resident.every((id) => Date.now() - (state(id).lastUsedAt ?? Date.now()) >= current.idleMinutes * 60_000)) {
          const next = resident[0];
          if (next) await unload(next);
        }
      }).catch(console.error).finally(scheduleIdle);
    }, delay);
    idleTimer.unref();
  }
  async function unload(id: ModelId): Promise<void> {
    if (!inference.isLoaded(id)) { state(id).loadState = 'unloaded'; notify(); return; }
    // Worker termination releases all native handles, including the other model kind.
    const resident = MODEL_IDS.filter((candidate) => inference.isLoaded(candidate));
    resident.forEach((candidate) => { state(candidate).loadState = 'unloading'; });
    notify();
    try { await inference.unload(MODEL_CATALOG[id].kind); }
    finally {
      resident.forEach((candidate) => { state(candidate).loadState = 'unloaded'; });
      notify();
    }
  }
  async function load(id: ModelId): Promise<void> {
    if (inference.isLoaded(id)) return;
    if (!models.isInstalled(id)) throw new Error(`${MODEL_CATALOG[id].name} is not installed`);
    const model = MODEL_CATALOG[id];
    const previous = MODEL_IDS.find((candidate) => MODEL_CATALOG[candidate].kind === model.kind && inference.isLoaded(candidate));
    if (previous) await unload(previous);
    const value = state(id);
    value.loadState = 'loading';
    value.error = undefined;
    notify();
    try {
      const dir = models.directory(id);
      const threads = settings.get().stt.threads;
      if (model.layout.kind === 'stt') await inference.loadStt({ type: 'stt:load', modelId: id, dir, layout: model.layout, threads });
      else await inference.loadTts({ type: 'tts:load', modelId: id, dir, layout: model.layout, threads: Math.min(threads, 4) });
      value.loadState = 'loaded';
      value.health = 'healthy';
      value.lastUsedAt = Date.now();
    } catch (error) {
      value.loadState = 'error';
      value.health = 'error';
      value.error = error instanceof Error ? error.message : String(error);
      throw error;
    } finally { notify(); scheduleIdle(); }
  }
  inference.on('health', (health) => {
    if (health.state === 'crashed') {
      for (const value of lifecycle.values()) {
        if (value.loadState === 'loaded' || value.loadState === 'loading') {
          value.loadState = 'error'; value.health = 'error'; value.error = health.lastError;
        }
      }
    }
    options.tray.setModels(modelStatuses());
  });
  models.on('progress', (event) => {
    const id = event.id as ModelId;
    if (event.state === 'installed' || event.state === 'missing') {
      const value = state(id);
      value.error = undefined;
      value.health = inference.isLoaded(id) ? 'healthy' : 'unchecked';
      if (!inference.isLoaded(id)) value.loadState = 'unloaded';
    }
    notify();
  });
  settings.on('change', (next, previous) => {
    scheduleIdle();
    for (const kind of ['stt', 'tts'] as const) {
      if (next[kind].modelId !== previous[kind].modelId || (kind === 'stt' && next.stt.threads !== previous.stt.threads)) {
        void serial(async () => {
          const oldId = previous[kind].modelId;
          if (settings.get()[kind].modelId !== oldId || next.stt.threads !== previous.stt.threads) await unload(oldId);
        }).catch(console.error);
      }
    }
    notify();
  });

  return {
    paths, settings, history, models, inference, inserter,
    shortcuts: options.shortcuts, tray: options.tray, window: options.window,
    overlay, dictation, reportDevices, updateSettings: applySettings,
    listDevices: () => reportedDevices,
    installedSttModels: () =>
      MODEL_IDS.filter((id) => MODEL_CATALOG[id].kind === 'stt' && models.isInstalled(id)).map(
        (id) => ({ id, label: MODEL_CATALOG[id].name }),
      ),
    status: () => {
      const base = collectSystemStatus({
        paths, models, inference, inserter,
        shortcuts: options.shortcuts,
        overlay,
        tray: options.tray,
      });
      const win = options.window();
      return { ...base, models: modelStatuses(), window: {
        maximized: !!win && !win.isDestroyed() && win.isMaximized(),
        minimizable: !!win && !win.isDestroyed() && win.isMinimizable(),
        maximizable: !!win && !win.isDestroyed() && win.isMaximizable(),
        closable: !!win && !win.isDestroyed() && win.isClosable(),
        focused: !!win && !win.isDestroyed() && win.isFocused(),
        fullscreen: !!win && !win.isDestroyed() && win.isFullScreen(),
      } };
    },
    modelStatuses,
    ensureLoaded: (id) => serial(() => load(id)),
    runModel: (id, operation) => serial(async () => {
      clearTimeout(idleTimer);
      await load(id);
      try { return await operation(); }
      finally { state(id).lastUsedAt = Date.now(); notify(); scheduleIdle(); }
    }),
    unloadModel: (id) => serial(async () => { await unload(id); scheduleIdle(); }),
    activateModel: (id) => serial(async () => {
      // A model only ever becomes active in the kind it belongs to, so the id is narrowed
      // by the catalog rather than asserted: what is persisted is always schema-valid.
      const model = MODEL_CATALOG[id];
      if (model.kind === 'stt') {
        const sttId = sttModelIdSchema.safeParse(id);
        if (!sttId.success) throw new Error(`${model.name} cannot be used for dictation`);
        await load(id);
        settings.update({ stt: { modelId: sttId.data } });
      } else {
        const ttsId = ttsModelIdSchema.safeParse(id);
        if (!ttsId.success) throw new Error(`${model.name} cannot be used for speech`);
        await load(id);
        settings.update({ tts: { modelId: ttsId.data } });
      }
      notify();
    }),
    verifyModel: (id) => serial(async () => {
      await models.cancel(id);
      await unload(id);
      try { await models.verify(id); await load(id); }
      catch (error) {
        const value = state(id); value.health = 'error'; value.error = error instanceof Error ? error.message : String(error);
        notify(); throw error;
      }
    }),
    removeModel: (id) => serial(async () => {
      await models.cancel(id);
      await unload(id);
      await models.remove(id);
      lifecycle.delete(id); notify(); scheduleIdle();
    }),
    dispose: async () => {
      closing = true;
      clearTimeout(idleTimer);
      dictation.dispose();
      overlay.destroy();
      models.cancelAll();
      await inference.stop();
      await queue;
      await inference.stop();
      history.close();
    },
    readClipboard: async () => (await clipboard.readText()).slice(0, MAX_TRANSCRIPT_CHARS),
  };
}
