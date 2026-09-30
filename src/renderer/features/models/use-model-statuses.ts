import { useEffect, useState } from 'react';
import type { ModelStatus } from '@shared/domain/models';
import type { ModelProgressEvent } from '@shared/domain/system';
import { api } from '@renderer/lib/api';
import { useSystemStatus } from '@renderer/lib/queries';

/** Model statuses from the last system snapshot, overlaid with live download progress. */
export function useModelStatuses(): ModelStatus[] {
  const { data: status } = useSystemStatus();
  const [live, setLive] = useState<Record<string, ModelProgressEvent>>({});

  useEffect(() => api.events.onModelProgress((event) => setLive((prev) => ({ ...prev, [event.id]: event }))), []);

  useEffect(() => {
    // Snapshot is authoritative once a job has settled.
    setLive((prev) => {
      const next = { ...prev };
      for (const m of status?.models ?? []) {
        if (m.state === 'installed' || m.state === 'missing') delete next[m.id];
      }
      return next;
    });
  }, [status]);

  return (status?.models ?? []).map((m) => {
    const event = live[m.id];
    return event ? { ...m, state: event.state, bytesDone: event.bytesDone, bytesTotal: event.bytesTotal, error: event.error } : m;
  });
}
