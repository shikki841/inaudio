import { protocol } from 'electron';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { buildContentSecurityPolicy } from '@shared/security/csp';
import { resolveInside } from '../app/paths';

export const APP_SCHEME = 'app';
export const APP_HOST = 'inaudio';
export const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
};

/** Must run before `app.ready`. */
export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: APP_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
    },
  ]);
}

/** Serves the packaged renderer from `rendererRoot` instead of file://. */
export function handleAppScheme(rendererRoot: string): void {
  const csp = buildContentSecurityPolicy({ dev: false });
  protocol.handle(APP_SCHEME, async (request) => {
    const url = new URL(request.url);
    if (url.host !== APP_HOST || request.method !== 'GET') {
      return new Response('Not found', { status: 404 });
    }
    const pathname = decodeURIComponent(url.pathname);
    let filePath: string;
    try {
      filePath = resolveInside(rendererRoot, pathname === '/' ? 'index.html' : `.${pathname}`);
    } catch {
      return new Response('Forbidden', { status: 403 });
    }
    // Read from disk directly: the session's request filter blocks file:// URLs.
    let body: Buffer;
    try {
      body = await readFile(filePath);
    } catch {
      return new Response('Not found', { status: 404 });
    }
    const ext = path.extname(filePath);
    const headers = new Headers({
      'Content-Type': MIME[ext] ?? 'application/octet-stream',
      'Content-Security-Policy': csp,
      'X-Content-Type-Options': 'nosniff',
    });
    if (ext === '.html') headers.set('Cache-Control', 'no-store');
    return new Response(new Uint8Array(body), { status: 200, headers });
  });
}
