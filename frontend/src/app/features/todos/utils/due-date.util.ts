import { Todo } from '@api';

export type DueStatus = 'overdue' | 'today' | 'upcoming';

export const DUE_TIME_PRESETS: readonly {
  key: 'MORNING' | 'AFTERNOON' | 'EVENING';
  time: string;
}[] = [
  { key: 'MORNING', time: '09:00' },
  { key: 'AFTERNOON', time: '14:00' },
  { key: 'EVENING', time: '19:00' },
];

export interface ReminderOption {
  /** Minutes before the due moment; `null` = no reminder. */
  value: number | null;
  /** Key under `TODOS.FORM`. */
  key: string;
}

/** For a task with a time. */
export const REMINDER_OPTIONS_TIMED: readonly ReminderOption[] = [
  { value: null, key: 'REMINDER_NONE' },
  { value: 0, key: 'REMINDER_AT_TIME' },
  { value: 15, key: 'REMINDER_15' },
  { value: 60, key: 'REMINDER_60' },
  { value: 1440, key: 'REMINDER_DAY_BEFORE' },
];

/** For a date-only task: the server sends them at 9:00. */
export const REMINDER_OPTIONS_DATE_ONLY: readonly ReminderOption[] = [
  { value: null, key: 'REMINDER_NONE' },
  { value: 0, key: 'REMINDER_DAY_OF_9' },
  { value: 1440, key: 'REMINDER_DAY_BEFORE_9' },
];

/** The i18n key (under `TODOS.FORM`) naming a stored offset, or null if unknown. */
export function reminderKey(offset: number, hasTime: boolean): string | null {
  const options = hasTime ? REMINDER_OPTIONS_TIMED : REMINDER_OPTIONS_DATE_ONLY;
  return options.find((o) => o.value === offset)?.key ?? null;
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** Local `YYYY-MM-DD` (never via toISOString, which shifts the day for UTC+ users). */
export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local midnight of a `YYYY-MM-DD` string (never `new Date(iso)`, which parses as UTC). */
export function fromIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Local `HH:MM`. */
export function toTimeString(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Today at the given `HH:MM` or `HH:MM:SS`. */
export function fromTimeString(t: string): Date {
  const [h, m] = t.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

export function addDays(iso: string, n: number): string {
  const d = fromIsoDate(iso);
  d.setDate(d.getDate() + n);
  return toIsoDate(d);
}

/** Whole calendar days from `now`'s date to `iso` (local midnight to midnight, DST-safe). */
function dayDiff(iso: string, now: Date): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round(
    (fromIsoDate(iso).getTime() - today.getTime()) / 86_400_000,
  );
}

export function dueStatus(
  todo: Pick<Todo, 'dueDate' | 'dueTime' | 'completed'>,
  now: Date,
): DueStatus | null {
  if (!todo.dueDate) {
    return null;
  }
  if (todo.completed) {
    return 'upcoming';
  }
  const diff = dayDiff(todo.dueDate, now);
  if (diff < 0) {
    return 'overdue';
  }
  if (diff === 0) {
    return todo.dueTime && todo.dueTime.slice(0, 5) < toTimeString(now)
      ? 'overdue'
      : 'today';
  }
  return 'upcoming';
}

function formatTime(dueTime: string, lang: string): string {
  return new Intl.DateTimeFormat(lang, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(fromTimeString(dueTime));
}

export function formatDueLabel(
  dueDate: string,
  dueTime: string | null | undefined,
  now: Date,
  lang: string,
  words: { today: string; tomorrow: string; yesterday: string },
): string {
  const diff = dayDiff(dueDate, now);
  const date = fromIsoDate(dueDate);
  let label: string;
  if (diff === 0) {
    label = words.today;
  } else if (diff === 1) {
    label = words.tomorrow;
  } else if (diff === -1) {
    label = words.yesterday;
  } else if (diff >= 2 && diff <= 6) {
    label = new Intl.DateTimeFormat(lang, { weekday: 'short' }).format(date);
  } else {
    label = new Intl.DateTimeFormat(lang, {
      day: 'numeric',
      month: 'short',
      ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
    }).format(date);
  }
  return dueTime ? `${label}, ${formatTime(dueTime, lang)}` : label;
}

/** Weekday, day, month, year and time, for the tooltip. */
export function formatDueFull(
  dueDate: string,
  dueTime: string | null | undefined,
  lang: string,
): string {
  const date = new Intl.DateTimeFormat(lang, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(fromIsoDate(dueDate));
  return dueTime ? `${date}, ${formatTime(dueTime, lang)}` : date;
}
