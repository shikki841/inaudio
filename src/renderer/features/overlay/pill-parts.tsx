import type { ReactNode } from 'react';
import { cn } from '@renderer/lib/cn';

/** A 28px square control, the only button size the pill has room for. */
export const iconButtonClass =
  'grid size-[28px] shrink-0 cursor-default place-items-center rounded-[8px] bg-sunken text-muted outline-none transition-colors select-none hover:text-ink focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50';

/** The stop button, which carries the recording colour rather than the accent. */
export const recordButtonClass = 'bg-record text-white hover:text-white';

/** A small flat label: the model name, the language, a phase detail. */
export function Chip({
  children,
  className,
  title,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        'flex h-[22px] min-w-0 shrink items-center rounded-[6px] bg-sunken px-2 text-[11px] font-medium text-muted',
        className,
      )}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}

/** The hairline between the phase readout and whatever trails it. */
export function Divider() {
  return <span aria-hidden className="h-5 w-px shrink-0 bg-line" />;
}

/** The phase marker: a filled dot, coloured by the tone the phase carries. */
export function Dot({ className, pulse }: { className?: string; pulse?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn('size-2 shrink-0 rounded-full', pulse && 'animate-pulse', className)}
    />
  );
}
