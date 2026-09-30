import { create } from 'zustand';
import type { Transcript } from '@shared/domain/history';
import type { DictationPhase } from '@shared/domain/system';
import { api, errorMessage } from '@renderer/lib/api';
import { queryClient, keys } from '@renderer/lib/queries';
import type { Settings } from '@shared/domain/settings';
import { playCue } from '@renderer/features/dictation/audio/cues';
import { Recorder, TARGET_RATE, trimSilence } from '@renderer/features/dictation/audio/recorder';

const MIN_SPEECH_MS = 250;
const MAX_RECORDING_MS = 10 * 60 * 1000;

interface DictationState {
  phase: DictationPhase;
  level: number;
  startedAt: number | null;
  last: Transcript | null;
  lastText: string;
  message: string | null;
  start(): Promise<void>;
  stop(options?: { insert?: boolean }): Promise<void>;
  cancel(): Promise<void>;
  toggle(): Promise<void>;
}

const recorder = new Recorder();
let limitTimer: ReturnType<typeof setTimeout> | undefined;

function settings(): Settings | undefined {
  return queryClient.getQueryData<Settings>(keys.settings);
}

export const useDictation = create<DictationState>((set, get) => {
  const setPhase = (phase: DictationPhase, patch: Partial<DictationState> = {}) => {
    set({ phase, ...patch });
    api.dictation.setPhase(phase);
  };

  return {
    phase: 'idle',
    level: 0,
    startedAt: null,
    last: null,
    lastText: '',
    message: null,

    async start() {
      if (get().phase === 'listening' || get().phase === 'transcribing') return;
      const current = settings();
      try {
        await recorder.start({
          deviceId: current?.audio.inputDeviceId ?? 'default',
          gain: current?.audio.inputGain ?? 1,
          onLevel: (level) => set({ level }),
        });
        if (current?.dictation.playCues) playCue('start');
        setPhase('listening', { startedAt: Date.now(), message: null, level: 0 });
        limitTimer = setTimeout(() => void get().stop(), MAX_RECORDING_MS);
        // Warm the STT model while the user speaks.
        if (current) void api.models.load(current.stt.modelId).catch(() => undefined);
      } catch (error) {
        const name = error instanceof DOMException ? error.name : '';
        const message =
          name === 'NotAllowedError'
            ? 'Microphone access was denied. Allow it in your system privacy settings.'
            : name === 'NotFoundError' || name === 'OverconstrainedError'
              ? 'The selected microphone is not available.'
              : errorMessage(error);
        setPhase('error', { message });
      }
    },

    async stop({ insert = true } = {}) {
      if (get().phase !== 'listening') return;
      clearTimeout(limitTimer);
      const current = settings();
      const raw = await recorder.stop();
      if (current?.dictation.playCues) playCue('stop');
      const samples = trimSilence(raw);
      if ((samples.length / TARGET_RATE) * 1000 < MIN_SPEECH_MS) {
        setPhase('idle', { level: 0, startedAt: null, message: 'No speech detected.' });
        return;
      }
      setPhase('transcribing', { level: 0, startedAt: null });
      try {
        const result = await api.dictation.transcribe(samples, { insert });
        void queryClient.invalidateQueries({ queryKey: keys.historyAll });
        const message = !result.text
          ? 'No speech detected.'
          : result.insertError
            ? `Copied to clipboard. Insertion failed: ${result.insertError}`
            : null;
        setPhase('idle', { last: result.transcript, lastText: result.text, message });
      } catch (error) {
        if (current?.dictation.playCues) playCue('error');
        setPhase('error', { message: errorMessage(error) });
      }
    },

    async cancel() {
      clearTimeout(limitTimer);
      await recorder.dispose();
      setPhase('idle', { level: 0, startedAt: null, message: null });
    },

    async toggle() {
      const { phase } = get();
      if (phase === 'listening') await get().stop();
      else if (phase !== 'transcribing' && phase !== 'inserting') await get().start();
    },
  };
});
