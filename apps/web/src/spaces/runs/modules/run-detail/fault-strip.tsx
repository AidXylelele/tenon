"use client";

import { CircleXIcon, CrosshairIcon, PencilIcon } from "lucide-react";
import type { Step } from "language-server/protocol";
import type { Instance } from "@/libs/data-access/types";
import { Button } from "@/libs/ui/components/button";
import { Link } from "@/libs/routing/link";
import { editorHref } from "@/libs/routing/routes";

interface FaultStripProps {
  readonly instance: Instance;
  readonly step: Step | null;
  readonly canEdit: boolean;
  readonly onShow: (step: string) => void;
}

export function FaultStrip({
  instance,
  step,
  canEdit,
  onShow,
}: FaultStripProps) {
  const error = instance.error;

  if (error === null) return null;

  const node = step?.id ?? null;
  const kind = error.type.split("/").at(-1);
  const editor = editorHref(instance.namespace, instance.name, node);

  return (
    <section
      aria-label="Why the run faulted"
      className="flex flex-col gap-2 border-b bg-destructive-soft px-4 py-2.5 text-sm sm:flex-row sm:items-center sm:gap-4 md:px-6"
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <CircleXIcon
          className="mt-0.5 size-4 shrink-0 text-destructive"
          aria-hidden
        />
        <div className="min-w-0">
          <span className="font-medium text-destructive">
            {error.title ?? "The run faulted"}
            {step !== null && ` at ${step.name}`}
          </span>
          <span className="text-foreground">
            {" "}
            {error.detail ??
              "The task raised an error the workflow did not handle."}{" "}
            ({kind}, status {error.status})
          </span>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 pl-7 sm:pl-0">
        {node !== null && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onShow(node);
            }}
          >
            <CrosshairIcon data-icon="inline-start" />
            Show the task
          </Button>
        )}
        {canEdit && (
          <Button variant="outline" size="sm" asChild>
            <Link href={editor}>
              <PencilIcon data-icon="inline-start" />
              Open in editor
            </Link>
          </Button>
        )}
      </div>
    </section>
  );
}
