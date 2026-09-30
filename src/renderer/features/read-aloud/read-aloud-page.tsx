import { ClipboardType, Download, Play, Square } from 'lucide-react';
import { useState } from 'react';
import { KOKORO_VOICES, MODEL_CATALOG, type VoiceId } from '@shared/domain/models';
import { MAX_TTS_CHARS } from '@shared/ipc/schemas';
import { Button } from '@renderer/components/ui/button';
import { Kbd, Notice, PageHeader } from '@renderer/components/ui/layout';
import { Select } from '@renderer/components/ui/select';
import { Slider } from '@renderer/components/ui/slider';
import { api } from '@renderer/lib/api';
import { formatAccelerator } from '@renderer/lib/format';
import { useSettings, useSystemStatus, useUpdateSettings } from '@renderer/lib/queries';
import { useUi } from '@renderer/stores/ui-store';
import { useReadAloud } from './read-aloud-store';

export function ReadAloudPage() {
  const [text, setText] = useState('');
  const { phase, error, lastAudio, speak, stop, exportWav } = useReadAloud();
  const { data: settings } = useSettings();
  const { data: status } = useSystemStatus();
  const update = useUpdateSettings();
  const navigate = useUi((s) => s.navigate);
  if (!settings || !status) return null;

  const tts = MODEL_CATALOG[settings.tts.modelId];
  const installed = status.models.find((m) => m.id === tts.id)?.state === 'installed';
  const busy = phase !== 'idle';

  const download = () => {
    const url = exportWav();
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inaudio-speech.wav';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Read Aloud"
        description={
          <span className="inline-flex items-center gap-2">
            Type or paste text, or press <Kbd keys={formatAccelerator(settings.tts.shortcut, status.platform)} /> to hear your clipboard.
          </span>
        }
      />
      {!installed && (
        <Notice action={<Button size="sm" variant="primary" onClick={() => navigate('models')}>Open Models</Button>}>
          {tts.name} is not downloaded yet.
        </Notice>
      )}

      <div className="flex flex-wrap items-center gap-6">
        <Select<VoiceId>
          label="Voice"
          value={settings.tts.voiceId as VoiceId}
          onValueChange={(voiceId) => update.mutate({ tts: { voiceId } })}
          options={KOKORO_VOICES.map((v) => ({ value: v.id, label: v.name, hint: `${v.accent} ${v.gender}` }))}
        />
        <label className="flex w-64 items-center gap-3 text-[13px] text-muted">
          Speed
          <Slider
            aria-label="Speech speed"
            min={0.5}
            max={2}
            step={0.05}
            value={[settings.tts.speed]}
            onValueChange={([speed]) => speed !== undefined && update.mutate({ tts: { speed } })}
          />
          <span className="w-10 font-mono tabular-nums text-ink">{settings.tts.speed.toFixed(2)}×</span>
        </label>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={MAX_TTS_CHARS}
        placeholder="Text to read aloud"
        aria-label="Text to read aloud"
        className="min-h-64 w-full resize-y rounded-lg bg-sunken p-4 text-[15px] leading-relaxed outline-none placeholder:text-faint focus:shadow-[0_0_0_2px_var(--accent)]"
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {busy ? (
            <Button variant="primary" onClick={stop}>
              <Square /> {phase === 'synthesizing' ? 'Synthesizing…' : 'Stop'}
            </Button>
          ) : (
            <Button variant="primary" disabled={!installed || !text.trim()} onClick={() => void speak(text)}>
              <Play /> Read aloud
            </Button>
          )}
          <Button variant="ghost" disabled={!installed || busy} onClick={() => void api.text.readClipboard().then((t) => { setText(t); void speak(t); })}>
            <ClipboardType /> Read clipboard
          </Button>
        </div>
        <div className="flex items-center gap-3 text-xs text-faint">
          {lastAudio && <span>Generated in {(lastAudio.inferenceMs / 1000).toFixed(2)} s</span>}
          <Button variant="ghost" size="sm" disabled={!lastAudio} onClick={download}>
            <Download /> Save WAV
          </Button>
          <span className="tabular-nums">{text.length.toLocaleString()} / {MAX_TTS_CHARS.toLocaleString()}</span>
        </div>
      </div>
      {error && <Notice tone="danger">{error}</Notice>}
    </div>
  );
}
