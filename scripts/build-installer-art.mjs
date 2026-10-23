// Renders the Windows installer's cloud hero animations and header into out/installer-art,
// which assets/installer/installer.nsh embeds. Built on demand by build-release.mjs, never
// committed. Direct BMP rendering keeps installer artwork free of embedded SVG designs.
//
//   install  welcome page: blue clouds with a full animation
//   ready    finish page: blue clouds with a full animation
//   remove   uninstaller: muted clouds with a restrained animation
//   removed  uninstaller done page: one still frame
import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'out', 'installer-art');
export const FRAMES = 20;
const W = 497;
const H = 150;

const THEMES = {
  install: { sky: '#E6ECFD', cloud: '#FFFFFF', accent: '#2F5BEA', drift: 1 },
  ready: { sky: '#E6ECFD', cloud: '#FFFFFF', accent: '#2F5BEA', drift: 1 },
  remove: { sky: '#F1F2F5', cloud: '#FFFFFF', accent: '#8A919C', drift: 0.25 },
  removed: { sky: '#F1F2F5', cloud: '#FFFFFF', accent: '#8A919C', drift: 0 },
};

function hexColor(value) {
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset + 1, offset + 3), 16));
}

function hash(x, y) {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return value - Math.floor(value);
}

function smoothNoise(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const top = hash(ix, iy) * (1 - sx) + hash(ix + 1, iy) * sx;
  const bottom = hash(ix, iy + 1) * (1 - sx) + hash(ix + 1, iy + 1) * sx;
  return top * (1 - sy) + bottom * sy;
}

function cloudNoise(x, y) {
  let value = 0;
  let amplitude = 0.5;
  for (let octave = 0; octave < 5; octave++) {
    value += smoothNoise(x, y) * amplitude;
    x = x * 2.03 + 17.1;
    y = y * 2.03 + 9.2;
    amplitude *= 0.5;
  }
  return value;
}

function mix(a, b, amount) {
  return Math.round(a + (b - a) * amount);
}

function cloudImage(width, height, theme, frame) {
  const pixels = Buffer.alloc(width * height * 4);
  const sky = hexColor(theme.sky);
  const cloud = hexColor(theme.cloud);
  const accent = hexColor(theme.accent);
  const progress = (frame / FRAMES) * Math.PI * 2 * theme.drift;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const uvx = x / Math.max(1, width - 1);
      const uvy = y / Math.max(1, height - 1);
      const drift = progress * 0.018;
      const broad = cloudNoise(uvx * 3.2 + drift, uvy * 2);
      const detail = cloudNoise(uvx * 5.6 - drift * 0.45, uvy * 3.5 + 13.7);
      const field = broad * 0.72 + detail * 0.28 + (1 - uvy) * 0.045;
      const coverage = Math.max(0, Math.min(1, (field - 0.42) / 0.17));
      const edge =
        Math.max(0, Math.min(1, (field - 0.44) / 0.19)) *
        (1 - Math.max(0, Math.min(1, (field - 0.64) / 0.12)));
      const cloudColor = [
        mix(cloud[0], accent[0], edge * 0.18),
        mix(cloud[1], accent[1], edge * 0.18),
        mix(cloud[2], accent[2], edge * 0.18),
      ];
      const offset = (y * width + x) * 4;
      pixels[offset] = mix(sky[0], cloudColor[0], coverage);
      pixels[offset + 1] = mix(sky[1], cloudColor[1], coverage);
      pixels[offset + 2] = mix(sky[2], cloudColor[2], coverage);
      pixels[offset + 3] = 255;
    }
  }

  return { pixels, width, height };
}

/** RGBA pixels (opaque) to a bottom-up 24-bit BMP, the format NSIS's LoadImage reads. */
export function bmp(rgba, width, height) {
  const stride = Math.ceil((width * 3) / 4) * 4;
  const size = 54 + stride * height;
  const file = Buffer.alloc(size);
  file.write('BM', 0, 'ascii');
  file.writeUInt32LE(size, 2);
  file.writeUInt32LE(54, 10);
  file.writeUInt32LE(40, 14);
  file.writeInt32LE(width, 18);
  file.writeInt32LE(height, 22);
  file.writeUInt16LE(1, 26);
  file.writeUInt16LE(24, 28);
  file.writeUInt32LE(stride * height, 34);
  file.writeInt32LE(2835, 38);
  file.writeInt32LE(2835, 42);
  for (let y = 0; y < height; y++) {
    const row = 54 + (height - 1 - y) * stride;
    for (let x = 0; x < width; x++) {
      const from = (y * width + x) * 4;
      file[row + x * 3] = rgba[from + 2];
      file[row + x * 3 + 1] = rgba[from + 1];
      file[row + x * 3 + 2] = rgba[from];
    }
  }
  return file;
}

if (import.meta.main ?? process.argv[1] === import.meta.filename) {
  await fs.rm(out, { recursive: true, force: true });
  for (const [name, theme] of Object.entries(THEMES)) {
    const count = theme.drift ? FRAMES : 1;
    for (const scale of [1, 2]) {
      const dir = path.join(out, name, `${scale}x`);
      await fs.mkdir(dir, { recursive: true });
      for (let frame = 0; frame < count; frame++) {
        const image = cloudImage(W * scale, H * scale, theme, frame);
        await fs.writeFile(path.join(dir, `${String(frame).padStart(2, '0')}.bmp`), bmp(image.pixels, image.width, image.height));
      }
    }
  }
  const headerImage = cloudImage(300, 114, THEMES.install, 0);
  await fs.writeFile(path.join(out, 'header.bmp'), bmp(headerImage.pixels, headerImage.width, headerImage.height));
  console.log('installer art written to', path.relative(root, out));
}
