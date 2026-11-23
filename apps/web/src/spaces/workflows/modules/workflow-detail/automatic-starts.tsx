"use client";

import { useId, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { Spinner } from "@/libs/ui/components/spinner";
import { Switch } from "@/libs/ui/components/switch";
import { turnAction } from "./actions";

interface AutomaticStartsProps {
  readonly namespace: string;
  readonly name: string;
  readonly on: boolean;
  readonly disabled: boolean;
}

export function AutomaticStarts({
  namespace,
  name,
  on,
  disabled,
}: AutomaticStartsProps) {
  const [shown, setShown] = useOptimistic(on);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const label = useId();
  const reason = useId();
  const state = shown ? "On" : "Off";

  function turn(next: boolean) {
    setRefusal(null);
    start(async () => {
      setShown(next);
      const outcome = await turnAction(namespace, name, next);

      if (!outcome.ok) {
        setRefusal(outcome.problem.detail);
        return;
      }

      const done = next
        ? `Automatic starts turned on for ${name}`
        : `Automatic starts turned off for ${name}`;
      const undo = {
        label: "Undo",
        onClick: () => {
          turn(!next);
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
          onCheckedChange={turn}
          disabled={disabled || pending}
          aria-labelledby={label}
          aria-describedby={refusal === null ? undefined : reason}
        />
        <span id={label} className="text-body font-semibold">
          Starts automatically
        </span>
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
