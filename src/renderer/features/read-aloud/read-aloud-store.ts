import { create } from 'zustand';
import type { Settings } from '@shared/domain/settings';
import { api, errorMessage } from '@renderer/lib/api';
import { encodeWav, PcmPlayer } from '@renderer/lib/audio-player';
import { keys, queryClient } from '@renderer/lib/queries';
import { MAX_TTS_CHARS } from '@shared/ipc/schemas';

type Phase = 'idle' | 'synthesizing' | 'playing';

interface ReadAloudState {
  phase: Phase;
  error: string | null;
  lastAudio: { samples: Float32Array; sampleRate: number; inferenceMs: number } | null;
  speak(text: string): Promise<void>;
  stop(): void;
  exportWav(): string | null;
}

const player = new PcmPlayer();
let generation = 0;

export const useReadAloud = create<ReadAloudState>((set, get) => ({
  phase: 'idle',
  error: null,
  lastAudio: null,

  async speak(text) {
    const trimmed = text.trim().slice(0, MAX_TTS_CHARS);
    if (!trimmed) return;
    const run = ++generation;
    player.stop();
    set({ phase: 'synthesizing', error: null });
    try {
      const audio = await api.tts.speak({ text: trimmed });
      if (run !== generation) return;
      set({ phase: 'playing', lastAudio: audio });
      const settings = queryClient.getQueryData<Settings>(keys.settings);
      await player.play(audio.samples, audio.sampleRate, settings?.audio.outputDeviceId ?? 'default', () => {
        if (run === generation) set({ phase: 'idle' });
      });
    } catch (error) {
      if (run === generation) set({ phase: 'idle', error: errorMessage(error) });
    }
  },

  stop() {
    generation++;
    player.stop();
    set({ phase: 'idle' });
  },

  exportWav() {
    const audio = get().lastAudio;
    return audio ? URL.createObjectURL(encodeWav(audio.samples, audio.sampleRate)) : null;
  },
}));

export async function readClipboardAloud(): Promise<void> {
  const text = await api.text.readClipboard();
  await useReadAloud.getState().speak(text);
}
