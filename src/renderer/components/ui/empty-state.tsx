import type { ReactNode } from 'react';
import { cn } from '@renderer/lib/cn';

/**
 * The one empty-state format: drawing, title, one line of help, an optional action. `md` fills
 * a page (History); `sm` sits inside a section, such as an empty Recent list or stats range.
 */
export function EmptyState({
  title,
  description,
  action,
  size = 'md',
}: {
  title: string;
  description: string;
  action?: ReactNode;
  size?: 'md' | 'sm';
}) {
  const small = size === 'sm';
  return (
    <div className={cn('grid justify-items-center text-center', small ? 'gap-3 py-8' : 'gap-4 py-18')}>
      <svg viewBox="0 0 120 120" aria-hidden className={cn('text-accent', small ? 'size-18' : 'size-30')}>
        <g fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
          <rect x="18" y="30" width="84" height="60" rx="14" className="text-line-strong" />
          <path d="M36 54h48" className="text-faint" />
          <path d="M36 70h30" className="text-faint" />
          <path d="M60 16v10" />
          <path d="M100 58h10" />
          <path d="M10 58h10" />
        </g>
      </svg>
      <div className="grid gap-1">
        <h3 className={cn('font-semibold text-ink', small ? 'text-base' : 'text-lg')}>{title}</h3>
        <p className="max-w-md text-sm text-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}
