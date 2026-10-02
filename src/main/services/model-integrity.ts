import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import * as tar from 'tar';
import bz2 from 'unbzip2-stream';

export interface IntegrityFile {
  path: string;
  bytes: number;
  sha256: string;
}

export function assertSafePath(target: string): void {
  const absolute = path.resolve(target);
  let current = path.parse(absolute).root;
  for (const part of absolute.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) throw new Error(`Symbolic links are not allowed: ${current}`);
  }
}

export function safeRelative(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= 1024 &&
    !value.includes('\\') &&
    !value.includes(':') &&
    !value.includes('\0') &&
    value
      .split('/')
      .every(
        (part) =>
          part !== '' &&
          part !== '.' &&
          part !== '..' &&
          !/[. ]$/.test(part) &&
          !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part),
      )
  );
}

function stamp(stat: fs.Stats): string {
  return [stat.dev, stat.ino, stat.size, stat.mtimeMs, stat.ctimeMs, stat.mode].join(':');
}

/** A cheap cache check; explicit verification still hashes every byte. */
export function snapshot(root: string, files: readonly IntegrityFile[]): Map<string, string> {
  assertSafePath(root);
  const result = new Map<string, string>();
  const expected = new Map(files.map((file) => [file.path, file.bytes]));
  const walk = (directory: string, relative: string) => {
    const dirStat = fs.lstatSync(directory);
    if (!dirStat.isDirectory() || dirStat.isSymbolicLink())
      throw new Error('Unsafe model directory');
    result.set(relative, stamp(dirStat));
    for (const name of fs.readdirSync(directory)) {
      const key = relative ? `${relative}/${name}` : name;
      const target = path.join(directory, name);
      const stat = fs.lstatSync(target);
      if (stat.isSymbolicLink()) throw new Error(`Symbolic link in model: ${key}`);
      if (stat.isDirectory()) {
        if (!files.some((file) => file.path.startsWith(`${key}/`)))
          throw new Error(`Unexpected directory: ${key}`);
        walk(target, key);
      } else {
        if (!stat.isFile()) throw new Error(`Not a regular file: ${key}`);
        if (key === '.installed.json') continue;
        if (!expected.has(key)) throw new Error(`Unexpected or damaged model file: ${key}`);
        if (expected.get(key) && expected.get(key) !== stat.size)
          throw new Error(`Unexpected or damaged model file: ${key}`);
        expected.delete(key);
        result.set(key, stamp(stat));
      }
    }
  };
  walk(root, '');
  if (expected.size) throw new Error(`Missing model file: ${expected.keys().next().value}`);
  return result;
}

export function sameSnapshot(a: Map<string, string>, b: Map<string, string>): boolean {
  return a.size === b.size && [...a].every(([key, value]) => b.get(key) === value);
}

export async function verifyFiles(
  root: string,
  files: readonly IntegrityFile[],
  signal?: AbortSignal,
): Promise<Map<string, string>> {
  const before = snapshot(root, files);
  for (const file of files) {
    signal?.throwIfAborted();
    const target = path.join(root, file.path);
    assertSafePath(target);
    const handle = await fs.promises.open(
      target,
      fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0),
    );
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stamp(stat) !== before.get(file.path))
        throw new Error(`Model changed during verification: ${file.path}`);
      if (file.sha256) {
        const hash = createHash('sha256');
        for await (const chunk of handle.createReadStream({ autoClose: false })) {
          signal?.throwIfAborted();
          hash.update(chunk);
        }
        if (hash.digest('hex') !== file.sha256) throw new Error(`Checksum mismatch: ${file.path}`);
      }
      if (stamp(await handle.stat()) !== before.get(file.path))
        throw new Error(`Model changed during verification: ${file.path}`);
    } finally {
      await handle.close();
    }
  }
  const after = snapshot(root, files);
  if (!sameSnapshot(before, after)) throw new Error('Model changed during verification');
  return after;
}

/** Preflight before extraction: reject unsupported members, duplicates and unsafe names. */
export async function extractVerifiedArchive(
  archive: string,
  destination: string,
  prefix: string,
  files: readonly IntegrityFile[],
  signal: AbortSignal,
  unpackedBytes?: number,
): Promise<void> {
  const expected = new Map(files.map((file) => [file.path, file.bytes]));
  const directories = new Set<string>([prefix]);
  for (const file of files) {
    const parts = file.path.split('/');
    for (let i = 1; i < parts.length; i++)
      directories.add(`${prefix}/${parts.slice(0, i).join('/')}`);
  }
  const seen = new Set<string>();
  const maxBytes =
    unpackedBytes ??
    files.reduce((sum, file) => sum + (file.bytes || 16 * 1024 * 1024), 0) +
      (files.length + directories.size + 100) * 4096;
  const run = async (extract: boolean) => {
    let bytes = 0;
    let entries = 0;
    const limit = new Transform({
      transform(chunk: Buffer, _encoding, done) {
        bytes += chunk.length;
        done(bytes > maxBytes ? new Error('Archive expansion limit exceeded') : null, chunk);
      },
    });
    const parser = extract
      ? tar.x({ cwd: destination, strip: 1, strict: true, noChmod: true, noMtime: true })
      : tar.t({ strict: true });
    if (!extract)
      parser.on('entry', (entry) => {
        const name = entry.type === 'Directory' ? entry.path.replace(/\/$/, '') : entry.path;
        const relative = name.slice(prefix.length + 1);
        const expectedBytes = expected.get(relative);
        const validSize =
          expectedBytes === undefined || expectedBytes <= 0 || expectedBytes === entry.size;
        if (
          ++entries > files.length + directories.size + 100 ||
          !safeRelative(name) ||
          seen.has(name.toLowerCase()) ||
          (entry.type === 'Directory'
            ? !directories.has(name) || entry.size !== 0
            : entry.type !== 'File' || !name.startsWith(`${prefix}/`) || !validSize)
        ) {
          parser.abort(new Error(`Unsafe or unexpected archive entry: ${entry.path}`));
          return;
        }
        seen.add(name.toLowerCase());
        if (entry.type === 'File') expected.delete(relative);
      });
    await pipeline(fs.createReadStream(archive), bz2(), limit, parser, { signal });
  };
  await run(false);
  if (expected.size) throw new Error('Archive is missing required inventory files');
  signal.throwIfAborted();
  assertSafePath(destination);
  await run(true);
}
