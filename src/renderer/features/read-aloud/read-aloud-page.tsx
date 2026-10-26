import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as ScrollArea from '@radix-ui/react-scroll-area';
import {
  Check,
  ClipboardType,
  Copy,
  Download,
  MoreHorizontal,
  Pause,
  PencilLine,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Square,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { transcriptTitle } from '@shared/domain/history';
import { KOKORO_VOICES, MODEL_CATALOG, type VoiceId } from '@shared/domain/models';
import { MAX_READ_ALOUD_CHARS, readAloudActive, type ReadAloudSource, type ReadAloudState } from '@shared/domain/read-aloud';
import { CopyButton } from '@renderer/components/ui/activity';
import { Button } from '@renderer/components/ui/button';
import { IconButton } from '@renderer/components/ui/icon-button';
import { Kbd, Notice, PageHeader, SectionHeading } from '@renderer/components/ui/layout';
import { Select } from '@renderer/components/ui/select';
import { Slider } from '@renderer/components/ui/slider';
import { Spinner } from '@renderer/components/ui/spinner';
import { Waveform } from '@renderer/components/ui/waveform';
import { api } from '@renderer/lib/api';
import { cn } from '@renderer/lib/cn';
import { formatAccelerator, formatDuration } from '@renderer/lib/format';
import { useSettings, useSystemStatus, useUpdateSettings } from '@renderer/lib/queries';
import { useAction } from '@renderer/lib/use-action';
import { useUi } from '@renderer/stores/ui-store';
import { useReadAloud } from './read-aloud-store';

const SOURCE_LABEL: Record<ReadAloudSource, string> = {
  selection: 'From your selection',
  clipboard: 'From the clipboard',
  manual: 'Typed here',
};

/** Up to this many sentences get their own segment in the progress bar; longer texts get a slider. */
const MAX_SEGMENTS = 60;

const menuContentClass = 'z-50 rounded-[6px] border border-line bg-surface p-1 shadow-[0_8px_24px_rgb(0_0_0/0.12)]';
const menuItemBase = 'flex h-8 cursor-default items-center gap-2 rounded-[6px] px-2.5 text-sm text-ink outline-none select-none data-disabled:text-faint data-highlighted:bg-sunken [&_svg]:size-4';
const menuItemClass = `${menuItemBase} [&_svg]:text-muted`;

/** The speeds people pick most; anything else is set exactly in Settings and shown as it is. */
const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];
const formatSpeed = (speed: number) => `${Number(speed.toFixed(2))}×`;

