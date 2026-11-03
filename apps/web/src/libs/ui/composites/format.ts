const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

const STEPS: ReadonlyArray<readonly [Intl.RelativeTimeFormatUnit, number]> = [
  ['second', 60],
  ['minute', 60],
  ['hour', 24],
  ['day', 30],
  ['month', 12],
  ['year', Number.POSITIVE_INFINITY],
];

// "just now", "3 minutes ago", "in 2 hours".
export function relativeText(at: number, now: number): string {
  let amount = (at - now) / 1000;

  if (Math.abs(amount) < 5) return 'just now';

  for (const [unit, size] of STEPS) {
    if (Math.abs(amount) < size)
      return relative.format(Math.round(amount), unit);

    amount /= size;
  }

  return relative.format(Math.round(amount), 'year');
}

// "850 ms", "4.2 s", "3 min 5 s", "2 h 10 min".
export function durationText(milliseconds: number): string {
  const ms = Math.max(0, milliseconds);

  if (ms < 1000) return `${Math.round(ms)} ms`;

  const seconds = ms / 1000;

  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)} s`;

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) return `${minutes} min ${Math.round(seconds % 60)} s`;

  const hours = Math.floor(minutes / 60);

  if (hours < 24) return `${hours} h ${minutes % 60} min`;

  return `${Math.floor(hours / 24)} d ${hours % 24} h`;
}
