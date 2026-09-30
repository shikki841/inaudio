import { session, type Session } from 'electron';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable, Transform } from 'node:stream';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import { isAllowedDownloadUrl } from '@shared/domain/models';

let downloadSession: Session | null = null;

/**
 * Model downloads use their own in-memory session: the renderer's session
 * blocks every remote request, and this one only reaches allow-listed hosts.
 */
function modelSession(): Session {
  if (!downloadSession) {
    downloadSession = session.fromPartition('inaudio-model-downloads', { cache: false });
    downloadSession.webRequest.onBeforeRequest((details, callback) => {
      callback({ cancel: !isAllowedDownloadUrl(details.url) });
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

// Electron's net.fetch cannot surface a manual redirect, so redirects are
// followed and each hop is checked by the session's onBeforeRequest filter.
async function fetchAllowed(url: string, signal: AbortSignal): Promise<Response> {
  if (!isAllowedDownloadUrl(url)) throw new Error(`Blocked download host: ${new URL(url).host}`);
  const response = await modelSession().fetch(url, { redirect: 'follow', signal, cache: 'no-store' });
  if (response.url && !isAllowedDownloadUrl(response.url)) {
    throw new Error(`Blocked download host: ${new URL(response.url).host}`);
  }
  if (!response.ok || !response.body) throw new Error(`Download failed (HTTP ${response.status})`);
  return response;
}

/** Streams a pinned artifact to disk, checking size and SHA-256 before it is kept. */
export async function downloadVerified(options: DownloadOptions): Promise<void> {
  const { url, destination, expectedBytes, expectedSha256, signal, onProgress } = options;
  const partial = `${destination}.partial`;
  const response = await fetchAllowed(url, signal);
  const hash = createHash('sha256');
  let received = 0;

  const meter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      received += chunk.length;
      if (received > expectedBytes) {
        callback(new Error('Download is larger than expected'));
        return;
      }
      hash.update(chunk);
      onProgress(chunk.length);
      callback(null, chunk);
    },
  });

  try {
    await pipeline(
      Readable.fromWeb(response.body as unknown as WebReadableStream<Uint8Array>),
      meter,
      fs.createWriteStream(partial, { mode: 0o600 }),
      { signal },
    );
    if (received !== expectedBytes) throw new Error('Download is incomplete');
    const digest = hash.digest('hex');
    if (digest !== expectedSha256) throw new Error('Checksum mismatch, file discarded');
    await fs.promises.rename(partial, destination);
  } catch (error) {
    await fs.promises.rm(partial, { force: true });
    throw error;
  }
}
