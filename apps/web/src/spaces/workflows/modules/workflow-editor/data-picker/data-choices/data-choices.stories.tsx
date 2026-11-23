import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { DataAtResult } from "language-server/protocol";
import { type ChangeEvent, useState } from "react";
import { choicesOf } from ".";
import {
  AFTER_A_TEST,
  AFTER_FETCH,
  AT_AN_ADDRESS,
  FIRST_STEP,
  IN_A_LOOP,
} from "./data.test-support";

interface ChoicesProbeProps {
  readonly data: DataAtResult;
  readonly onlyPaths: boolean;
}

function ChoicesProbe({ data, onlyPaths }: ChoicesProbeProps) {
  const [query, setQuery] = useState("");
  const choices = choicesOf(data, query, onlyPaths);
  const count = `${String(choices.count)} pieces of data`;

  function search(event: ChangeEvent<HTMLInputElement>) {
    setQuery(event.target.value);
  }

  return (
    <section
      aria-label="Data choices"
      className="flex w-[28rem] flex-col gap-3 p-4 text-sm"
    >
      <input
        aria-label="Find data, or type a field name"
        placeholder="Find data, or type a field name"
        value={query}
        onChange={search}
        className="rounded-md border px-3 py-2"
      />
      <p role="status">{count}</p>
      {choices.groups.map((group) => (
        <div key={group.id}>
          <h2 className="font-semibold">{group.title}</h2>
          <ul>
            {group.choices.map((choice) => (
              <li key={choice.id}>
                {choice.label} · {choice.shape} ·{" "}
                <code className="font-mono">{choice.value}</code>
                {choice.export !== null && ` · exports ${choice.export}`}
              </li>
            ))}
          </ul>
          {group.note !== null && <p className="text-caption">{group.note}</p>}
        </div>
      ))}
      {choices.notes.map((note) => (
        <p key={note} className="text-caption">
          {note}
        </p>
      ))}
    </section>
  );
}

const meta = {
  component: ChoicesProbe,
  args: { data: AFTER_FETCH, onlyPaths: false },
} satisfies Meta<typeof ChoicesProbe>;

export default meta;

type Story = StoryObj<typeof meta>;

export const BeforeATest: Story = {};

export const AfterATest: Story = {
  args: { data: AFTER_A_TEST },
};

export const FirstStep: Story = {
  args: { data: FIRST_STEP },
};

export const AtAnAddress: Story = {
  args: { data: AT_AN_ADDRESS },
};

export const InALoopOnlyPaths: Story = {
  args: { data: IN_A_LOOP, onlyPaths: true },
};
