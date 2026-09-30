import { Cpu, Mic, Minus, Square, SquareDashed, X } from 'lucide-react';
import { MODEL_CATALOG } from '@shared/domain/models';
import type { AppMenuCommand } from '@shared/domain/system';
import { IconButton } from '@renderer/components/ui/icon-button';
import { StatusDot } from '@renderer/components/ui/layout';
import { api } from '@renderer/lib/api';
import { useSettings, useSystemStatus } from '@renderer/lib/queries';
import { useUi } from '@renderer/stores/ui-store';

const ROUTE_LABEL: Record<ReturnType<typeof useUi.getState>['route'], string> = {
  dictation: 'Dictation',
  history: 'History',
  'read-aloud': 'Read Aloud',
  models: 'Models',
  audio: 'Audio',
  settings: 'Settings',
};

const MENUS: { label: string; command: AppMenuCommand }[] = [
  { label: 'File', command: 'file.open-models-folder' },
  { label: 'View', command: 'view.settings' },
  { label: 'Setup', command: 'file.run-setup' },
];

export function StatusBar() {
  const route = useUi((s) => s.route);
  const { data: status } = useSystemStatus();
  const { data: settings } = useSettings();
  const worker = status?.worker;
  const stt = settings ? MODEL_CATALOG[settings.stt.modelId] : null;
  const sttLoaded = !!stt && worker?.loadedStt === stt.id;
  const tone =
    worker?.state === 'ready' || worker?.state === 'busy' ? 'success' : worker?.state === 'crashed' ? 'danger' : 'warning';

  return (
    <header className="drag grid h-[44px] grid-cols-[1fr_auto_1fr] items-center border-b border-line/70 bg-canvas/80 px-3 backdrop-blur-sm">
      <nav className="no-drag flex items-center gap-1" aria-label="Window menu">
        {MENUS.map((menu) => (
          <button
            key={menu.label}
            type="button"
            className="rounded-[6px] px-2 py-1 text-xs font-medium text-muted hover:bg-surface hover:text-ink"
            onClick={() => void api.system.menu(menu.command)}
          >
            {menu.label}
          </button>
        ))}
      </nav>

      <div className="pointer-events-none flex items-center justify-center gap-3 text-xs text-muted">
        <span className="font-semibold text-ink">{ROUTE_LABEL[route]}</span>
        {stt && (
          <span className="inline-flex items-center gap-1">
            <Mic className="size-3.5" />
            {stt.name}
            <StatusDot tone={sttLoaded ? 'success' : 'neutral'} />
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <Cpu className="size-3.5" />
          Engine {worker?.state ?? 'starting'}
          <StatusDot tone={tone} />
        </span>
      </div>

      <div className="no-drag ml-auto flex items-center gap-1">
        <button
          type="button"
          className="rounded-[6px] p-1 text-muted hover:bg-surface hover:text-ink"
          onClick={() => void api.system.window('minimize')}
          aria-label="Minimize window"
        >
          <Minus className="size-4" />
        </button>
        <button
          type="button"
          className="rounded-[6px] p-1 text-muted hover:bg-surface hover:text-ink"
          onClick={() => void api.system.window('maximize-toggle')}
          aria-label={status?.window.maximized ? 'Restore window' : 'Maximize window'}
        >
          {status?.window.maximized ? <SquareDashed className="size-3.5" /> : <Square className="size-3.5" />}
        </button>
        <IconButton label="Close window" className="text-muted hover:bg-danger hover:text-white" onClick={() => void api.system.window('close')}>
          <X />
        </IconButton>
      </div>
    </header>
  );
}
