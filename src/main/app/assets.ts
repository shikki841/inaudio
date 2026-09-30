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

export function appIcon(): NativeImage {
  return nativeImage.createFromPath(iconPath('icon.png'));
}
