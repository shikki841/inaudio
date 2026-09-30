import { FolderOpen } from 'lucide-react';
import { Button } from '@renderer/components/ui/button';
import { Badge, PageHeader, Row, Section } from '@renderer/components/ui/layout';
import { RadioGroup } from '@renderer/components/ui/radio-group';
import { Segmented } from '@renderer/components/ui/segmented';
import { Select } from '@renderer/components/ui/select';
import { Switch } from '@renderer/components/ui/switch';
import { api } from '@renderer/lib/api';
import { useSettings, useSystemStatus, useUpdateSettings } from '@renderer/lib/queries';
import type { Settings } from '@shared/domain/settings';
import { ShortcutInput } from './shortcut-input';

const THREADS = [1, 2, 4, 6, 8, 12, 16];

export function SettingsPage() {
  const { data: settings } = useSettings();
  const { data: status } = useSystemStatus();
  const update = useUpdateSettings();
  if (!settings || !status) return null;
  const { dictation } = settings;
  const cpu = navigator.hardwareConcurrency || 4;

  return (
    <div>
      <PageHeader title="Settings" />

      <Section title="Dictation">
        <Row label="Shortcut" description="Works from any app while Inaudio is running.">
          <ShortcutInput
            label="Dictation shortcut"
            value={dictation.shortcut}
            platform={status.platform}
            registered={status.shortcuts.dictation}
            onChange={(shortcut) => update.mutate({ dictation: { shortcut } })}
          />
        </Row>
        <Row
          label="Recording mode"
          description="Push to talk records while the shortcut is held; it only works while Inaudio is focused. From other apps the shortcut toggles."
        >
          <Segmented<Settings['dictation']['mode']>
            label="Recording mode"
            value={dictation.mode}
            onValueChange={(mode) => update.mutate({ dictation: { mode } })}
            options={[
              { value: 'toggle', label: 'Toggle' },
              { value: 'push-to-talk', label: 'Push to talk' },
            ]}
          />
        </Row>
        <div className="py-3">
          <p className="pb-2 text-sm font-medium">When a transcript is ready</p>
          <RadioGroup<Settings['dictation']['insertMode']>
            label="Insertion mode"
            value={dictation.insertMode}
            onValueChange={(insertMode) => update.mutate({ dictation: { insertMode } })}
            options={[
              {
                value: 'paste',
                label: 'Type into the focused app',
                description: status.insertion.available ? `Pastes with ${status.insertion.method}.` : status.insertion.reason,
                disabled: !status.insertion.available,
              },
              { value: 'clipboard', label: 'Copy to clipboard', description: 'Paste it yourself.' },
              { value: 'none', label: 'Keep it in Inaudio', description: 'Shown on the Dictation page and in History.' },
            ]}
          />
        </div>
        <Row label="Restore clipboard" description="Put back what was on the clipboard after typing.">
          <Switch
            aria-label="Restore clipboard"
            checked={dictation.restoreClipboard}
            disabled={dictation.insertMode !== 'paste'}
            onCheckedChange={(restoreClipboard) => update.mutate({ dictation: { restoreClipboard } })}
          />
        </Row>
        <Row label="Save history" description="Keep transcripts in a local database on this computer.">
          <Switch
            aria-label="Save history"
            checked={dictation.saveHistory}
            onCheckedChange={(saveHistory) => update.mutate({ dictation: { saveHistory } })}
          />
        </Row>
      </Section>

      <Section title="Read aloud">
        <Row label="Read clipboard shortcut">
          <ShortcutInput
            label="Read aloud shortcut"
            value={settings.tts.shortcut}
            platform={status.platform}
            registered={status.shortcuts.readAloud}
            onChange={(shortcut) => update.mutate({ tts: { shortcut } })}
          />
        </Row>
      </Section>

      <Section title="Performance">
        <Row label="CPU threads" description={`Threads used by the speech engine. This computer has ${cpu}.`}>
          <Select
            label="CPU threads"
            className="min-w-28"
            value={String(settings.stt.threads)}
            onValueChange={(v) => update.mutate({ stt: { threads: Number(v) } })}
            options={THREADS.filter((n) => n <= Math.max(cpu, 4)).map((n) => ({ value: String(n), label: String(n) }))}
          />
        </Row>
        {status.onBattery && (
          <Row label="Power" description="Running on battery. Fewer threads use less power.">
            <Badge tone="warning">On battery</Badge>
          </Row>
        )}
      </Section>

      <Section title="App">
        <div className="grid gap-3 py-3">
          <p className="text-sm font-medium">Appearance</p>
          <div className="grid gap-2 md:grid-cols-3">
            {(['system', 'light', 'dark'] as const).map((theme) => (
              <button
                key={theme}
                type="button"
                onClick={() => update.mutate({ appearance: { theme } })}
                className={`rounded-[12px] border p-3 text-left transition-colors ${
                  settings.appearance.theme === theme ? 'border-accent bg-accent-soft/50' : 'border-line bg-surface hover:bg-sunken'
                }`}
              >
                <p className="text-sm font-semibold capitalize">{theme}</p>
                <p className="text-xs text-muted">{theme === 'dark' ? 'Pure dark UI' : theme === 'light' ? 'Bright surfaces' : 'Follow OS setting'}</p>
              </button>
            ))}
          </div>
        </div>
        <Row label="Font size">
          <Segmented<Settings['appearance']['fontSize']>
            label="Font size"
            value={settings.appearance.fontSize}
            onValueChange={(fontSize) => update.mutate({ appearance: { fontSize } })}
            options={[
              { value: 'sm', label: 'Small' },
              { value: 'md', label: 'Default' },
              { value: 'lg', label: 'Large' },
            ]}
          />
        </Row>
        <Row label="Font family">
          <Segmented<Settings['appearance']['fontFamily']>
            label="Font family"
            value={settings.appearance.fontFamily}
            onValueChange={(fontFamily) => update.mutate({ appearance: { fontFamily } })}
            options={[
              { value: 'inter', label: 'Inter' },
              { value: 'system', label: 'System' },
            ]}
          />
        </Row>
        <Row label="Animations">
          <Segmented<Settings['appearance']['animations']>
            label="Animations"
            value={settings.appearance.animations}
            onValueChange={(animations) => update.mutate({ appearance: { animations } })}
            options={[
              { value: 'full', label: 'Full' },
              { value: 'reduced', label: 'Reduced' },
              { value: 'off', label: 'Off' },
            ]}
          />
        </Row>
        <Row label="Display width">
          <Segmented<Settings['appearance']['contentWidth']>
            label="Display width"
            value={settings.appearance.contentWidth}
            onValueChange={(contentWidth) => update.mutate({ appearance: { contentWidth } })}
            options={[
              { value: 'compact', label: 'Compact' },
              { value: 'default', label: 'Default' },
              { value: 'wide', label: 'Wide' },
            ]}
          />
        </Row>
        <Row label="Accent color">
          <Select
            label="Accent color"
            className="min-w-32"
            value={settings.appearance.accentTone}
            onValueChange={(accentTone) => update.mutate({ appearance: { accentTone } })}
            options={[
              { value: 'blue', label: 'Blue' },
              { value: 'violet', label: 'Violet' },
              { value: 'green', label: 'Green' },
              { value: 'amber', label: 'Amber' },
              { value: 'rose', label: 'Rose' },
            ]}
          />
        </Row>
        {status.platform !== 'linux' && (
          <Row label="Open at login">
            <Switch
              aria-label="Open at login"
              checked={settings.system.launchAtLogin}
              onCheckedChange={(launchAtLogin) => update.mutate({ system: { launchAtLogin } })}
            />
          </Row>
        )}
        <Row label="Keep running in the tray" description="Closing the window leaves shortcuts active.">
          <Switch
            aria-label="Keep running in the tray"
            checked={settings.system.closeToTray}
            onCheckedChange={(closeToTray) => update.mutate({ system: { closeToTray } })}
          />
        </Row>
        <Row label="Setup" description="Walk through microphone, model and shortcut setup again.">
          <Button size="sm" onClick={() => update.mutate({ onboardingComplete: false })}>
            Run setup
          </Button>
        </Row>
      </Section>

      <Section title="About">
        <Row label="Data folder" description={<span data-selectable>{status.dataDir}</span>}>
          <Button size="sm" variant="ghost" onClick={() => void api.system.revealModels()}>
            <FolderOpen /> Models
          </Button>
        </Row>
        <Row label="Version" description={`Inaudio ${status.appVersion} · Electron ${status.electronVersion} · ${status.platform} ${status.arch}`} />
        <Row label="Engine" description="sherpa-onnx, CPU. No network access after models are downloaded.">
          <Button size="sm" variant="ghost" onClick={() => void api.system.openLink('sherpaOnnx')}>
            Project page
          </Button>
        </Row>
      </Section>
    </div>
  );
}
