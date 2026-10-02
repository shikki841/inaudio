import { app, nativeImage, type NativeImage } from 'electron';
import path from 'node:path';

/** Icons ship as an extra resource in packaged builds and live in assets/ during development. */
export function iconPath(name: string): string {
  const root = app.isPackaged
    ? path.join(process.resourcesPath, 'icons')
    : path.join(app.getAppPath(), 'assets', 'icons');
  return path.join(root, name);
}

export function trayImage(): NativeImage {
  if (process.platform === 'darwin') {
    const image = nativeImage.createFromPath(iconPath('trayTemplate.png'));
    image.setTemplateImage(true);
    return image;
  }
  return nativeImage.createFromPath(iconPath('tray.png'));
}

/** --color-record from src/renderer/styles/index.css. */
const RECORD = { r: 0xd9, g: 0x3a, b: 0x2b };

/**
 * The tray icon recoloured to the record accent, built at runtime from the icon that
 * already ships so recording needs no second binary asset. Chromium hands out
 * premultiplied BGRA pixels for every platform Electron builds for; a different channel
 * order would only shift the hue, never break the icon.
 */
export function trayRecordingImage(): NativeImage {
  const darwin = process.platform === 'darwin';
  const base = nativeImage.createFromPath(iconPath(darwin ? 'trayTemplate.png' : 'tray.png'));
  if (base.isEmpty()) return trayImage();

  let tinted: NativeImage | null = null;
  for (const scaleFactor of base.getScaleFactors()) {
    const size = base.getSize(scaleFactor);
    const width = Math.round(size.width * scaleFactor);
    const height = Math.round(size.height * scaleFactor);
    const pixels = base.toBitmap({ scaleFactor });
    if (pixels.length < width * height * 4) continue;
    for (let i = 0; i + 3 < pixels.length; i += 4) {
      const alpha = pixels[i + 3] ?? 0;
      if (alpha === 0) continue;
      pixels[i] = Math.round((RECORD.b * alpha) / 255);
      pixels[i + 1] = Math.round((RECORD.g * alpha) / 255);
      pixels[i + 2] = Math.round((RECORD.r * alpha) / 255);
    }
    if (tinted) tinted.addRepresentation({ buffer: pixels, width, height, scaleFactor });
    else tinted = nativeImage.createFromBitmap(pixels, { width, height, scaleFactor });
  }

  if (!tinted || tinted.isEmpty()) return trayImage();
  // A template image would be recoloured by macOS, discarding the tint.
  tinted.setTemplateImage(false);
  return tinted;
}

export function appIcon(): NativeImage {
  return nativeImage.createFromPath(iconPath('icon.png'));
}
