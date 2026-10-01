import path from 'node:path';
import type { AliasOptions } from 'vite';

export const alias: AliasOptions = {
  '@shared': path.resolve(__dirname, 'src/shared'),
  '@renderer': path.resolve(__dirname, 'src/renderer'),
};

/** Native addons are loaded from node_modules at runtime, never bundled. */
export const nativeExternals = ['sherpa-onnx-node'];
