import { useState } from 'react';
import { Kbd } from '@renderer/components/ui/layout';
import { cn } from '@renderer/lib/cn';
import { acceleratorFromEvent, formatAccelerator } from '@renderer/lib/format';

/** Click, then press a key combination. Escape cancels. */
export function ShortcutInput({
  value,
  platform,
  onChange,
  label,
  registered,
}: {
  value: string;
  platform: string;
  onChange(accelerator: string): void;
  label: string;
  registered: boolean;
}) {
  const [recording, setRecording] = useState(false);
  return (
    <div className="flex items-center gap-3">
      {!registered && !recording && <span className="text-xs text-danger">In use by another app</span>}
      <button
        type="button"
        aria-label={`${label}: ${value}. Press to change.`}
        onClick={() => setRecording(true)}
        onBlur={() => setRecording(false)}
        onKeyDown={(e) => {
          if (!recording) return;
          e.preventDefault();
          if (e.key === 'Escape') return setRecording(false);
          const accelerator = acceleratorFromEvent(e.nativeEvent, platform);
          if (accelerator) {
            onChange(accelerator);
            setRecording(false);
          }
        }}
        className={cn(
          'flex h-9 min-w-44 items-center justify-center rounded-lg px-3 text-sm',
          recording ? 'bg-accent-soft text-accent shadow-[0_0_0_2px_var(--accent)]' : 'bg-sunken hover:bg-line',
        )}
      >
        {recording ? 'Press keys…' : <Kbd keys={formatAccelerator(value, platform)} />}
      </button>
    </div>
  );
}
