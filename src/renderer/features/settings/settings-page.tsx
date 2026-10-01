import { Check, FolderOpen, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
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
const ACCENT_COLORS = {
  blue: '#2f5bea',
  violet: '#6148d8',
  green: '#1f8a4c',
  amber: '#ba7400',
  rose: '#c14574',
} as const;
const SEARCH_ITEMS = [
  { id: 'settings-appearance', label: 'Appearance', section: 'Appearance', keywords: 'theme font animations width accent color' },
  { id: 'settings-theme', label: 'Theme mode', section: 'Appearance', keywords: 'system light dark theme preview' },
  { id: 'settings-font-size', label: 'Font size', section: 'Appearance', keywords: 'text size' },
  { id: 'settings-font-family', label: 'Font family', section: 'Appearance', keywords: 'typeface font' },
  { id: 'settings-animations', label: 'Animations', section: 'Appearance', keywords: 'motion reduced off' },
  { id: 'settings-content-width', label: 'Display width', section: 'Appearance', keywords: 'compact default wide layout' },
  { id: 'settings-accent', label: 'Accent color', section: 'Appearance', keywords: 'blue violet green amber rose color' },
  { id: 'settings-dictation', label: 'Dictation', section: 'Dictation', keywords: 'shortcut recording transcript clipboard history' },
  { id: 'settings-read-aloud', label: 'Read aloud', section: 'Read aloud', keywords: 'shortcut speech' },
  { id: 'settings-performance', label: 'Performance', section: 'Performance', keywords: 'cpu threads power battery' },
  { id: 'settings-app', label: 'App', section: 'App', keywords: 'login tray setup' },
  { id: 'settings-about', label: 'About', section: 'About', keywords: 'version engine data folder models' },
] as const;

function ThemePreview({ theme }: { theme: 'system' | 'light' | 'dark' }) {
  const dark = theme === 'dark';
  const mixed = theme === 'system';
  return (
    <div className={`grid h-24 grid-cols-[30%_1fr] overflow-hidden rounded-lg border ${dark ? 'border-[#393b45] bg-[#17181d]' : 'border-[#d8dce4] bg-white'}`}>
      <div className={`p-2 ${dark ? 'bg-[#20222a]' : 'bg-[#f0f2f6]'}`}>
        <div className={`mb-2 h-1.5 w-8 rounded-full ${dark ? 'bg-[#626878]' : 'bg-[#aeb6c4]'}`} />
        <div className={`mb-1 h-1.5 w-full rounded-full ${dark ? 'bg-[#4a4e5b]' : 'bg-[#c7cdd8]'}`} />
        <div className={`h-1.5 w-3/4 rounded-full ${dark ? 'bg-[#4a4e5b]' : 'bg-[#c7cdd8]'}`} />
      </div>
      <div className="space-y-2 p-2">
        <div className={`h-2 w-1/2 rounded-full ${dark ? 'bg-[#858b9a]' : 'bg-[#77808e]'}`} />
        <div className="flex h-8 overflow-hidden rounded-md">
          <div className={`h-full w-1/2 ${mixed || !dark ? 'bg-[#f0f2f6]' : 'bg-[#252832]'}`} />
          {mixed && <div className="h-full w-1/2 bg-[#252832]" />}
          {!mixed && <div className={`h-full w-1/2 ${dark ? 'bg-[#252832]' : 'bg-[#f0f2f6]'}`} />}
        </div>
        <div className={`h-1.5 w-2/3 rounded-full ${dark ? 'bg-[#4a4e5b]' : 'bg-[#c7cdd8]'}`} />
      </div>
    </div>
  );
}

export function SettingsPage() {
  const [search, setSearch] = useState('');
  const { data: settings } = useSettings();
  const { data: status } = useSystemStatus();
  const update = useUpdateSettings();
  const results = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];
    return SEARCH_ITEMS.filter((item) => `${item.label} ${item.section} ${item.keywords}`.toLowerCase().includes(query));
  }, [search]);
  const jumpTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (!settings || !status) return null;
  const { dictation } = settings;
  const cpu = navigator.hardwareConcurrency || 4;

  return (
    <div>
      <PageHeader title="Settings" />
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search settings"
          aria-label="Search settings"
          className="h-10 w-full rounded-lg bg-sunken pr-9 pl-9 text-sm text-ink outline-none placeholder:text-faint focus:shadow-[0_0_0_2px_var(--accent)]"
        />
        {search && (
          <button type="button" aria-label="Clear settings search" onClick={() => setSearch('')} className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-faint hover:text-ink">
            <X className="size-4" />
          </button>
        )}
        {search && (
          <div className="absolute z-10 mt-2 grid w-full gap-1 rounded-lg border border-line bg-surface p-1 shadow-[0_8px_24px_rgb(0_0_0/0.12)]">
            {results.length ? results.map((item) => (
              <button key={item.id} type="button" onClick={() => { jumpTo(item.id); setSearch(''); }} className="flex items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-sunken">
                <span>{item.label}</span>
                <span className="text-xs text-faint">{item.section}</span>
              </button>
            )) : <p className="px-3 py-2 text-sm text-muted">No settings found.</p>}
          </div>
        )}
      </div>

      <div className="flex flex-col">
      <Section id="settings-dictation" title="Dictation" className="order-2">
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

      <Section id="settings-read-aloud" title="Read aloud" className="order-3">
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

      <Section id="settings-performance" title="Performance" className="order-4">
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

      <Section id="settings-appearance" title="Appearance" className="order-first pt-0">
        <div id="settings-theme" className="grid gap-3 py-3">
          <p className="text-sm font-medium">Theme mode</p>
          <div role="radiogroup" aria-label="Theme mode" className="grid gap-2 md:grid-cols-3">
            {(['system', 'light', 'dark'] as const).map((theme) => {
              const selected = settings.appearance.theme === theme;
              return (
                <button
                  key={theme}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => update.mutate({ appearance: { theme } })}
                  className={`rounded-[12px] border p-2 text-left transition-colors ${selected ? 'border-accent bg-accent-soft/50 shadow-[0_0_0_1px_var(--accent)]' : 'border-line bg-surface hover:bg-sunken'}`}
                >
                  <ThemePreview theme={theme} />
                  <span className="mt-2 flex items-center justify-between px-1 text-sm font-semibold capitalize">
                    {theme}
                    {selected && <Check className="size-4 text-accent" />}
                  </span>
                  <span className="block px-1 pt-0.5 text-xs text-muted">{theme === 'dark' ? 'Dark surfaces' : theme === 'light' ? 'Bright surfaces' : 'Follow OS setting'}</span>
                </button>
              );
            })}
          </div>
        </div>
        <Row id="settings-font-size" label="Font size">
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
        <Row id="settings-font-family" label="Font family">
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
        <Row id="settings-animations" label="Animations">
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
        <Row id="settings-content-width" label="Display width">
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
        <Row id="settings-accent" label="Accent color">
          <Select
            label="Accent color"
            className="min-w-32"
            value={settings.appearance.accentTone}
            onValueChange={(accentTone) => update.mutate({ appearance: { accentTone } })}
            options={Object.entries(ACCENT_COLORS).map(([value, color]) => ({
              value: value as Settings['appearance']['accentTone'],
              label: value.charAt(0).toUpperCase() + value.slice(1),
              adornment: <span aria-hidden className="size-3 rounded-full" style={{ backgroundColor: color }} />,
            }))}
          />
        </Row>
      </Section>

      <Section id="settings-app" title="App" className="order-5">
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

      <Section id="settings-about" title="About" className="order-6">
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
    </div>
  );
}
