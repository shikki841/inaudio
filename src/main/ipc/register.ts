import { app, ipcMain, shell } from 'electron';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { voiceSid, type ModelId } from '@shared/domain/models';
import type { Transcript } from '@shared/domain/history';
import type { TranscribeResult } from '@shared/ipc/api';
import { EVENTS, IPC } from '@shared/ipc/channels';
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
  handle(IPC.systemWindow, schemas.windowAction, (action) => {
    const win = services.window();
    if (!win || win.isDestroyed()) return;
    if (action === 'minimize') {
      win.minimize();
      return;
    }
    if (action === 'close') {
      win.close();
      return;
    }
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });
  handle(IPC.systemMenu, schemas.menuCommand, async (command) => {
    if (command === 'file.open-models-folder') {
      await shell.openPath(paths.models);
      return;
    }
    if (command === 'file.run-setup') {
      settings.update({ onboardingComplete: false });
      return;
    }
    if (command === 'file.quit') {
      app.quit();
      return;
    }
    const win = services.window();
    if (!win || win.isDestroyed()) return;
    win.show();
    win.focus();
    const route = command.slice('view.'.length);
    win.webContents.send(EVENTS.command, `navigate:${route}`);
  });

  handle(IPC.settingsGet, none, () => settings.get());
  handle(IPC.settingsUpdate, schemas.settingsPatch, (patch) => settings.update(patch));

  handle(IPC.modelsList, none, () => services.modelStatuses());
  handle(IPC.modelsDownload, schemas.modelId, (id) => {
    // Progress is pushed as events; the promise settles when the job ends.
    return models.download(id);
  });
  handle(IPC.modelsCancel, schemas.modelId, (id) => models.cancel(id));
  handle(IPC.modelsRemove, schemas.modelId, (id) => services.removeModel(id));
  handle(IPC.modelsLoad, schemas.modelId, (id) => services.ensureLoaded(id));
  handle(IPC.modelsUnload, schemas.modelId, (id) => services.unloadModel(id));
  handle(IPC.modelsActivate, schemas.modelId, (id) => services.activateModel(id));
  handle(IPC.modelsVerify, schemas.modelId, (id) => services.verifyModel(id));
  handle(IPC.modelsReveal, schemas.modelId, (id) => {
    if (!models.isInstalled(id)) throw new Error('Model is not installed');
    shell.showItemInFolder(models.directory(id));
  });

  handle(IPC.dictationTranscribe, schemas.transcribe, async ({ samples, sampleRate, insert }) => {
    const current = settings.get();
    const modelId: ModelId = current.stt.modelId;
    const result = await services.runModel(modelId, () => inference.transcribe(samples, sampleRate));
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
    return services.runModel(tts.modelId, () => inference.speak(text, voiceSid(voiceId ?? tts.voiceId), speed ?? tts.speed));
  });

  handle(IPC.historyList, schemas.historyQuery, (query) => history.list(query));
  handle(IPC.historyRemove, schemas.historyId, (id) => history.remove(id));
  handle(IPC.historyClear, none, () => history.clear());
}
