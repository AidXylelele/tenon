'use client';

import { cn } from 'cn';
import { XIcon } from 'lucide-react';
import { Button } from '@/libs/ui/components/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/libs/ui/components/command';
import {
  type KindInfo,
  KINDS,
  type TaskKind,
} from '@/operations/workflow-document';
import { tileOf } from '../../__shared_context/outline/families';
import { TaskIcon } from '../../__shared_context/outline/task-icon';

const GROUPS: readonly KindInfo['group'][] = ['Work', 'Events', 'Flow'];

const GROUP_LABEL: Record<KindInfo['group'], string> = {
  Work: 'Do something',
  Events: 'Talk to other applications',
  Flow: 'Shape the flow',
};

interface NodeCreatorProps {
  readonly onPick: (kind: TaskKind) => void;
  readonly onClose: () => void;
}

// "What happens next?": every step the platform runs, searchable, in plain words.
export function NodeCreator({ onPick, onClose }: NodeCreatorProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div>
          <div className="text-sm font-semibold">What happens next?</div>
          <div className="text-xs text-muted-foreground">
            Pick a step; you set it up right after.
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close"
          onClick={onClose}
        >
          <XIcon />
        </Button>
      </div>
      <Command className="flex-1 rounded-none bg-transparent">
        <CommandInput
          placeholder="Search steps: call, wait, event…"
          autoFocus
        />
        <CommandList className="max-h-none flex-1">
          <CommandEmpty>No step matches.</CommandEmpty>
          {GROUPS.map((group) => (
            <CommandGroup key={group} heading={GROUP_LABEL[group]}>
              {KINDS.filter((info) => info.group === group).map((info) => (
                <CommandItem
                  key={info.kind}
                  value={`${info.label} ${info.description}`}
                  onSelect={() => onPick(info.kind)}
                  className="gap-3 py-2"
                >
                  <span
                    className={cn(
                      'flex size-9 shrink-0 items-center justify-center rounded-xl ring-1',
                      tileOf(info.kind),
                    )}
                  >
                    <TaskIcon kind={info.kind} className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">
                      {info.label}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {info.description}
                    </span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </Command>
    </div>
  );
}
