import assert from 'node:assert/strict';
import test from 'node:test';
import { activityOf, activitySince, addDays, heatmapStartOf, startOfDay, ACTIVITY_WEEKS } from '../src/shared/history/stats.ts';

// Tuesday 14 October 2026, 15:00 local time.
const NOW = new Date(2026, 9, 14, 15, 0).getTime();
const at = (daysAgo, hour = 10, minute = 0) => {
  const date = new Date(NOW);
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, minute, 0, 0);
  return date.getTime();
};
const row = (daysAgo, words, durationMs = 10_000, hour = 10) => ({ text: Array(words).fill('word').join(' '), durationMs, createdAt: at(daysAgo, hour) });
const timesOf = (rows) => rows.map((item) => item.createdAt);

test('words land on their local day, today last', () => {
  const rows = [row(0, 5), row(0, 3, 10_000, 0), row(1, 7, 10_000, 23), row(6, 2)];
  const result = activityOf(rows, timesOf(rows), { now: NOW, days: 7 });
  assert.deepEqual(result.daily, [2, 0, 0, 0, 0, 7, 8]);
  assert.equal(result.words, 17);
  assert.equal(result.takes, 4);
  assert.equal(result.today, startOfDay(NOW));
});

test('a take just after midnight counts for the new day, one just before for the old', () => {
  const rows = [{ text: 'late night', durationMs: 1_000, createdAt: at(1, 23, 59) }, { text: 'early', durationMs: 1_000, createdAt: at(0, 0, 1) }];
  const result = activityOf(rows, timesOf(rows), { now: NOW, days: 7 });
  assert.deepEqual(result.daily.slice(-2), [2, 1]);
});

test('the previous period is the same length right before the range', () => {
  const rows = [row(0, 10), row(6, 4), row(7, 6), row(13, 1), row(14, 100)];
  const week = activityOf(rows, timesOf(rows), { now: NOW, days: 7 });
  assert.equal(week.words, 14);
  assert.deepEqual({ words: week.previous.words, takes: week.previous.takes }, { words: 7, takes: 2 });
  const month = activityOf(rows, timesOf(rows), { now: NOW, days: 30 });
  assert.equal(month.daily.length, 30);
  assert.equal(month.words, 121);
  assert.equal(month.previous.takes, 0);
});

test('pace needs more than five seconds of audio', () => {
  const short = [row(0, 20, 4_000)];
  assert.equal(activityOf(short, timesOf(short), { now: NOW, days: 7 }).pace, 0);
  const long = [row(0, 150, 60_000)];
  assert.equal(activityOf(long, timesOf(long), { now: NOW, days: 7 }).pace, 150);
});

test('the current streak survives a quiet today and breaks after a whole quiet day', () => {
  const days = (list) => list.map((daysAgo) => at(daysAgo));
  assert.equal(activityOf([], days([0, 1, 2]), { now: NOW, days: 7 }).streak.current, 3);
  assert.equal(activityOf([], days([1, 2, 3, 4]), { now: NOW, days: 7 }).streak.current, 4);
  assert.equal(activityOf([], days([2, 3]), { now: NOW, days: 7 }).streak.current, 0);
});

test('the longest streak looks at every day, not only the range', () => {
  const times = [40, 41, 42, 43, 44, 45, 0, 1].map((daysAgo) => at(daysAgo));
  times.push(at(41, 18));
  const { streak } = activityOf([], times, { now: NOW, days: 7 });
  assert.deepEqual(streak, { current: 2, longest: 6 });
});

test('the heatmap starts on a Monday and ends with the current week', () => {
  const start = heatmapStartOf(NOW);
  assert.equal(new Date(start).getDay(), 1);
  assert.equal(addDays(start, ACTIVITY_WEEKS * 7 - 1) >= startOfDay(NOW), true);
  const rows = [row(0, 4)];
  const { heatmap, heatmapStart } = activityOf(rows, timesOf(rows), { now: NOW, days: 7 });
  assert.equal(heatmap.length, ACTIVITY_WEEKS * 7);
  assert.equal(heatmap[Math.round((startOfDay(NOW) - heatmapStart) / 86_400_000)], 4);
});

test('the query window covers both the previous period and the heatmap', () => {
  assert.equal(activitySince(NOW, 7), heatmapStartOf(NOW));
  assert.ok(activitySince(NOW, 30) <= addDays(startOfDay(NOW), -59));
});

test('nothing saved yet gives zeros, not NaN', () => {
  const result = activityOf([], [], { now: NOW, days: 30 });
  assert.equal(result.words, 0);
  assert.equal(result.pace, 0);
  assert.deepEqual(result.streak, { current: 0, longest: 0 });
  assert.ok(result.daily.every((value) => value === 0));
});

test('a transcript dated in the future is ignored', () => {
  const rows = [{ text: 'from tomorrow', durationMs: 1_000, createdAt: at(-1) }];
  const result = activityOf(rows, timesOf(rows), { now: NOW, days: 7 });
  assert.equal(result.takes, 0);
  assert.equal(result.streak.longest, 0);
});
