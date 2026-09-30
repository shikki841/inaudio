// Renders assets/logo.svg into the platform icon set under assets/icons.
import fs from 'node:fs/promises';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import pngToIco from 'png-to-ico';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'assets', 'icons');
const svg = await fs.readFile(path.join(root, 'assets', 'logo.svg'), 'utf8');

const tint = (color) => svg.replace(/currentColor/g, color);
// App icon: solid accent tile with the mark in white.
const tile = () =>
  svg
    .replace('viewBox="0 0 64 64"', 'viewBox="-10 -10 84 84"')
    .replace(/currentColor/g, '#FFFFFF')
    .replace('>', '><rect x="-10" y="-10" width="84" height="84" rx="19" fill="#2F5BEA" stroke="none"/>');

const render = (source, size) =>
  new Resvg(source, { fitTo: { mode: 'width', value: size } }).render().asPng();

await fs.mkdir(out, { recursive: true });
const writes = {
  'icon.png': render(tile(), 1024),
  'tray.png': render(tint('#ECEEF2'), 32),
  'tray@2x.png': render(tint('#ECEEF2'), 64),
  'trayTemplate.png': render(tint('#000000'), 22),
  'trayTemplate@2x.png': render(tint('#000000'), 44),
};
for (const [name, data] of Object.entries(writes)) await fs.writeFile(path.join(out, name), data);
const icoSizes = [16, 24, 32, 48, 64, 128, 256].map((s) => render(tile(), s));
await fs.writeFile(path.join(out, 'icon.ico'), await pngToIco(icoSizes));
console.log('icons written to', path.relative(root, out));
