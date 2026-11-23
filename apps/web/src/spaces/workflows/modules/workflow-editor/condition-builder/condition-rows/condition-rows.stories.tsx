import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { Comparison, Condition } from "language-server/protocol";
import { type ChangeEvent, useState } from "react";
import {
  conditionOf,
  draftOf,
  editsOf,
  rowProblemOf,
  withComparison,
  withRight,
} from "./draft";
import { COMPARISONS } from "./words";

interface RowProbeProps {
  readonly condition: Condition;
}

const POINTER = "/do/1/route/switch/0/paid/when";

function RowProbe({ condition }: RowProbeProps) {
  const [draft, setDraft] = useState(() => draftOf(condition));
  const [first] = draft.rows;
  const written = conditionOf(draft);
  const edits = editsOf(POINTER, draft);
  const problems = draft.rows.map(rowProblemOf);
  const shown = JSON.stringify(written, null, 2);
  const sent = JSON.stringify(edits, null, 2);

  function compare(event: ChangeEvent<HTMLSelectElement>) {
    const picked = COMPARISONS.find(
      (each) => each.comparison === event.target.value,
    );

    if (first === undefined || picked === undefined) return;

    const next = withComparison(draft, first.id, picked.comparison);
    setDraft(next);
  }

  function type(event: ChangeEvent<HTMLInputElement>) {
    if (first === undefined) return;

    const right = { kind: "value" as const, text: event.target.value };
    const next = withRight(draft, first.id, right);
    setDraft(next);
  }

  const comparison: Comparison = first?.comparison ?? "isNotEmpty";

  return (
    <section
      aria-label="Condition rows"
      className="flex w-[30rem] flex-col gap-3 p-4 text-sm"
    >
      <label className="flex flex-col gap-1">
        Comparison of the first row
        <select
          value={comparison}
          onChange={compare}
          className="rounded-md border px-2 py-1"
        >
          {COMPARISONS.map((each) => (
            <option key={each.comparison} value={each.comparison}>
              {each.words}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        Its second value
        <input onChange={type} className="rounded-md border px-2 py-1" />
      </label>
      <p>Problems: {problems.map((problem) => problem ?? "none").join(", ")}</p>
      <h2 className="font-semibold">Condition written</h2>
      <pre className="font-mono text-code">{shown}</pre>
      <h2 className="font-semibold">Edits sent</h2>
      <pre className="font-mono text-code">{sent}</pre>
    </section>
  );
}

const meta = {
  component: RowProbe,
  args: {
    condition: {
      join: "all",
      rows: [
        {
          left: ".status",
          comparison: "is",
          right: { kind: "value", value: "paid" },
        },
      ],
    },
  },
} satisfies Meta<typeof RowProbe>;

export default meta;

type Story = StoryObj<typeof meta>;

export const OneRow: Story = {};

export const NoRowYet: Story = {
  args: { condition: { join: "all", rows: [] } },
};
