"use client";

import type { Condition, Step } from "language-server/protocol";
import { useEffect, useState } from "react";
import type { JsonValue } from "@/libs/json/json";
import { pointerOf } from "@/libs/json/pointer";
import type { WorkflowSession } from "@/operations/workflow-language";
import type { ConditionWords } from "@/features/workflow-flow";
import { conditionWordsOf } from "./condition-builder";

interface RowsCase {
  readonly step: string;
  readonly name: string;
  readonly pointer: string;
  readonly condition: Condition;
}

interface WordedCase {
  readonly step: string;
  readonly name: string;
  readonly words: string | null;
}

type Samples = Readonly<Record<string, JsonValue>>;

const NO_WORDS: ConditionWords = new Map();

const NOTHING_TYPED = "";

export function useConditionWords(
  session: WorkflowSession,
  steps: readonly Step[],
  samples: Samples,
): ConditionWords {
  const [words, setWords] = useState(NO_WORDS);

  useEffect(() => {
    let current = true;
    const cases = steps.flatMap(rowsCasesOf);
    const asked = cases.map((each) => wordedCaseOf(session, each, samples));

    Promise.all(asked).then(
      (worded) => {
        if (current) setWords(wordsByStepOf(worded));
      },
      () => undefined,
    );

    return () => {
      current = false;
    };
  }, [session, steps, samples]);

  return words;
}

function rowsCasesOf(step: Step): readonly RowsCase[] {
  const cases = step.flow.filter((transition) => transition.on === "case");

  return cases.flatMap((transition, index) => {
    const reading = transition.condition;
    const name = transition.case ?? "";
    const keys = ["switch", String(index), name, "when"];
    const pointer = `${step.pointer}${pointerOf(keys)}`;

    if (reading?.kind !== "condition") return [];

    return [{ step: step.id, name, pointer, condition: reading.condition }];
  });
}

async function wordedCaseOf(
  session: WorkflowSession,
  rows: RowsCase,
  samples: Samples,
): Promise<WordedCase> {
  const { step, name, pointer, condition } = rows;
  const data = await session.dataAt(step, pointer, samples, NOTHING_TYPED);
  const words = conditionWordsOf(condition, data);

  return { step, name, words };
}

function wordsByStepOf(worded: readonly WordedCase[]): ConditionWords {
  const byStep = Map.groupBy(worded, (each) => each.step);
  const entries = [...byStep].map(
    ([step, cases]) => [step, caseWordsOf(cases)] as const,
  );

  return new Map(entries);
}

function caseWordsOf(
  cases: readonly WordedCase[],
): ReadonlyMap<string, string> {
  const entries = cases.flatMap((each) =>
    each.words === null ? [] : [[each.name, each.words] as const],
  );

  return new Map(entries);
}
