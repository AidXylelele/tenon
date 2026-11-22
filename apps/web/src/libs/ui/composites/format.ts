const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

const STEPS: readonly (readonly [Intl.RelativeTimeFormatUnit, number])[] = [
  ["second", 60],
  ["minute", 60],
  ["hour", 24],
  ["day", 30],
  ["month", 12],
  ["year", Number.POSITIVE_INFINITY],
];

export function relativeText(at: number, now: number): string {
  let amount = (at - now) / 1000;

  if (Math.abs(amount) < 5) return "just now";

  for (const [unit, size] of STEPS) {
    if (Math.abs(amount) < size)
      return relative.format(Math.round(amount), unit);

    amount /= size;
  }

  return relative.format(Math.round(amount), "year");
}

export function utcText(iso: string): string {
  const minute = iso.slice(0, 16).replace("T", " ");
  return `${minute} UTC`;
}

export function durationText(milliseconds: number): string {
  const ms = Math.max(0, milliseconds);
  const wholeMs = Math.round(ms);

  if (ms < 1000) return `${String(wholeMs)} ms`;

  const seconds = ms / 1000;

  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)} s`;

  const minutes = Math.floor(seconds / 60);
  const restSeconds = Math.round(seconds % 60);

  if (minutes < 60) return `${String(minutes)} min ${String(restSeconds)} s`;

  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;

  if (hours < 24) return `${String(hours)} h ${String(restMinutes)} min`;

  const days = Math.floor(hours / 24);
  const restHours = hours % 24;

  return `${String(days)} d ${String(restHours)} h`;
}
