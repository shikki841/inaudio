import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const platform = process.platform;
const arch = process.arch;
const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
const extensions = platform === 'win32' ? ['.exe', '.nupkg'] : platform === 'darwin' ? ['.zip'] : ['.deb', '.rpm'];
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const name = path.join(directory, entry.name);
    return entry.isDirectory() ? files(name) : [name];
  });
}
const artifacts = files('out/make').filter((file) => extensions.includes(path.extname(file)) || path.basename(file) === 'RELEASES');
for (const extension of extensions) {
  if (!artifacts.some((file) => file.endsWith(extension))) throw new Error(`Missing ${extension} installer`);
}
mkdirSync('release-assets', { recursive: true });
const names = new Set();
const checksums = [];
for (const file of artifacts) {
  const name = `${platform}-${arch}-${path.basename(file)}`;
  if (names.has(name)) throw new Error(`Duplicate artifact: ${name}`);
  names.add(name);
  copyFileSync(file, path.join('release-assets', name));
  checksums.push(`${createHash('sha256').update(readFileSync(file)).digest('hex')}  ${name}`);
}
writeFileSync(`release-assets/SHA256SUMS-${platform}-${arch}-${version}.txt`, `${checksums.sort().join('\n')}\n`);
console.log(`Collected ${artifacts.length} artifacts for ${platform}/${arch}`);
