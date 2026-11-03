'use client';

import {
  ArrowDownIcon,
  ArrowRightIcon,
  FoldVerticalIcon,
  InfoIcon,
  UnfoldVerticalIcon,
} from 'lucide-react';
import { Button } from '@/libs/ui/components/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/libs/ui/components/popover';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/libs/ui/components/toggle-group';
import type { Direction } from './layout';

interface CanvasToolbarProps {
  readonly direction: Direction;
  readonly onDirection: (direction: Direction) => void;
  readonly onCollapseAll: () => void;
  readonly onExpandAll: () => void;
  // Whether the workflow has any group to open or close.
  readonly grouped: boolean;
}

const LEGEND = [
  {
    line: 'border-t-2 border-[var(--edge-neutral)]',
    meaning: 'Goes on to the next step',
  },
  {
    line: 'border-t-2 border-[var(--edge-choice)]',
    meaning: 'A path of a choice',
  },
  {
    line: 'border-t-2 border-dashed border-[var(--edge-choice)]',
    meaning: 'Goes to a named step',
  },
  {
    line: 'border-t-2 border-dashed border-[var(--edge-failure)]',
    meaning: 'Taken when a step fails',
  },
  {
    line: 'border-t-2 border-dashed border-[var(--edge-neutral)]',
    meaning: 'Leaves its block or ends the run',
  },
  {
    line: 'border-t-[3px] border-[var(--edge-taken)]',
    meaning: 'The way a run went',
  },
];

// How the viewer arranges the canvas (research R16): its direction, its groups open or closed,
// and what each kind of connection means.
export function CanvasToolbar({
  direction,
  onDirection,
  onCollapseAll,
  onExpandAll,
  grouped,
}: CanvasToolbarProps) {
  return (
    <div className="flex items-center gap-1 rounded-xl border bg-background/95 p-1 shadow-sm backdrop-blur">
      <ToggleGroup
        type="single"
        size="sm"
        value={direction}
        onValueChange={(value) => {
          if (value === 'down' || value === 'right') onDirection(value);
        }}
        aria-label="Direction"
      >
        <ToggleGroupItem
          value="down"
          aria-label="Top to bottom"
          title="Top to bottom"
        >
          <ArrowDownIcon />
        </ToggleGroupItem>
        <ToggleGroupItem
          value="right"
          aria-label="Left to right"
          title="Left to right"
        >
          <ArrowRightIcon />
        </ToggleGroupItem>
      </ToggleGroup>
      {grouped && (
        <>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Close every block"
            title="Close every block"
            onClick={onCollapseAll}
          >
            <FoldVerticalIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Open every block"
            title="Open every block"
            onClick={onExpandAll}
          >
            <UnfoldVerticalIcon />
          </Button>
        </>
      )}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="What the connections mean"
            title="What the connections mean"
          >
            <InfoIcon />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72">
          <p className="mb-2 text-sm font-medium">What the connections mean</p>
          <ul className="flex flex-col gap-2 text-sm">
            {LEGEND.map((item) => (
              <li key={item.meaning} className="flex items-center gap-3">
                <span className={`w-8 shrink-0 ${item.line}`} aria-hidden />
                {item.meaning}
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
    </div>
  );
}
