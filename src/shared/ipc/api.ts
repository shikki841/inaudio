import type { HistoryPage, HistoryQuery, Transcript } from '../domain/history';
import type { ModelId, ModelStatus, VoiceId } from '../domain/models';
import type { Settings, SettingsPatch } from '../domain/settings';
import type {
  AppMenuCommand,
  AppCommand,
  DictationPhase,
  ModelProgressEvent,
  SystemStatus,
  WindowAction,
} from '../domain/system';
import type { ExternalLinkId } from './schemas';

export interface TranscribeResult {
  transcript: Transcript | null;
  text: string;
  inserted: boolean;
  insertError?: string;
}

export interface SpeakResult {
  samples: Float32Array;
  sampleRate: number;
  inferenceMs: number;
}

type Unsubscribe = () => void;

/** The complete surface exposed to the renderer as `window.inaudio`. */
export interface InaudioApi {
  system: {
    status(): Promise<SystemStatus>;
    openLink(id: ExternalLinkId): Promise<void>;
    revealModels(): Promise<void>;
    window(action: WindowAction): Promise<void>;
    menu(command: AppMenuCommand): Promise<void>;
  };
  settings: {
    get(): Promise<Settings>;
    update(patch: SettingsPatch): Promise<Settings>;
  };
  models: {
    list(): Promise<ModelStatus[]>;
    download(id: ModelId): Promise<void>;
    cancel(id: ModelId): Promise<void>;
    remove(id: ModelId): Promise<void>;
    load(id: ModelId): Promise<void>;
  };
  dictation: {
    transcribe(samples: Float32Array, options: { insert: boolean }): Promise<TranscribeResult>;
    setPhase(phase: DictationPhase): void;
  };
  text: {
    insert(text: string): Promise<void>;
    copy(text: string): Promise<void>;
    readClipboard(): Promise<string>;
  };
  tts: {
    speak(input: { text: string; voiceId?: VoiceId; speed?: number }): Promise<SpeakResult>;
  };
  history: {
    list(query: HistoryQuery): Promise<HistoryPage>;
    remove(id: string): Promise<void>;
    clear(): Promise<void>;
  };
  events: {
    onCommand(listener: (command: AppCommand) => void): Unsubscribe;
    onModelProgress(listener: (event: ModelProgressEvent) => void): Unsubscribe;
    onStatusChanged(listener: () => void): Unsubscribe;
    onSettingsChanged(listener: (settings: Settings) => void): Unsubscribe;
  };
}
