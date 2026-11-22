"use client";

import { useId, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { Spinner } from "@/libs/ui/components/spinner";
import { Switch } from "@/libs/ui/components/switch";
import { turnAction } from "./actions";

interface OnOffSwitchProps {
  readonly namespace: string;
  readonly name: string;
  readonly on: boolean;
  readonly disabled: boolean;
}

export function OnOffSwitch({
  namespace,
  name,
  on,
  disabled,
}: OnOffSwitchProps) {
  const [shown, setShown] = useOptimistic(on);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const label = useId();
  const reason = useId();

  function turn(next: boolean) {
    setRefusal(null);
    start(async () => {
      setShown(next);
      const outcome = await turnAction(namespace, name, next);

      if (!outcome.ok) {
        setRefusal(outcome.problem.detail);
        return;
      }

      const done = next ? "Automatic starts on" : "Automatic starts off";
      toast.success(done);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {pending && <Spinner className="size-3.5 text-muted-foreground" />}
        <span id={label} className="text-sm font-medium">
          Automatic starts
        </span>
        <Switch
          checked={shown}
          onCheckedChange={turn}
          disabled={disabled || pending}
          aria-labelledby={label}
          aria-describedby={refusal === null ? undefined : reason}
        />
        <span className="w-6 text-sm text-muted-foreground">
          {shown ? "On" : "Off"}
        </span>
      </div>
      {refusal !== null && (
        <p id={reason} role="alert" className="text-sm text-destructive">
          {refusal}
        </p>
      )}
    </div>
  );
}
