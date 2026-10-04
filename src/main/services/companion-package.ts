import fs from 'node:fs';
import path from 'node:path';
import { companionPackageSchema, type CompanionPackage } from '@shared/domain/companion';
import { resolveInside } from '../app/paths';

const SUPPORTED_IMAGE_EXTENSIONS = new Set(['.png', '.webp', '.jpg', '.jpeg', '.svg']);
const MAX_SPRITESHEET_BYTES = 16 * 1024 * 1024;

export interface CompanionManifestFile {
  manifest: CompanionPackage;
  directory: string;
}

export function validateCompanionManifest(
  raw: unknown,
  directory: string,
): CompanionManifestFile {
  const manifest = companionPackageSchema.parse(raw);
  if (manifest.frameCount > manifest.columns * manifest.rows) {
    throw new Error('Companion frame count exceeds its sprite grid');
  }
  if (
    manifest.frameWidth * manifest.columns > 8192 ||
    manifest.frameHeight * manifest.rows > 8192
  ) {
    throw new Error('Companion spritesheet dimensions are too large');
  }
  if (manifest.spritesheetPath) {
    if (path.isAbsolute(manifest.spritesheetPath)) {
      throw new Error('Companion spritesheet paths must be relative');
    }
    const asset = resolveInside(directory, manifest.spritesheetPath);
    if (!SUPPORTED_IMAGE_EXTENSIONS.has(path.extname(asset).toLowerCase())) {
      throw new Error('Companion spritesheets must be PNG, WebP, JPEG, or JPG files');
    }
    if (!fs.existsSync(asset)) throw new Error('Companion spritesheet does not exist');
    const stats = fs.statSync(asset);
    if (!stats.isFile() || stats.size > MAX_SPRITESHEET_BYTES) {
      throw new Error('Companion spritesheet is missing or too large');
    }
  }
  return { manifest, directory: path.resolve(directory) };
}

export function readCompanionManifest(directory: string): CompanionManifestFile {
  const manifestPath = resolveInside(directory, 'companion.json');
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as unknown;
  } catch (error) {
    throw new Error(
      `Could not read companion manifest: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return validateCompanionManifest(raw, directory);
}
