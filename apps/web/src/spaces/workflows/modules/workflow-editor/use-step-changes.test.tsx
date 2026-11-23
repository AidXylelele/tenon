import { act, renderHook } from "@testing-library/react";
import type { EditAction, Step, StepList } from "language-server/protocol";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { Announcer } from "@/libs/ui/composites/announcer";
import type { FlowHandle } from "@/features/workflow-flow";
import { useStepChanges } from "./use-step-changes";

const SAID = vi.hoisted(() => ({ list: [] as string[] }));

vi.mock("@/libs/ui/composites/announcer", () => ({
  Announcer: ({ children }: { readonly children: ReactNode }) => children,
  useAnnounce: () => (words: string) => {
    SAID.list.push(`said:${words}`);
  },
}));

function stepOf(name: string): Step {
  return {
    id: `/do/${name}`,
    pointer: `/do/0/${name}`,
    name,
    kind: "set",
    variant: null,
    family: "data",
    summary: null,
    milliseconds: null,
    note: null,
    range: null,
    selectionRange: null,
    lists: [],
    flow: [],
    catch: null,
  };
}

function listOf(steps: readonly Step[]): StepList {
  return { id: "/do", pointer: "/do", role: "sequence", steps };
}

const FETCH = stepOf("fetch");
const ADDED = stepOf("set");
const BEFORE = listOf([FETCH]);
const AFTER = listOf([FETCH, ADDED]);
const PLACE = { kind: "list", list: "/do", index: 1, above: "fetch" } as const;
const INSERT = { kind: "insertStep", variant: "set" } as const;

function setUp(answer: boolean) {
  SAID.list = [];
  const order = SAID.list;
  const edit = vi.fn((actions: readonly EditAction[]) => {
    order.push(`edit:${actions[0]?.kind ?? ""}`);
    return Promise.resolve(answer);
  });
  const select = vi.fn((target: string | null) => {
    order.push(`select:${String(target)}`);
  });
  const flow = {
    current: {
      focusAfterRemoving: vi.fn(),
      focusStep: vi.fn((step: string) => {
        order.push(`focus:${step}`);
      }),
    } satisfies FlowHandle,
  };
  const hook = renderHook(
    ({ steps }: { readonly steps: StepList }) =>
      useStepChanges({ steps, flow, edit, select }),
    { initialProps: { steps: BEFORE }, wrapper: Announcer },
  );
  return { hook, order, flow };
}

describe("adding and deleting steps", () => {
  it("an_added_step_is_announced_after_the_edit_then_selected_and_focused", async () => {
    const { hook, order } = setUp(true);

    await act(() => hook.result.current.choose(PLACE, INSERT));
    hook.rerender({ steps: AFTER });

    expect(order).toEqual([
      "edit:insertStep",
      "said:Step added",
      "select:/do/set",
      "focus:/do/set",
    ]);
  });

  it("a_refused_step_is_announced_as_refused_and_nothing_is_focused", async () => {
    const { hook, order } = setUp(false);

    await act(() => hook.result.current.choose(PLACE, INSERT));
    hook.rerender({ steps: AFTER });

    expect(order).toEqual(["edit:insertStep", "said:The step was not added"]);
  });

  it("a_deleted_step_is_announced_after_the_edit", async () => {
    const { hook, order, flow } = setUp(true);

    await act(() => hook.result.current.remove("/do/fetch"));

    expect(flow.current.focusAfterRemoving).toHaveBeenCalledWith("/do/fetch");
    expect(order).toEqual(["edit:removeStep", "said:Step deleted"]);
  });

  it("a_refused_deletion_is_announced_as_refused", async () => {
    const { hook, order } = setUp(false);

    await act(() => hook.result.current.remove("/do/fetch"));

    expect(order).toEqual(["edit:removeStep", "said:The step was not deleted"]);
  });
});
