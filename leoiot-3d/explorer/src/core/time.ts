// Time of a reading in the school's local time (FSD: school-local timezone).

export const SCHOOL_TIME_ZONE = 'Europe/Vienna';

function day(ms: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: SCHOOL_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ms);
}

/** "13:05:22", or "2026-10-29 13:05:22" when the reading is not from today (school time). */
export function readingTime(ts: number, now: number): string {
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: SCHOOL_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(ts);
  const d = day(ts);
  return d === day(now) ? time : `${d} ${time}`;
}