/** The speed chip on the player: a short list of presets, and the way to an exact value. */
function SpeedMenu({ value, onChange, onMore }: { value: number; onChange(speed: number): void; onMore(): void }) {
  const preset = SPEEDS.find((speed) => Math.abs(speed - value) < 0.001);
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <Button size="sm" aria-label={`Speed, ${formatSpeed(value)}`} className="min-w-14 tabular-nums">
          {formatSpeed(value)}
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" side="top" sideOffset={6} collisionPadding={12} className={cn(menuContentClass, 'min-w-44')}>
          <DropdownMenu.Label className="px-2.5 pt-1.5 pb-1 text-[11px] font-semibold tracking-[0.06em] text-faint uppercase">Speed</DropdownMenu.Label>
          <DropdownMenu.RadioGroup value={preset === undefined ? '' : String(preset)} onValueChange={(next) => onChange(Number(next))}>
            {SPEEDS.map((speed) => (
              <DropdownMenu.RadioItem key={speed} value={String(speed)} className={cn(menuItemBase, 'justify-between tabular-nums data-[state=checked]:font-medium')}>
                {formatSpeed(speed)}
                <DropdownMenu.ItemIndicator>
                  <Check aria-hidden className="text-accent" />
                </DropdownMenu.ItemIndicator>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
          <DropdownMenu.Separator className="mx-1 my-1 h-px bg-line" />
          <DropdownMenu.Item className={menuItemClass} onSelect={onMore}>
            <SlidersHorizontal /> Exact speed in Settings
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function statusLabel(state: ReadAloudState): string {
  switch (state.status) {
    case 'capturing':
      return 'Reading the selection…';
    case 'preparing':
      return 'Preparing the voice…';
    case 'playing':
      return state.waiting ? 'Waiting for the next sentence…' : 'Reading';
    case 'paused':
      return 'Paused';
    case 'stopped':
      return state.index + 1 >= state.count ? 'Finished' : 'Stopped';
    case 'error':
      return 'Stopped';
    default:
      return 'Ready';
  }
}

/** Ticks while audio plays, so the clock follows without the store re-rendering every frame. */
function useElapsed(playing: boolean): number {
  const elapsed = useReadAloud((s) => s.elapsed);
  const [value, setValue] = useState(() => elapsed());
  useEffect(() => {
    setValue(elapsed());
    if (!playing) return;
    const id = setInterval(() => setValue(elapsed()), 250);
    return () => clearInterval(id);
  }, [elapsed, playing]);
  return value;
}

/**
 * The session text with each sentence clickable. While it is read, the sentence being read is
 * marked, the ones already read stay in full ink and the ones still to come are quieter.
 */
function Preview({ follow }: { follow: boolean }) {
  const session = useReadAloud((s) => s.session);
  const state = useReadAloud((s) => s.state);
  const seek = useReadAloud((s) => s.seek);
  const current = useRef<HTMLButtonElement>(null);
  const active = readAloudActive(state.status) && state.sessionId === session?.sessionId;

  useEffect(() => {
    if (follow && active) current.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [follow, active, state.index]);

  if (!session) return null;
  const parts: ReactNode[] = [];
  let cursor = 0;
  session.segments.forEach((segment, i) => {
    if (segment.start > cursor) parts.push(session.text.slice(cursor, segment.start));
    const marked = follow && active && i === state.index;
    parts.push(
      <button
        key={segment.start}
        ref={marked ? current : undefined}
        type="button"
        tabIndex={-1}
        onClick={() => (state.sessionId ? seek(i) : undefined)}
        className={cn(
          'inline cursor-default rounded-[6px] text-left transition-colors hover:bg-surface',
          follow && active && i > state.index && 'text-muted',
          marked && 'bg-accent-soft text-ink shadow-[0_0_0_3px_var(--accent-soft)] hover:bg-accent-soft',
        )}
      >
        {segment.text}
      </button>,
    );
    cursor = segment.end;
  });

  return (
    <ScrollArea.Root className="h-80 overflow-hidden">
      <ScrollArea.Viewport className="size-full">
        <div data-selectable className="px-[22px] py-5 text-[17px] leading-[1.75] whitespace-pre-wrap text-ink">
          {parts}
        </div>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar orientation="vertical" className="flex w-2.5 touch-none p-0.5 select-none">
        <ScrollArea.Thumb className="relative flex-1 rounded-full bg-line-strong hover:bg-muted" />
      </ScrollArea.Scrollbar>
    </ScrollArea.Root>
  );
}

/**
 * One segment per sentence, as wide as the sentence is long: read, being read (filling as it
 * plays) and still to come. A click reads on from that sentence.
 */
function Segments({ weights, index, progress, enabled, onSeek }: { weights: number[]; index: number; progress: number; enabled: boolean; onSeek(index: number): void }) {
  return (
    <div className="flex h-3 items-center gap-[3px]" role="group" aria-label={`Sentence ${index + 1} of ${weights.length}`}>
      {weights.map((weight, i) => (
        <button
          key={i}
          type="button"
          tabIndex={-1}
          disabled={!enabled}
          aria-label={`Sentence ${i + 1}`}
          onClick={() => onSeek(i)}
          style={{ flexGrow: weight }}
          className={cn(
            'relative h-1.5 min-w-1 basis-0 overflow-hidden rounded-[2px] transition-[height] enabled:hover:h-2.5 disabled:cursor-default',
            i < index ? 'bg-accent' : i === index && enabled ? 'bg-accent/35' : 'bg-line-strong',
          )}
        >
          {i === index && enabled && <span aria-hidden className="absolute inset-y-0 left-0 bg-accent" style={{ width: `${progress * 100}%` }} />}
        </button>
      ))}
    </div>
  );
}

export function ReadAloudPage() {
  const session = useReadAloud((s) => s.session);
  const state = useReadAloud((s) => s.state);
  const cached = useReadAloud((s) => s.cached);
  const startError = useReadAloud((s) => s.error);
  const { readText, readClipboard, control, seek, exportWav } = useReadAloud.getState();
  const { data: settings } = useSettings();
  const { data: status } = useSystemStatus();
  const update = useUpdateSettings();
  const navigate = useUi((s) => s.navigate);
  const openSettings = useUi((s) => s.openSettings);
  const origin = useReadAloud((s) => s.origin);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(true);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const shownSession = useRef<string | null>(null);
  const clipboard = useAction(() => readClipboard());
  const copyText = useAction((text: string) => api.text.copy(text), { success: 'Copied to the clipboard' });

  useEffect(() => {
    if (!session || shownSession.current === session.sessionId) return;
    shownSession.current = session.sessionId;
    // A draft being written wins: the new session plays on without taking over the editor.
    if (editing && draft.trim()) return;
    setDraft(session.text);
    setEditing(false);
  }, [session, editing, draft]);

  const active = readAloudActive(state.status) && state.status !== 'capturing';
  const elapsed = useElapsed(state.status === 'playing' && !state.waiting);
  if (!settings || !status) return null;

  const tts = MODEL_CATALOG[settings.tts.modelId];
  const installed = status.models.find((m) => m.id === tts.id)?.state === 'installed';
  const hasSession = !!session && state.sessionId === session.sessionId;
  const paused = state.status === 'paused';
  const position = dragIndex ?? state.index;
  const navigable = hasSession && !editing;
  const speaking = state.status === 'playing' && !state.waiting;
  // The voice is being prepared or the selection read: the big button shows a spinner meanwhile.
  const preparing = state.status === 'preparing' || state.status === 'capturing';
  const text = editing ? draft : (session?.text ?? '');
  const nowPlaying = navigable && session ? (origin?.title ?? transcriptTitle({ title: '', text: session.text }, 48)) : 'Nothing playing';
  const weights = navigable && session ? session.segments.map((segment) => Math.max(1, segment.end - segment.start)) : [];
  // Total time is known once every sentence has been synthesized; until then the end reads –:––.
  const total = state.durations.length === state.count && state.durations.every((ms) => ms > 0) ? state.durations.reduce((sum, ms) => sum + ms, 0) : 0;
  const before = state.durations.slice(0, state.index).reduce((sum, ms) => sum + ms, 0);
  const current = state.durations[state.index] ?? 0;
  const progress = current ? Math.min(1, Math.max(0, (elapsed - before) / current)) : 0;

  const play = () => {
    if (paused) control('resume');
    else if (editing || !hasSession) {
      setEditing(false);
      void readText(draft);
    } else control('replay');
  };
  const edit = () => {
    if (active) control('stop');
    setEditing(true);
  };
  const download = () => {
    const url = exportWav();
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inaudio-speech.wav';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const copy = () => {
    if (text) void copyText.run(text);
  };

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Read Aloud"
        description={
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            Select text in any app and press <Kbd keys={formatAccelerator(settings.tts.shortcut, status.platform)} />, or
            type or paste it here.
          </span>
        }
        actions={
          <>
            <Button size="sm" disabled={!installed} loading={clipboard.pending} onClick={() => void clipboard.run()}>
              <ClipboardType /> Read clipboard
            </Button>
            <DropdownMenu.Root modal={false}>
              <DropdownMenu.Trigger asChild>
                <IconButton label="More actions">
                  <MoreHorizontal />
                </IconButton>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={6}
                  className={cn(menuContentClass, 'min-w-48')}
                >
                  <DropdownMenu.Item className={menuItemClass} disabled={editing || !hasSession} onSelect={edit}>
                    <PencilLine /> Edit text
                  </DropdownMenu.Item>
                  <DropdownMenu.Item className={menuItemClass} disabled={!text || copyText.pending} onSelect={copy}>
                    <Copy /> Copy text
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator className="mx-1 my-1 h-px bg-line" />
                  <DropdownMenu.Item className={menuItemClass} disabled={!hasSession || cached < state.count} onSelect={download}>
                    <Download /> Save WAV
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </>
        }
      />

      {!installed && (
        <Notice action={<Button size="sm" variant="primary" onClick={() => navigate('models')}>Open Models</Button>}>
          {tts.name} is not downloaded yet.
        </Notice>
      )}
      {(startError || state.status === 'error') && <Notice tone="danger">{startError ?? state.message}</Notice>}
      {hasSession && session.truncated && !editing && (
        <Notice tone="neutral">Only the first {MAX_READ_ALOUD_CHARS.toLocaleString()} characters are read.</Notice>
      )}

      <section aria-label="Text" className="grid gap-3">
        <SectionHeading
          action={
            <>
              <span className="truncate text-xs text-faint tabular-nums">
                {editing
                  ? `${draft.length.toLocaleString()} / ${MAX_READ_ALOUD_CHARS.toLocaleString()}`
                  : `${SOURCE_LABEL[session?.source ?? 'manual']} · ${state.count} ${state.count === 1 ? 'sentence' : 'sentences'}`}
              </span>
              {!editing && (
                <Button variant="ghost" size="sm" disabled={!hasSession} onClick={edit}>
                  <PencilLine /> Edit text
                </Button>
              )}
              <CopyButton text={text} label="Copy text" />
            </>
          }
        >
          {editing ? 'Text to read' : 'Reading'}
        </SectionHeading>
        <div className="overflow-hidden rounded-[6px] bg-sunken focus-within:shadow-[0_0_0_2px_var(--accent)]">
          {editing ? (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={MAX_READ_ALOUD_CHARS}
              placeholder="Type or paste the text to read aloud"
              aria-label="Text to read aloud"
              className="app-scroll-area block h-80 w-full resize-y rounded-[6px] bg-transparent px-[22px] py-5 text-[17px] leading-[1.75] outline-none placeholder:text-faint"
            />
          ) : (
            <Preview follow={settings.tts.followAlong} />
          )}
        </div>
        {editing && hasSession && <p className="m-0 text-xs text-faint">Replay reads the edited text, not the original selection.</p>}
      </section>

      <section
        aria-label="Player"
        className="grid grid-cols-[minmax(0,1fr)_minmax(300px,1.6fr)_auto] items-center gap-7 border-t border-line pt-5"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className={cn('grid size-11 shrink-0 place-items-center rounded-[6px]', active ? 'bg-accent-soft text-accent' : 'bg-sunken text-faint')}
          >
            {active ? <Waveform paused={!speaking} /> : <Volume2 className="size-[18px]" />}
          </span>
          <span className="grid min-w-0">
            <span className="truncate text-sm font-semibold">{nowPlaying}</span>
            <span role="status" aria-live="polite" className="truncate text-xs text-muted">
              {navigable
                ? `${statusLabel(state)}${state.count ? ` · sentence ${position + 1} of ${state.count}` : ''}`
                : draft.trim()
                  ? 'Press play to read it aloud'
                  : 'Type text or read the clipboard'}
            </span>
          </span>
        </div>

        <div className="grid min-w-0 justify-items-center gap-2">
          <div className="flex items-center gap-2.5">
            <IconButton label="Replay from the start" disabled={!navigable} onClick={() => control('replay')}>
              <RotateCcw />
            </IconButton>
            <IconButton label="Previous sentence" disabled={!navigable || state.index === 0} onClick={() => seek(state.index - 1)}>
              <SkipBack />
            </IconButton>
            {active && !paused ? (
              <button
                type="button"
                aria-label="Pause"
                aria-busy={preparing || state.waiting || undefined}
                onClick={() => control('pause')}
                className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-on-accent outline-none hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {preparing || state.waiting ? <Spinner className="size-[18px]" /> : <Pause aria-hidden className="size-[18px] fill-current" />}
              </button>
            ) : (
              <button
                type="button"
                aria-label={preparing ? 'Preparing the voice' : paused ? 'Resume' : editing || !hasSession ? 'Read aloud' : 'Play again'}
                aria-busy={preparing || undefined}
                disabled={!installed || preparing || (editing || !hasSession ? !draft.trim() : false)}
                onClick={play}
                className={cn(
                  'grid size-11 shrink-0 place-items-center rounded-full bg-accent text-on-accent outline-none hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                  preparing ? 'disabled:opacity-80' : 'disabled:opacity-40',
                )}
              >
                {preparing ? <Spinner className="size-[18px]" /> : <Play aria-hidden className="ml-0.5 size-[18px] fill-current" />}
              </button>
            )}
            <IconButton label="Next sentence" disabled={!navigable || state.index + 1 >= state.count} onClick={() => seek(state.index + 1)}>
              <SkipForward />
            </IconButton>
            <IconButton label="Stop" disabled={!active} onClick={() => control('stop')}>
              <Square />
            </IconButton>
          </div>
          <div className="grid w-full grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2.5 text-xs text-muted tabular-nums">
            <span>{formatDuration(navigable ? elapsed : 0)}</span>
            {navigable && state.count > 1 && state.count <= MAX_SEGMENTS ? (
              <Segments weights={weights} index={position} progress={dragIndex === null ? progress : 0} enabled={navigable} onSeek={seek} />
            ) : (
              <Slider
                aria-label="Sentence"
                min={0}
                max={Math.max(1, state.count - 1)}
                step={1}
                disabled={!navigable || state.count < 2}
                value={[hasSession ? position : 0]}
                onValueChange={([index]) => index !== undefined && setDragIndex(index)}
                onValueCommit={([index]) => {
                  setDragIndex(null);
                  if (index !== undefined) seek(index);
                }}
              />
            )}
            <span className="text-right">{navigable && total ? formatDuration(total) : '–:––'}</span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Select<VoiceId>
            label="Voice"
            className="h-8 max-w-40 min-w-0"
            contentClassName="rounded-[6px]"
            value={settings.tts.voiceId as VoiceId}
            onValueChange={(voiceId) => update.mutate({ tts: { voiceId } })}
            options={KOKORO_VOICES.map((v) => ({ value: v.id, label: v.name, hint: `${v.accent} ${v.gender}` }))}
          />
          <SpeedMenu
            value={settings.tts.speed}
            onChange={(next) => update.mutate({ tts: { speed: next } })}
            onMore={() => openSettings('read-aloud', 'settings-read-aloud-voice')}
          />
          <span className="flex items-center gap-2 text-muted">
            {settings.tts.volume === 0 ? <VolumeX aria-hidden className="size-4 shrink-0" /> : <Volume2 aria-hidden className="size-4 shrink-0" />}
            <Slider
              aria-label="Speech volume"
              aria-valuetext={`${Math.round(settings.tts.volume * 100)}%`}
              className="w-[72px]"
              min={0}
              max={1}
              step={0.05}
              value={[settings.tts.volume]}
              onValueChange={([volume]) => volume !== undefined && update.mutate({ tts: { volume } })}
            />
          </span>
        </div>
      </section>
    </div>
  );
}
