"use client";

import { useId } from "react";
import { Spinner } from "@/libs/ui/components/spinner";
import { Switch } from "@/libs/ui/components/switch";
import { useAutomaticStarts } from "./use-automatic-starts";

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
  const { shown, pending, refusal, turn } = useAutomaticStarts(
    namespace,
    name,
    on,
  );
  const label = useId();
  const reason = useId();
  const state = shown ? "On" : "Off";

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
