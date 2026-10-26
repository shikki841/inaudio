import { ArrowDownRight, ArrowUpRight, Copy, Minus } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { transcriptTitle, wordCount, type Transcript } from '@shared/domain/history';
import { ACTIVITY_WEEKS, addDays, type Activity, type ActivityKind, type ActivityRange } from '@shared/history/stats';
import { Button } from '@renderer/components/ui/button';
import { EmptyState } from '@renderer/components/ui/empty-state';
import { IconButton } from '@renderer/components/ui/icon-button';
import { Notice, SectionHeading } from '@renderer/components/ui/layout';
import { Segmented } from '@renderer/components/ui/segmented';
import { Tooltip } from '@renderer/components/ui/tooltip';
import { ReadAloudButton, useReadingState } from '@renderer/features/read-aloud/read-aloud-controls';
import { api } from '@renderer/lib/api';
import { cn } from '@renderer/lib/cn';
import { formatDuration, formatSpan, formatTime } from '@renderer/lib/format';
import { useHistoryStats } from '@renderer/lib/queries';
import { useAction } from '@renderer/lib/use-action';

const WAVE_BARS = 64;

/**
 * The last few seconds of input as a wide, scrolling waveform: still and faint while idle,
 * frozen and dimmed while busy. The caller passes the level from a component that alone
 * subscribes to it, since it changes many times a second.
 */
export function LevelWave({ level, active, busy = false }: { level: number; active: boolean; busy?: boolean }) {
  const latest = useRef(level);
  latest.current = level;
  const [history, setHistory] = useState<number[]>(() => Array(WAVE_BARS).fill(0));

  useEffect(() => {
    if (!active) {
      if (!busy) setHistory(Array(WAVE_BARS).fill(0));
      return;
    }
    const id = setInterval(() => setHistory((h) => [...h.slice(1), latest.current]), 60);
    return () => clearInterval(id);
  }, [active, busy]);

  return (
    <div aria-hidden className="flex h-[72px] w-full items-center justify-between gap-[2px] rounded-[6px] bg-sunken px-4">
      {history.map((value, index) => (
        <span
          key={index}
          className={cn('w-1 shrink-0 rounded-full transition-[height] duration-75', active ? 'bg-accent' : busy ? 'bg-accent/40' : 'bg-line-strong')}
          style={{ height: `${Math.max(4, Math.min(52, Math.sqrt(value) * 66))}px` }}
        />
      ))}
    </div>
  );
}

/** Copies a transcript: a spinner while main writes the clipboard, a toast when it is done or fails. */
export function CopyButton({ text, label = 'Copy transcript' }: { text: string; label?: string }) {
  const copy = useAction(() => api.text.copy(text), { success: 'Copied to the clipboard' });
  return (
    <IconButton label={label} size="icon-sm" loading={copy.pending} disabled={!text} onClick={() => void copy.run()}>
      <Copy />
    </IconButton>
  );
}

const RANGES: { value: `${ActivityRange}`; label: string }[] = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
];
const narrowDay = new Intl.DateTimeFormat(undefined, { weekday: 'narrow' });
const shortDate = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });
const longDate = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const plural = (count: number, one: string, many: string) => `${count.toLocaleString()} ${count === 1 ? one : many}`;

/** One number in the strip: label, value with its unit, and a quiet line under it. */
function Metric({ label, value, unit, note }: { label: string; value: string; unit?: string; note?: ReactNode }) {
  return (
    <div className="grid min-w-0 content-start gap-1 px-5 first:pl-0">
      <span className="text-xs text-muted">{label}</span>
      <span className="truncate text-[28px] leading-tight font-semibold tracking-tight tabular-nums">
        {value}
        {unit && <span className="ml-1.5 text-[13px] font-medium tracking-normal text-muted">{unit}</span>}
      </span>
      <span className="flex min-h-[18px] items-center gap-1 text-xs text-muted">{note}</span>
    </div>
  );
}

/** How a figure compares with the period before. The words carry the direction; the arrow repeats it. */
function Change({ now, before, days }: { now: number; before: number; days: number }) {
  if (!now && !before) return null;
  if (!before) return <span>Nothing in the previous {days} days</span>;
  const percent = Math.round(((now - before) / before) * 100);
  if (percent === 0) {
    return (
      <>
        <Minus aria-hidden className="size-3.5 shrink-0" />
        <span>Same as the previous {days} days</span>
      </>
    );
  }
  const Arrow = percent > 0 ? ArrowUpRight : ArrowDownRight;
  const amount = `${Math.abs(percent).toLocaleString()}% ${percent > 0 ? 'more' : 'less'}`;
  return (
    <span title={`${amount} than the previous ${days} days`} className="flex min-w-0 items-center gap-1">
      <Arrow aria-hidden className={cn('size-3.5 shrink-0', percent > 0 ? 'text-success' : 'text-danger')} />
      <span className="shrink-0 text-ink">{amount}</span>
      <span className="truncate">than the previous {days} days</span>
    </span>
  );
}

