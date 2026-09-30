import { Cpu, Mic, Plug } from 'lucide-react';
import { MODEL_CATALOG } from '@shared/domain/models';
import { StatusDot } from '@renderer/components/ui/layout';
import { Tooltip } from '@renderer/components/ui/tooltip';
import { useSettings, useSystemStatus } from '@renderer/lib/queries';

/** Title-bar strip above the workspace: draggable, shows worker and model state. */
export function StatusBar() {
  const { data: status } = useSystemStatus();
  const { data: settings } = useSettings();
  const worker = status?.worker;
  const stt = settings ? MODEL_CATALOG[settings.stt.modelId] : null;
  const sttLoaded = !!stt && worker?.loadedStt === stt.id;
  const tone =
    worker?.state === 'ready' || worker?.state === 'busy' ? 'success' : worker?.state === 'crashed' ? 'danger' : 'warning';

  return (
    <div className="drag flex h-11 items-center justify-end gap-5 pr-[150px] text-xs text-muted">
      {stt && (
        <Tooltip content={sttLoaded ? 'Loaded in memory' : 'Loads on first use'}>
          <span className="no-drag flex items-center gap-1.5">
            <Mic className="size-3.5" />
            {stt.name}
            <StatusDot tone={sttLoaded ? 'success' : 'neutral'} />
          </span>
        </Tooltip>
      )}
      <Tooltip content={worker?.lastError ?? `Inference worker ${worker?.state ?? 'starting'}`}>
        <span className="no-drag flex items-center gap-1.5">
          <Cpu className="size-3.5" />
          Engine {worker?.state ?? 'starting'}
          <StatusDot tone={tone} />
        </span>
      </Tooltip>
      <span className="flex items-center gap-1.5">
        <Plug className="size-3.5" />
        Offline
      </span>
    </div>
  );
}
