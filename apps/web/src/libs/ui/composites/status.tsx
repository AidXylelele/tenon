import { cn } from 'cn';

// The colours of a state. Colour carries state only: blue is busy, amber waits, violet is held,
// green is done, red failed, grey idle or ended otherwise (research R8).
export type Tone =
  'idle' | 'busy' | 'waiting' | 'held' | 'done' | 'failed' | 'ended';

const TONE: Record<Tone, { readonly dot: string; readonly text: string }> = {
  idle: {
    dot: 'bg-muted-foreground/50',
    text: 'text-muted-foreground',
  },
  busy: {
    dot: 'bg-sky-500',
    text: 'text-sky-700 dark:text-sky-300',
  },
  waiting: {
    dot: 'bg-amber-500',
    text: 'text-amber-700 dark:text-amber-300',
  },
  held: {
    dot: 'bg-violet-500',
    text: 'text-violet-700 dark:text-violet-300',
  },
  done: {
    dot: 'bg-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-400',
  },
  failed: {
    dot: 'bg-red-500',
    text: 'text-red-700 dark:text-red-400',
  },
  ended: {
    dot: 'bg-zinc-400',
    text: 'text-muted-foreground',
  },
};

// The classes of a tone: the dot's background and the word's colour.
export function toneClasses(tone: Tone) {
  return TONE[tone];
}

interface StatusProps {
  readonly tone: Tone;
  readonly label: string;
  // Whether the state is changing as it is shown: its dot pulses.
  readonly live?: boolean;
  readonly className?: string;
}

// A state as a coloured dot and its word.
export function Status({ tone, label, live = false, className }: StatusProps) {
  const classes = TONE[tone];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-sm font-medium',
        classes.text,
        className,
      )}
    >
      <span className="relative flex size-2" aria-hidden>
        {live && (
          <span
            className={cn(
              'absolute inline-flex size-full animate-ping rounded-full opacity-60',
              classes.dot,
            )}
          />
        )}
        <span
          className={cn(
            'relative inline-flex size-2 rounded-full',
            classes.dot,
          )}
        />
      </span>
      {label}
    </span>
  );
}
