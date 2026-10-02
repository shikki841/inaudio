import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@renderer/lib/cn';

/** The floating card both the dropdown and the two pickers draw themselves in. */
export const panelClass =
  'z-50 rounded-[12px] border border-line bg-surface p-[5px] shadow-[0_10px_30px_rgb(0_0_0/0.18)] dark:shadow-[0_10px_30px_rgb(0_0_0/0.55)]';

/** A row in a panel. Radix sets `data-highlighted` on the focused item. */
export const panelItemClass =
  'flex h-[30px] cursor-default items-center gap-[9px] rounded-[6px] px-[9px] text-[13px] whitespace-nowrap text-ink outline-none select-none data-disabled:text-faint data-highlighted:bg-sunken';

export function PanelLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-[9px] pt-[7px] pb-1 text-[10px] leading-none font-semibold tracking-[0.06em] text-faint uppercase">
      {children}
    </div>
  );
}

export function PanelSeparator() {
  return <div className="mx-[7px] my-[5px] h-px bg-line" />;
}

/** The dimmed closing line each picker ends with. */
export function PanelHint({ children }: { children: ReactNode }) {
  return <p className="px-[9px] py-[6px] text-[12px] leading-snug text-faint">{children}</p>;
}

/** Trailing text on a row: a shortcut, a language, a latency figure. */
export function PanelTail({ children }: { children: ReactNode }) {
  return <span className="ml-auto pl-3 font-mono text-[11px] text-faint">{children}</span>;
}

/** The check that marks the active device or model, holding its column when absent. */
export function PanelCheck({ selected }: { selected: boolean }) {
  return (
    <Check
      aria-hidden
      className={cn('size-[13px] shrink-0 text-accent', !selected && 'invisible')}
    />
  );
}

/** Row styling for a selected entry, which the preview draws in the accent. */
export const panelSelectedClass = 'bg-accent-soft font-medium text-accent';
