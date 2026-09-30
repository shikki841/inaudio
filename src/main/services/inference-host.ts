import { EventEmitter } from 'node:events';
import path from 'node:path';
import { utilityProcess, type UtilityProcess } from 'electron';
import type { WorkerHealth } from '@shared/domain/system';
import type {
  PingResult,
  SttResult,
  TtsResult,
  WorkerMessage,
  WorkerRequest,
} from '@shared/worker/protocol';

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type RequestInput = DistributiveOmit<WorkerRequest, 'id'>;

interface Pending {
  resolve(value: unknown): void;
  reject(error: Error): void;
  timer: NodeJS.Timeout;
}

const TIMEOUTS: Record<RequestInput['type'], number> = {
  'stt:load': 120_000,
  'stt:transcribe': 180_000,
  'tts:load': 120_000,
  'tts:speak': 180_000,
  unload: 10_000,
  ping: 5_000,
};

const MAX_RESTARTS = 5;

/**
 * Supervises the inference utility process: request/response correlation,
 * timeouts, crash detection and bounded restarts.
 */
export class InferenceHost extends EventEmitter<{ health: [WorkerHealth] }> {
  private child: UtilityProcess | null = null;
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();
  private ready: Promise<void> | null = null;
  private health: WorkerHealth = { state: 'stopped', restarts: 0 };
  private stopping = false;
  private loaded: { stt?: string; tts?: string } = {};

  constructor(private readonly entry: string = path.join(__dirname, 'inference-worker.js')) {
    super();
  }

  getHealth(): WorkerHealth {
    return { ...this.health, loadedStt: this.loaded.stt, loadedTts: this.loaded.tts };
  }

  isLoaded(modelId: string): boolean {
    return this.loaded.stt === modelId || this.loaded.tts === modelId;
  }

  start(): Promise<void> {
    if (this.ready) return this.ready;
    this.stopping = false;
    this.setHealth({ state: 'starting' });
    const child = utilityProcess.fork(this.entry, [], {
      serviceName: 'Inaudio Inference',
      stdio: 'pipe',
    });
    this.child = child;
    child.stdout?.on('data', (d: Buffer) => process.stdout.write(`[inference] ${d}`));
    child.stderr?.on('data', (d: Buffer) => process.stderr.write(`[inference] ${d}`));

    this.ready = new Promise<void>((resolve, reject) => {
      const onBoot = setTimeout(() => reject(new Error('Inference worker did not start')), 15_000);
      child.on('message', (message: WorkerMessage) => {
        if ('type' in message) {
          if (message.type === 'ready') {
            clearTimeout(onBoot);
            this.setHealth({ state: 'ready', pid: child.pid, lastError: undefined });
            resolve();
          } else if (message.type === 'log') {
            console[message.level](`[inference] ${message.message}`);
          }
          return;
        }
        const pending = this.pending.get(message.id);
        if (!pending) return;
        clearTimeout(pending.timer);
        this.pending.delete(message.id);
        if (this.pending.size === 0 && this.health.state === 'busy') this.setHealth({ state: 'ready' });
        if (message.ok) pending.resolve(message.result);
        else pending.reject(new Error(message.error));
      });
      child.once('exit', (code) => {
        clearTimeout(onBoot);
        this.handleExit(code);
        reject(new Error(`Inference worker exited (${code})`));
      });
    });
    this.ready.catch(() => undefined);
    return this.ready;
  }

  async stop(): Promise<void> {
    this.stopping = true;
    this.child?.kill();
    this.child = null;
    this.ready = null;
  }

  async loadStt(input: Extract<RequestInput, { type: 'stt:load' }>): Promise<void> {
    if (this.loaded.stt === input.modelId) return;
    await this.request(input);
    this.loaded.stt = input.modelId;
    this.emit('health', this.getHealth());
  }

  async loadTts(input: Extract<RequestInput, { type: 'tts:load' }>): Promise<void> {
    if (this.loaded.tts === input.modelId) return;
    await this.request(input);
    this.loaded.tts = input.modelId;
    this.emit('health', this.getHealth());
  }

  transcribe(samples: Float32Array, sampleRate: number): Promise<SttResult> {
    return this.request({ type: 'stt:transcribe', samples, sampleRate }) as Promise<SttResult>;
  }

  speak(text: string, sid: number, speed: number): Promise<TtsResult> {
    return this.request({ type: 'tts:speak', text, sid, speed }) as Promise<TtsResult>;
  }

  async unload(kind: 'stt' | 'tts' | 'all'): Promise<void> {
    if (!this.child) return;
    await this.request({ type: 'unload', kind });
    if (kind !== 'tts') delete this.loaded.stt;
    if (kind !== 'stt') delete this.loaded.tts;
    this.emit('health', this.getHealth());
  }

  ping(): Promise<PingResult> {
    return this.request({ type: 'ping' }) as Promise<PingResult>;
  }

  private async request(input: RequestInput): Promise<unknown> {
    await this.start();
    const child = this.child;
    if (!child) throw new Error('Inference worker is not running');
    const id = this.nextId++;
    const message = { ...input, id } as WorkerRequest;
    if (input.type !== 'ping') this.setHealth({ state: 'busy' });
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Inference request timed out (${input.type})`));
      }, TIMEOUTS[input.type]);
      this.pending.set(id, { resolve, reject, timer });
      child.postMessage(message);
    });
  }

  private handleExit(code: number): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new Error('Inference worker stopped'));
      this.pending.delete(id);
    }
    this.child = null;
    this.ready = null;
    this.loaded = {};
    if (this.stopping) {
      this.setHealth({ state: 'stopped' });
      return;
    }
    const restarts = this.health.restarts + 1;
    this.setHealth({ state: 'crashed', restarts, lastError: `Exited with code ${code}`, pid: undefined });
    if (restarts <= MAX_RESTARTS) {
      setTimeout(() => void this.start().catch(() => undefined), Math.min(30_000, 500 * 2 ** restarts));
    }
  }

  private setHealth(patch: Partial<WorkerHealth>): void {
    this.health = { ...this.health, ...patch };
    this.emit('health', this.getHealth());
  }
}
