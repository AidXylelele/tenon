import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Field, FieldDescription, FieldError, FieldLabel } from "./field";
import { Input } from "./input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";
import { Textarea } from "./textarea";

function FieldStates() {
  return (
    <div className="grid max-w-3xl grid-cols-2 gap-6 p-6">
      <Field>
        <FieldLabel htmlFor="address">Address</FieldLabel>
        <FieldDescription>The URL the step calls.</FieldDescription>
        <Input id="address" placeholder="https://api.example.com/orders" />
      </Field>
      <Field data-invalid>
        <FieldLabel htmlFor="address-invalid">Address</FieldLabel>
        <Input
          id="address-invalid"
          aria-invalid
          aria-describedby="address-error"
          defaultValue="api.example.com"
        />
        <FieldError id="address-error">
          Enter the address with https://, for example https://api.example.com
        </FieldError>
      </Field>
      <Field>
        <FieldLabel htmlFor="disabled">Workflow name</FieldLabel>
        <Input id="disabled" disabled defaultValue="sales/order-router" />
      </Field>
      <Field>
        <FieldLabel htmlFor="method">Method</FieldLabel>
        <Select defaultValue="get">
          <SelectTrigger id="method" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="get">GET</SelectItem>
            <SelectItem value="post">POST</SelectItem>
            <SelectItem value="put">PUT</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field className="col-span-2">
        <FieldLabel htmlFor="body">Body</FieldLabel>
        <Textarea id="body" placeholder='{ "items": [] }' />
      </Field>
    </div>
  );
}

const meta = {
  title: "Design system/Components/Fields",
  component: FieldStates,
} satisfies Meta<typeof FieldStates>;

export default meta;

type Story = StoryObj<typeof meta>;

export const States: Story = {};

export const Focused: Story = {
  render: () => (
    <div className="max-w-sm p-6">
      <Field>
        <FieldLabel htmlFor="focused">Address</FieldLabel>
        <Input id="focused" autoFocus placeholder="https://" />
      </Field>
    </div>
  ),
};
