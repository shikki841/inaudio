import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import * as tar from 'tar';
import bz2 from 'unbzip2-stream';
import {
  MODEL_CATALOG,
  MODEL_IDS,
  modelBytes,
  type ModelDescriptor,
  type ModelId,
  type ModelStatus,
} from '@shared/domain/models';
import type { ModelProgressEvent } from '@shared/domain/system';
import { resolveInside } from '../app/paths';
import { downloadVerified } from './downloader';

const MARKER = '.installed.json';

interface ActiveDownload {
  controller: AbortController;
  bytesDone: number;
  state: 'downloading' | 'verifying';
}

/**
 * Owns the models directory. Model ids map to catalog entries; the renderer
 * never supplies a path.
 */
export class ModelManager extends EventEmitter<{ progress: [ModelProgressEvent] }> {
  private readonly active = new Map<ModelId, ActiveDownload>();
  private readonly errors = new Map<ModelId, string>();

  constructor(
    private readonly modelsRoot: string,
    private readonly downloadsRoot: string,
    private readonly isLoaded: (id: ModelId) => boolean,
  ) {
    super();
  }

  directory(id: ModelId): string {
    return resolveInside(this.modelsRoot, MODEL_CATALOG[id].id);
  }

  isInstalled(id: ModelId): boolean {
    const model = MODEL_CATALOG[id];
    const dir = this.directory(id);
    if (!fs.existsSync(path.join(dir, MARKER))) return false;
    return requiredFiles(model).every((file) => fs.existsSync(resolveInside(dir, file)));
  }

  status(id: ModelId): ModelStatus {
    const model = MODEL_CATALOG[id];
    const active = this.active.get(id);
    const total = modelBytes(model);
    const installed = this.isInstalled(id);
    const error = this.errors.get(id);
    return {
      id,
      kind: model.kind,
      state: active?.state ?? (installed ? 'installed' : error ? 'error' : 'missing'),
      bytesTotal: total,
      bytesDone: active ? active.bytesDone : installed ? total : 0,
      loaded: installed && this.isLoaded(id),
      ...(error ? { error } : {}),
    };
  }

  list(): ModelStatus[] {
    return MODEL_IDS.map((id) => this.status(id));
  }

  async download(id: ModelId): Promise<void> {
    if (this.active.has(id) || this.isInstalled(id)) return;
    const model = MODEL_CATALOG[id];
    const controller = new AbortController();
    const job: ActiveDownload = { controller, bytesDone: 0, state: 'downloading' };
    this.active.set(id, job);
    this.errors.delete(id);
    const staging = resolveInside(this.downloadsRoot, `${id}.staging`);
    let lastEmit = 0;
    const report = (force = false) => {
      const now = Date.now();
      if (!force && now - lastEmit < 200) return;
      lastEmit = now;
      this.emit('progress', { ...this.status(id) });
    };

    try {
      await fs.promises.rm(staging, { recursive: true, force: true });
      await fs.promises.mkdir(staging, { recursive: true, mode: 0o700 });
      report(true);
      for (const [index, artifact] of model.artifacts.entries()) {
        const onProgress = (bytes: number) => {
          job.bytesDone += bytes;
          report();
        };
        if (artifact.type === 'file') {
          const target = resolveInside(staging, artifact.path);
          await fs.promises.mkdir(path.dirname(target), { recursive: true });
          await downloadVerified({
            url: artifact.url,
            destination: target,
            expectedBytes: artifact.bytes,
            expectedSha256: artifact.sha256,
            signal: controller.signal,
            onProgress,
          });
        } else {
          const archive = resolveInside(this.downloadsRoot, `${id}.${index}.tar.bz2`);
          await downloadVerified({
            url: artifact.url,
            destination: archive,
            expectedBytes: artifact.bytes,
            expectedSha256: artifact.sha256,
            signal: controller.signal,
            onProgress,
          });
          job.state = 'verifying';
          report(true);
          try {
            await extractTarBz2(archive, staging, artifact.stripPrefix, controller.signal);
          } finally {
            await fs.promises.rm(archive, { force: true });
          }
          for (const file of artifact.expect) {
            if (!fs.existsSync(resolveInside(staging, file))) {
              throw new Error(`Archive is missing ${file}`);
            }
          }
        }
      }
      await fs.promises.writeFile(
        path.join(staging, MARKER),
        JSON.stringify({ id, installedAt: Date.now(), bytes: modelBytes(model) }),
      );
      const finalDir = this.directory(id);
      await fs.promises.rm(finalDir, { recursive: true, force: true });
      await fs.promises.rename(staging, finalDir);
    } catch (error) {
      await fs.promises.rm(staging, { recursive: true, force: true });
      const aborted = controller.signal.aborted;
      if (!aborted) this.errors.set(id, error instanceof Error ? error.message : String(error));
      if (!aborted) throw error;
    } finally {
      this.active.delete(id);
      report(true);
    }
  }

  cancel(id: ModelId): void {
    this.active.get(id)?.controller.abort();
  }

  async remove(id: ModelId): Promise<void> {
    this.cancel(id);
    this.errors.delete(id);
    await fs.promises.rm(this.directory(id), { recursive: true, force: true });
    this.emit('progress', { ...this.status(id) });
  }

  cancelAll(): void {
    for (const job of this.active.values()) job.controller.abort();
  }
}

function requiredFiles(model: ModelDescriptor): string[] {
  const layout = model.layout;
  if (layout.kind === 'stt') return [layout.encoder, layout.decoder, layout.joiner, layout.tokens];
  return [layout.model, layout.voices, layout.tokens, path.join(layout.dataDir, 'phontab')];
}

async function extractTarBz2(
  archive: string,
  destination: string,
  stripPrefix: string,
  signal: AbortSignal,
): Promise<void> {
  await pipeline(
    fs.createReadStream(archive),
    bz2(),
    tar.x({
      cwd: destination,
      strip: 1,
      // Only regular files and directories inside the expected top-level folder.
      filter: (entryPath, entry) => {
        const type = 'type' in entry ? entry.type : undefined;
        const normalized = entryPath.replace(/\\/g, '/');
        return (
          (type === 'File' || type === 'Directory') &&
          (normalized === stripPrefix || normalized.startsWith(`${stripPrefix}/`)) &&
          !normalized.split('/').includes('..')
        );
      },
    }),
    { signal },
  );
}
