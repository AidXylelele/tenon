import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Field, FieldLabel } from "../components/field";
import { Input } from "../components/input";
import { Disclosure } from "./disclosure";

function StepFormEnd({ open }: { readonly open: boolean }) {
  return (
    <div className="flex max-w-md flex-col gap-4 p-6">
      <Disclosure
        title="More options"
        summary="Waits for the result · prints JSON"
        defaultOpen={open}
      >
        <Field>
          <FieldLabel htmlFor="stdin">Standard input</FieldLabel>
          <Input id="stdin" />
        </Field>
      </Disclosure>
      <Disclosure title="If this step fails" summary="Stop the run">
        <p>Retry it, or go on with another step.</p>
      </Disclosure>
      <Disclosure title="Data in and out" summary="The answer as is">
        <p>Choose what the step takes and what it gives.</p>
      </Disclosure>
    </div>
  );
}

const meta = {
  title: "Design system/Components/Disclosure",
  component: StepFormEnd,
} satisfies Meta<typeof StepFormEnd>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Closed: Story = { args: { open: false } };

export const Open: Story = { args: { open: true } };
