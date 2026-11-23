"use client";

import type {
  EditAction,
  StepList,
  StepVariant,
} from "language-server/protocol";
import { type RefObject, useEffect, useRef, useState } from "react";
import { useAnnounce } from "@/libs/ui/composites/announcer";
import {
  type FlowHandle,
  type InsertPlace,
  listsOf,
  placeOf,
} from "@/features/workflow-flow";
import type { EntryAction } from "./step-catalog";

interface StepChangesProps {
  readonly steps: StepList | null;
  readonly flow: RefObject<FlowHandle | null>;
  readonly edit: (actions: readonly EditAction[]) => Promise<boolean>;
  readonly select: (target: string | null) => void;
}

interface PendingStep {
  readonly list: string;
  readonly index: number;
  readonly known: ReadonlySet<string>;
}

type Insertion = Extract<EntryAction, { readonly kind: "insertStep" }>;

export function useStepChanges({
  steps,
  flow,
  edit,
  select,
}: StepChangesProps) {
  const announce = useAnnounce();
  const pending = useRef<PendingStep | null>(null);
  const [asked, setAsked] = useState(0);

  useEffect(() => {
    const waiting = pending.current;

    if (waiting === null || steps === null) return;

    const added = addedStepOf(steps, waiting);

    if (added === null) return;

    pending.current = null;
    select(added);
    flow.current?.focusStep(added);
  }, [steps, asked, select, flow]);

  async function choose(place: InsertPlace, action: Insertion) {
    if (steps === null) return;

    const waiting = pendingOf(steps, place);
    const inserted = insertionOf(place, action.variant);
    const done = await edit([inserted]);

    if (!done) {
      announce("The step was not added");
      return;
    }

    announce("Step added");
    pending.current = waiting;
    setAsked((count) => count + 1);
  }

  async function remove(step: string) {
    flow.current?.focusAfterRemoving(step);
    const done = await edit([{ kind: "removeStep", step }]);
    const words = done ? "Step deleted" : "The step was not deleted";
    announce(words);
  }

  return { choose, remove };
}

function pendingOf(steps: StepList, place: InsertPlace): PendingStep | null {
  const at =
    place.kind === "list"
      ? { list: place.list, index: place.index }
      : afterSwitchOf(steps, place.switch);

  if (at === null) return null;

  const list = listsOf(steps).find((each) => each.id === at.list);
  const ids = list?.steps.map((step) => step.id) ?? [];
  return { ...at, known: new Set(ids) };
}

function afterSwitchOf(
  steps: StepList,
  id: string,
): { readonly list: string; readonly index: number } | null {
  const switched = placeOf(steps, id);

  if (switched === null) return null;

  return { list: switched.list, index: switched.index + 1 };
}

function addedStepOf(steps: StepList, waiting: PendingStep): string | null {
  const list = listsOf(steps).find((each) => each.id === waiting.list);
  const added = list?.steps[waiting.index] ?? null;

  if (added === null || waiting.known.has(added.id)) return null;

  return added.id;
}

function insertionOf(place: InsertPlace, variant: StepVariant): EditAction {
  if (place.kind === "branch")
    return {
      kind: "insertStepOnBranch",
      switch: place.switch,
      case: place.case,
      step: variant,
      name: null,
    };

  return {
    kind: "insertStep",
    list: place.list,
    index: place.index,
    step: variant,
    name: null,
  };
}
