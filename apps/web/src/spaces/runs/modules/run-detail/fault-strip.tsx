"use client";

import { CircleXIcon, CrosshairIcon, RotateCwIcon } from "lucide-react";
import type { Step } from "language-server/protocol";
import type { Instance } from "@/libs/data-access/types";
import { Link } from "@/libs/routing/link";
import { editorHref } from "@/libs/routing/routes";
import { Button } from "@/libs/ui/components/button";

interface FaultStripProps {
  readonly instance: Instance;
  readonly step: Step | null;
  readonly canEdit: boolean;
  readonly onShow: (step: string) => void;
}

const ADVICE = "Run again later, or add a retry to this step.";

export function FaultStrip({
  instance,
  step,
  canEdit,
  onShow,
}: FaultStripProps) {
  const error = instance.error;

  if (error === null) return null;

  const node = step?.id ?? null;
  const subject = step?.name ?? "The run";
  const why =
    error.detail ??
    error.title ??
    "the step raised an error the workflow did not handle";
  const retry = editorHref(instance.namespace, instance.name, node);

  return (
    <div className="px-4 pt-3 md:px-6">
      <div
        role="alert"
        className="flex flex-col gap-2 rounded-lg border border-destructive/40 bg-destructive-soft px-4 py-2.5 text-sm sm:flex-row sm:items-center sm:gap-4"
      >
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <CircleXIcon
            className="mt-0.5 size-4 shrink-0 text-destructive"
            aria-hidden
          />
          <p className="min-w-0">
            <strong className="font-semibold">{subject}</strong> failed: {why}.{" "}
            {ADVICE}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 pl-7 sm:pl-0">
          {canEdit && node !== null && (
            <Button variant="outline" size="sm" asChild>
              <Link href={retry}>
                <RotateCwIcon data-icon="inline-start" />
                Add a retry to this step
              </Link>
            </Button>
          )}
          {node !== null && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onShow(node);
              }}
            >
              <CrosshairIcon data-icon="inline-start" />
              Show the step
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