/** Words per day across the range, today in the accent colour, with a table for screen readers. */
function DailyBars({ daily, today }: { daily: number[]; today: number }) {
  const max = Math.max(1, ...daily);
  const count = daily.length;
  const dates = daily.map((_, index) => addDays(today, index - (count - 1)));
  const label = (index: number) => {
    if (index === count - 1) return 'Today';
    if (count <= 7) return narrowDay.format(dates[index]);
    return (count - 1 - index) % 5 === 0 ? shortDate.format(dates[index]) : '';
  };
  const columns = { gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` };
  return (
    <div className="grid min-w-0 gap-2">
      <div aria-hidden className="grid h-[104px] items-end border-b border-line" style={columns}>
        {daily.map((words, index) => (
          <Tooltip key={dates[index]} content={`${longDate.format(dates[index])} · ${plural(words, 'word', 'words')}`}>
            <span className="group flex h-full items-end justify-center">
              <span
                className={cn(
                  'block min-h-[2px] max-w-7 rounded-t-[2px] transition-colors',
                  count <= 7 ? 'w-[55%]' : 'w-[70%]',
                  index === count - 1 ? 'bg-accent' : 'bg-line-strong group-hover:bg-muted',
                )}
                style={{ height: words ? `${Math.max(4, (words / max) * 100)}%` : 0 }}
              />
            </span>
          </Tooltip>
        ))}
      </div>
      <div aria-hidden className="grid text-[11px] text-faint" style={columns}>
        {daily.map((_, index) => (
          <span key={dates[index]} className="text-center whitespace-nowrap">
            {label(index)}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>Words per day</caption>
        <tbody>
          {daily.map((words, index) => (
            <tr key={dates[index]}>
              <th scope="row">{index === count - 1 ? 'Today' : longDate.format(dates[index])}</th>
              <td>{plural(words, 'word', 'words')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const HEAT = ['bg-sunken shadow-[inset_0_0_0_1px_var(--line)]', 'bg-accent-soft', 'bg-accent/45', 'bg-accent/70', 'bg-accent'];

/** Twelve weeks of words, Monday to Sunday down each column, ending with this week. */
function Heatmap({ activity }: { activity: Activity }) {
  const { heatmap, heatmapStart, today, streak } = activity;
  const max = Math.max(1, ...heatmap);
  const level = (words: number) => (words ? Math.min(4, Math.ceil((words / max) * 4)) : 0);
  const summary = `Words per day for the last ${ACTIVITY_WEEKS} weeks. Current streak ${plural(streak.current, 'day', 'days')}, longest ${plural(streak.longest, 'day', 'days')}.`;
  return (
    <div className="grid shrink-0 gap-2">
      <div role="img" aria-label={summary} className="grid grid-flow-col grid-rows-[repeat(7,10px)] auto-cols-[10px] gap-[3px]">
        {heatmap.map((words, index) => {
          const day = addDays(heatmapStart, index);
          if (day > today) return <i key={day} aria-hidden className="invisible" />;
          return (
            <Tooltip key={day} content={`${longDate.format(day)} · ${plural(words, 'word', 'words')}`}>
              <i aria-hidden className={cn('block rounded-[2px]', HEAT[level(words)])} />
            </Tooltip>
          );
        })}
      </div>
      <div aria-hidden className="flex items-center justify-between gap-4 text-[11px] text-faint">
        <span>{ACTIVITY_WEEKS} weeks</span>
        <span className="inline-flex items-center gap-[3px]">
          Less
          {HEAT.map((tone) => (
            <i key={tone} className={cn('inline-block size-2.5 rounded-[2px]', tone)} />
          ))}
          More
        </span>
      </div>
    </div>
  );
}

function ActivitySkeleton() {
  return (
    <div aria-hidden className="grid gap-5">
      <div className="grid grid-cols-4 divide-x divide-line">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="grid gap-2.5 px-5 first:pl-0">
            <span className="skeleton h-3 w-16 rounded-[6px]" />
            <span className="skeleton h-7 w-24 rounded-[6px]" />
            <span className="skeleton h-3 w-32 rounded-[6px]" />
          </div>
        ))}
      </div>
      <span className="skeleton h-[128px] rounded-[6px]" />
    </div>
  );
}

const KIND_COPY: Record<ActivityKind, { takes: string; empty: (days: number) => { title: string; description: string } }> = {
  dictation: {
    takes: 'Dictations',
    empty: (days) => ({ title: `No dictations in the last ${days} days`, description: 'Dictate in any app and each take is counted here.' }),
  },
  live: {
    takes: 'Sessions',
    empty: (days) => ({ title: `No live sessions in the last ${days} days`, description: 'Stop a live transcript and its words are counted here.' }),
  },
};

/**
 * The page's activity, counted in the main process from saved transcripts: four figures with
 * their change from the period before, words per day, and twelve weeks of streaks.
 */
export function ActivityStats({ kind }: { kind: ActivityKind }) {
  const [days, setDays] = useState<ActivityRange>(7);
  const { data, isError, refetch, isFetching } = useHistoryStats(kind, days);
  const heading = useId();
  const copy = KIND_COPY[kind];
  const span = data?.ms ? formatSpan(data.ms) : undefined;

  return (
    <section aria-labelledby={heading} aria-busy={isFetching || undefined} className="grid gap-5">
      <SectionHeading
        id={heading}
        action={<Segmented<`${ActivityRange}`> label="Activity range" value={`${days}`} onValueChange={(next) => setDays(Number(next) as ActivityRange)} options={RANGES} />}
      >
        Activity
      </SectionHeading>
      {isError && !data ? (
        <Notice tone="danger" action={<Button size="sm" loading={isFetching} onClick={() => void refetch()}>Try again</Button>}>
          Activity could not be counted.
        </Notice>
      ) : !data ? (
        <ActivitySkeleton />
      ) : (
        <>
          <div className="grid grid-cols-4 divide-x divide-line">
            <Metric label="Words" value={data.words.toLocaleString()} note={<Change now={data.words} before={data.previous.words} days={days} />} />
            <Metric label={copy.takes} value={data.takes.toLocaleString()} note={<Change now={data.takes} before={data.previous.takes} days={days} />} />
            {kind === 'dictation' ? (
              <Metric
                label="Pace"
                value={data.pace ? data.pace.toLocaleString() : '–'}
                unit={data.pace ? 'words a minute' : undefined}
                note={data.pace && data.previous.pace ? <Change now={data.pace} before={data.previous.pace} days={days} /> : null}
              />
            ) : (
              <Metric label="Time transcribed" value={span?.value ?? '–'} unit={span?.unit} note={<Change now={data.ms} before={data.previous.ms} days={days} />} />
            )}
            <Metric
              label="Streak"
              value={data.streak.current.toLocaleString()}
              unit={data.streak.current === 1 ? 'day' : 'days'}
              note={data.streak.longest ? `Longest ${plural(data.streak.longest, 'day', 'days')}` : null}
            />
          </div>
          {data.takes ? (
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-12 pt-3">
              <DailyBars daily={data.daily} today={data.today} />
              <Heatmap activity={data} />
            </div>
          ) : (
            <EmptyState size="sm" {...copy.empty(days)} />
          )}
        </>
      )}
    </section>
  );
}

/**
 * One recent transcript: its words, when, and Read aloud and Copy within reach. `fresh` marks
 * the one just made; `clamp` shortens long text to a few lines.
 */
export function RecentItem({
  item,
  fresh = false,
  detail,
  clamp = false,
  onOpen,
}: {
  item: Transcript;
  fresh?: boolean;
  /** Extra words for the details line, such as the time taken on device. */
  detail?: string;
  clamp?: boolean;
  onOpen?(): void;
}) {
  const reading = useReadingState(item.id);
  const words = wordCount(item.text);
  const body = (
    <>
      {clamp && item.title && <span className="block truncate text-[15px] font-semibold">{item.title}</span>}
      <span data-selectable className={cn('block text-[15px] leading-relaxed whitespace-pre-wrap break-words', clamp && 'line-clamp-2')}>
        {item.text}
      </span>
      <span className="block pt-1 text-xs text-faint tabular-nums">
        {fresh ? 'Just now' : formatTime(item.createdAt)} · {formatDuration(item.durationMs)} · {plural(words, 'word', 'words')}
        {detail ? ` · ${detail}` : ''}
      </span>
    </>
  );
  return (
    <li
      className={cn(
        'group flex items-start gap-3 rounded-[6px] px-3.5 py-3 transition-colors hover:bg-sunken',
        (fresh || reading !== 'idle') && 'bg-accent-soft hover:bg-accent-soft',
      )}
    >
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 flex-1 rounded-[6px] text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
          {body}
        </button>
      ) : (
        <div className="min-w-0 flex-1">{body}</div>
      )}
      <span
        className={cn(
          'flex shrink-0 items-center gap-1',
          !fresh && reading === 'idle' && 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 has-[[aria-busy]]:opacity-100',
        )}
      >
        <ReadAloudButton id={item.id} title={transcriptTitle(item)} text={item.text} />
        <CopyButton text={item.text} />
      </span>
    </li>
  );
}
