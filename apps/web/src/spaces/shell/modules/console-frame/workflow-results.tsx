'use client';

import { WaypointsIcon } from 'lucide-react';
import { useState, useTransition } from 'react';
import { CommandGroup, CommandItem } from '@/libs/ui/components/command';
import { Spinner } from '@/libs/ui/components/spinner';
import { workflowHref } from '@/operations/app-routes';
import { type FoundWorkflow, searchableWorkflowsAction } from './actions';

// The workflows a search offers, kept between its openings so the list shows at once while
// it is read again.
interface WorkflowSearch {
  readonly found: readonly FoundWorkflow[] | null;
  readonly reading: boolean;
  // Reads the active workflows; the search calls it each time it opens.
  readonly read: () => void;
}

interface WorkflowResultsProps {
  readonly search: WorkflowSearch;
  // Closes the search and opens the workflow's page.
  readonly onGo: (href: string) => void;
}

// The search's source of workflows: nothing is read before the search first opens.
export function useWorkflowSearch(): WorkflowSearch {
  const [found, setFound] = useState<readonly FoundWorkflow[] | null>(null);
  const [reading, startReading] = useTransition();

  function read() {
    startReading(async () => {
      const active = await searchableWorkflowsAction();
      setFound(active);
    });
  }

  return { found, reading, read };
}

// The workflows in the search, each opening its page, and whether it is on; until the first
// answer, a line says they are being read.
export function WorkflowResults({ search, onGo }: WorkflowResultsProps) {
  return (
    <CommandGroup heading="Workflows">
      {search.reading && search.found === null && (
        <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground">
          <Spinner className="size-3.5" />
          Reading workflows…
        </div>
      )}
      {search.found?.map((each) => (
        <CommandItem
          key={`${each.namespace}/${each.name}`}
          value={`${each.namespace} ${each.name}`}
          onSelect={() => {
            const href = workflowHref(each.namespace, each.name);
            onGo(href);
          }}
        >
          <WaypointsIcon />
          <span>{each.name}</span>
          <span className="text-muted-foreground">{each.namespace}</span>
          {each.on && (
            <span className="ml-auto text-xs text-emerald-600 dark:text-emerald-400">
              On
            </span>
          )}
        </CommandItem>
      ))}
    </CommandGroup>
  );
}
