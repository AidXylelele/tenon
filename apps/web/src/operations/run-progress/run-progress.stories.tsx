import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { Phase, Trigger } from "@/libs/data-access/types";
import type { StepState } from "./interfaces";
import {
  PHASES,
  phaseLabel,
  startedBy,
  stepStateLabel,
  triggerLabel,
} from "./vocabulary";

const STEP_ONLY: readonly StepState[] = ["retrying", "skipped", "not-reached"];

const TRIGGERS: readonly Trigger[] = [
  "manual",
  "schedule",
  "event",
  "parent",
  "detached",
  "restart",
];

function Row({
  term,
  words,
}: {
  readonly term: string;
  readonly words: readonly string[];
}) {
  return (
    <tr>
      <td className="pr-4 font-mono">{term}</td>
      {words.map((word) => (
        <td key={word} className="pr-4">
          {word}
        </td>
      ))}
    </tr>
  );
}

function PhaseRow({ phase }: { readonly phase: Phase }) {
  const words = [phaseLabel(phase)];

  return <Row term={phase} words={words} />;
}

function StateRow({ state }: { readonly state: StepState }) {
  const words = [stepStateLabel(state)];

  return <Row term={state} words={words} />;
}

function TriggerRow({ trigger }: { readonly trigger: Trigger }) {
  const words = [triggerLabel(trigger), startedBy(trigger)];

  return <Row term={trigger} words={words} />;
}

function Words() {
  return (
    <div className="flex flex-col gap-6 p-4 text-sm">
      <table className="w-fit">
        <caption className="pb-2 text-left font-semibold">
          A run&apos;s phase
        </caption>
        <tbody>
          {PHASES.map((phase: Phase) => (
            <PhaseRow key={phase} phase={phase} />
          ))}
        </tbody>
      </table>
      <table className="w-fit">
        <caption className="pb-2 text-left font-semibold">
          A step&apos;s state beyond the phases
        </caption>
        <tbody>
          {STEP_ONLY.map((state) => (
            <StateRow key={state} state={state} />
          ))}
        </tbody>
      </table>
      <table className="w-fit">
        <caption className="pb-2 text-left font-semibold">
          How a run started
        </caption>
        <tbody>
          {TRIGGERS.map((trigger) => (
            <TriggerRow key={trigger} trigger={trigger} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

const meta = {
  component: Words,
} satisfies Meta<typeof Words>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ConsoleWords: Story = {};
