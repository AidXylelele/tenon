"use client";

import { useCallback, useEffect, useState } from "react";
import type { Problem } from "@/libs/data-access/problem";
import type { JsonValue } from "@/libs/json/json";
import { isUnended } from "@/operations/run-progress";
import { testRunAction, testRunReadAction } from "./actions";
import type { DraftStore } from "./draft-store";
import type { TestRun, WorkflowName } from "./interfaces";

const POLL_MS = 1000;

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

const NOT_SAVED = "The draft could not be saved, so it was not tested.";

const SAVED_ELSEWHERE =
  "Someone else saved this draft meanwhile; resolve it, then test again.";

export function useTestRun(name: WorkflowName, draft: DraftStore) {
  const [state, setState] = useState<TestRunState>(IDLE);
  const shown = state.kind === "ran" ? state.test : null;
  const id = shown?.run.id ?? null;
  const ended = shown === null || !isUnended(shown.run.phase);

  useEffect(() => {
    let current = true;

    if (id === null || ended) return;

    const timer = setTimeout(() => {
      void testRunReadAction(id).then((test) => {
        if (current && test !== null) setState({ kind: "ran", test });
      });
    }, POLL_MS);

    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [id, ended, shown]);

  const run = useCallback(
    async (input: JsonValue) => {
      setState(STARTING);
      const etag = await draft.flush();

      if (etag === null) {
        setState({ kind: "refused", reason: NOT_SAVED, problem: null });
        return;
      }

      const request = { ...name, etag, input };
      const answer = await testRunAction(request);

      if (answer.kind === "conflict") {
        setState({ kind: "refused", reason: SAVED_ELSEWHERE, problem: null });
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
    [draft, name],
  );

  const reset = useCallback(() => {
    setState(IDLE);
  }, []);

  return { state, run, reset };
}
