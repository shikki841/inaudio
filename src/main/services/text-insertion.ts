import { clipboard, systemPreferences } from 'electron';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { InsertionSupport } from '@shared/domain/system';

interface PasteCommand {
  file: string;
  args: string[];
  method: string;
}

function findOnPath(binary: string): string | null {
  for (const dir of (process.env.PATH ?? '').split(path.delimiter)) {
    if (!dir) continue;
    const candidate = path.join(dir, binary);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {
      // keep looking
    }
  }
  return null;
}

/**
 * Fixed executables with fixed arguments. Transcript text never reaches a
 * command line; it only travels through the clipboard.
 */
function resolvePasteCommand(): PasteCommand | null {
  switch (process.platform) {
    case 'darwin':
      return {
        file: '/usr/bin/osascript',
        args: ['-e', 'tell application "System Events" to keystroke "v" using command down'],
        method: 'System Events (osascript)',
      };
    case 'win32': {
      const root = process.env.SystemRoot ?? 'C:\\Windows';
      return {
        file: path.join(root, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
        args: [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')",
        ],
        method: 'SendKeys (PowerShell)',
      };
    }
    default: {
      if (process.env.WAYLAND_DISPLAY) {
        const wtype = findOnPath('wtype');
        if (wtype) return { file: wtype, args: ['-M', 'ctrl', 'v', '-m', 'ctrl'], method: 'wtype' };
        const ydotool = findOnPath('ydotool');
        if (ydotool) return { file: ydotool, args: ['key', '29:1', '47:1', '47:0', '29:0'], method: 'ydotool' };
      }
      const xdotool = findOnPath('xdotool');
      if (xdotool) {
        return { file: xdotool, args: ['key', '--clearmodifiers', 'ctrl+v'], method: 'xdotool' };
      }
      return null;
    }
  }
}

function run(command: PasteCommand): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(command.file, command.args, { timeout: 5000, windowsHide: true, shell: false }, (error) =>
      error ? reject(error) : resolve(),
    );
  });
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class TextInserter {
  private readonly command = resolvePasteCommand();

  support(): InsertionSupport {
    if (!this.command) {
      return {
        available: false,
        reason:
          process.platform === 'linux'
            ? 'Install xdotool (X11) or wtype (Wayland) to paste into other apps.'
            : 'No paste helper found.',
      };
    }
    if (process.platform === 'darwin' && !systemPreferences.isTrustedAccessibilityClient(false)) {
      return { available: false, reason: 'Grant Accessibility access in System Settings.' };
    }
    return { available: true, method: this.command.method };
  }

  copy(text: string): Promise<void> {
    return clipboard.writeText(text);
  }

  /** Puts text on the clipboard, sends the paste keystroke to the focused app, then restores the clipboard. */
  async insert(text: string, { restoreClipboard }: { restoreClipboard: boolean }): Promise<void> {
    const support = this.support();
    if (!support.available || !this.command) throw new Error(support.available ? 'Paste failed' : support.reason);
    const previous = restoreClipboard ? await clipboard.readText() : null;
    await clipboard.writeText(text);
    await delay(60);
    await run(this.command);
    if (previous !== null) {
      await delay(400);
      if ((await clipboard.readText()) === text) await clipboard.writeText(previous);
    }
  }
}
