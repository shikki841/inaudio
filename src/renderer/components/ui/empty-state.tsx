import type { ReactNode } from 'react';

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="grid justify-items-center gap-4 py-18 text-center">
      <svg viewBox="0 0 120 120" aria-hidden className="size-30 text-accent">
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
        <h3 className="text-[18px] font-semibold text-ink">{title}</h3>
        <p className="max-w-md text-sm text-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}
