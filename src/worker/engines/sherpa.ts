import { createRequire } from 'node:module';

/**
 * sherpa-onnx-node ships prebuilt native addons per platform. It is loaded
 * lazily so the worker can boot and report errors even if the addon fails.
 */
export interface SherpaModule {
  OfflineRecognizer: {
    createAsync(config: unknown): Promise<SherpaRecognizer>;
  };
  OfflineTts: {
    createAsync(config: unknown): Promise<SherpaTts>;
  };
  OnlineRecognizer: new (config: unknown) => SherpaOnlineRecognizer;
}

export interface SherpaStream {
  acceptWaveform(input: { samples: Float32Array; sampleRate: number }): void;
}

export interface SherpaRecognizer {
  createStream(): SherpaStream;
  decodeAsync(stream: SherpaStream): Promise<{ text: string; lang?: string }>;
}

export interface SherpaOnlineStream {
  acceptWaveform(input: { samples: Float32Array; sampleRate: number }): void;
  inputFinished(): void;
}

export interface SherpaOnlineRecognizer {
  createStream(): SherpaOnlineStream;
  isReady(stream: SherpaOnlineStream): boolean;
  decode(stream: SherpaOnlineStream): void;
  getResult(stream: SherpaOnlineStream): { text: string; lang?: string };
}

export interface SherpaTts {
  numSpeakers: number;
  sampleRate: number;
  generateAsync(input: {
    text: string;
    sid: number;
    speed: number;
    enableExternalBuffer?: boolean;
  }): Promise<{
    samples: Float32Array;
    sampleRate: number;
  }>;
}

let cached: SherpaModule | null = null;

export function loadSherpa(): SherpaModule {
  if (!cached) {
    const require = createRequire(__filename);
    cached = require('sherpa-onnx-node') as SherpaModule;
  }
  return cached;
}
