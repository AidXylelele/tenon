import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { WorkflowStructure } from "language-server/protocol";
import { type ReactNode, useState } from "react";
import { fn } from "storybook/test";
import { TooltipProvider } from "@/libs/ui/components/tooltip";
import {
  type ConditionWords,
  type EditMode,
  type FlowMode,
  type RunMode,
  type RunStart,
  type StepMark,
  type StepRun,
  WorkflowFlow,
} from ".";
import {
  DRAFT_DIGEST,
  DAILY_DIGEST,
  EMPTY_REPEAT,
  MONTH_END,
  NEW_WORKFLOW,
  ORDER_ROUTER,
  PARALLEL_CHECKS,
  ranFor,
} from "./workflows.test-support";

interface FlowStoryProps {
  readonly workflow: WorkflowStructure;
  readonly mode: FlowMode;
  readonly selected: string | null;
  readonly selectable: boolean;
}

const EDITOR_CANVAS_AT_1024 = { width: 608, height: 720 };

const SEND = "/do/For each invoice/do/Send the invoice";

const BY_HAND: RunStart = {
  trigger: "manual",
  detail: "Administrator · the workflow also runs every day at 09:00 UTC",
};

const BY_EVENT: RunStart = {
  trigger: "event",
  detail: "com.acme.order.paid · order 4182",
};

const SEND_TIMES = ["140 ms", "151 ms", "150 ms"];

function FlowStory({ workflow, mode, selected, selectable }: FlowStoryProps) {
  const [shown, setShown] = useState(selected);
  const choose = fn((target: string | null) => {
    setShown(target);
  });
  const onSelect = selectable ? choose : undefined;

  return (
    <WorkflowFlow
      workflow={workflow}
      mode={mode}
      selected={shown}
      onSelect={onSelect}
    />
  );
}

function RepeatStory() {
  const [shown, setShown] = useState(3);
  const time = SEND_TIMES[shown - 1] ?? null;
  const steps = new Map<string, StepRun>([
    ...BATCH_RUN,
    [SEND, ranFor(time)],
    [
      "/do/For each invoice",
      {
        ...ranFor("3 iterations · 441 ms"),
        iteration: { shown, count: 3 },
      },
    ],
  ]);
  const mode = running(steps, true, (_, iteration) => {
    setShown(iteration);
  });

  return (
    <FlowStory workflow={MONTH_END} mode={mode} selected={null} selectable />
  );
}

const ORDER_WORDS: ConditionWords = new Map([
  [
    "/do/Which kind?",
    new Map([
      ["A licence", "Read the order › kind is “licence”"],
      ["A parcel", "Read the order › kind is “parcel”"],
    ]),
  ],
]);

function editing(
  marks: ReadonlyMap<string, StepMark> = new Map(),
  conditions: ConditionWords = new Map(),
): EditMode {
  return {
    kind: "edit",
    marks,
    inserting: null,
    onInsert: fn(),
    conditions,
    languageTerms: false,
  };
}

function running(
  steps: ReadonlyMap<string, StepRun>,
  ended: boolean,
  onIteration: RunMode["onIteration"] = fn(),
  start: RunStart = BY_HAND,
): RunMode {
  return {
    kind: "run",
    start,
    steps,
    ended,
    onIteration,
  };
}

function Frame({ children }: { readonly children: ReactNode }) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="h-screen">{children}</div>
    </TooltipProvider>
  );
}

function NarrowFrame({ children }: { readonly children: ReactNode }) {
  return (
    <TooltipProvider delayDuration={300}>
      <div style={EDITOR_CANVAS_AT_1024} className="border">
        {children}
      </div>
    </TooltipProvider>
  );
}

