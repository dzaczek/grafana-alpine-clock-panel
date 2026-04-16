import moment from 'moment-timezone';

export interface TimezoneOption {
  value: string;
  label: string;
}

export const TIMEZONE_OPTIONS: TimezoneOption[] = [
  { value: '', label: 'Browser Local' },
  { value: 'UTC', label: 'UTC' },
  ...moment.tz.names().map((t) => ({ value: t, label: t })),
];

/**
 * Get current wall-clock time (h/m/s/ms) for a given IANA timezone.
 * Empty string = browser local.
 */
export function getTimeInZone(tz: string, date: Date = new Date()) {
  const m = tz ? moment.tz(date, tz) : moment(date);
  return {
    hour: m.hour(),
    minute: m.minute(),
    second: m.second(),
    ms: m.millisecond(),
  };
}
