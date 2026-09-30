import type { SttResult, TtsResult } from '@shared/worker/protocol';

export interface SpeechToTextEngine {
  readonly modelId: string;
  transcribe(samples: Float32Array, sampleRate: number): Promise<SttResult>;
  dispose(): void;
}

export interface TextToSpeechEngine {
  readonly modelId: string;
  speak(text: string, sid: number, speed: number): Promise<TtsResult>;
  dispose(): void;
}
