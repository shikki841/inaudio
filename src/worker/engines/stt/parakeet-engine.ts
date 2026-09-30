import path from 'node:path';
import type { SttVariant } from '@shared/domain/models';
import type { SttResult } from '@shared/worker/protocol';
import { loadSherpa, type SherpaRecognizer } from '../sherpa';
import type { SpeechToTextEngine } from '../types';

/** NVIDIA Parakeet TDT (NeMo transducer) through sherpa-onnx. */
export class ParakeetEngine implements SpeechToTextEngine {
  private constructor(
    readonly modelId: string,
    private readonly recognizer: SherpaRecognizer,
  ) {}

  static async create(modelId: string, dir: string, layout: SttVariant, threads: number) {
    const sherpa = loadSherpa();
    const recognizer = await sherpa.OfflineRecognizer.createAsync({
      featConfig: { sampleRate: layout.sampleRate, featureDim: 80 },
      modelConfig: {
        transducer: {
          encoder: path.join(dir, layout.encoder),
          decoder: path.join(dir, layout.decoder),
          joiner: path.join(dir, layout.joiner),
        },
        tokens: path.join(dir, layout.tokens),
        modelType: layout.modelType,
        numThreads: threads,
        provider: 'cpu',
        debug: 0,
      },
      decodingMethod: 'greedy_search',
    });
    return new ParakeetEngine(modelId, recognizer);
  }

  async transcribe(samples: Float32Array, sampleRate: number): Promise<SttResult> {
    const started = performance.now();
    const stream = this.recognizer.createStream();
    stream.acceptWaveform({ samples, sampleRate });
    const result = await this.recognizer.decodeAsync(stream);
    return {
      text: result.text.trim(),
      language: result.lang ?? '',
      inferenceMs: Math.round(performance.now() - started),
    };
  }

  dispose(): void {
    // Native handles are released by the addon's finalizers once unreferenced.
  }
}
