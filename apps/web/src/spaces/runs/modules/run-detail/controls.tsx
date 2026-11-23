"use client";

import {
  CircleStopIcon,
  CopyIcon,
  EllipsisIcon,
  PauseIcon,
  PlayIcon,
  RotateCcwIcon,
  Trash2Icon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { InstanceControl } from "@/libs/data-access/automation";
import type { Control } from "@/libs/data-access/types";
import { runHref, RUNS_HREF } from "@/libs/routing/routes";
import { Button } from "@/libs/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/libs/ui/components/dropdown-menu";
import { Spinner } from "@/libs/ui/components/spinner";
import { ConfirmAction } from "@/libs/ui/composites/confirm-action";
import { controlAction, deleteAction, restartAction } from "./actions";

type Confirmed = "cancel" | "delete";

export function Controls({
  id,
  controls,
}: {
  readonly id: string;
  readonly controls: readonly Control[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [refusal, setRefusal] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<Confirmed | null>(null);
  const allowed = new Set(controls);
  const cancel = controlAction.bind(null, id, "cancel");
  const remove = deleteAction.bind(null, id);
  const cancelling = confirming === "cancel";
  const deleting = confirming === "delete";
  const onCancelling = keepOpen("cancel");
  const onDeleting = keepOpen("delete");

  function keepOpen(kind: Confirmed) {
    return (open: boolean) => {
      setConfirming(open ? kind : null);
    };
  }

  function control(kind: InstanceControl, done: string) {
    setRefusal(null);
    start(async () => {
      const outcome = await controlAction(id, kind);

      if (!outcome.ok) {
        setRefusal(outcome.problem.detail);
        return;
      }

      toast.success(done);
    });
  }

  function runAgain() {
    setRefusal(null);
    start(async () => {
      const outcome = await restartAction(id);

      if (!outcome.ok) {
        setRefusal(outcome.problem.detail);
        return;
      }

      toast.success("Started again with the same version and input");
      const again = runHref(outcome.value.id);
      router.push(again);
    });
  }

  async function copyId() {
    try {
      await navigator.clipboard.writeText(id);
      toast.success("Run ID copied");
    } catch {
      setRefusal("The browser did not let the run ID be copied");
    }
  }

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <div className="flex flex-wrap items-center gap-2">
        {pending && <Spinner className="text-muted-foreground" />}
        {allowed.has("resume") && (
          <Button
            disabled={pending}
            onClick={() => {
              control("resume", "Resumed");
            }}
          >
            <PlayIcon data-icon="inline-start" />
            Resume
          </Button>
        )}
        {allowed.has("restart") && (
          <Button disabled={pending} onClick={runAgain}>
            <RotateCcwIcon data-icon="inline-start" />
            Run again
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="More actions"
              title="More actions"
            >
              <EllipsisIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" aria-label="More actions">
            {allowed.has("suspend") && (
              <DropdownMenuItem
                disabled={pending}
                onSelect={() => {
                  control("suspend", "Paused: it waits until resumed");
                }}
              >
                <PauseIcon />
                Pause
              </DropdownMenuItem>
            )}
            {allowed.has("cancel") && (
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => {
                  setConfirming("cancel");
                }}
              >
                <CircleStopIcon />
                Cancel run…
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={copyId}>
              <CopyIcon />
              Copy run ID
            </DropdownMenuItem>
            {allowed.has("delete") && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => {
                    setConfirming("delete");
                  }}
                >
                  <Trash2Icon />
                  Delete run…
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <ConfirmAction
        icon={<CircleStopIcon data-icon="inline-start" />}
        label="Cancel run"
        title="Cancel this run?"
        description="Steps already done are not undone. A cancelled run does not resume."
        actionLabel="Cancel run"
        action={cancel}
        success="Cancelled"
        open={cancelling}
        onOpenChange={onCancelling}
      />
      <ConfirmAction
        icon={<Trash2Icon data-icon="inline-start" />}
        label="Delete run"
        title="Delete this run?"
        description="Its record, tasks and events are removed for good."
        actionLabel="Delete run"
        action={remove}
        success="Run deleted"
        onDone={() => {
          router.push(RUNS_HREF);
        }}
        open={deleting}
        onOpenChange={onDeleting}
      />
      {refusal !== null && (
        <p role="alert" className="text-sm text-destructive">
          {refusal}
        </p>
      )}
    </div>
  );
}
