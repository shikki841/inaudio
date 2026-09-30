import { globalShortcut } from 'electron';
import type { Settings } from '@shared/domain/settings';

export interface ShortcutState {
  dictation: boolean;
  readAloud: boolean;
}

/**
 * System-wide shortcuts. Electron reports key-down only, so the global
 * dictation shortcut always toggles; hold-to-talk is handled in the window.
 */
export class ShortcutService {
  private state: ShortcutState = { dictation: false, readAloud: false };
  private registered: string[] = [];

  constructor(private readonly handlers: { dictation(): void; readAloud(): void }) {}

  apply(settings: Settings): ShortcutState {
    this.clear();
    this.state = {
      dictation: this.register(settings.dictation.shortcut, this.handlers.dictation),
      readAloud: this.register(settings.tts.shortcut, this.handlers.readAloud),
    };
    return this.state;
  }

  current(): ShortcutState {
    return this.state;
  }

  clear(): void {
    for (const accelerator of this.registered) globalShortcut.unregister(accelerator);
    this.registered = [];
  }

  private register(accelerator: string, handler: () => void): boolean {
    try {
      const ok = globalShortcut.register(accelerator, handler);
      if (ok) this.registered.push(accelerator);
      return ok;
    } catch {
      return false;
    }
  }
}
