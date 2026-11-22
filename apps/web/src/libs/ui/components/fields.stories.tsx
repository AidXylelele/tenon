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

export const SelectOpen: Story = {
  render: () => (
    <div className="max-w-sm p-6">
      <Field>
        <FieldLabel htmlFor="method-open">Method</FieldLabel>
        <Select defaultValue="post" defaultOpen>
          <SelectTrigger id="method-open" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="get">GET</SelectItem>
            <SelectItem value="post">POST</SelectItem>
            <SelectItem value="put">PUT</SelectItem>
          </SelectContent>
        </Select>
      </Field>
    </div>
  ),
};

export const Invalid: Story = {
  render: () => (
    <div className="flex max-w-sm flex-col gap-6 p-6">
      <Field data-invalid>
        <FieldLabel htmlFor="schedule">Schedule</FieldLabel>
        <Input
          id="schedule"
          aria-invalid
          aria-describedby="schedule-error"
          defaultValue="0 9 * *"
        />
        <FieldError id="schedule-error">
          A schedule has five parts: minute, hour, day, month and weekday.
        </FieldError>
      </Field>
      <Field data-invalid>
        <FieldLabel htmlFor="region">Region</FieldLabel>
        <Select>
          <SelectTrigger
            id="region"
            aria-invalid
            aria-describedby="region-error"
            className="w-full"
          >
            <SelectValue placeholder="Choose a region" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="eu">Europe</SelectItem>
          </SelectContent>
        </Select>
        <FieldError id="region-error">Choose where the runs happen.</FieldError>
      </Field>
      <Field data-invalid>
        <FieldLabel htmlFor="payload">Body</FieldLabel>
        <Textarea
          id="payload"
          aria-invalid
          aria-describedby="payload-error"
          defaultValue="{ items: }"
        />
        <FieldError id="payload-error">The body is not valid JSON.</FieldError>
      </Field>
    </div>
  ),
};
