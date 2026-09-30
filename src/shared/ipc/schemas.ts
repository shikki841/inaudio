import { z } from 'zod';
import { modelIdSchema, voiceIdSchema } from '../domain/models';
import { historyQuerySchema, MAX_TRANSCRIPT_CHARS } from '../domain/history';
import { settingsPatchSchema } from '../domain/settings';
import type { AppMenuCommand, WindowAction } from '../domain/system';

/** 16 kHz mono float32 for at most 10 minutes. */
export const MAX_AUDIO_SAMPLES = 16_000 * 60 * 10;
export const MAX_TTS_CHARS = 5_000;

export const EXTERNAL_LINKS = {
  parakeetV2: 'https://huggingface.co/nvidia/parakeet-tdt-0.6b-v2',
  parakeetV3: 'https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3',
  kokoro: 'https://huggingface.co/hexgrad/Kokoro-82M',
  sherpaOnnx: 'https://github.com/k2-fsa/sherpa-onnx',
} as const;
export type ExternalLinkId = keyof typeof EXTERNAL_LINKS;

export const schemas = {
  openLink: z.enum(Object.keys(EXTERNAL_LINKS) as [ExternalLinkId, ...ExternalLinkId[]]),
  settingsPatch: settingsPatchSchema,
  modelId: modelIdSchema,
  transcribe: z.object({
    samples: z
      .instanceof(Float32Array)
      .refine((a) => a.length > 0 && a.length <= MAX_AUDIO_SAMPLES, 'Audio length out of range'),
    sampleRate: z.literal(16000),
    insert: z.boolean(),
  }),
  phase: z.enum(['idle', 'listening', 'transcribing', 'inserting', 'error']),
  text: z.string().min(1).max(MAX_TRANSCRIPT_CHARS),
  speak: z.object({
    text: z.string().trim().min(1).max(MAX_TTS_CHARS),
    voiceId: voiceIdSchema.optional(),
    speed: z.number().min(0.5).max(2).optional(),
  }),
  historyQuery: historyQuerySchema,
  historyId: z.string().uuid(),
  windowAction: z.enum(['minimize', 'maximize-toggle', 'close'] as [WindowAction, ...WindowAction[]]),
  menuCommand: z.enum(
    [
      'file.open-models-folder',
      'file.run-setup',
      'file.quit',
      'view.dictation',
      'view.history',
      'view.read-aloud',
      'view.models',
      'view.audio',
      'view.settings',
    ] as [AppMenuCommand, ...AppMenuCommand[]],
  ),
};
