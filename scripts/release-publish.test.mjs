import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./release-publish.mjs', import.meta.url));

test('rejects a changed Flatpak before invoking GitHub release commands', () => {
  if (process.platform !== 'linux') return;
  const root = path.resolve(`.release-publish-test-${randomUUID()}`);
  const assets = path.join(root, 'release-assets');
  const bin = path.join(root, 'bin');
  const calls = path.join(root, 'github-calls.txt');
  mkdirSync(assets, { recursive: true });
  mkdirSync(bin, { recursive: true });
  try {
    const expectedFiles = {
      'windows-installer.exe': 'windows bytes',
      'inaudio-1.2.3.flatpak': 'Flatpak bundle bytes',
      'inaudio-1.2.3.AppImage': 'AppImage bytes',
      'inaudio-1.2.3.deb': 'deb bytes',
      'inaudio-1.2.3.rpm': 'rpm bytes',
      'inaudio-1.2.3-mac.zip': 'mac bytes',
    };
    for (const [name, contents] of Object.entries(expectedFiles)) {
      writeFileSync(path.join(assets, name), contents);
    }
    for (const [target, names] of Object.entries({
      'win32-x64': ['windows-installer.exe'],
      'linux-x64': ['inaudio-1.2.3.flatpak', 'inaudio-1.2.3.AppImage', 'inaudio-1.2.3.deb', 'inaudio-1.2.3.rpm'],
      'darwin-arm64': ['inaudio-1.2.3-mac.zip'],
    })) {
      const lines = names.map((name) => `${createHash('sha256').update(readFileSync(path.join(assets, name))).digest('hex')}  ${name}`);
      writeFileSync(path.join(assets, `SHA256SUMS-${target}-1.2.3.txt`), `${lines.join('\n')}\n`);
    }
    writeFileSync(path.join(assets, 'inaudio-1.2.3.flatpak'), 'tampered Flatpak bundle');

    const gh = path.join(bin, 'gh');
    writeFileSync(gh, `#!/bin/sh\nprintf '%s\\n' "$*" >> "$GITHUB_CALL_LOG"\nexit 1\n`);
    chmodSync(gh, 0o755);
    const result = spawnSync(process.execPath, [script], {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        GITHUB_REPOSITORY: 'shikki841/inaudio',
        GITHUB_SHA: 'a'.repeat(40),
        RELEASE_TAG: 'v1.2.3',
        GITHUB_CALL_LOG: calls,
        PATH: `${bin}:${process.env.PATH}`,
      },
    });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Checksum mismatch: inaudio-1\.2\.3\.flatpak/);
    assert.equal(existsSync(calls), false, 'GitHub must not be called for unverified assets');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
