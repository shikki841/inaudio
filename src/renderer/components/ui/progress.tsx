import * as ProgressPrimitive from '@radix-ui/react-progress';
import { cn } from '@renderer/lib/cn';

export function Progress({ value, className, label }: { value: number; className?: string; label: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <ProgressPrimitive.Root
      value={pct}
      aria-label={label}
      className={cn('relative h-1.5 w-full overflow-hidden rounded-full bg-line', className)}
    >
      <ProgressPrimitive.Indicator
        className="h-full bg-accent transition-transform duration-300"
        style={{ transform: `translateX(-${100 - pct}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}
