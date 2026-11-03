'use client';

import { useState } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/libs/ui/components/popover';
import { type KindInfo, KINDS } from '../../__shared_context/document/kinds';
import type { TaskKind } from '../../__shared_context/document/tasks';
import { TaskIcon } from '../../__shared_context/outline/task-icon';

const GROUPS: readonly KindInfo['group'][] = ['Work', 'Events', 'Flow'];

const GROUP_LABEL: Record<KindInfo['group'], string> = {
  Work: 'Do something',
  Events: 'Talk to other applications',
  Flow: 'Shape the flow',
};

interface AddTaskMenuProps {
  readonly onPick: (kind: TaskKind) => void;
  readonly children: React.ReactNode;
}

// The palette of steps the platform runs, in plain words, grouped by what they are for.
export function AddTaskMenu({ onPick, children }: AddTaskMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(36rem,calc(100vw-2rem))] p-2"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {GROUPS.map((group) => (
            <div key={group} className="flex flex-col gap-0.5">
              <div className="px-2 pt-1 pb-1 text-xs font-medium text-muted-foreground">
                {GROUP_LABEL[group]}
              </div>
              {KINDS.filter((info) => info.group === group).map((info) => (
                <button
                  key={info.kind}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onPick(info.kind);
                  }}
                  className="flex items-start gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                >
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border bg-background">
                    <TaskIcon kind={info.kind} className="size-3.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">
                      {info.label}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {info.description}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
