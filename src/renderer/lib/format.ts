export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unit]}`;
}

export function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const time = new Intl.DateTimeFormat(undefined, { timeStyle: 'short' });

export function formatWhen(epochMs: number): string {
  const date = new Date(epochMs);
  const today = new Date();
  return date.toDateString() === today.toDateString() ? `Today, ${time.format(date)}` : dateTime.format(date);
}

/** Renders an Electron accelerator for the current platform. */
export function formatAccelerator(accelerator: string, platform: string): string[] {
  const mac = platform === 'darwin';
  return accelerator.split('+').map((part) => {
    switch (part) {
      case 'CommandOrControl':
      case 'CmdOrCtrl':
        return mac ? '⌘' : 'Ctrl';
      case 'Shift':
        return mac ? '⇧' : 'Shift';
      case 'Alt':
      case 'Option':
        return mac ? '⌥' : 'Alt';
      case 'Control':
      case 'Ctrl':
        return mac ? '⌃' : 'Ctrl';
      case 'Super':
      case 'Meta':
        return mac ? '⌘' : 'Win';
      default:
        return part;
    }
  });
}

const MODIFIERS: Record<string, string> = {
  Control: 'Control',
  Meta: 'Super',
  Alt: 'Alt',
  Shift: 'Shift',
};

/** Converts a keydown event into an Electron accelerator, or null if incomplete. */
export function acceleratorFromEvent(event: KeyboardEvent, platform: string): string | null {
  if (event.key in MODIFIERS) return null;
  const parts: string[] = [];
  const mac = platform === 'darwin';
  if ((mac && event.metaKey) || (!mac && event.ctrlKey)) parts.push('CommandOrControl');
  if (mac && event.ctrlKey) parts.push('Control');
  if (!mac && event.metaKey) parts.push('Super');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');
  if (parts.length === 0) return null;
  const code = event.code;
  let key: string | null = null;
  if (/^Key[A-Z]$/.test(code)) key = code.slice(3);
  else if (/^Digit\d$/.test(code)) key = code.slice(5);
  else if (/^F\d{1,2}$/.test(code)) key = code;
  else if (code === 'Space') key = 'Space';
  else if (code === 'Backquote') key = '`';
  else if (code === 'Period') key = '.';
  else if (code === 'Comma') key = ',';
  else if (code === 'Slash') key = '/';
  else if (code === 'Semicolon') key = ';';
  return key ? [...parts, key].join('+') : null;
}
