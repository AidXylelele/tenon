'use client';

import { CircleAlertIcon, CrosshairIcon, PencilIcon } from 'lucide-react';
import type { Instance } from '@/libs/data-access/types';
import type { JsonObject } from '@/libs/document-text/json';
import { Button } from '@/libs/ui/components/button';
import { Link } from '@/libs/routing/link';
import { isWithin } from '@/libs/document-text/json-pointer';
import { editorHref } from '@/operations/app-routes';
import {
  allEntries,
  protectorOf,
  type TaskEntry,
} from '@/operations/workflow-document';

interface FaultStripProps {
  readonly instance: Instance;
  readonly document: JsonObject | null;
  // Authors may open the workflow in the editor at the step.
  readonly canEdit: boolean;
  readonly onShow: (pointer: string) => void;
}

// Why a run faulted and what to do next (FR-033): the error, the step it came from, which the
// canvas shows when asked, and the editor opened at that step to fix it.
export function FaultStrip({
  instance,
  document,
  canEdit,
  onShow,
}: FaultStripProps) {
  const error = instance.error;

  if (error === null) return null;

  const step = document === null ? null : stepOf(document, error.instance);
  const node =
    step === null || document === null
      ? null
      : protectorOf(document, step.pointer);
  const kind = error.type.split('/').at(-1);
  const editor = editorHref(instance.namespace, instance.name, node);

  return (
    <section
      aria-label="Why the run faulted"
      className="flex flex-col gap-2 border-b bg-red-500/[0.06] px-4 py-2.5 text-sm sm:flex-row sm:items-center sm:gap-4 md:px-6"
    >
      <div className="flex min-w-0 flex-1 items-start gap-3" role="alert">
        <CircleAlertIcon className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" />
        <div className="min-w-0">
          <span className="font-medium text-red-700 dark:text-red-300">
            {error.title ?? 'The run faulted'}
            {step !== null && ` at ${step.name}`}
          </span>
          <span className="text-muted-foreground">
            {' '}
            {error.detail ??
              'The step raised an error the workflow did not handle.'}{' '}
            ({kind}, status {error.status})
          </span>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 pl-7 sm:pl-0">
        {node !== null && (
          <Button variant="outline" size="sm" onClick={() => onShow(node)}>
            <CrosshairIcon data-icon="inline-start" />
            Show the step
          </Button>
        )}
        {canEdit && (
          <Button variant="outline" size="sm" asChild>
            <Link href={editor}>
              <PencilIcon data-icon="inline-start" />
              Open in the editor
            </Link>
          </Button>
        )}
      </div>
    </section>
  );
}

// The step an error's pointer lies in: the deepest step whose pointer holds it.
function stepOf(
  document: JsonObject,
  pointer: string | null,
): TaskEntry | null {
  if (pointer === null) return null;

  const holding = allEntries(document)
    .map(({ entry }) => entry)
    .filter((entry) => isWithin(pointer, entry.pointer));
  return holding.at(-1) ?? null;
}
