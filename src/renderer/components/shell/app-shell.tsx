import type { ReactNode } from 'react';
import { useSystemStatus } from '@renderer/lib/queries';
import { Sidebar } from './sidebar';
import { StatusBar } from './status-bar';

/**
 * The canvas holds the sidebar; the workspace floats on it as the one
 * page-level surface, inset on top/right and flush with the bottom edge.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { data: status } = useSystemStatus();
  const mac = status?.platform === 'darwin';
  return (
    <div className="flex h-full bg-canvas">
      <Sidebar macInset={mac} />
      <div className="flex min-w-0 flex-1 flex-col">
        <StatusBar />
        <main className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable] rounded-t-2xl bg-surface mr-3 shadow-[0_0_0_1px_var(--line)]">
          <div className="mx-auto w-full max-w-[880px] px-10 pt-9 pb-12">{children}</div>
        </main>
      </div>
    </div>
  );
}
