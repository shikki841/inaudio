import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const platform = process.platform;
const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
const prepackaged = path.resolve('out', `inaudio-${platform}-${arch}`);
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const run = (command, args) => {
  if (process.platform !== 'win32') {
    execFileSync(command, args, { stdio: 'inherit' });
    return;
  }
  execFileSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', [command, ...args].join(' ')], {
    stdio: 'inherit',
  });
};

run(npm, ['run', 'package', '--', '--platform', platform, '--arch', arch]);
if (!existsSync(prepackaged)) {
  throw new Error(`Forge did not produce the expected packaged app: ${prepackaged}`);
}

const targetArgs = platform === 'win32' ? ['--win', 'nsis'] : platform === 'darwin' ? ['--mac', 'zip'] : ['--linux', 'AppImage', 'deb', 'rpm'];
run(process.platform === 'win32' ? 'npx.cmd' : 'npx', [
  'electron-builder',
  '--prepackaged',
  prepackaged,
  '--config',
  'electron-builder.yml',
  '--publish',
  'never',
  ...targetArgs,
], { stdio: 'inherit' });
