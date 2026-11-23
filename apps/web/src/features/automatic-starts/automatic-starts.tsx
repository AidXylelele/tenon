"use client";

import { useId, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { Spinner } from "@/libs/ui/components/spinner";
import { Switch } from "@/libs/ui/components/switch";
import type { AutomaticStartsProps } from "./interfaces";

export function AutomaticStarts({
  workflow,
  on,
  disabled = false,
  labelled = false,
  turn,
}: AutomaticStartsProps) {
  const [shown, setShown] = useOptimistic(on);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const label = useId();
  const reason = useId();
  const state = shown ? "On" : "Off";
  const named = labelled ? undefined : `${workflow} starts automatically`;

  function change(next: boolean) {
    setRefusal(null);
    start(async () => {
      setShown(next);
      const outcome = await turn(next);

      if (!outcome.ok) {
        setRefusal(outcome.problem.detail);
        return;
      }

      const done = next
        ? `Automatic starts turned on for ${workflow}`
        : `Automatic starts turned off for ${workflow}`;
      const undo = {
        label: "Undo",
        onClick: () => {
          change(!next);
        },
      };
      toast.success(done, { duration: Infinity, action: undo });
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Switch
          checked={shown}
          onCheckedChange={change}
          disabled={disabled || pending}
          aria-label={named}
          aria-labelledby={labelled ? label : undefined}
          aria-describedby={refusal === null ? undefined : reason}
        />
        {labelled && (
          <span id={label} className="text-body font-semibold">
            Starts automatically
          </span>
        )}
        <span className="text-body text-muted-foreground">{state}</span>
        {pending && <Spinner className="size-4 text-muted-foreground" />}
      </div>
      {refusal !== null && (
        <p id={reason} role="alert" className="text-caption text-destructive">
          {refusal}
        </p>
      )}
    </div>
  );
}
