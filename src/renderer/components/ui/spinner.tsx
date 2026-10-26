import { Loader2 } from 'lucide-react';
import { cn } from '@renderer/lib/cn';

/**
 * The app's one loading mark. It turns at full motion and holds still under reduced or off
 * motion and the system setting, so whatever shows it must also say what is happening
 * (a label, `aria-busy`, or a status line).
 */
export function Spinner({ className }: { className?: string }) {
  return <Loader2 aria-hidden data-spinner className={cn('spinner', className)} />;
}
