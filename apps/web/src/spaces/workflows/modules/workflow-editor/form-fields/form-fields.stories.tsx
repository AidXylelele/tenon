import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { FormField, Step, StepFormResult } from "language-server/protocol";
import {
  failureOf,
  failureSummaryOf,
  formKindOf,
  layoutOf,
  pathOf,
  wordsOf,
} from ".";
import {
  FETCH_FORM,
  FETCH_STEP,
  HANDLING,
  POST_FORM,
  POST_STEP,
  REPORT_FORM,
  REPORT_INNER_STEP,
  RETRYING,
  SCRIPT_FORM,
  SCRIPT_STEP,
  SET_FORM,
  SET_STEP,
} from "./forms.test-support";

interface LayoutProbeProps {
  readonly step: Step;
  readonly form: StepFormResult;
  readonly protection: StepFormResult | null;
}

function LayoutProbe({ step, form, protection }: LayoutProbeProps) {
  const kind = formKindOf(step.kind, form.fields);
  const layout = layoutOf(form.fields, step);
  const failure = failureOf(step, form, protection);
  const summary = failureSummaryOf(failure);
  const sections = [
    { title: "Essential", fields: layout.essentials },
    { title: "More options", fields: layout.more },
    { title: "Data in and out", fields: layout.data },
    { title: "If this step fails", fields: layout.failure },
  ];
  const heading = `${step.name} — a ${kind} form`;

  function titleOf(field: FormField): string {
    const path = pathOf(field, step.pointer);
    const words = wordsOf(kind, path, field);
    return `${words.title} (${words.control}) · ${path}`;
  }

  return (
    <section aria-label={heading} className="flex flex-col gap-3 p-4 text-sm">
      <h2 className="font-semibold">{heading}</h2>
      {sections.map((section) => (
        <div key={section.title}>
          <h3 className="font-semibold">{section.title}</h3>
          <ul className="font-mono text-caption">
            {section.fields.map((field) => (
              <li key={field.pointer}>{titleOf(field)}</li>
            ))}
          </ul>
        </div>
      ))}
      <p>
        If it fails: <strong>{summary}</strong>, set on{" "}
        <code>{failure.target.step}</code>
      </p>
    </section>
  );
}

const meta = {
  component: LayoutProbe,
  args: { step: FETCH_STEP, form: FETCH_FORM, protection: null },
} satisfies Meta<typeof LayoutProbe>;

export default meta;

type Story = StoryObj<typeof meta>;

export const HttpGet: Story = {};

export const HttpPost: Story = {
  args: { step: POST_STEP, form: POST_FORM },
};

export const Script: Story = {
  args: { step: SCRIPT_STEP, form: SCRIPT_FORM },
};

export const SetData: Story = {
  args: { step: SET_STEP, form: SET_FORM },
};

export const RetriedByItsTry: Story = {
  args: { step: REPORT_INNER_STEP, form: REPORT_FORM, protection: RETRYING },
};

export const HandledByItsTry: Story = {
  args: { step: REPORT_INNER_STEP, form: REPORT_FORM, protection: HANDLING },
};
