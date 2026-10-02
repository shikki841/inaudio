import { globalShortcut } from 'electron';
import type { Settings } from '@shared/domain/settings';
import type { ShortcutId, ShortcutState, ShortcutStatus } from '@shared/domain/system';

const OFF: ShortcutStatus = 'off';
const REGISTERED: ShortcutStatus = 'registered';
const UNAVAILABLE: ShortcutStatus = 'unavailable';

const EMPTY: ShortcutState = {
  dictation: OFF,
  readAloud: OFF,
  cancel: OFF,
  overlay: OFF,
};

/**
 * System-wide shortcuts. Electron reports key-down only, so the global dictation shortcut
 * always toggles; hold-to-talk is handled inside the window.
 */
export class ShortcutService {
  private state: ShortcutState = { ...EMPTY };
  private registered: string[] = [];

  constructor(
    private readonly handlers: {
      dictation(): void;
      readAloud(): void;
      cancel(): void;
      overlay(): void;
    },
  ) {}

  apply(settings: Settings): ShortcutState {
    this.clear();
    this.state = {
      dictation: this.register(settings.dictation.shortcut, this.handlers.dictation),
      readAloud: this.register(settings.tts.shortcut, this.handlers.readAloud),
      cancel: this.register(settings.dictation.cancelShortcut, this.handlers.cancel),
      overlay: this.register(settings.overlay.toggleShortcut, this.handlers.overlay),
    };
    return this.state;
  }

  current(): ShortcutState {
    return this.state;
  }

  clear(): void {
    for (const accelerator of this.registered) globalShortcut.unregister(accelerator);
    this.registered = [];
    this.state = { ...EMPTY };
  }

  private register(accelerator: string, handler: () => void): ShortcutStatus {
    if (!accelerator) return OFF;
    try {
      const ok = globalShortcut.register(accelerator, handler);
      if (ok) {
        this.registered.push(accelerator);
        return REGISTERED;
      }
      return UNAVAILABLE;
    } catch {
      return UNAVAILABLE;
    }
  }
}
