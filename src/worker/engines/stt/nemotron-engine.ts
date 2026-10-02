import path from 'node:path';
import type { SttVariant } from '@shared/domain/models';
import type { SttResult } from '@shared/worker/protocol';
import { loadSherpa, type SherpaOnlineRecognizer, type SherpaOnlineStream } from '../sherpa';
import type { SpeechToTextEngine } from '../types';

const DEFAULT_CHUNK_MS = 560;

/** NVIDIA Nemotron Cache-Aware FastConformer-RNNT through sherpa-onnx. */
export class NemotronEngine implements SpeechToTextEngine {
  private constructor(
    readonly modelId: string,
    private readonly recognizer: SherpaOnlineRecognizer,
    private readonly chunkMs: number,
  ) {}

  static create(modelId: string, dir: string, layout: SttVariant, threads: number): NemotronEngine {
    const sherpa = loadSherpa();
    if (layout.modelType !== 'nemotron')
      throw new Error('Nemotron engine received an incompatible model layout');
    const recognizer = new sherpa.OnlineRecognizer({
      featConfig: { sampleRate: layout.sampleRate, featureDim: 80 },
      modelConfig: {
        transducer: {
          encoder: path.join(dir, layout.encoder),
          decoder: path.join(dir, layout.decoder),
          joiner: path.join(dir, layout.joiner),
        },
        tokens: path.join(dir, layout.tokens),
        modelType: 'nemotron',
        numThreads: threads,
        provider: 'cpu',
        debug: 0,
      },
      decodingMethod: 'greedy_search',
      enableEndpoint: false,
    });
    return new NemotronEngine(modelId, recognizer, layout.chunkMs ?? DEFAULT_CHUNK_MS);
  }

  async transcribe(samples: Float32Array, sampleRate: number): Promise<SttResult> {
    const started = performance.now();
    const stream = this.recognizer.createStream();
    const chunkSamples = Math.max(1, Math.round(sampleRate * (this.chunkMs / 1000)));
    for (let offset = 0; offset < samples.length; offset += chunkSamples) {
      const chunk = samples.subarray(offset, Math.min(offset + chunkSamples, samples.length));
      stream.acceptWaveform({ samples: chunk, sampleRate });
      this.decodeReady(stream);
    }
    stream.inputFinished();
    this.decodeReady(stream);
    const result = this.recognizer.getResult(stream);
    return {
      text: result.text.trim(),
      language: result.lang ?? 'en',
      inferenceMs: Math.round(performance.now() - started),
    };
  }

  dispose(): void {
    // Native handles are released by the addon's finalizers once unreferenced.
  }

  private decodeReady(stream: SherpaOnlineStream): void {
    while (this.recognizer.isReady(stream)) this.recognizer.decode(stream);
  }
}