const BATCH_RUN: readonly (readonly [string, StepRun])[] = [
  ["/do/Prepare the batch", ranFor("214 ms")],
  ["/do/Prepare the batch/do/Fetch the invoices", ranFor("212 ms")],
  ["/do/Prepare the batch/do/Add up the totals", ranFor("0 ms")],
  ["/do/Tell finance", ranFor("233 ms")],
  ["/do/Tell finance/fork/branches/Email", ranFor("233 ms")],
  [
    "/do/Tell finance/fork/branches/Email/do/Email the summary",
    ranFor("233 ms"),
  ],
  ["/do/Tell finance/fork/branches/Chat", ranFor("198 ms")],
  [
    "/do/Tell finance/fork/branches/Chat/do/Post to the channel",
    ranFor("198 ms"),
  ],
  ["/do/Archive the batch", ranFor("after 2 attempts · 2.3 s")],
  [
    "/do/Archive the batch/try/Upload the archive",
    ranFor("attempt 2 of 3 · 171 ms"),
  ],
];

const meta = {
  component: FlowStory,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <Frame>
        <Story />
      </Frame>
    ),
  ],
} satisfies Meta<typeof FlowStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const EditWithProblems: Story = {
  args: {
    workflow: DRAFT_DIGEST,
    mode: editing(
      new Map<string, StepMark>([
        [
          "/do/Post the items",
          {
            kind: "problem",
            count: 1,
            message: "the address is missing",
            missing: "address",
          },
        ],
        [
          "/do/Pause before the next digest",
          { kind: "fill", missing: "duration" },
        ],
      ]),
    ),
    selected: "/do/Post the items",
    selectable: true,
  },
};

export const EmptyWorkflow: Story = {
  args: {
    workflow: NEW_WORKFLOW,
    mode: editing(),
    selected: null,
    selectable: true,
  },
};

export const Blocks: Story = {
  args: {
    workflow: MONTH_END,
    mode: editing(),
    selected: null,
    selectable: true,
  },
};

export const EmptyBlock: Story = {
  args: {
    workflow: EMPTY_REPEAT,
    mode: editing(),
    selected: "/do/For each order",
    selectable: true,
  },
};

export const BranchesAndJumps: Story = {
  args: {
    workflow: ORDER_ROUTER,
    mode: editing(new Map(), ORDER_WORDS),
    selected: "/do/Which kind?",
    selectable: true,
  },
};

export const RunFailed: Story = {
  args: {
    workflow: DAILY_DIGEST,
    mode: running(
      new Map<string, StepRun>([
        ["/do/Fetch the digest", ranFor("189 ms")],
        [
          "/do/Has items?",
          { ...ranFor("0 ms"), branch: "If the answer has items" },
        ],
        ["/do/Post the items", ranFor("171 ms", "faulted")],
      ]),
      false,
    ),
    selected: "/do/Post the items",
    selectable: true,
  },
};

export const RunWithIterations: Story = {
  args: {
    workflow: MONTH_END,
    mode: running(new Map(), true),
    selected: null,
    selectable: true,
  },
  render: () => <RepeatStory />,
};

export const RunInProgress: Story = {
  args: {
    workflow: ORDER_ROUTER,
    mode: running(
      new Map<string, StepRun>([
        ["/do/Read the order", ranFor("2 ms")],
        ["/do/Which kind?", { ...ranFor("0 ms"), branch: "A parcel" }],
        ["/do/Book the courier", ranFor("412 ms")],
        ["/do/Booked?", { ...ranFor("0 ms"), branch: "Not yet" }],
        ["/do/Wait a minute", ranFor("for 41 s", "running")],
      ]),
      false,
      fn(),
      BY_EVENT,
    ),
    selected: null,
    selectable: true,
  },
};

export const WideForkAt1024: Story = {
  args: {
    workflow: PARALLEL_CHECKS,
    mode: editing(),
    selected: null,
    selectable: true,
  },
  decorators: [
    (Story) => (
      <NarrowFrame>
        <Story />
      </NarrowFrame>
    ),
  ],
};

export const VersionReadOnly: Story = {
  args: {
    workflow: ORDER_ROUTER,
    mode: { kind: "read" },
    selected: null,
    selectable: false,
  },
};
