import { Menu, Tray, app } from 'electron';
import type { ModelStatus } from '@shared/domain/models';
import type { DictationPhase } from '@shared/domain/system';
import { trayImage } from '../app/assets';

const PHASE_LABEL: Record<DictationPhase, string> = {
  idle: 'Ready',
  listening: 'Listening…',
  transcribing: 'Transcribing…',
  inserting: 'Inserting…',
  error: 'Needs attention',
};

export class TrayService {
  private tray: Tray | null = null;
  private phase: DictationPhase = 'idle';
  private models: ModelStatus[] = [];

  constructor(
    private readonly actions: {
      show(): void;
      toggleDictation(): void;
      readClipboard(): void;
      openSettings(): void;
      quit(): void;
    },
  ) {}

  create(): void {
    if (this.tray) return;
    this.tray = new Tray(trayImage());
    this.tray.on('click', () => this.actions.show());
    this.render();
  }

  setPhase(phase: DictationPhase): void {
    this.phase = phase;
    this.render();
  }

  setModels(models: ModelStatus[]): void {
    this.models = models;
    this.render();
  }

  destroy(): void {
    this.tray?.destroy();
    this.tray = null;
  }

  private render(): void {
    if (!this.tray) return;
    const listening = this.phase === 'listening';
    const loaded = this.models.filter((model) => model.loaded).map((model) => model.id).join(', ');
    this.tray.setToolTip(`${app.getName()}: ${PHASE_LABEL[this.phase]}${loaded ? ` • ${loaded}` : ''}`);
    this.tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: PHASE_LABEL[this.phase], enabled: false },
        { type: 'separator' },
        { label: listening ? 'Stop dictation' : 'Start dictation', click: this.actions.toggleDictation },
        { label: 'Read clipboard aloud', click: this.actions.readClipboard },
        { type: 'separator' },
        { label: 'Open Inaudio', click: this.actions.show },
        { label: 'Settings', click: this.actions.openSettings },
        { type: 'separator' },
        { label: 'Quit', click: this.actions.quit },
      ]),
    );
  }
}
