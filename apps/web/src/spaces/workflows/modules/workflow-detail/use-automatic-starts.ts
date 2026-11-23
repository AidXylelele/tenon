"use client";

import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { turnAction } from "./actions";

interface AutomaticStarts {
  readonly shown: boolean;
  readonly pending: boolean;
  readonly refusal: string | null;
  readonly turn: (next: boolean) => void;
}

export function useAutomaticStarts(
  namespace: string,
  name: string,
  on: boolean,
): AutomaticStarts {
  const [shown, setShown] = useOptimistic(on);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function turn(next: boolean) {
    setRefusal(null);
    start(async () => {
      setShown(next);
      const outcome = await turnAction(namespace, name, next);

      if (!outcome.ok) {
        setRefusal(outcome.problem.detail);
        toast.error(outcome.problem.detail);
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

  return { shown, pending, refusal, turn };
}
