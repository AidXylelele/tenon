import { cn } from 'cn';
import { type Tone, toneClasses } from '../vocabulary';

// The run line: tasks as stations on one vertical line, in the order they run. A segment takes
// the colour of the station above it, so a run fills the line as it goes.

export function RunLine({
  children,
  className,
}: {
  readonly children: React.ReactNode;
  readonly className?: string;
}) {
  return (
    <ol className={cn('relative flex flex-col', className)}>{children}</ol>
  );
}

interface StationProps {
  readonly tone: Tone;
  readonly marker?: React.ReactNode;
  // The station is the current one: its marker pulses.
  readonly live?: boolean;
  readonly last?: boolean;
  readonly selected?: boolean;
  readonly flagged?: boolean;
  readonly children: React.ReactNode;
  readonly className?: string;
}

export function Station({
  tone,
  marker,
  live = false,
  last = false,
  selected = false,
  flagged = false,
  children,
  className,
}: StationProps) {
  const classes = toneClasses(tone);

  return (
    <li
      className={cn(
        'relative grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-2',
        className,
      )}
    >
      {!last && (
        <span
          aria-hidden
          className={cn(
            'absolute top-7 bottom-0 left-[0.8125rem] w-0.5 rounded-full',
            classes.line,
            tone === 'idle' && 'opacity-60',
          )}
        />
      )}
      <span
        className="relative flex h-7 items-start justify-center pt-1.5"
        aria-hidden
      >
        {live && (
          <span
            className={cn(
              'absolute top-1.5 size-4 animate-ping rounded-full opacity-50',
              classes.dot,
            )}
          />
        )}
        <span
          className={cn(
            'relative flex size-4 items-center justify-center rounded-full ring-4 ring-background',
            classes.dot,
            flagged && 'ring-red-500/30',
            selected && 'ring-sky-500/30',
          )}
        >
          {marker}
        </span>
      </span>
      <div className="min-w-0 pb-4">{children}</div>
    </li>
  );
}
