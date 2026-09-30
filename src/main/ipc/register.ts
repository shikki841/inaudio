import { ipcMain, shell } from 'electron';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { MODEL_CATALOG, voiceSid, type ModelId } from '@shared/domain/models';
import type { Transcript } from '@shared/domain/history';
import type { TranscribeResult } from '@shared/ipc/api';
import { IPC } from '@shared/ipc/channels';
import { EXTERNAL_LINKS, schemas } from '@shared/ipc/schemas';
import { assertTrustedSender } from '../security/trusted-origin';
import { openTrustedExternal } from '../security/hardening';
import type { Services } from '../services/container';
import { handle } from './handle';

const none = z.undefined();

export function registerIpc(services: Services): void {
  const { settings, history, models, inference, inserter, paths } = services;

  handle(IPC.systemStatus, none, () => services.status());
  handle(IPC.systemOpenLink, schemas.openLink, (id) => openTrustedExternal(EXTERNAL_LINKS[id]));
  handle(IPC.systemRevealModels, none, async () => {
    await shell.openPath(paths.models);
  });

  handle(IPC.settingsGet, none, () => settings.get());
  handle(IPC.settingsUpdate, schemas.settingsPatch, (patch) => settings.update(patch));

  handle(IPC.modelsList, none, () => models.list());
  handle(IPC.modelsDownload, schemas.modelId, (id) => {
    // Progress is pushed as events; the promise settles when the job ends.
    return models.download(id);
  });
  handle(IPC.modelsCancel, schemas.modelId, (id) => models.cancel(id));
  handle(IPC.modelsRemove, schemas.modelId, async (id) => {
    if (inference.isLoaded(id)) await inference.unload(MODEL_CATALOG[id].kind);
    await models.remove(id);
  });
  handle(IPC.modelsLoad, schemas.modelId, (id) => services.ensureLoaded(id));

  handle(IPC.dictationTranscribe, schemas.transcribe, async ({ samples, sampleRate, insert }) => {
    const current = settings.get();
    const modelId: ModelId = current.stt.modelId;
    await services.ensureLoaded(modelId);
    const result = await inference.transcribe(samples, sampleRate);
    const response: TranscribeResult = { transcript: null, text: result.text, inserted: false };
    if (!result.text) return response;

    const transcript: Transcript = {
      id: randomUUID(),
      text: result.text.slice(0, 20_000),
      modelId,
      durationMs: Math.round((samples.length / sampleRate) * 1000),
      inferenceMs: result.inferenceMs,
      language: result.language.slice(0, 16),
      createdAt: Date.now(),
    };
    if (current.dictation.saveHistory) history.add(transcript);
    response.transcript = transcript;

    if (insert) {
      const mode = current.dictation.insertMode;
      try {
        if (mode === 'paste') {
          await inserter.insert(transcript.text, { restoreClipboard: current.dictation.restoreClipboard });
          response.inserted = true;
        } else if (mode === 'clipboard') {
          await inserter.copy(transcript.text);
        }
      } catch (error) {
        await inserter.copy(transcript.text).catch(() => undefined);
        response.insertError = error instanceof Error ? error.message : String(error);
      }
    }
    return response;
  });

  ipcMain.on(IPC.dictationPhase, (event, raw: unknown) => {
    try {
      assertTrustedSender(event);
    } catch {
      return;
    }
    const phase = schemas.phase.safeParse(raw);
    if (phase.success) services.tray.setPhase(phase.data);
  });

  handle(IPC.textInsert, schemas.text, (text) =>
    inserter.insert(text, { restoreClipboard: settings.get().dictation.restoreClipboard }),
  );
  handle(IPC.clipboardWrite, schemas.text, (text) => inserter.copy(text));
  handle(IPC.clipboardRead, none, () => services.readClipboard());

  handle(IPC.ttsSpeak, schemas.speak, async ({ text, voiceId, speed }) => {
    const tts = settings.get().tts;
    await services.ensureLoaded(tts.modelId);
    return inference.speak(text, voiceSid(voiceId ?? tts.voiceId), speed ?? tts.speed);
  });

  handle(IPC.historyList, schemas.historyQuery, (query) => history.list(query));
  handle(IPC.historyRemove, schemas.historyId, (id) => history.remove(id));
  handle(IPC.historyClear, none, () => history.clear());
}
