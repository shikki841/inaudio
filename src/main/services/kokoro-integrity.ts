import type { IntegrityFile } from './model-integrity';

export const KOKORO_ARCHIVE_SHA256 = '912804855a04745fa77a30be545b3f9a5d15c4d66db00b88cbcd4921df605ac7';

export const KOKORO_FILES: readonly IntegrityFile[] = [
  { path: 'model.onnx', bytes: 0, sha256: '' },
  { path: 'voices.bin', bytes: 0, sha256: '' },
  { path: 'tokens.txt', bytes: 0, sha256: '' },
  { path: 'espeak-ng-data/phontab', bytes: 0, sha256: '' },
];
