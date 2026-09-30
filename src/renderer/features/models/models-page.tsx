import { FolderOpen } from 'lucide-react';
import { Button } from '@renderer/components/ui/button';
import { PageHeader, Section } from '@renderer/components/ui/layout';
import { api } from '@renderer/lib/api';
import { useSettings, useSystemStatus, useUpdateSettings } from '@renderer/lib/queries';
import { ModelRow } from './model-row';
import { useModelStatuses } from './use-model-statuses';

export function ModelsPage() {
  const models = useModelStatuses();
  const { data: settings } = useSettings();
  const { data: status } = useSystemStatus();
  const update = useUpdateSettings();
  if (!settings || !status) return null;

  const stt = models.filter((m) => m.kind === 'stt');
  const tts = models.filter((m) => m.kind === 'tts');

  return (
    <div>
      <PageHeader
        title="Models"
        description="Models are downloaded once, checked against pinned SHA-256 hashes, and run offline after that."
        actions={
          <Button variant="ghost" size="sm" onClick={() => void api.system.revealModels()}>
            <FolderOpen /> Show folder
          </Button>
        }
      />
      <Section title="Speech to text">
        {stt.map((m) => (
          <ModelRow
            key={m.id}
            status={m}
            selected={settings.stt.modelId === m.id}
            onSelect={() => update.mutate({ stt: { modelId: m.id as typeof settings.stt.modelId } })}
          />
        ))}
      </Section>
      <Section title="Text to speech">
        {tts.map((m) => (
          <ModelRow key={m.id} status={m} selected={settings.tts.modelId === m.id} />
        ))}
      </Section>
      <p className="pt-2 text-xs text-faint" data-selectable>
        Stored in {status.modelsDir}. Inference runs in a separate process on the CPU through sherpa-onnx.
      </p>
    </div>
  );
}
