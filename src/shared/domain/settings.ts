import { z } from 'zod';
import { sttModelIdSchema, ttsModelIdSchema, voiceIdSchema } from './models';

/** Electron accelerator, e.g. "CommandOrControl+Shift+Space". */
export const acceleratorSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9+]+$/, 'Use keys joined with "+"');

export const settingsSchema = z.object({
  version: z.literal(1),
  onboardingComplete: z.boolean(),
  appearance: z.object({
    theme: z.enum(['system', 'light', 'dark']),
    sidebarCollapsed: z.boolean(),
    fontSize: z.enum(['sm', 'md', 'lg']),
    fontFamily: z.enum(['inter', 'system']),
    animations: z.enum(['full', 'reduced', 'off']),
    contentWidth: z.enum(['compact', 'default', 'wide']),
    accentTone: z.enum(['blue', 'violet', 'green', 'amber', 'rose']),
  }),
  dictation: z.object({
    mode: z.enum(['toggle', 'push-to-talk']),
    shortcut: acceleratorSchema,
    insertMode: z.enum(['paste', 'clipboard', 'none']),
    restoreClipboard: z.boolean(),
    saveHistory: z.boolean(),
    playCues: z.boolean(),
  }),
  audio: z.object({
    inputDeviceId: z.string().max(256),
    outputDeviceId: z.string().max(256),
    inputGain: z.number().min(0).max(2),
  }),
  stt: z.object({
    modelId: sttModelIdSchema,
    threads: z.number().int().min(1).max(16),
  }),
  tts: z.object({
    modelId: ttsModelIdSchema,
    voiceId: voiceIdSchema,
    speed: z.number().min(0.5).max(2),
    shortcut: acceleratorSchema,
  }),
  system: z.object({
    launchAtLogin: z.boolean(),
    closeToTray: z.boolean(),
  }),
});

export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  onboardingComplete: false,
  appearance: {
    theme: 'system',
    sidebarCollapsed: false,
    fontSize: 'md',
    fontFamily: 'inter',
    animations: 'full',
    contentWidth: 'default',
    accentTone: 'blue',
  },
  dictation: {
    mode: 'toggle',
    shortcut: 'CommandOrControl+Shift+Space',
    insertMode: 'paste',
    restoreClipboard: true,
    saveHistory: true,
    playCues: true,
  },
  audio: { inputDeviceId: 'default', outputDeviceId: 'default', inputGain: 1 },
  stt: { modelId: 'parakeet-tdt-0.6b-v2-int8', threads: 4 },
  tts: {
    modelId: 'kokoro-en-v0_19',
    voiceId: '00',
    speed: 1,
    shortcut: 'CommandOrControl+Shift+R',
  },
  system: { launchAtLogin: false, closeToTray: true },
};

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };
export type SettingsPatch = DeepPartial<Omit<Settings, 'version'>>;

export const settingsPatchSchema = z
  .object({
    onboardingComplete: settingsSchema.shape.onboardingComplete.optional(),
    appearance: settingsSchema.shape.appearance.partial().strict().optional(),
    dictation: settingsSchema.shape.dictation.partial().strict().optional(),
    audio: settingsSchema.shape.audio.partial().strict().optional(),
    stt: settingsSchema.shape.stt.partial().strict().optional(),
    tts: settingsSchema.shape.tts.partial().strict().optional(),
    system: settingsSchema.shape.system.partial().strict().optional(),
  })
  .strict();

export function mergeSettings(base: Settings, patch: SettingsPatch): Settings {
  return settingsSchema.parse({
    ...base,
    ...(patch.onboardingComplete === undefined ? {} : { onboardingComplete: patch.onboardingComplete }),
    appearance: { ...base.appearance, ...patch.appearance },
    dictation: { ...base.dictation, ...patch.dictation },
    audio: { ...base.audio, ...patch.audio },
    stt: { ...base.stt, ...patch.stt },
    tts: { ...base.tts, ...patch.tts },
    system: { ...base.system, ...patch.system },
  });
}
