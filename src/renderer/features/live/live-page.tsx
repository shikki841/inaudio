import { ArrowDown, History, MonitorSpeaker, PictureInPicture2, Square, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { needsDisplayCapture, type LiveSource } from '@shared/domain/capture';
import { wordCount } from '@shared/domain/history';
import { MODEL_CATALOG } from '@shared/domain/models';
import { ActivityStats, CopyButton, LevelWave, RecentItem } from '@renderer/components/ui/activity';
import { Button } from '@renderer/components/ui/button';
import { EmptyState } from '@renderer/components/ui/empty-state';
import { Badge, Kbd, Notice, PageHeader, SectionHeading } from '@renderer/components/ui/layout';
import { Segmented } from '@renderer/components/ui/segmented';
import { Spinner } from '@renderer/components/ui/spinner';
import { ReadAloudButton } from '@renderer/features/read-aloud/read-aloud-controls';
import { api } from '@renderer/lib/api';
import { cn } from '@renderer/lib/cn';
import { formatAccelerator, formatDuration, groupByDay } from '@renderer/lib/format';
import { useHistory, useSettings, useSystemStatus, useUpdateSettings } from '@renderer/lib/queries';
import { useAction } from '@renderer/lib/use-action';
import { useElapsed } from '@renderer/lib/use-elapsed';
import { useUi } from '@renderer/stores/ui-store';
import { ConsentDialog } from './consent-dialog';
import { useLive } from './live-store';
import { SavedSessionsDrawer } from './saved-sessions';

const RECENT = 3;

const SOURCES: { value: LiveSource; label: string }[] = [
  { value: 'system', label: 'System audio' },
  { value: 'system+mic', label: 'System + microphone' },
  { value: 'device', label: 'Audio device' },
];

/** Only the waveform follows the input level, so the page does not re-render with it. */
function LiveWave({ active, busy }: { active: boolean; busy: boolean }) {
  const level = useLive((s) => (active ? s.level : 0));
  return <LevelWave level={level} active={active} busy={busy} />;
}

/**
 * Keeps the end of a growing transcript in view, unless the reader has scrolled up; then
 * `pinned` is false until they jump back or scroll to the end themselves.
 */
function useFollow(text: string, follow: boolean) {
  const box = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(true);
  useEffect(() => {
    const el = box.current;
    if (el && follow && pinned) el.scrollTop = el.scrollHeight;
  }, [text, follow, pinned]);
  const onScroll = () => {
    const el = box.current;
    if (el) setPinned(el.scrollHeight - el.scrollTop - el.clientHeight < 40);
  };
  const jump = () => {
    const el = box.current;
    if (el) el.scrollTop = el.scrollHeight;
    setPinned(true);
  };
  return { box, onScroll, pinned, jump };
}

export function LivePage() {
  const live = useLive((s) => s.live);
  const consent = useLive((s) => s.consent);
  const requestError = useLive((s) => s.error);
  const { start, stop, cancel, dismissConsent } = useLive.getState();
  const { data: settings } = useSettings();
  const { data: status } = useSystemStatus();
  const update = useUpdateSettings();
  const navigate = useUi((s) => s.navigate);
  const [asking, setAsking] = useState(false);
  const [sessions, setSessions] = useState(false);
  const popOut = useAction(() => api.live.openWindow());
  const elapsed = useElapsed(live.phase === 'capturing' ? live.startedAt : 0);
  const { data: history } = useHistory({ kind: 'live', limit: RECENT, offset: 0 });
  const follow = useFollow(live.text + live.preview, live.phase === 'capturing');
  if (!settings || !status) return null;

  const support = status.systemAudio;
  const stt = MODEL_CATALOG[settings.stt.modelId];
  const installed = status.models.find((m) => m.id === stt.id)?.installed ?? false;
  const capturing = live.phase === 'capturing';
  const starting = live.phase === 'starting';
  const finishing = live.phase === 'finishing';
  const active = capturing || starting || finishing;
  const source = active ? live.source : settings.live.source;
  const display = needsDisplayCapture(source);
  // The device source never touches screen capture, so it works where loopback does not.
  const available = !display || support.available;
  // The platform answer, confirmed by the track once a session has run.
  const ownAudioFiltered = live.ownAudioFiltered || support.ownAudioFiltered;
  const keys = settings.live.shortcut ? formatAccelerator(settings.live.shortcut, status.platform) : null;

  const onPress = () => {
    if (capturing) return stop();
    if (active) return;
    if (!settings.live.consentAcknowledged) return setAsking(true);
    void start(source, true);
  };
  const onConfirm = (remember: boolean) => {
    const chosen = consent ?? source;
    setAsking(false);
    if (remember) update.mutate({ live: { consentAcknowledged: true } });
    void start(chosen, true);
  };
  const onCancelConsent = () => {
    setAsking(false);
    dismissConsent();
  };

  const label = capturing
    ? source === 'system+mic'
      ? 'Recording system audio and microphone'
      : source === 'device'
        ? 'Recording the audio device'
        : 'Recording system audio'
    : starting
      ? display && support.mode === 'system-picker'
        ? 'Choose a screen to share its audio…'
        : 'Starting…'
      : finishing
        ? 'Finishing the transcript…'
        : 'Ready';
  const pendingSeconds = Math.ceil(live.pendingMs / 1000);
  const hasText = live.text.length > 0;
  const words = hasText ? wordCount(live.text) : 0;
  const paragraphs = hasText ? live.text.split(/\n{2,}/) : [];
  const interim = active ? live.preview : '';
  const recent = history?.items ?? [];
  const showTranscript = active || hasText || (live.phase !== 'error' && !!live.message);

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Live transcript"
        description="Transcribe audio playing on this computer, like a meeting or a video. Audio is processed here and never saved."
        actions={
          <>
            <Button size="sm" onClick={() => setSessions(true)}>
              <History /> Saved sessions
            </Button>
            <Button size="sm" loading={popOut.pending} onClick={() => void popOut.run()}>
              <PictureInPicture2 /> Pop out
            </Button>
          </>
        }
      />

      {!available && (
        <Notice
          tone="danger"
          action={
            <Button size="sm" onClick={() => update.mutate({ live: { source: 'device' } })}>
              Use an audio device
            </Button>
          }
        >
          {support.reason}
        </Notice>
      )}
      {available && !installed && (
        <Notice action={<Button size="sm" variant="primary" onClick={() => navigate('models')}>Open Models</Button>}>
          {stt.name} is not downloaded yet.
        </Notice>
      )}
      {display && support.available && !ownAudioFiltered && settings.live.pauseReadAloud && !active && (
        <Notice tone="neutral">
          This system can’t keep Inaudio’s own sounds out of the recording, so Read Aloud pauses while you record.
        </Notice>
      )}
      {live.behind && (
        <Notice tone="warning">
          Transcription is {formatDuration(live.pendingMs)} behind. Nothing is lost; it catches up when the audio gets quieter or after you stop.
        </Notice>
      )}
      {(requestError || (live.phase === 'error' && live.message)) && (
        <Notice tone="danger">{requestError ?? live.message}</Notice>
      )}

      <section aria-label="Live transcript" className="grid grid-cols-[auto_1fr] items-center gap-7 border-b border-line pb-6">
        <button
          type="button"
          onClick={onPress}
          disabled={!available || !installed || starting || finishing}
          aria-pressed={capturing}
          aria-busy={starting || finishing || undefined}
          aria-label={capturing ? 'Stop live transcript' : 'Start live transcript'}
          className={cn(
            'relative grid size-24 place-items-center rounded-full outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent disabled:opacity-40',
            capturing ? 'bg-record text-white shadow-[0_0_0_10px_var(--record-soft)]' : 'bg-accent text-on-accent hover:bg-accent-hover',
          )}
        >
          {starting || finishing ? (
            <Spinner className="size-9" />
          ) : capturing ? (
            <Square aria-hidden className="size-8 fill-current" />
          ) : (
            <MonitorSpeaker aria-hidden className="size-10" />
          )}
        </button>
        <div className="grid min-w-0 gap-3">
          <div aria-live="polite" className="flex min-h-8 items-baseline gap-3">
            <span className="truncate text-xl font-semibold">{label}</span>
            {capturing && <span className="font-mono text-sm text-muted tabular-nums">{formatDuration(elapsed)}</span>}
            <span className="flex-1" />
            {(capturing || starting) && (
              <Button variant="ghost" size="sm" onClick={cancel}>
                <X /> Discard
              </Button>
            )}
          </div>
          <LiveWave active={capturing} busy={finishing} />
          <p className="m-0 text-sm text-muted">
            {capturing ? (
              <>
                {settings.live.pauseReadAloud && 'Read Aloud is paused while this runs. '}
                {live.parts === 1 ? '1 part transcribed.' : `${live.parts} parts transcribed.`}
                {settings.audio.speechCleanup && ' Background noise is cleaned up.'}
              </>
            ) : keys ? (
              <span className="inline-flex flex-wrap items-center gap-2">
                Click to start, or press <Kbd keys={keys} /> from any app.
              </span>
            ) : (
              'Click to start. Stop when you are done and the transcript is saved to History.'
            )}
          </p>
          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
            <Segmented<LiveSource>
              label="Audio source"
              value={source}
              disabled={active}
              onValueChange={(next) => update.mutate({ live: { source: next } })}
              options={SOURCES}
            />
            <span className="flex-1" />
            <Badge>{stt.name}</Badge>
          </div>
        </div>
      </section>

      {showTranscript && (
        <section className="grid gap-3">
          <SectionHeading
            action={
              <>
                {active && hasText && (
                  <span className="text-xs text-faint tabular-nums">
                    {words.toLocaleString()} {words === 1 ? 'word' : 'words'}
                    {capturing && ` · ${formatDuration(elapsed)}`}
                  </span>
                )}
                {!active && live.savedId && <Badge>Saved to History · {formatDuration(live.durationMs)}</Badge>}
                {hasText && !active && <ReadAloudButton id={live.savedId ?? 'live-last'} title="Live transcript" text={live.text} />}
                {hasText && <CopyButton text={live.text} />}
              </>
            }
          >
            {active ? 'Transcript' : 'Last transcript'}
          </SectionHeading>
          {!active && live.phase !== 'error' && live.message && <Notice tone="neutral">{live.message}</Notice>}
          {(active || hasText) && (
            <div className="relative">
              <div
                ref={follow.box}
                onScroll={follow.onScroll}
                data-selectable
                tabIndex={0}
                aria-label="Transcript"
                className="app-scroll-area max-h-[28rem] min-h-32 overflow-y-auto rounded-[6px] bg-sunken px-[22px] py-5 text-[17px] leading-[1.75] break-words whitespace-pre-wrap outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {paragraphs.map((paragraph, index) => (
                  <p key={index} className="m-0 mb-3.5 last:mb-0">
                    {paragraph}
                    {index === paragraphs.length - 1 && interim && <Interim text={interim} caret={capturing} spaced />}
                  </p>
                ))}
                {!hasText &&
                  (interim ? (
                    <p className="m-0">
                      <Interim text={interim} caret={capturing} />
                    </p>
                  ) : (
                    capturing && <p className="m-0 text-faint">Listening. Text appears as it is heard.</p>
                  ))}
              </div>
              {active && !follow.pinned && (
                <Button
                  size="sm"
                  onClick={follow.jump}
                  className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-surface shadow-[0_0_0_1px_var(--line),0_6px_16px_rgb(0_0_0/0.08)] hover:bg-surface"
                >
                  <ArrowDown /> Jump to latest
                </Button>
              )}
            </div>
          )}
          {active && pendingSeconds > 0 && (
            <p className="m-0 flex items-center gap-2 text-sm text-faint">
              <Spinner className="size-4" />
              Transcribing the last {pendingSeconds === 1 ? 'second' : `${pendingSeconds} seconds`}…
            </p>
          )}
        </section>
      )}

      {settings.live.saveHistory && (
        <>
          <ActivityStats kind="live" />

          <section className="grid gap-1">
            {recent.length ? (
              groupByDay(recent).map((group, index) => (
                <div key={group.day} className="grid gap-1">
                  <SectionHeading
                    action={
                      index === 0 && (
                        <Button variant="ghost" size="sm" onClick={() => setSessions(true)}>
                          All sessions
                        </Button>
                      )
                    }
                  >
                    {group.day}
                  </SectionHeading>
                  <ul className="m-0 grid list-none gap-1 p-0">
                    {group.items.map((item) => (
                      <RecentItem key={item.id} item={item} clamp />
                    ))}
                  </ul>
                </div>
              ))
            ) : history ? (
              <>
                <SectionHeading>Recent sessions</SectionHeading>
                <EmptyState
                  size="sm"
                  title="No live sessions yet"
                  description="Your transcripts appear here after you stop a session."
                  action={
                    <Button variant="ghost" size="sm" onClick={() => navigate('history')}>
                      Open History
                    </Button>
                  }
                />
              </>
            ) : null}
          </section>
        </>
      )}

      <ConsentDialog open={asking || consent !== null} onCancel={onCancelConsent} onConfirm={onConfirm} />
      <SavedSessionsDrawer open={sessions} onOpenChange={setSessions} />
    </div>
  );
}

/** The stretch still being heard: lighter, swapped whole each time, with a caret while recording. */
function Interim({ text, caret, spaced = false }: { text: string; caret: boolean; spaced?: boolean }) {
  return (
    <span className="text-faint">
      {spaced ? ' ' : ''}
      {text}
      {caret && <span aria-hidden className="live-caret ml-0.5 inline-block h-[1.05em] w-0.5 bg-accent align-[-0.15em]" />}
    </span>
  );
}
