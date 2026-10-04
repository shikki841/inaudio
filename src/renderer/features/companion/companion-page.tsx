import { useQuery } from '@tanstack/react-query';
import type { CompanionSettings } from '@shared/domain/companion';
import { PageHeader, Row, Section } from '@renderer/components/ui/layout';
import { Select } from '@renderer/components/ui/select';
import { Slider } from '@renderer/components/ui/slider';
import { Switch } from '@renderer/components/ui/switch';
import { api } from '@renderer/lib/api';
import { useSettings, useUpdateSettings } from '@renderer/lib/queries';
import { BuddySprite } from './buddy-sprite';

const STATES = [
  ['dictation.started', 'When I start listening'],
  ['transcription.completed', 'When transcription finishes'],
  ['tts.started', 'When Inaudio speaks'],
  ['model.loading', 'While a model loads'],
  ['app.error', 'When something goes wrong'],
  ['companion.clicked', 'When I interact with it'],
] as const;

export function CompanionPage() {
  const { data: settings } = useSettings();
  const packages = useQuery({ queryKey: ['companions'], queryFn: () => api.companions.list() });
  const update = useUpdateSettings();
  if (!settings || !packages.data) return null;
  const companionSettings = settings.companion;
  const selected = packages.data.find((item) => item.id === companionSettings.activeId) ?? packages.data[0];
  if (!selected) return null;

  const change = (patch: Partial<CompanionSettings>) => {
    update.mutate({ companion: { ...companionSettings, ...patch } });
  };
  const reactionChange = (event: keyof CompanionSettings['reactions'], enabled: boolean) => {
    change({ reactions: { ...companionSettings.reactions, [event]: { ...companionSettings.reactions[event], enabled } } });
  };

  return (
    <>
      <PageHeader
        title="Companion"
        description="Choose a small desktop companion that follows Inaudio's real voice and model states."
        actions={
          <Switch
            aria-label="Show companion"
            checked={companionSettings.visible}
            onCheckedChange={(visible) => void api.companions.setVisibility(visible)}
          />
        }
      />

      <section className="grid gap-5 md:grid-cols-[minmax(0,1fr)_280px]">
        <div className="grid gap-3 sm:grid-cols-3">
          {packages.data.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => void api.companions.select(item.id)}
              className={`grid gap-3 rounded-xl border p-4 text-left transition-colors ${
                item.id === selected.id ? 'border-accent bg-accent-soft' : 'border-line bg-sunken hover:bg-line'
              }`}
            >
              <BuddySprite companion={item} size="small" />
              <span>
                <span className="block text-sm font-semibold">{item.displayName}</span>
                <span className="mt-1 block text-xs text-muted">{item.description}</span>
              </span>
            </button>
          ))}
        </div>
        <div className="grid min-h-56 place-items-center rounded-xl border border-line bg-canvas p-6">
          <div className="grid justify-items-center gap-3">
            <BuddySprite companion={selected} size="large" />
            <span className="text-sm font-medium">{selected.displayName} preview</span>
          </div>
        </div>
      </section>

      <Section title="Appearance" description="The same companion window follows the app theme and stays on the selected display.">
        <Row label="Size" description="How large the companion appears on the desktop.">
          <div className="flex w-56 items-center gap-3">
            <Slider
              aria-label="Companion size"
              min={0.5}
              max={2}
              step={0.1}
              value={[companionSettings.scale]}
              onValueChange={([scale]) => scale !== undefined && change({ scale })}
            />
            <span className="w-12 text-right font-mono text-sm">{Math.round(companionSettings.scale * 100)}%</span>
          </div>
        </Row>
        <Row label="Desktop position" description="The position is clamped to the active display work area.">
          <Select
            label="Desktop position"
            value={companionSettings.position}
            onValueChange={(position) => change({ position: position as CompanionSettings['position'] })}
            options={[
              { value: 'top-left', label: 'Top left' },
              { value: 'top-right', label: 'Top right' },
              { value: 'bottom-left', label: 'Bottom left' },
              { value: 'bottom-right', label: 'Bottom right' },
              { value: 'near-microphone', label: 'Near microphone' },
              { value: 'focus-area', label: 'Above active area' },
            ]}
          />
        </Row>
        <Row label="Edge inset" description="Keep the buddy this far inside the display edges.">
          <div className="flex w-56 items-center gap-3">
            <Slider
              aria-label="Edge inset"
              min={24}
              max={160}
              step={4}
              value={[companionSettings.edgeMargin]}
              onValueChange={([edgeMargin]) => edgeMargin !== undefined && change({ edgeMargin })}
            />
            <span className="w-16 text-right font-mono text-sm">{companionSettings.edgeMargin}px</span>
          </div>
        </Row>
        <Row label="Keep away from text" description="Adds a larger gap above the cursor when using Above active area.">
          <Switch
            aria-label="Keep away from text"
            checked={companionSettings.keepAwayFromText}
            onCheckedChange={(keepAwayFromText) => change({ keepAwayFromText })}
          />
        </Row>
        <Row label="Status bubble" description="Show the live listening, transcribing, and speaking label.">
          <Select
            label="Status bubble"
            value={companionSettings.bubble}
            onValueChange={(bubble) => change({ bubble: bubble as CompanionSettings['bubble'] })}
            options={[
              { value: 'auto', label: 'Automatic' },
              { value: 'above', label: 'Above buddy' },
              { value: 'hidden', label: 'Hidden' },
            ]}
          />
        </Row>
        <Row label="Click-through" description="Let clicks pass to the window behind the companion.">
          <Switch
            aria-label="Click-through"
            checked={companionSettings.clickThrough}
            onCheckedChange={(clickThrough) => change({ clickThrough })}
          />
        </Row>
      </Section>

      <Section title="Behavior" description="Keep reactions deterministic, local, and tied to actions you can see.">
        <Row label="Personality">
          <Select
            label="Personality"
            value={companionSettings.personality}
            onValueChange={(personality) => change({ personality: personality as CompanionSettings['personality'] })}
            options={['calm', 'playful', 'curious', 'energetic', 'sleepy', 'quiet'].map((value) => ({
              value,
              label: value.charAt(0).toUpperCase() + value.slice(1),
            }))}
          />
        </Row>
        <Row label="Motion" description="Reduce movement without changing the companion state.">
          <Select
            label="Motion"
            value={companionSettings.motion}
            onValueChange={(motion) => change({ motion: motion as CompanionSettings['motion'] })}
            options={[
              { value: 'full', label: 'Full' },
              { value: 'reduced', label: 'Reduced' },
              { value: 'off', label: 'Off' },
            ]}
          />
        </Row>
        <Row label="Spoken reactions" description="Reserved for the shared Kokoro voice service.">
          <Switch
            aria-label="Spoken reactions"
            checked={companionSettings.voiceEnabled}
            onCheckedChange={(voiceEnabled) => change({ voiceEnabled })}
          />
        </Row>
        <Row label="Sleep after inactivity" description="The buddy settles down without changing dictation or model state.">
          <div className="flex w-56 items-center gap-3">
            <Slider
              aria-label="Sleep after inactivity"
              min={1}
              max={120}
              step={1}
              value={[companionSettings.idleSleepMinutes]}
              onValueChange={([idleSleepMinutes]) =>
                idleSleepMinutes !== undefined && change({ idleSleepMinutes })
              }
            />
            <span className="w-16 text-right font-mono text-sm">
              {companionSettings.idleSleepMinutes} min
            </span>
          </div>
        </Row>
      </Section>

      <Section title="Reactions" description="The companion only reacts to enabled events from the application.">
        {STATES.map(([event, label]) => (
          <Row key={event} label={label}>
            <Switch
              aria-label={label}
              checked={companionSettings.reactions[event].enabled}
              onCheckedChange={(enabled) => reactionChange(event, enabled)}
            />
          </Row>
        ))}
      </Section>
    </>
  );
}
