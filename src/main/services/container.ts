import { clipboard, type BrowserWindow } from 'electron';
import { MODEL_CATALOG, type ModelId } from '@shared/domain/models';
import type { SystemStatus } from '@shared/domain/system';
import { MAX_TRANSCRIPT_CHARS } from '@shared/domain/history';
import type { AppPaths } from '../app/paths';
import { HistoryRepository } from './history-repository';
import { InferenceHost } from './inference-host';
import { ModelManager } from './model-manager';
import { SettingsStore } from './settings-store';
import type { ShortcutService } from './shortcuts';
import { collectSystemStatus } from './system-status';
import { TextInserter } from './text-insertion';
import type { TrayService } from './tray';

/** Every long-lived main-process service, created once at startup. */
export interface Services {
  paths: AppPaths;
  settings: SettingsStore;
  history: HistoryRepository;
  models: ModelManager;
  inference: InferenceHost;
  inserter: TextInserter;
  shortcuts: ShortcutService;
  tray: TrayService;
  window(): BrowserWindow | null;
  status(): SystemStatus;
  ensureLoaded(id: ModelId): Promise<void>;
  readClipboard(): Promise<string>;
}

export function createServices(options: {
  paths: AppPaths;
  tray: TrayService;
  shortcuts: ShortcutService;
  window(): BrowserWindow | null;
}): Services {
  const { paths } = options;
  const settings = new SettingsStore(paths.settings);
  const inference = new InferenceHost();
  const models = new ModelManager(paths.models, paths.downloads, (id) => inference.isLoaded(id));
  const history = new HistoryRepository(paths.database);
  const inserter = new TextInserter();

  const loading = new Map<ModelId, Promise<void>>();
  async function ensureLoaded(id: ModelId): Promise<void> {
    if (inference.isLoaded(id)) return;
    if (!models.isInstalled(id)) throw new Error(`${MODEL_CATALOG[id].name} is not installed`);
    const inflight = loading.get(id);
    if (inflight) return inflight;
    const model = MODEL_CATALOG[id];
    const dir = models.directory(id);
    const threads = settings.get().stt.threads;
    const job =
      model.layout.kind === 'stt'
        ? inference.loadStt({ type: 'stt:load', modelId: id, dir, layout: model.layout, threads })
        : inference.loadTts({ type: 'tts:load', modelId: id, dir, layout: model.layout, threads: Math.min(threads, 4) });
    loading.set(id, job);
    try {
      await job;
    } finally {
      loading.delete(id);
    }
  }

  return {
    paths,
    settings,
    history,
    models,
    inference,
    inserter,
    shortcuts: options.shortcuts,
    tray: options.tray,
    window: options.window,
    status: () =>
      collectSystemStatus({ paths, models, inference, shortcuts: options.shortcuts, inserter }),
    ensureLoaded,
    readClipboard: async () => (await clipboard.readText()).slice(0, MAX_TRANSCRIPT_CHARS),
  };
}
