"use client";

import {
  CircleStopIcon,
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
import { Spinner } from "@/libs/ui/components/spinner";
import { ConfirmAction } from "@/libs/ui/composites/confirm-action";
import { controlAction, deleteAction, restartAction } from "./actions";

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
  const allowed = new Set(controls);

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

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <div className="flex flex-wrap items-center gap-2">
        {pending && <Spinner className="text-muted-foreground" />}
        {allowed.has("suspend") && (
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => {
              control("suspend", "Suspended: it waits until resumed");
            }}
          >
            <PauseIcon data-icon="inline-start" />
            Suspend
          </Button>
        )}
        {allowed.has("resume") && (
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => {
              control("resume", "Resumed");
            }}
          >
            <PlayIcon data-icon="inline-start" />
            Resume
          </Button>
        )}
        {allowed.has("cancel") && (
          <ConfirmAction
            icon={<CircleStopIcon data-icon="inline-start" />}
            label="Cancel run"
            title="Cancel this run?"
            description="It stops where it is, with the runs it waits for. A cancelled run does not resume."
            actionLabel="Cancel run"
            action={controlAction.bind(null, id, "cancel")}
            success="Cancelled"
          />
        )}
        {allowed.has("restart") && (
          <Button disabled={pending} onClick={runAgain}>
            <RotateCcwIcon data-icon="inline-start" />
            Run again
          </Button>
        )}
        {allowed.has("delete") && (
          <ConfirmAction
            icon={<Trash2Icon data-icon="inline-start" />}
            label="Delete run"
            title="Delete this run?"
            description="Its record, tasks and events are removed for good."
            actionLabel="Delete run"
            action={deleteAction.bind(null, id)}
            success="Run deleted"
            onDone={() => {
              router.push(RUNS_HREF);
            }}
          />
        )}
      </div>
      {refusal !== null && (
        <p role="alert" className="text-sm text-destructive">
          {refusal}
        </p>
      )}
    </div>
  );
}
