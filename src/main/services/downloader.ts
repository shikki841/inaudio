import { session, type Session } from 'electron';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable, Transform } from 'node:stream';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import { MODEL_CATALOG } from '@shared/domain/models';
import { assertSafePath } from './model-integrity';

let downloadSession: Session | null = null;
const CDN_HOSTS = new Set([
  'huggingface.co', 'hf.co', 'cdn-lfs.huggingface.co', 'cdn-lfs.hf.co',
  'cdn-lfs-us-1.hf.co', 'cdn-lfs-eu-1.hf.co',
  'cas-bridge.xethub.hf.co', 'transfer.xethub.hf.co',
  'github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com',
]);

export function isAllowedModelDownloadUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && !url.username && !url.password &&
      !url.port && !url.hash && CDN_HOSTS.has(url.hostname);
  } catch { return false; }
}

function modelSession(): Session {
  if (!downloadSession) {
    downloadSession = session.fromPartition('inaudio-model-downloads', { cache: false });
    downloadSession.webRequest.onBeforeRequest((details, callback) => {
      callback({ cancel: !isAllowedModelDownloadUrl(details.url) });
    });
    downloadSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  }
  return downloadSession;
}

export interface DownloadOptions {
  url: string;
  destination: string;
  expectedBytes: number;
  expectedSha256: string;
  signal: AbortSignal;
  onProgress(bytes: number): void;
}

/** Only catalog source URLs may initiate a download; every redirect uses an exact host list. */
export async function downloadVerified(options: DownloadOptions): Promise<void> {
  const { url, destination, expectedBytes, expectedSha256, signal, onProgress } = options;
  if (!Object.values(MODEL_CATALOG).some((model) => model.artifacts.some((artifact) =>
    artifact.url === url && artifact.bytes === expectedBytes && artifact.sha256 === expectedSha256)) ||
    !isAllowedModelDownloadUrl(url)) throw new Error('Untrusted model download');
  assertSafePath(path.dirname(destination));
  const partial = `${destination}.${randomUUID()}.partial`;
  const controller = new AbortController();
  const abort = () => controller.abort(signal.reason);
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) abort();
  const totalTimer = setTimeout(() => controller.abort(new Error('Download exceeded 60 minutes')), 60 * 60_000);
  let idleTimer = setTimeout(() => controller.abort(new Error('Download connection timed out')), 30_000);
  let created = false;
  let response: Response | undefined;
  try {
    response = await modelSession().fetch(url, { redirect: 'follow', signal: controller.signal, cache: 'no-store', credentials: 'omit' });
    if (!response.ok || !response.body || !isAllowedModelDownloadUrl(response.url)) {
      throw new Error(`Download failed (HTTP ${response.status})`);
    }
    const length = response.headers.get('content-length');
    if (length !== null && Number(length) !== expectedBytes) throw new Error('Unexpected download length');
    const hash = createHash('sha256');
    let received = 0;
    const resetIdle = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => controller.abort(new Error('Download stalled')), 60_000);
    };
    resetIdle();
    const meter = new Transform({ transform(chunk: Buffer, _encoding, callback) {
      resetIdle();
      received += chunk.length;
      if (received > expectedBytes) return callback(new Error('Download is larger than expected'));
      hash.update(chunk);
      onProgress(chunk.length);
      callback(null, chunk);
    } });
    const handle = await fs.promises.open(partial, 'wx', 0o600);
    created = true;
    await handle.close();
    await pipeline(
      Readable.fromWeb(response.body as unknown as WebReadableStream<Uint8Array>), meter,
      fs.createWriteStream(partial, { flags: 'wx' }),
      { signal: controller.signal },
    );
    controller.signal.throwIfAborted();
    if (received !== expectedBytes) throw new Error('Download is incomplete');
    if (hash.digest('hex') !== expectedSha256) throw new Error('Checksum mismatch, file discarded');
    assertSafePath(path.dirname(destination));
    if (fs.existsSync(destination)) throw new Error('Download destination already exists');
    await fs.promises.rename(partial, destination);
  } finally {
    clearTimeout(totalTimer);
    clearTimeout(idleTimer);
    signal.removeEventListener('abort', abort);
    controller.abort();
    if (response?.body && !response.body.locked) await response.body.cancel().catch(() => undefined);
    if (created) await fs.promises.rm(partial, { force: true });
  }
}
