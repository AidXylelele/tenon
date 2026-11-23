"use client";

import { useCallback, useEffect, useState } from "react";
import type { Problem } from "@/libs/data-access/problem";
import type { JsonValue } from "@/libs/json/json";
import { isUnended } from "@/operations/run-progress";
import type { DraftStore } from "./draft-store";
import type { TestRun, WorkflowName } from "./interfaces";
import { testRunOf } from "./reads";

const POLL_MS = 1000;

const MOST_MISSES = 3;

export type TestRunState =
  | { readonly kind: "idle" }
  | { readonly kind: "starting" }
  | {
      readonly kind: "refused";
      readonly reason: string;
      readonly problem: Problem | null;
    }
  | { readonly kind: "ran"; readonly test: TestRun };

const IDLE: TestRunState = { kind: "idle" };

const STARTING: TestRunState = { kind: "starting" };

const HELD =
  "The draft is not saved yet, so it was not tested; see the line under the title, then test again.";

export function useTestRun(name: WorkflowName, draft: DraftStore) {
  const [state, setState] = useState<TestRunState>(IDLE);
  const [misses, setMisses] = useState(0);
  const shown = state.kind === "ran" ? state.test : null;
  const id = shown?.run.id ?? null;
  const ended = shown === null || !isUnended(shown.run.phase);
  const lost = misses >= MOST_MISSES;

  useEffect(() => {
    let current = true;

    if (id === null || ended || lost) return;

    const timer = setTimeout(() => {
      testRunOf(name, id).then(
        (test) => {
          if (!current) return;

          setMisses(0);
          setState({ kind: "ran", test });
        },
        () => {
          if (current) setMisses((count) => count + 1);
        },
      );
    }, POLL_MS);

    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [name, id, ended, lost, misses, shown]);

  const run = useCallback(
    async (input: JsonValue) => {
      setState(STARTING);
      setMisses(0);
      const key = crypto.randomUUID();
      const answer = await draft.test(input, key);

      if (answer.kind === "held") {
        setState({ kind: "refused", reason: HELD, problem: null });
        return;
      }

      if (answer.kind === "refused") {
        const reason = answer.problem.detail;
        setState({ kind: "refused", reason, problem: answer.problem });
        return;
      }

      const test = { run: answer.run, records: [] };
      setState({ kind: "ran", test });
    },
    [draft],
  );

  const reset = useCallback(() => {
    setState(IDLE);
  }, []);

  const readAgain = useCallback(() => {
    setMisses(0);
  }, []);

  return { state, lost, run, reset, readAgain };
}
